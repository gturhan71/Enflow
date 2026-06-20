import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

const VISIT_PLAN_INCLUDE = {
  visits: { orderBy: { plannedDate: 'asc' as const } },
};

// ── VISIT PLANS ──────────────────────────────────────────────────────────────

// GET /?weekOf=2026-06-15 → tenant'ın ziyaret planları (opsiyonel hafta filtresi)
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  const { weekOf, preparedById } = req.query as { weekOf?: string; preparedById?: string };
  const plans = await prisma.visitPlan.findMany({
    where: {
      tenantId: req.tenantId,
      ...(weekOf ? { weekOf: new Date(weekOf) } : {}),
      ...(preparedById ? { preparedById } : {}),
    },
    include: VISIT_PLAN_INCLUDE,
    orderBy: { weekOf: 'desc' },
  });
  res.json(plans);
}));

router.get('/plans/:id', asyncHandler(async (req: Request, res: Response) => {
  const plan = await prisma.visitPlan.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: VISIT_PLAN_INCLUDE,
  });
  if (!plan) return res.status(404).json({ error: 'Ziyaret planı bulunamadı.' });
  res.json(plan);
}));

// POST / → { weekOf, preparedById, preparedByName, visits?: [{ customerId, customerName, type, plannedDate, needsCaptured }] }
router.post('/plans', asyncHandler(async (req: Request, res: Response) => {
  const { weekOf, preparedById, preparedByName, notes, visits } = req.body as {
    weekOf: string;
    preparedById: string;
    preparedByName?: string;
    notes?: string;
    visits?: { customerId?: string; customerName?: string; type?: string; plannedDate: string; needsCaptured?: string }[];
  };

  if (!weekOf || !preparedById) {
    return res.status(400).json({ error: 'weekOf ve preparedById zorunludur.' });
  }

  const plan = await prisma.visitPlan.create({
    data: {
      tenantId: req.tenantId,
      weekOf: new Date(weekOf),
      preparedById,
      preparedByName: preparedByName || null,
      notes: notes || null,
      visits: visits?.length
        ? {
            create: visits.map(v => ({
              tenantId: req.tenantId,
              customerId: v.customerId || null,
              customerName: v.customerName || null,
              type: v.type || 'OTHER',
              plannedDate: new Date(v.plannedDate),
              needsCaptured: v.needsCaptured || null,
            })),
          }
        : undefined,
    },
    include: VISIT_PLAN_INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'VISIT_PLAN', entityId: plan.id, details: { weekOf } });
  res.status(201).json(plan);
}));

router.put('/plans/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status, notes } = req.body as { status?: string; notes?: string };

  const plan = await prisma.visitPlan.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!plan) return res.status(404).json({ error: 'Ziyaret planı bulunamadı.' });

  const updated = await prisma.visitPlan.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
    },
    include: VISIT_PLAN_INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status ? `STATUS_${status}` : 'UPDATE', entityType: 'VISIT_PLAN', entityId: id });
  res.json(updated);
}));

router.delete('/plans/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const plan = await prisma.visitPlan.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!plan) return res.status(404).json({ error: 'Ziyaret planı bulunamadı.' });

  await prisma.visit.deleteMany({ where: { visitPlanId: id } });
  await prisma.visitPlan.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'VISIT_PLAN', entityId: id });
  res.json({ message: 'Ziyaret planı silindi.' });
}));

// ── VISITS (tek ziyaret kaydı) ───────────────────────────────────────────────

router.post('/plans/:id/visits', asyncHandler(async (req: Request, res: Response) => {
  const visitPlanId = String(req.params.id);
  const plan = await prisma.visitPlan.findFirst({ where: { id: visitPlanId, tenantId: req.tenantId } });
  if (!plan) return res.status(404).json({ error: 'Ziyaret planı bulunamadı.' });

  const { customerId, customerName, type, plannedDate, needsCaptured } = req.body;
  const visit = await prisma.visit.create({
    data: {
      visitPlanId,
      tenantId: req.tenantId,
      customerId: customerId || null,
      customerName: customerName || null,
      type: type || 'OTHER',
      plannedDate: new Date(plannedDate),
      needsCaptured: needsCaptured || null,
    },
  });
  res.status(201).json(visit);
}));

router.put('/visits/:visitId', asyncHandler(async (req: Request, res: Response) => {
  const visitId = String(req.params.visitId);
  const visit = await prisma.visit.findFirst({ where: { id: visitId, tenantId: req.tenantId } });
  if (!visit) return res.status(404).json({ error: 'Ziyaret bulunamadı.' });

  const { status, actualDate, needsCaptured, type, plannedDate, customerId, customerName } = req.body;
  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: {
      ...(status !== undefined && { status }),
      ...(actualDate !== undefined && { actualDate: actualDate ? new Date(actualDate) : null }),
      ...(needsCaptured !== undefined && { needsCaptured }),
      ...(type !== undefined && { type }),
      ...(plannedDate !== undefined && { plannedDate: new Date(plannedDate) }),
      ...(customerId !== undefined && { customerId }),
      ...(customerName !== undefined && { customerName }),
      updatedAt: new Date(),
    },
  });
  res.json(updated);
}));

router.delete('/visits/:visitId', asyncHandler(async (req: Request, res: Response) => {
  const visitId = String(req.params.visitId);
  const visit = await prisma.visit.findFirst({ where: { id: visitId, tenantId: req.tenantId } });
  if (!visit) return res.status(404).json({ error: 'Ziyaret bulunamadı.' });

  await prisma.visit.delete({ where: { id: visitId } });
  res.json({ message: 'Ziyaret silindi.' });
}));

// ── GÜNLÜK RAPOR ──────────────────────────────────────────────────────────────

router.get('/daily-reports', asyncHandler(async (req: Request, res: Response) => {
  const { userId, weekStart, weekEnd } = req.query as { userId?: string; weekStart?: string; weekEnd?: string };
  const reports = await prisma.dailyReport.findMany({
    where: {
      tenantId: req.tenantId,
      ...(userId ? { userId } : {}),
      ...(weekStart && weekEnd ? { date: { gte: new Date(weekStart), lte: new Date(weekEnd) } } : {}),
    },
    orderBy: { date: 'desc' },
  });
  res.json(reports);
}));

router.post('/daily-reports', asyncHandler(async (req: Request, res: Response) => {
  const { userId, userName, date, content } = req.body;
  if (!userId || !date || !content) {
    return res.status(400).json({ error: 'userId, date ve content zorunludur.' });
  }
  const report = await prisma.dailyReport.create({
    data: {
      tenantId: req.tenantId,
      userId,
      userName: userName || null,
      date: new Date(date),
      content,
    },
  });
  res.status(201).json(report);
}));

router.put('/daily-reports/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const report = await prisma.dailyReport.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!report) return res.status(404).json({ error: 'Günlük rapor bulunamadı.' });

  const { content, sharedWithManager } = req.body;
  const updated = await prisma.dailyReport.update({
    where: { id },
    data: {
      ...(content !== undefined && { content }),
      ...(sharedWithManager !== undefined && { sharedWithManager }),
    },
  });
  res.json(updated);
}));

router.delete('/daily-reports/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const report = await prisma.dailyReport.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!report) return res.status(404).json({ error: 'Günlük rapor bulunamadı.' });

  await prisma.dailyReport.delete({ where: { id } });
  res.json({ message: 'Günlük rapor silindi.' });
}));

export default router;
