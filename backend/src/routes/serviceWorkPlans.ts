// Profesyonel Hizmetler — haftalık teknisyen dağıtım planı (Faz 2, `visits.ts`
// VisitPlan paterniyle aynı iskelet). WorkOrder'ın asıl CRUD/statü akışı
// workOrders.ts'te — bu router yalnız haftalık GRUPLAMA katmanı. Bkz.
// docs/PROFESYONEL_HIZMETLER_PLAN.md.
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware, requireRole(['GENERAL_MANAGER', 'OPERATIONS_MGR', 'PROJECT_MGR']));

const PLAN_INCLUDE = {
  workOrders: {
    select: {
      id: true, workOrderNo: true, title: true, type: true, status: true, priority: true,
      scheduledDate: true, customerName: true,
      assignedTechnician: { select: { id: true, name: true } },
    },
    orderBy: { scheduledDate: 'asc' as const },
  },
};

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { weekOf, unitId } = req.query as { weekOf?: string; unitId?: string };
  const plans = await prisma.serviceWorkPlan.findMany({
    where: {
      tenantId: req.tenantId,
      ...(weekOf ? { weekOf: new Date(weekOf) } : {}),
      ...(unitId ? { unitId } : {}),
    },
    include: PLAN_INCLUDE,
    orderBy: { weekOf: 'desc' },
  });
  res.json(plans);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const plan = await prisma.serviceWorkPlan.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, include: PLAN_INCLUDE });
  if (!plan) return res.status(404).json({ error: 'Haftalık plan bulunamadı.' });
  res.json(plan);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { weekOf, unitId, notes, preparedByName } = req.body as { weekOf?: string; unitId?: string; notes?: string; preparedByName?: string };
  if (!weekOf) return res.status(400).json({ error: 'weekOf zorunludur.' });

  const plan = await prisma.serviceWorkPlan.create({
    data: {
      tenantId: req.tenantId,
      weekOf: new Date(weekOf),
      unitId: unitId || null,
      preparedById: req.userId,
      preparedByName: preparedByName || null,
      notes: notes || null,
    },
    include: PLAN_INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'SERVICE_WORK_PLAN', entityId: plan.id, details: { weekOf } });
  res.status(201).json(plan);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.serviceWorkPlan.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Haftalık plan bulunamadı.' });

  const { status, notes } = req.body as { status?: string; notes?: string };
  const plan = await prisma.serviceWorkPlan.update({
    where: { id },
    data: { ...(status !== undefined && { status }), ...(notes !== undefined && { notes }) },
    include: PLAN_INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status ? `STATUS_${status}` : 'UPDATE', entityType: 'SERVICE_WORK_PLAN', entityId: id });
  res.json(plan);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.serviceWorkPlan.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Haftalık plan bulunamadı.' });

  // WorkOrder'lar silinmez — yalnız servicePlanId null'a düşer (onDelete: SetNull,
  // Visit'in aksine WorkOrder plandan bağımsız var olabilen bir kayıt).
  await prisma.serviceWorkPlan.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'SERVICE_WORK_PLAN', entityId: id });
  res.json({ message: 'Haftalık plan silindi.' });
}));

export default router;
