import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';
import { logActivity } from '../services/activityLog';

const router: Router = Router();

const LEGAL_UPLOADS_ROOT = path.join(__dirname, '../../uploads/legal');
const legalUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
}

// ── Hukuki Vakalar ─────────────────────────────────────────────────────────────

router.get('/cases', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { status, type, relatedEntityId } = req.query as
    { status?: string; type?: string; relatedEntityId?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (relatedEntityId) where.relatedEntityId = relatedEntityId;
  const items = await prisma.legalCase.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(items);
}));

router.post('/cases', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const {
    type, title, status, priority, relatedEntityType, relatedEntityId,
    summary, opinion, assignedToId, assignedToName, requestedById, requestedByName,
    sourceTaskId, dueDate, categoryCode,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'Başlık zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.legalCase.create({
    data: {
      tenantId: req.tenantId,
      type: type || 'CONTRACT_REVIEW',
      title,
      status: status || 'OPEN',
      priority: priority || 'MEDIUM',
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      summary: summary || null,
      opinion: opinion || null,
      assignedToId: assignedToId || null,
      assignedToName: assignedToName || null,
      requestedById: requestedById || null,
      requestedByName: requestedByName || null,
      sourceTaskId: sourceTaskId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      docNumber,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'LEGAL_CASE', entityId: item.id, details: { title: item.title, type: item.type } });
  res.json(item);
}));

router.put('/cases/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.legalCase.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Vaka bulunamadı.' });
  const {
    type, title, status, priority, relatedEntityType, relatedEntityId,
    summary, opinion, assignedToId, assignedToName, dueDate,
  } = req.body;
  const item = await prisma.legalCase.update({
    where: { id },
    data: {
      type, title, status, priority, relatedEntityType, relatedEntityId,
      summary, opinion, assignedToId, assignedToName,
      dueDate: dueDate ? new Date(dueDate) : record.dueDate,
      closedAt: status === 'CLOSED' && !record.closedAt ? new Date() : record.closedAt,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'LEGAL_CASE', entityId: id, details: { title: item.title, status: item.status } });
  res.json(item);
}));

router.delete('/cases/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.legalCase.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Vaka bulunamadı.' });
  await prisma.legalCase.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'LEGAL_CASE', entityId: id });
  res.json({ message: 'Silindi.' });
}));

router.post(
  '/cases/:id/upload',
  tenantMiddleware,
  legalUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
    const record = await prisma.legalCase.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!record) return res.status(404).json({ error: 'Vaka bulunamadı.' });

    const folder = slugify(record.title || record.id);
    const uploadDir = getUploadDir(LEGAL_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${id.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);
    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/legal/${folder}/${safeName}`;
    let fileUrl = localUrl;
    let ncUrl: string | null = null;

    const NC_URL = process.env.NEXTCLOUD_URL;
    const NC_USER = process.env.NEXTCLOUD_USER;
    const NC_PASS = process.env.NEXTCLOUD_PASS;
    if (NC_URL && NC_USER && NC_PASS) {
      try {
        const remotePath = `/ENFLOW_DMS/Hukuk/${folder}`;
        ncUrl = await uploadToNextcloud(req.file.buffer, safeName, remotePath, NC_URL, NC_USER, NC_PASS);
        fileUrl = ncUrl;
      } catch (e) {
        console.warn('[Nextcloud] Legal upload failed, using local:', (e as Error).message);
        fileUrl = localUrl;
      }
    }

    const item = await prisma.legalCase.update({ where: { id }, data: { fileUrl } });
    res.json({ case: item, localUrl, nextcloudUrl: ncUrl });
  })
);

// ── Gelen Hukuk Talepleri (TodoTask.relatedModule='LEGAL') ──────────────────────
// Faz 4 passthrough'u korunur — LEGAL görevleri "gelen talep" olarak listelenir.

router.get('/requests', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tasks = await prisma.todoTask.findMany({
    where: { tenantId: req.tenantId, relatedModule: 'LEGAL' },
    orderBy: { createdAt: 'desc' },
  });
  // Hangi talepler zaten vakaya dönüştürülmüş?
  const cases = await prisma.legalCase.findMany({
    where: { tenantId: req.tenantId, sourceTaskId: { not: null } },
    select: { sourceTaskId: true },
  });
  const converted = new Set(cases.map(c => c.sourceTaskId));
  res.json(tasks.map(t => ({ ...t, converted: converted.has(t.id) })));
}));

export default router;
