// Fırsat oluşturulurken zorunlu 3 evrak (teknik şartname/idari şartname/sözleşme
// taslağı) + serbest ek evraklar (OTHER). Fırsat evraksız da oluşturulabilir —
// zorunluluk yalnız Presales BoM girişinde kontrol edilir (bkz. opportunities.ts
// POST /:id/bom). Dosyalar ortak Fırsat klasör köküne yazılır (bkz.
// opportunityFolderService.ts) — Presales bu evraklara göre ürün pozisyonlar.
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { documentUpload, enforceStorageLimit } from '../utils/secureUpload';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { resolveOpportunityUploadDir, opportunityLocalUrl, opportunityRemotePath } from '../services/opportunityFolderService';
import { tryUploadToNextcloud } from '../utils/fileUpload';

const router: Router = Router();
router.use(tenantMiddleware);

// Fırsatı oluşturan/satış tarafı yükler + GM her zaman yetkili; okuma tenantMiddleware
// ile herkese açık (Presales bu evraklara göre pozisyonlama yapabilsin diye).
const CAN_MUTATE = requireRole(['GENERAL_MANAGER', 'SALES_REP', 'SALES_MGR']);

export const REQUIRED_DOC_TYPES = ['TECH_SPEC', 'ADMIN_SPEC', 'CONTRACT_DRAFT'] as const;
const DEFAULT_REQUIRED_DOCS: { docType: string; name: string }[] = [
  { docType: 'TECH_SPEC', name: 'Teknik Şartname' },
  { docType: 'ADMIN_SPEC', name: 'İdari Şartname' },
  { docType: 'CONTRACT_DRAFT', name: 'Sözleşme Taslağı' },
];

const upload = documentUpload(50);

async function findOpportunity(oppId: string, tenantId: string) {
  return prisma.opportunity.findFirst({ where: { id: oppId, tenantId }, select: { id: true, trackingCode: true } });
}

router.get('/:oppId/required-docs', asyncHandler(async (req: Request, res: Response) => {
  const oppId = String(req.params.oppId);
  const opp = await findOpportunity(oppId, req.tenantId);
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  let docs = await prisma.opportunityRequiredDoc.findMany({ where: { opportunityId: oppId }, orderBy: { sortOrder: 'asc' } });
  if (docs.length === 0) {
    await prisma.opportunityRequiredDoc.createMany({
      data: DEFAULT_REQUIRED_DOCS.map((d, i) => ({
        tenantId: req.tenantId, opportunityId: oppId, docType: d.docType, name: d.name,
        isRequired: true, sortOrder: i,
      })),
    });
    docs = await prisma.opportunityRequiredDoc.findMany({ where: { opportunityId: oppId }, orderBy: { sortOrder: 'asc' } });
  }
  res.json(docs);
}));

// Serbest ek evrak ekle (yalnız OTHER — 3 sabit evrak silinemez/eklenemez)
router.post('/:oppId/required-docs', CAN_MUTATE, asyncHandler(async (req: Request, res: Response) => {
  const oppId = String(req.params.oppId);
  const opp = await findOpportunity(oppId, req.tenantId);
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Evrak adı zorunlu.' });

  const maxSort = await prisma.opportunityRequiredDoc.aggregate({ where: { opportunityId: oppId }, _max: { sortOrder: true } });
  const doc = await prisma.opportunityRequiredDoc.create({
    data: { tenantId: req.tenantId, opportunityId: oppId, docType: 'OTHER', name, isRequired: false, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'OPPORTUNITY_DOC', entityId: doc.id, details: { opportunityId: oppId, name } });
  res.json(doc);
}));

router.post(
  '/:oppId/required-docs/:docId/upload',
  CAN_MUTATE,
  upload.single('file'),
  enforceStorageLimit(),
  asyncHandler(async (req: Request, res: Response) => {
    const oppId = String(req.params.oppId);
    const docId = String(req.params.docId);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });

    const opp = await findOpportunity(oppId, req.tenantId);
    if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

    // IDOR koruması: docId gerçekten bu fırsata + tenant'a ait mi?
    const docOwned = await prisma.opportunityRequiredDoc.findFirst({
      where: { id: docId, opportunityId: oppId, tenantId: req.tenantId },
      select: { id: true },
    });
    if (!docOwned) return res.status(404).json({ error: 'Evrak bulunamadı.' });

    // trackingCode Faz A itibarıyla her fırsatta garanti (yeni kayıtlar + backfill) —
    // yine de savunmacı fallback: yoksa opportunityId klasör adı olarak kullanılır.
    const trackingCode = opp.trackingCode || opp.id;
    const { dir: uploadDir, folder } = resolveOpportunityUploadDir(trackingCode, 'required-docs');

    const ext = path.extname(req.file.originalname);
    const safeName = `${docId.slice(-8)}_${path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
    fs.writeFileSync(path.join(uploadDir, safeName), req.file.buffer);

    const localUrl = opportunityLocalUrl(trackingCode, 'required-docs', safeName);
    const ncUrl = await tryUploadToNextcloud(req.tenantId, req.file.buffer, safeName, opportunityRemotePath(trackingCode, 'required-docs'));
    const fileUrl = ncUrl || localUrl;

    const doc = await prisma.opportunityRequiredDoc.update({
      where: { id: docId },
      data: { fileUrl, fileName: req.file.originalname, status: 'UPLOADED', updatedAt: new Date() },
    });
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPLOAD', entityType: 'OPPORTUNITY_DOC', entityId: docId, details: { opportunityId: oppId, fileName: req.file.originalname } });

    res.json({ doc, localUrl, nextcloudUrl: ncUrl, folder, fileName: safeName });
  })
);

router.delete('/:oppId/required-docs/:docId', CAN_MUTATE, asyncHandler(async (req: Request, res: Response) => {
  const oppId = String(req.params.oppId);
  const docId = String(req.params.docId);
  const existing = await prisma.opportunityRequiredDoc.findFirst({ where: { id: docId, opportunityId: oppId, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Evrak bulunamadı.' });
  if (existing.docType !== 'OTHER') return res.status(400).json({ error: 'Zorunlu evrak silinemez.' });
  await prisma.opportunityRequiredDoc.delete({ where: { id: docId } });
  res.json({ success: true });
}));

export default router;
