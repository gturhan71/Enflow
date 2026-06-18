import { prisma } from '../prismaClient';

/**
 * Tüm birimleri kapsayan varsayılan iş akışı şablonu.
 *
 * Sıra ve adım tanımları Enflow'a özgüdür; üçüncü taraf doküman/notasyon
 * içermez. Birimler tenant'ın kendi `Unit` kayıtlarından, ad üzerinden
 * keyword eşleşmesiyle türetilir — böylece her tenant kendi birim
 * adlandırmasını kullanabilir. Eşleşmeyen birimler akışın sonuna eklenir.
 */
interface CanonicalStep {
  /** Birim adında aranan anahtar kelimeler (küçük harf, biri eşleşmeli). */
  match: string[];
  description: string;
  type: 'AUTO' | 'MANUAL';
  requiresCompletion: boolean;
  completionNote?: string;
}

export const DEFAULT_WORKFLOW_STEPS: CanonicalStep[] = [
  {
    match: ['satış', 'pazarlama', 'crm'],
    description: 'Fırsat yönetimi ve ilk değerlendirme',
    type: 'AUTO',
    requiresCompletion: false,
  },
  {
    match: ['teknik', 'presales', 'çözüm'],
    description: 'Teknik analiz, BoM ve maliyet hazırlığı',
    type: 'AUTO',
    requiresCompletion: true,
    completionNote: 'BoM ve maliyet analizi tamamlanmış olmalı',
  },
  {
    match: ['finans'],
    description: 'Finansal değerlendirme ve onay',
    type: 'MANUAL',
    requiresCompletion: true,
    completionNote: 'Maliyet/marj onayı verilmiş olmalı',
  },
  {
    match: ['igpd', 'iş geliştirme'],
    description: 'İş geliştirme ve pazarlama onayı',
    type: 'MANUAL',
    requiresCompletion: true,
    completionNote: 'İGPD değerlendirmesi tamamlanmış olmalı',
  },
  {
    match: ['üst yönetim', 'gmü', 'genel müdür'],
    description: 'Üst yönetim onayı',
    type: 'MANUAL',
    requiresCompletion: true,
    completionNote: 'Üst yönetim onayı alınmış olmalı',
  },
  {
    match: ['ksu', 'sözleşme', 'kontrat'],
    description: 'Sözleşme ve evrak kontrolü',
    type: 'MANUAL',
    requiresCompletion: true,
    completionNote: 'Zorunlu sözleşme evrakları kontrol edilmiş olmalı',
  },
  {
    match: ['kgd', 'kalite'],
    description: 'Kalite güvence ve proje devri',
    type: 'AUTO',
    requiresCompletion: false,
  },
  {
    match: ['isab', 'i̇sab', 'ihale', 'satın alma'],
    description: 'İhale ve satın alma takibi',
    type: 'AUTO',
    requiresCompletion: false,
  },
];

type StepLike = {
  id: string;
  order: number;
  enabled: boolean;
  unitId: string;
  nextStepId: string | null;
};

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * Tenant'ın aktif birimlerini kanonik sıraya göre dizip varsayılan
 * (`isDefault: true`) bir Workflow + WorkflowStep[] oluşturur. Zaten varsa
 * mevcut kaydı döner (idempotent). Tenant'ta karşılığı olmayan kanonik adım
 * hiç oluşturulmaz.
 */
export async function ensureDefaultWorkflow(tenantId: string) {
  const existing = await prisma.workflow.findFirst({
    where: { tenantId, isDefault: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (existing) return existing;

  const units = await prisma.unit.findMany({ where: { tenantId } });

  // Kanonik sıraya göre eşleşen birimleri seç (her birim en fazla bir kez).
  const used = new Set<string>();
  const ordered: { unitId: string; step: CanonicalStep }[] = [];
  for (const step of DEFAULT_WORKFLOW_STEPS) {
    const unit = units.find(
      (u) => !used.has(u.id) && step.match.some((kw) => normalize(u.name).includes(normalize(kw)))
    );
    if (unit) {
      used.add(unit.id);
      ordered.push({ unitId: unit.id, step });
    }
  }
  // Eşleşmeyen birimleri jenerik adımlarla sona ekle.
  for (const unit of units) {
    if (!used.has(unit.id)) {
      ordered.push({
        unitId: unit.id,
        step: { match: [], description: `${unit.name} işlemleri`, type: 'AUTO', requiresCompletion: false },
      });
    }
  }

  if (ordered.length === 0) {
    // Hiç birim yoksa boş bir default şablon oluştur (UI uyarı gösterir).
    return prisma.workflow.create({
      data: { name: 'Varsayılan İş Akışı', description: 'Tüm birimleri kapsayan otomatik şablon.', tenantId, isDefault: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  return prisma.workflow.create({
    data: {
      name: 'Varsayılan İş Akışı',
      description: 'Tüm birimleri kapsayan otomatik şablon.',
      tenantId,
      isDefault: true,
      steps: {
        create: ordered.map(({ unitId, step }, index) => ({
          unitId,
          order: index,
          type: step.type,
          description: step.description,
          requiresCompletion: step.requiresCompletion,
          completionNote: step.completionNote ?? null,
        })),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Skip-resolution motoru: verilen adımdan sonra görevin aktarılacağı
 * **aktif** (`enabled: true`) sıradaki adımı bulur. Kaldırılan (devre dışı)
 * birimleri şeffafça atlar → akış asla tıkanmaz.
 *
 * `fallbackUsed` = literal `nextStepId` devre dışı bir birimi işaret ediyordu,
 * motor sıradaki aktif adıma yönlendirdi (UI bunu uyarı olarak gösterir).
 */
export function resolveNextStep(steps: StepLike[], currentStepId: string): {
  nextStep: StepLike | null;
  fallbackUsed: boolean;
  removedStepId: string | null;
} {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const current = sorted.find((s) => s.id === currentStepId);
  if (!current) return { nextStep: null, fallbackUsed: false, removedStepId: null };

  // Sıradaki ilk aktif adım (order'a göre).
  const nextActive = sorted.find((s) => s.order > current.order && s.enabled) ?? null;

  // Literal nextStepId tanımlıysa ve devre dışı bir adımı işaret ediyorsa → fallback.
  let fallbackUsed = false;
  let removedStepId: string | null = null;
  if (current.nextStepId) {
    const literalNext = sorted.find((s) => s.id === current.nextStepId);
    if (literalNext && !literalNext.enabled) {
      fallbackUsed = true;
      removedStepId = literalNext.id;
    }
  }

  return { nextStep: nextActive, fallbackUsed, removedStepId };
}
