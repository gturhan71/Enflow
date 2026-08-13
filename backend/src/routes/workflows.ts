import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

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
  order?: number;
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
});

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: req.tenantId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflows);
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
  const { name, description, steps, processKey } = req.body as { name: string; description?: string; steps: IncomingStep[]; processKey?: string | null };

  if (processKey) {
    const existing = await prisma.workflow.findFirst({ where: { tenantId: req.tenantId, processKey } });
    if (existing) return res.status(409).json({ error: 'Bu süreç için zaten bir iş akışı var, mevcut kaydı güncelleyin.' });
  }

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      tenantId: req.tenantId,
      processKey: processKey ?? null,
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
  const { name, description, steps, processKey } = req.body as { name: string; description?: string; steps: IncomingStep[]; processKey?: string | null };
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: id } });

    return tx.workflow.update({
      where: { id },
      data: {
        name,
        description,
        ...(processKey !== undefined && { processKey }),
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
