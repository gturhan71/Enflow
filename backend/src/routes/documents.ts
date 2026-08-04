import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';
import { documentUpload } from '../utils/secureUpload';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';

const router: Router = Router();
const DOCUMENT_UPLOADS_ROOT = path.join(__dirname, '../../uploads/documents');
const corporateDocUpload = documentUpload(50);

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const docs = await prisma.corporateDocument.findMany({ where: { tenantId: req.tenantId } });
  res.json(docs);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const doc = await prisma.corporateDocument.create({
    data: {
      ...rest,
      expiryDate: expiryDate ? new Date(expiryDate as string) : null,
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      tenantId: req.tenantId
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'DOCUMENT', entityId: doc.id, details: { name: doc.name, category: doc.category } });
  res.json(doc);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (expiryDate) data.expiryDate = new Date(expiryDate as string);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const doc = await prisma.corporateDocument.update({ where: { id }, data });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'DOCUMENT', entityId: id });
  res.json(doc);
}));

router.post(
  '/:id/upload',
  tenantMiddleware,
  corporateDocUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
    const doc = await prisma.corporateDocument.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!doc) return res.status(404).json({ error: 'Doküman bulunamadı.' });

    const folder = slugify(doc.name || doc.id);
    const uploadDir = getUploadDir(DOCUMENT_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${id.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);
    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/documents/${folder}/${safeName}`;
    let fileUrl = localUrl;
    let ncUrl: string | null = null;

    const NC_URL = process.env.NEXTCLOUD_URL;
    const NC_USER = process.env.NEXTCLOUD_USER;
    const NC_PASS = process.env.NEXTCLOUD_PASS;
    if (NC_URL && NC_USER && NC_PASS) {
      try {
        const remotePath = `/ENFLOW_DMS/SirketEvraklari/${folder}`;
        ncUrl = await uploadToNextcloud(req.file.buffer, safeName, remotePath, NC_URL, NC_USER, NC_PASS);
        fileUrl = ncUrl;
      } catch (e) {
        logger.warn('[Nextcloud] Document upload failed, using local:', (e as Error).message);
        fileUrl = localUrl;
      }
    }

    const updated = await prisma.corporateDocument.update({ where: { id }, data: { fileUrl } });
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPLOAD', entityType: 'DOCUMENT', entityId: id, details: { fileUrl } });
    res.json({ doc: updated, localUrl, nextcloudUrl: ncUrl });
  })
);

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.corporateDocument.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'DOCUMENT', entityId: id });
  res.json({ message: 'Doküman silindi.' });
}));

export default router;
