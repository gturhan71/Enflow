import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';

const router: Router = Router();

const TENDER_UPLOADS_ROOT = path.join(__dirname, '../../uploads/tenders');
const tenderUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Standart ihale uygunluk/evrak listesi (özgün, üçüncü-taraf notasyonu yok)
const DEFAULT_CHECKLIST: { name: string; isRequired: boolean }[] = [
  { name: 'İhale İlanı / Davet Yazısı', isRequired: true },
  { name: 'İdari Şartname', isRequired: true },
  { name: 'Teknik Şartname', isRequired: true },
  { name: 'Birim Fiyat Teklif Cetveli', isRequired: true },
  { name: 'Geçici Teminat Mektubu', isRequired: true },
  { name: 'İmza Sirküleri', isRequired: true },
  { name: 'Ticaret Sicil Gazetesi', isRequired: true },
  { name: 'Vergi Borcu Yoktur Belgesi', isRequired: true },
  { name: 'SGK Borcu Yoktur Belgesi', isRequired: true },
  { name: 'İş Deneyim Belgesi', isRequired: false },
];

async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
}

// ── İhaleler ────────────────────────────────────────────────────────────────────

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { status, method } = req.query as { status?: string; method?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (method) where.method = method;
  const items = await prisma.tender.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { checklist: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(items);
}));

router.get('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const item = await prisma.tender.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { checklist: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!item) return res.status(404).json({ error: 'İhale bulunamadı.' });
  res.json(item);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const {
    name, ikn, authority, method, status, submissionDeadline, estimatedValue, currency,
    opportunityId, contractWorkflowId, ekapRef, ownerId, ownerName, notes, categoryCode,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'İhale adı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.tender.create({
    data: {
      tenantId: req.tenantId,
      name,
      ikn: ikn || null,
      authority: authority || null,
      method: method || 'OPEN',
      status: status || 'DRAFT',
      submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : null,
      estimatedValue: typeof estimatedValue === 'number' ? estimatedValue : 0,
      currency: currency || 'TRY',
      opportunityId: opportunityId || null,
      contractWorkflowId: contractWorkflowId || null,
      ekapRef: ekapRef || null,
      ownerId: ownerId || null,
      ownerName: ownerName || null,
      notes: notes || null,
      docNumber,
    },
  });
  res.json(item);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İhale bulunamadı.' });
  const {
    name, ikn, authority, method, status, submissionDeadline, estimatedValue, currency,
    opportunityId, contractWorkflowId, ekapRef, ownerId, ownerName, notes,
  } = req.body;
  let item = await prisma.tender.update({
    where: { id },
    data: {
      name, ikn, authority, method, status,
      submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : record.submissionDeadline,
      estimatedValue: typeof estimatedValue === 'number' ? estimatedValue : record.estimatedValue,
      currency, opportunityId, contractWorkflowId, ekapRef, ownerId, ownerName, notes,
    },
  });

  // İhale WON → otomatik ContractWorkflow oluştur + bağla (idempotent: contractWorkflowId boşsa)
  if (record.status !== 'WON' && status === 'WON' && !item.contractWorkflowId) {
    const composedTitle = item.ikn ? `${item.name} — İKN: ${item.ikn}` : item.name;
    const wf = await prisma.contractWorkflow.create({
      data: {
        title: composedTitle,
        tenderName: item.name,
        tenderNo: item.ikn || null,
        contractValue: item.estimatedValue || 0,
        opportunityId: item.opportunityId || null,
        status: 'DRAFT',
        tenantId: req.tenantId,
      },
    });
    item = await prisma.tender.update({ where: { id }, data: { contractWorkflowId: wf.id } });
  }

  res.json(item);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İhale bulunamadı.' });
  await prisma.tender.delete({ where: { id } });
  res.json({ message: 'Silindi.' });
}));

// ── Uygunluk Denetimi / Checklist ───────────────────────────────────────────────

router.get('/:id/checklist', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tender = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  let items = await prisma.tenderChecklistItem.findMany({ where: { tenderId: id }, orderBy: { sortOrder: 'asc' } });
  // Boşsa standart listeyi seed et
  if (items.length === 0) {
    await prisma.tenderChecklistItem.createMany({
      data: DEFAULT_CHECKLIST.map((c, i) => ({ tenderId: id, name: c.name, isRequired: c.isRequired, sortOrder: i })),
    });
    items = await prisma.tenderChecklistItem.findMany({ where: { tenderId: id }, orderBy: { sortOrder: 'asc' } });
  }
  res.json(items);
}));

router.post('/:id/checklist', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tender = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  const { name, isRequired, sortOrder, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Evrak adı zorunlu.' });
  const count = await prisma.tenderChecklistItem.count({ where: { tenderId: id } });
  const item = await prisma.tenderChecklistItem.create({
    data: {
      tenderId: id,
      name,
      isRequired: isRequired !== false,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : count,
      notes: notes || null,
    },
  });
  res.json(item);
}));

router.put('/:id/checklist/:itemId', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const itemId = String(req.params.itemId);
  const tender = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  const record = await prisma.tenderChecklistItem.findFirst({ where: { id: itemId, tenderId: id } });
  if (!record) return res.status(404).json({ error: 'Evrak bulunamadı.' });
  const { name, isRequired, status, sortOrder, notes } = req.body;
  const item = await prisma.tenderChecklistItem.update({
    where: { id: itemId },
    data: { name, isRequired, status, sortOrder, notes },
  });
  res.json(item);
}));

router.delete('/:id/checklist/:itemId', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const itemId = String(req.params.itemId);
  const tender = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  const record = await prisma.tenderChecklistItem.findFirst({ where: { id: itemId, tenderId: id } });
  if (!record) return res.status(404).json({ error: 'Evrak bulunamadı.' });
  await prisma.tenderChecklistItem.delete({ where: { id: itemId } });
  res.json({ message: 'Silindi.' });
}));

router.post(
  '/:id/checklist/:itemId/upload',
  tenantMiddleware,
  tenderUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const itemId = String(req.params.itemId);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
    const tender = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
    const record = await prisma.tenderChecklistItem.findFirst({ where: { id: itemId, tenderId: id } });
    if (!record) return res.status(404).json({ error: 'Evrak bulunamadı.' });

    const folder = slugify(tender.name || tender.id);
    const uploadDir = getUploadDir(TENDER_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${itemId.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);
    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/tenders/${folder}/${safeName}`;
    let fileUrl = localUrl;
    let ncUrl: string | null = null;

    const NC_URL = process.env.NEXTCLOUD_URL;
    const NC_USER = process.env.NEXTCLOUD_USER;
    const NC_PASS = process.env.NEXTCLOUD_PASS;
    if (NC_URL && NC_USER && NC_PASS) {
      try {
        const remotePath = `/ENFLOW_DMS/Ihale/${folder}`;
        ncUrl = await uploadToNextcloud(req.file.buffer, safeName, remotePath, NC_URL, NC_USER, NC_PASS);
        fileUrl = ncUrl;
      } catch (e) {
        console.warn('[Nextcloud] Tender upload failed, using local:', (e as Error).message);
        fileUrl = localUrl;
      }
    }

    const item = await prisma.tenderChecklistItem.update({
      where: { id: itemId },
      data: { fileUrl, status: 'DONE' },
    });
    res.json({ item, localUrl, nextcloudUrl: ncUrl });
  })
);

export default router;
