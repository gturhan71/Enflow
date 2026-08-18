// Enflow — Varsayılan Süreç Şablonu (Faz H).
// ─────────────────────────────────────────────────────────────────────────────
// tenant-1'de curl ile kurgulanıp uçtan uca doğrulanan 13 süreci, tenant'a özel
// unitId yerine DEFAULT_UNITS'in KARARLI `key`'leriyle tanımlar — böylece boş
// bir tenant'a (birimler + roller dahil) tek çağrıyla uygulanabilir. Bu, tek
// bir "doğru" iş akışı DAYATMASI değildir: `applyDefaultWorkflowTemplate`
// yalnız HENÜZ kurgulanmamış süreçleri doldurur, tenant'ın kendi kurguladığı
// bir süreci asla üzerine yazmaz (immutable kural: harita tenant'ındır).
import { prisma } from '../prismaClient';
import { logActivity } from './activityLog';
import { DEFAULT_UNITS } from './bootstrapTenant';

interface TemplateStep {
  unitKey: string;
  role: string | null;
  type: 'MANUAL' | 'AUTO';
  description: string;
  order: number;
  actionKey?: string | null;
}

interface TemplateProcess {
  name: string;
  entityType: string;
  steps: TemplateStep[];
}

export const DEFAULT_WORKFLOW_TEMPLATE: Record<string, TemplateProcess> = {
  OPPORTUNITY_APPROVAL: {
    name: 'Fırsat Onayı',
    entityType: 'OPPORTUNITY',
    steps: [
      { unitKey: 'sales', role: 'SALES_MGR', type: 'MANUAL', description: 'Satış Müdürü ön onayı', order: 0 },
      { unitKey: 'igpd', role: 'IGPD_MGR', type: 'MANUAL', description: 'İGB iş geliştirme uygunluk onayı', order: 1 },
      { unitKey: 'top', role: 'GENERAL_MANAGER', type: 'MANUAL', description: 'Genel Müdür nihai onayı', order: 2 },
    ],
  },
  CONTRACT_SIGNING: {
    name: 'Sözleşme İmza',
    entityType: 'CONTRACT_WORKFLOW_SIGNING',
    steps: [
      { unitKey: 'legal', role: 'LEGAL_MGR', type: 'MANUAL', description: 'Hukuk incelemesi', order: 0 },
      { unitKey: 'ksu', role: 'KSU_MGR', type: 'MANUAL', description: 'KSU sözleşme incelemesi', order: 1 },
      { unitKey: 'top', role: 'GENERAL_MANAGER', type: 'MANUAL', description: 'İmza onayı', order: 2 },
    ],
  },
  TENDER_SUBMIT_APPROVAL: {
    name: 'Teklif Onayı (ihaleye teslim)',
    entityType: 'TENDER',
    steps: [
      { unitKey: 'sales', role: 'SALES_MGR', type: 'MANUAL', description: 'Teklif teslim onayı', order: 0 },
      { unitKey: 'sales', role: null, type: 'AUTO', description: 'Teklifi teslim et', order: 1, actionKey: 'SUBMIT_TENDER' },
    ],
  },
  TENDER_TO_CONTRACT: {
    name: 'İhale → Sözleşme',
    entityType: 'TENDER',
    steps: [
      { unitKey: 'isab', role: 'ISAB_MGR', type: 'MANUAL', description: 'İYB uygunluk onayı', order: 0 },
      { unitKey: 'top', role: null, type: 'AUTO', description: 'Sözleşme kaydı oluştur', order: 1, actionKey: 'CREATE_CONTRACT_FROM_TENDER' },
    ],
  },
  CONTRACT_TO_PROJECT: {
    name: 'Sözleşme → Proje',
    entityType: 'CONTRACT_WORKFLOW_SIGNING',
    steps: [
      { unitKey: 'kgd', role: 'KGD_MGR', type: 'MANUAL', description: 'KY kalite güvence ön kontrolü', order: 0 },
      { unitKey: 'project', role: 'PROJECT_MGR', type: 'MANUAL', description: 'Proje devralma onayı', order: 1 },
      { unitKey: 'project', role: null, type: 'AUTO', description: 'Proje kaydı oluştur', order: 2, actionKey: 'CREATE_PROJECT_FROM_ENTITY' },
    ],
  },
  CONTRACT_TO_PROCUREMENT: {
    name: 'Sözleşme → Satınalma',
    entityType: 'CONTRACT_WORKFLOW_SIGNING',
    steps: [
      { unitKey: 'top', role: 'GENERAL_MANAGER', type: 'MANUAL', description: 'Satınalmaya devir onayı', order: 0 },
      { unitKey: 'procurement', role: 'PROCUREMENT_MGR', type: 'AUTO', description: 'Satınalma talebi oluştur', order: 1, actionKey: 'CREATE_PURCHASE_REQUEST_FROM_CONTRACT' },
    ],
  },
  OPPORTUNITY_TO_PROJECT: {
    name: 'Fırsat → Proje',
    entityType: 'OPPORTUNITY',
    steps: [
      { unitKey: 'top', role: 'GENERAL_MANAGER', type: 'MANUAL', description: 'Proje açma onayı', order: 0 },
      { unitKey: 'top', role: null, type: 'AUTO', description: 'Proje kaydı oluştur', order: 1, actionKey: 'CREATE_PROJECT_FROM_ENTITY' },
    ],
  },
  PURCHASE_APPROVAL: {
    name: 'Satınalma Onayı',
    entityType: 'PURCHASE_REQUEST',
    steps: [
      { unitKey: 'top', role: null, type: 'MANUAL', description: 'Birim onayı', order: 0 },
      { unitKey: 'procurement', role: 'PROCUREMENT_MGR', type: 'MANUAL', description: 'Satın Alma Müdürü onayı', order: 1 },
      { unitKey: 'top', role: 'GENERAL_MANAGER', type: 'MANUAL', description: 'Genel Müdür onayı', order: 2 },
    ],
  },
  PURCHASE_TO_COST_ITEM: {
    name: 'Satınalma → Maliyet Kalemi',
    entityType: 'PURCHASE_REQUEST',
    steps: [
      { unitKey: 'top', role: null, type: 'AUTO', description: 'Maliyet kalemi oluştur', order: 0, actionKey: 'CREATE_PURCHASE_COST_ITEM' },
    ],
  },
  PURCHASE_TO_INVOICE: {
    name: 'Satınalma → Fatura',
    entityType: 'PURCHASE_REQUEST',
    steps: [
      { unitKey: 'finance', role: 'FINANCE_MGR', type: 'MANUAL', description: 'Fatura kaydı yetkisi', order: 0 },
    ],
  },
  PROJECT_TO_INVOICE: {
    name: 'Proje → Fatura (kapanış)',
    entityType: 'PROJECT',
    steps: [
      { unitKey: 'finance', role: 'FINANCE_MGR', type: 'MANUAL', description: 'Kapanış faturası onayı', order: 0 },
      { unitKey: 'finance', role: null, type: 'AUTO', description: 'Satış faturası oluştur', order: 1, actionKey: 'CREATE_SALES_INVOICE_FOR_PROJECT' },
    ],
  },
  CRM_HANDOFF: {
    name: 'CRM Devri (birimler arası)',
    entityType: 'OPPORTUNITY',
    steps: [
      { unitKey: 'technical', role: 'PRESALES_MGR', type: 'MANUAL', description: 'Presales teknik değerlendirme devri', order: 0 },
    ],
  },
  PRESALES_HANDOFF: {
    name: 'Presales Devri (teknik analiz sonrası)',
    entityType: 'OPPORTUNITY',
    steps: [
      { unitKey: 'sales', role: 'SALES_MGR', type: 'MANUAL', description: "Teklif hazırlığı için Satış'a devir", order: 0 },
    ],
  },
};

