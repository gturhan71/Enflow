import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { advanceProcess, ProcessNotConfiguredError, entityExists, ENTITY_TYPES } from '../services/processEngine';
import { applyDefaultWorkflowTemplate } from '../services/workflowTemplate';

const router: Router = Router();

interface IncomingStep {
  unitId: string;
  type: string;
  description: string;
  nextStepId?: string | null;
  enabled?: boolean;
  requiresCompletion?: boolean;
  completionNote?: string | null;
  role?: string | null;
  delegateUserId?: string | null;
  approvalMode?: string;
  actionKey?: string | null;
  actionConfig?: string | null;
  order?: number;
  recipientField?: string | null;
}

// Not: `order` artık istemciden gelebilir (aynı order'ı paylaşan birden çok
// satır = paralel/çoklu-onaylayıcı aşama — Süreç Motoru, Faz A). Verilmemişse
// dizideki sırayla (eski davranış — hepsi ayrı order) devam edilir.
const mapStep = (step: IncomingStep, index: number) => ({
  unitId: step.unitId,
  order: step.order ?? index,
  type: step.type,
  description: step.description,
  nextStepId: step.nextStepId ?? null,
  enabled: step.enabled ?? true,
  requiresCompletion: step.requiresCompletion ?? false,
  completionNote: step.completionNote ?? null,
  role: step.role ?? null,
  delegateUserId: step.delegateUserId ?? null,
  approvalMode: step.approvalMode ?? 'ANY',
  actionKey: step.actionKey ?? null,
  actionConfig: step.actionConfig ?? null,
  recipientField: step.recipientField ?? null,
});

// Sabit taksonomideki süreçler (bkz. src/types/workflow.ts PROCESS_KEYS) —
// bunların her biri ilgili modülde ÖZEL bir route'tan (kendi durum
// ön-koşulları/yetki katmanıyla) advanceProcess çağırıyor. Jenerik tetikleme
// ucu bunları asla tetikleyemez — o hassas ön-koşulları bypass eder.
const KNOWN_PROCESS_KEYS = new Set([
  'OPPORTUNITY_APPROVAL', 'CONTRACT_SIGNING', 'TENDER_SUBMIT_APPROVAL', 'TENDER_TO_CONTRACT',
  'CONTRACT_TO_PROJECT', 'CONTRACT_TO_PROCUREMENT', 'OPPORTUNITY_TO_PROJECT', 'PURCHASE_APPROVAL',
  'PURCHASE_TO_COST_ITEM', 'PURCHASE_TO_INVOICE', 'PROJECT_TO_INVOICE', 'CRM_HANDOFF', 'PRESALES_HANDOFF',
  'BOM_COST_ANALYSIS_HANDOFF',
]);

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: req.tenantId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflows);
}));

// Varsayılan Süreç Şablonu (Faz H) — tenant-1'de kurgulanıp doğrulanmış 13
// süreci (+ gerekli varsayılan birimleri) boş/kısmen boş bir tenant'a tek
// çağrıyla uygular. Tenant'ın ZATEN kurguladığı bir processKey asla üzerine
// yazılmaz — yalnız eksikleri doldurur (immutable kural: harita tenant'ındır).
router.post('/apply-default-template', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  const result = await applyDefaultWorkflowTemplate(req.tenantId, req.userId);
  res.json(result);
}));

