import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { computeSlaDueDate } from '../utils/businessDays';
import { logActivity } from '../services/activityLog';
import { sweepSlaEscalations } from '../services/slaEscalation';

const router: Router = Router();

// İşlevsel eylem → o işin yapıldığı modül sekmesi (deep-link hedefi; frontend ile aynı).
const ACTION_TARGET: Record<string, string> = {
  BOM_PREPARE: 'presales', SPEC_ANALYSIS: 'presales',
  COST_ANALYSIS: 'crm-cost', PROPOSAL_PREPARE: 'crm-proposals', NEGOTIATION: 'crm-negotiation',
  TENDER_FILE_PREP: 'sales-support',
  MILESTONE_UPDATE: 'project-mgmt', HANDOVER_DOCS: 'project-mgmt', COST_ENTRY: 'project-mgmt',
  VENDOR_QUOTE: 'procurement', PO_ISSUE: 'procurement', DELIVERY_RECORD: 'procurement',
  DOC_PREPARE: 'contract-workflow', SIGN_APPROVE: 'contract-workflow',
  CONTRACT_REVIEW: 'contract-workflow', CASE_OPEN: 'contract-workflow', OPINION: 'contract-workflow',
};
// src/modules/todo/helpers.ts taskTargetTab() ile birebir aynı tutulmalı (frontend
// mirror'ı) — biri güncellenip diğeri unutulursa Notification/TodoTask "Git" hedefleri
// birbirinden sapar.
const MODULE_TARGET: Record<string, string> = {
  OPPORTUNITY: 'crm-opportunities', PROJECT: 'project-mgmt', PROCUREMENT: 'procurement',
  CONTRACT: 'contract-workflow', LEGAL: 'contract-workflow',
  CONTRACT_WORKFLOW_SIGNING: 'contract-workflow', PURCHASE_REQUEST: 'procurement', TENDER: 'sales-support',
  PROJECT_COST: 'finance', LEGAL_CASE: 'contract-workflow', PROPOSAL: 'crm-proposals',
};
const targetTab = (actionKey?: string | null, relatedModule?: string | null): string | null =>
  (actionKey ? ACTION_TARGET[actionKey] : undefined) || (relatedModule ? MODULE_TARGET[relatedModule] : undefined) || null;

// Kullanıcı kapsamı (KİŞİ-BAZLI): bir kullanıcı YALNIZ kendisine atanan
// (assignedToUserId) veya kendi oluşturduğu (assignedBy) görevleri görür.
// Atanmamış (legacy/null) görevler için birim fallback'i: kendi biriminin
// atanmamış görevlerini de görür. GM gözetim için tüm görevleri görür.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await sweepSlaEscalations(req.tenantId); // SLA aşımı eskalasyonu (non-throwing)
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

  // Atanan kişiye bildirim (kendi oluşturduğu değilse). assignedToUserId, extension
  // ile birim yöneticisine çözülmüş olabilir → güncel task'tan oku.
  if (task.assignedToUserId && task.assignedToUserId !== req.userId) {
    await prisma.notification.create({
      data: {
        tenantId: req.tenantId,
        userId: task.assignedToUserId,
        type: 'TASK',
        title: 'Size yeni bir görev atandı',
        message: task.title,
        // Bildirime tıklayınca ilgili modül ekranına (ve kayda) deep-link.
        relatedModule: targetTab(task.actionKey, task.relatedModule),
        relatedItemId: task.relatedItemId,
      },
    }).catch(() => {});
  }
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
  // "Yapıldığı" zaman damgası — COMPLETED'e YENİ geçişte set edilir, geri açılırsa
  // (reopen) temizlenir. updatedAt kullanılmadı: tamamlandıktan sonra başka bir alan
  // (öncelik, açıklama vb.) düzenlenirse updatedAt yanıltıcı biçimde ilerlerdi.
  if (rest.status === 'COMPLETED' && record.status !== 'COMPLETED') data.completedAt = new Date();
  else if (rest.status && rest.status !== 'COMPLETED' && record.status === 'COMPLETED') data.completedAt = null;
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