export interface ApplyTemplateResult {
  addedUnits: string[];
  createdProcesses: string[];
  skippedProcesses: string[];
}

/**
 * Şablonu bir tenant'a uygular: (1) eksik varsayılan birimleri ekler (isimle
 * eşleşeni atlar — `/units/seed-defaults` ile aynı idempotent mantık), (2)
 * şablondaki her süreç için tenant'ta HENÜZ bir Workflow yoksa oluşturur.
 * Tenant zaten o processKey'i kurgulamışsa DOKUNULMAZ (asla üzerine yazmaz).
 */
export async function applyDefaultWorkflowTemplate(tenantId: string, actorUserId?: string): Promise<ApplyTemplateResult> {
  const existingUnits = await prisma.unit.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
  const unitIdByName = new Map(existingUnits.map((u) => [norm(u.name), u.id]));

  const addedUnits: string[] = [];
  for (const u of DEFAULT_UNITS) {
    if (unitIdByName.has(norm(u.name))) continue;
    const created = await prisma.unit.create({ data: { name: u.name, description: u.description, tenantId } });
    unitIdByName.set(norm(u.name), created.id);
    addedUnits.push(u.name);
  }
  const unitIdByKey = new Map(DEFAULT_UNITS.map((u) => [u.key, unitIdByName.get(norm(u.name))]));

  const existingWorkflows = await prisma.workflow.findMany({ where: { tenantId, processKey: { not: null } }, select: { processKey: true } });
  const configuredKeys = new Set(existingWorkflows.map((w) => w.processKey));

  const createdProcesses: string[] = [];
  const skippedProcesses: string[] = [];
  for (const [processKey, tpl] of Object.entries(DEFAULT_WORKFLOW_TEMPLATE)) {
    if (configuredKeys.has(processKey)) {
      skippedProcesses.push(processKey);
      continue;
    }
    await prisma.workflow.create({
      data: {
        tenantId,
        processKey,
        name: tpl.name,
        description: '',
        entityType: tpl.entityType,
        steps: {
          create: tpl.steps.map((s) => {
            const unitId = unitIdByKey.get(s.unitKey);
            if (!unitId) throw new Error(`Şablon birimi çözülemedi: ${s.unitKey}`);
            return {
              unitId,
              role: s.role,
              type: s.type,
              description: s.description,
              order: s.order,
              actionKey: s.actionKey ?? null,
              approvalMode: 'ANY',
            };
          }),
        },
      },
    });
    createdProcesses.push(processKey);
  }

  await logActivity({
    tenantId, userId: actorUserId, action: 'APPLY_WORKFLOW_TEMPLATE', entityType: 'WORKFLOW', entityId: tenantId,
    details: { addedUnits: addedUnits.length, createdProcesses: createdProcesses.length, skippedProcesses: skippedProcesses.length },
  });

  return { addedUnits, createdProcesses, skippedProcesses };
}