// Süreç Motoru (Faz A) — Tasarımcı UI'ın belirli bir processKey'e ait iş akışını
// düzenlemek için okuduğu uç. Bulunamazsa 404 (henüz kurgulanmamış — motorun
// kendi 409'undan farklı: bu salt-okunur bir "var mı" sorgusu). /:id'den ÖNCE tanımlı olmalı.
router.get('/by-process/:processKey', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const processKey = req.params.processKey as string;
  const workflow = await prisma.workflow.findFirst({
    where: { tenantId: req.tenantId, processKey },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!workflow) return res.status(404).json({ error: 'Bu süreç için henüz bir iş akışı yapılandırılmadı.' });
  res.json(workflow);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps, processKey, entityType } = req.body as { name: string; description?: string; steps: IncomingStep[]; processKey?: string | null; entityType?: string | null };

  if (processKey) {
    const existing = await prisma.workflow.findFirst({ where: { tenantId: req.tenantId, processKey } });
    if (existing) return res.status(409).json({ error: 'Bu süreç için zaten bir iş akışı var, mevcut kaydı güncelleyin.' });
  }
  // Sabit taksonomi dışındaki (tenant-özel) süreçler için entityType, jenerik
  // tetikleme ucunun (POST /:processKey/trigger) hangi kayıt türüne
  // uygulanacağını bilmesi için gereklidir; ENTITY_FIELD_SPECS'te tanımlı
  // olmayan bir değer kabul edilmez.
  if (entityType && !ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `Geçersiz hedef kaydı türü: ${entityType}` });
  }

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      tenantId: req.tenantId,
      processKey: processKey ?? null,
      entityType: entityType ?? null,
      steps: {
        create: steps.map(mapStep)
      }
    },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'WORKFLOW', entityId: workflow.id, details: { name: workflow.name, processKey: workflow.processKey } });
  res.json(workflow);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps, processKey, entityType } = req.body as { name: string; description?: string; steps: IncomingStep[]; processKey?: string | null; entityType?: string | null };
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });
  if (entityType && !ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `Geçersiz hedef kaydı türü: ${entityType}` });
  }

  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: id } });

    return tx.workflow.update({
      where: { id },
      data: {
        name,
        description,
        ...(processKey !== undefined && { processKey }),
        ...(entityType !== undefined && { entityType }),
        steps: {
          create: steps.map(mapStep)
        }
      },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  });

  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'WORKFLOW', entityId: id, details: { name } });
  res.json(updatedWorkflow);
}));

// ── Jenerik tetikleme — tenant-özel süreçler için ──────────────────────────
// Sabit taksonomideki süreçlerin HER BİRİ kendi modülünde, kendi durum
// ön-koşullarıyla tetiklenir (ör. yalnız SIGNED sözleşme). Tenant'ın "+ Yeni
// Süreç" ile eklediği özel süreçlerin ise koda gömülü bir tetikleme noktası
// yok — bu uç, ilgili varlık ekranındaki jenerik "Süreç Başlat" butonunun
// çağırdığı tek giriş noktasıdır.
router.post('/:processKey/trigger', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const processKey = req.params.processKey as string;
  const { entityId } = req.body as { entityId?: string };
  if (!entityId) return res.status(400).json({ error: 'entityId zorunlu.' });

  if (KNOWN_PROCESS_KEYS.has(processKey)) {
    return res.status(403).json({ error: 'Bu süreç ilgili modülden tetikleniyor, buradan başlatılamaz.' });
  }

  const workflow = await prisma.workflow.findFirst({ where: { tenantId, processKey } });
  if (!workflow) return res.status(404).json({ error: 'Süreç bulunamadı — önce Tasarımcı\'da kurgulayıp kaydedin.' });
  if (!workflow.entityType) return res.status(400).json({ error: 'Bu sürecin hedef kaydı türü tanımlanmamış. Tasarımcı\'da düzenleyip hedef türünü seçin.' });

  const exists = await entityExists(tenantId, workflow.entityType, entityId);
  if (!exists) return res.status(404).json({ error: 'Hedef kayıt bulunamadı.' });

  try {
    const result = await advanceProcess(tenantId, processKey, workflow.entityType, entityId, { actorUserId: req.userId });
    await logActivity({ tenantId, userId: req.userId, action: 'PROCESS_TRIGGERED', entityType: workflow.entityType, entityId, details: { processKey } });
    res.json({ success: true, actionsInvoked: result.actionsInvoked });
  } catch (e) {
    if (e instanceof ProcessNotConfiguredError) return res.status(409).json({ error: e.message });
    throw e;
  }
}));

// Süreç Motoru — tenant bir süreci tamamen kaldırabilir (Tasarımcı'nın
// "oluştur/düzenle/sil" tam yaşam döngüsü talebi). Yarıda kalmış bir gerçek
// onayı (PENDING ApprovalChain) olan bir süreç sessizce silinemez — o anda
// devam eden bir işi kimseye görünmez hale getirir; önce çözülmeli.
router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const record = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  if (record.processKey) {
    const pendingChain = await prisma.approvalChain.findFirst({
      where: { tenantId, processKey: record.processKey, status: 'PENDING' },
    });
    if (pendingChain) {
      return res.status(409).json({ error: 'Bu süreçte devam eden (onay bekleyen) bir kayıt var — önce o onay tamamlanmalı/reddedilmeli, sonra süreç silinebilir.' });
    }
  }

  await prisma.$transaction([
    prisma.workflowStep.deleteMany({ where: { workflowId: id } }),
    prisma.workflow.delete({ where: { id } }),
  ]);
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'WORKFLOW', entityId: id, details: { name: record.name, processKey: record.processKey } });
  res.json({ success: true });
}));

export default router;
