import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
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

const MEETING_KINDS = ['INTRO', 'PLANNED', 'FOLLOWUP', 'OTHER'];
const LINK_TYPES = ['NEW_CONTACT', 'VISIT', 'OPPORTUNITY', 'PROJECT'];

router.post('/daily-reports', asyncHandler(async (req: Request, res: Response) => {
  const { userId, userName, date, content, meetingKind, linkType, linkId, linkLabel } = req.body;
  if (!userId || !date || !content) {
    return res.status(400).json({ error: 'userId, date ve content zorunludur.' });
  }
  const kind = MEETING_KINDS.includes(meetingKind) ? meetingKind : 'OTHER';
  const lType = LINK_TYPES.includes(linkType) ? linkType : 'NEW_CONTACT';
  const report = await prisma.dailyReport.create({
    data: {
      tenantId: req.tenantId,
      userId,
      userName: userName || null,
      date: new Date(date),
      content,
      meetingKind: kind,
      linkType: lType,
      linkId: lType === 'NEW_CONTACT' ? null : (linkId || null),
      linkLabel: linkLabel || null,
      isKnownToSystem: lType !== 'NEW_CONTACT',
    },
  });
  res.status(201).json(report);
}));

// Dönem-toplu paylaşım: kullanıcının [start,end] aralığındaki paylaşılmamış
// raporlarını yöneticiyle paylaşılmış işaretler (Satış Müdürü kadansına göre).
router.post('/daily-reports/share-period', asyncHandler(async (req: Request, res: Response) => {
  const { userId, start, end } = req.body as { userId?: string; start?: string; end?: string };
  if (!userId || !start || !end) {
    return res.status(400).json({ error: 'userId, start ve end zorunludur.' });
  }
  const result = await prisma.dailyReport.updateMany({
    where: {
      tenantId: req.tenantId,
      userId,
      sharedWithManager: false,
      date: { gte: new Date(start), lte: new Date(end) },
    },
    data: { sharedWithManager: true, sharedAt: new Date() },
  });
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'SHARE_PERIOD',
    entityType: 'DAILY_REPORT', entityId: userId,
    details: { count: result.count, start, end },
  });
  res.json({ count: result.count });
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

// ── RAPOR PAYLAŞIM AYARLARI (Tenant.moduleSettings.dailyReport) ───────────────
// GET: tüm tenant kullanıcıları okuyabilir (satışçı aralığı görmeli).
// PUT: yalnız Satış Müdürü + GM (kadansı belirler). moduleSettings MERGE edilir.
const DEFAULT_SHARE_INTERVAL = 7;

router.get('/report-settings', asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const dr = (ms.dailyReport as { shareIntervalDays?: number }) || {};
  res.json({ shareIntervalDays: dr.shareIntervalDays ?? DEFAULT_SHARE_INTERVAL });
}));

router.put('/report-settings', requireRole(['GENERAL_MANAGER', 'SALES_MGR']), asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.body?.shareIntervalDays);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return res.status(400).json({ error: 'shareIntervalDays 1–365 arası olmalı.' });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.dailyReport = { ...(ms.dailyReport as object || {}), shareIntervalDays: Math.round(days) };
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'UPDATE',
    entityType: 'REPORT_SETTINGS', entityId: req.tenantId, details: { shareIntervalDays: Math.round(days) },
  });
  res.json({ shareIntervalDays: Math.round(days) });
}));

export default router;
