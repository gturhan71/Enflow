import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { computeSlaDueDate } from '../utils/businessDays';
import { logActivity } from '../services/activityLog';

const router: Router = Router();

// Kullanıcı kapsamı (KİŞİ-BAZLI): bir kullanıcı YALNIZ kendisine atanan
// (assignedToUserId) veya kendi oluşturduğu (assignedBy) görevleri görür.
// Atanmamış (legacy/null) görevler için birim fallback'i: kendi biriminin
// atanmamış görevlerini de görür. GM gözetim için tüm görevleri görür.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = req.userId
    ? await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true, unitId: true } })
    : null;

  const where: { tenantId: string; OR?: Array<Record<string, unknown>> } = { tenantId: req.tenantId };
  if (user && user.role !== 'GENERAL_MANAGER') {
    where.OR = [
      { assignedToUserId: req.userId },
      { assignedBy: req.userId },
    ];
    if (user.unitId) where.OR.push({ assignedToUserId: null, unitId: user.unitId });
  }

  const tasks = await prisma.todoTask.findMany({ where });
  res.json(tasks);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, slaBusinessDays, ...rest } = req.body;
  // slaBusinessDays verilmiş ama dueDate verilmemişse, iş günü bazlı otomatik hesapla.
  const resolvedDueDate = dueDate
    ? new Date(dueDate as string)
    : computeSlaDueDate(slaBusinessDays as number | undefined);

  const task = await prisma.todoTask.create({
    data: {
      ...rest,
      dueDate: resolvedDueDate,
      slaBusinessDays: slaBusinessDays ?? null,
      progressNotes: typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes || []),
      tenantId: req.tenantId
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'TASK', entityId: task.id, details: { title: task.title, relatedModule: task.relatedModule } });
  res.json(task);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (dueDate) data.dueDate = new Date(dueDate as string);
  if (progressNotes !== undefined) {
    data.progressNotes = typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes);
  }
  const task = await prisma.todoTask.update({ where: { id }, data });
  await logActivity({ tenantId, userId: req.userId, action: rest.status && rest.status !== record.status ? `STATUS_${rest.status}` : 'UPDATE', entityType: 'TASK', entityId: id, details: { title: task.title, status: task.status } });
  res.json(task);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.todoTask.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'TASK', entityId: id });
  res.json({ message: 'Görev silindi.' });
}));

export default router;
