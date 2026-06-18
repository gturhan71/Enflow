import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { autoSkipOrphanStages } from '../services/approvalChainService';

const router: Router = Router();

// GET /?entityType=PROPOSAL&entityId=xxx → tek zincir bulma (yoksa null)
// GET /?pendingForRole=FINANCE_MGR → o role ait, sırası gelmiş (PENDING) bekleyen onaylar
// "Sırası gelmiş" = kendinden önceki tüm aşamalar APPROVED olan ilk PENDING aşama bu role ait.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, pendingForRole } = req.query as { entityType?: string; entityId?: string; pendingForRole?: string };

  if (pendingForRole) {
    const chains = await prisma.approvalChain.findMany({
      where: { tenantId: req.tenantId, status: 'PENDING' },
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    // Self-heal: tenant'ta aktif olmayan role sahip öncü aşamaları atla, böylece
    // "sırası gelmiş" aşama doğru role düşer ve kaldırılan rol swimlane'i tıkamaz.
    const healed = await Promise.all(chains.map(c => autoSkipOrphanStages(req.tenantId, c.id)));
    const myTurn = (healed.filter(Boolean) as NonNullable<typeof healed[number]>[]).filter(c => {
      if (c.status !== 'PENDING') return false;
      const firstPending = c.stages.find(s => s.status === 'PENDING');
      return firstPending?.role === pendingForRole;
    });
    return res.json(myTurn);
  }

  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const chains = await prisma.approvalChain.findMany({
    where,
    include: { stages: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(chains);
}));

router.get('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });
  res.json(chain);
}));

// POST / → { entityType, entityId, stages: [{ role, order? }] }
router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, stages } = req.body as {
    entityType: string;
    entityId: string;
    stages: { role: string; order?: number }[];
  };

  if (!entityType || !entityId || !Array.isArray(stages) || stages.length === 0) {
    return res.status(400).json({ error: 'entityType, entityId ve en az bir stage zorunludur.' });
  }

  const chain = await prisma.approvalChain.create({
    data: {
      entityType,
      entityId,
      tenantId: req.tenantId,
      stages: {
        create: stages.map((s, i) => ({ role: s.role, order: s.order ?? i }))
      }
    },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  res.json(chain);
}));

router.post('/:id/stages/:stageId/approve', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const stageId = String(req.params.stageId);
  const { approverId, note } = req.body as { approverId?: string; note?: string };

  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  const stage = chain.stages.find(s => s.id === stageId);
  if (!stage) return res.status(404).json({ error: 'Onay aşaması bulunamadı.' });

  await prisma.approvalStage.update({
    where: { id: stageId },
    data: { status: 'APPROVED', approverId, note, approvedAt: new Date() }
  });

  // Kalan aşamalarda tenant'ta aktif olmayan rolleri atla; geriye PENDING
  // kalmazsa zincir COMPLETED olur (SKIPPED aşamalar bloklamaz).
  const updated = await autoSkipOrphanStages(req.tenantId, id);
  res.json(updated);
}));

router.post('/:id/stages/:stageId/reject', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const stageId = String(req.params.stageId);
  const { approverId, note } = req.body as { approverId?: string; note?: string };

  const chain = await prisma.approvalChain.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  await prisma.approvalStage.update({
    where: { id: stageId },
    data: { status: 'REJECTED', approverId, note, approvedAt: new Date() }
  });
  await prisma.approvalChain.update({ where: { id }, data: { status: 'REJECTED' } });

  const updated = await prisma.approvalChain.findFirst({
    where: { id },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  res.json(updated);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const chain = await prisma.approvalChain.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  await prisma.approvalChain.delete({ where: { id } });
  res.json({ message: 'Onay zinciri silindi.' });
}));

export default router;
