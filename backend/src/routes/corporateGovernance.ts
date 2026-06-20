import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';
import { nextDocumentNumber } from '../services/documentNumberService';

const router: Router = Router();

// Opsiyonel docNumber üretimi: istek `categoryCode` içeriyorsa ve tenant'ın
// aktif bir kodlama profili varsa özgün bir kod üretilir; yoksa null kalır.
async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
}

// ── 1) Lessons Learned (Alınan Dersler) ─────────────────────────────────────

router.get('/lessons', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (projectId) where.projectId = projectId;
  const items = await prisma.lessonsLearned.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(items);
}));

router.post('/lessons', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { title, situation, projectId, category, rootCause, action, impact, status, createdById, createdByName, categoryCode } = req.body;
  if (!title || !situation) return res.status(400).json({ error: 'Başlık ve durum açıklaması zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.lessonsLearned.create({
    data: {
      tenantId: req.tenantId, title, situation,
      projectId: projectId || null,
      category: category || 'OTHER',
      rootCause: rootCause || null,
      action: action || null,
      impact: impact || 'MEDIUM',
      status: status || 'OPEN',
      createdById: createdById || null,
      createdByName: createdByName || null,
      docNumber,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'LESSON', entityId: item.id });
  res.json(item);
}));

router.put('/lessons/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.lessonsLearned.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const { title, situation, projectId, category, rootCause, action, impact, status } = req.body;
  const item = await prisma.lessonsLearned.update({
    where: { id },
    data: { title, situation, projectId, category, rootCause, action, impact, status },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'LESSON', entityId: String(req.params.id) });
  res.json(item);
}));

router.delete('/lessons/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.lessonsLearned.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  await prisma.lessonsLearned.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'LESSON', entityId: String(req.params.id) });
  res.json({ message: 'Silindi.' });
}));

// ── 2) Risk & Fırsat ────────────────────────────────────────────────────────

router.get('/risks', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.riskOpportunity.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { score: 'desc' },
  });
  res.json(items);
}));

router.post('/risks', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { type, title, description, category, probability, impact, response, owner, status, categoryCode } = req.body;
  if (!title) return res.status(400).json({ error: 'Başlık zorunlu.' });
  const p = Math.min(5, Math.max(1, Number(probability) || 3));
  const i = Math.min(5, Math.max(1, Number(impact) || 3));
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.riskOpportunity.create({
    data: {
      tenantId: req.tenantId, title,
      type: type || 'RISK',
      description: description || null,
      category: category || 'OTHER',
      probability: p, impact: i, score: p * i,
      response: response || null,
      owner: owner || null,
      status: status || 'OPEN',
      docNumber,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'RISK', entityId: item.id });
  res.json(item);
}));

router.put('/risks/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.riskOpportunity.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const { type, title, description, category, probability, impact, response, owner, status } = req.body;
  const p = probability !== undefined ? Math.min(5, Math.max(1, Number(probability))) : record.probability;
  const i = impact !== undefined ? Math.min(5, Math.max(1, Number(impact))) : record.impact;
  const item = await prisma.riskOpportunity.update({
    where: { id },
    data: { type, title, description, category, probability: p, impact: i, score: p * i, response, owner, status },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'RISK', entityId: String(req.params.id) });
  res.json(item);
}));

router.delete('/risks/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.riskOpportunity.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  await prisma.riskOpportunity.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'RISK', entityId: String(req.params.id) });
  res.json({ message: 'Silindi.' });
}));

// ── 3) Kurumsal Metrikler (KPI) ─────────────────────────────────────────────

router.get('/metrics', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.corporateMetric.findMany({
    where: { tenantId: req.tenantId },
    orderBy: [{ period: 'desc' }, { name: 'asc' }],
  });
  res.json(items);
}));

router.post('/metrics', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, period, targetValue, actualValue, unit, category, note } = req.body;
  if (!name || !period) return res.status(400).json({ error: 'KPI adı ve dönem zorunlu.' });
  const exists = await prisma.corporateMetric.findFirst({ where: { tenantId: req.tenantId, name, period } });
  if (exists) return res.status(409).json({ error: 'Bu KPI bu dönem için zaten kayıtlı.' });
  const item = await prisma.corporateMetric.create({
    data: {
      tenantId: req.tenantId, name, period,
      targetValue: targetValue != null ? Number(targetValue) : null,
      actualValue: actualValue != null ? Number(actualValue) : null,
      unit: unit || null,
      category: category || 'OTHER',
      note: note || null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'METRIC', entityId: item.id });
  res.json(item);
}));

router.put('/metrics/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.corporateMetric.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const { name, period, targetValue, actualValue, unit, category, note } = req.body;
  const item = await prisma.corporateMetric.update({
    where: { id },
    data: {
      name, period,
      targetValue: targetValue != null ? Number(targetValue) : record.targetValue,
      actualValue: actualValue != null ? Number(actualValue) : record.actualValue,
      unit, category, note,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'METRIC', entityId: String(req.params.id) });
  res.json(item);
}));

router.delete('/metrics/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.corporateMetric.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  await prisma.corporateMetric.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'METRIC', entityId: String(req.params.id) });
  res.json({ message: 'Silindi.' });
}));

// ── 4) Dış Kaynaklı Doküman Sicili ──────────────────────────────────────────

router.get('/external-docs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.externalDocumentRegister.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}));

router.post('/external-docs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, source, externalRef, version, publishedAt, reviewedAt, status, fileUrl, notes, categoryCode } = req.body;
  if (!name) return res.status(400).json({ error: 'Doküman adı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.externalDocumentRegister.create({
    data: {
      tenantId: req.tenantId, name,
      source: source || null,
      externalRef: externalRef || null,
      version: version || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      status: status || 'ACTIVE',
      fileUrl: fileUrl || null,
      notes: notes || null,
      docNumber,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'EXTERNAL_DOC', entityId: item.id });
  res.json(item);
}));

router.put('/external-docs/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.externalDocumentRegister.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const { name, source, externalRef, version, publishedAt, reviewedAt, status, fileUrl, notes } = req.body;
  const item = await prisma.externalDocumentRegister.update({
    where: { id },
    data: {
      name, source, externalRef, version,
      publishedAt: publishedAt ? new Date(publishedAt) : record.publishedAt,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : record.reviewedAt,
      status, fileUrl, notes,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'EXTERNAL_DOC', entityId: String(req.params.id) });
  res.json(item);
}));

router.delete('/external-docs/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.externalDocumentRegister.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  await prisma.externalDocumentRegister.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'EXTERNAL_DOC', entityId: String(req.params.id) });
  res.json({ message: 'Silindi.' });
}));

export default router;
