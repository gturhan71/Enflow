import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { documentUpload, enforceStorageLimit } from '../utils/secureUpload';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';
import { slugify, getUploadDir, tryUploadToNextcloud } from '../utils/fileUpload';

const router: Router = Router();
router.use(tenantMiddleware);

const QUOTE_UPLOADS_ROOT = path.join(__dirname, '../../uploads/bom-quotes');
const quoteUpload = documentUpload(25);

// Bir fırsatın tüm BoM teklifleri (lineKey ile gruplanır)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.query.opportunityId ? String(req.query.opportunityId) : undefined;
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId zorunlu.' });
  const quotes = await prisma.boMLineQuote.findMany({
    where: { tenantId: req.tenantId, opportunityId },
    orderBy: [{ lineKey: 'asc' }, { unitPrice: 'asc' }],
  });
  res.json(quotes);
}));

// Teklif ekle
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    opportunityId, lineKey, componentName, vendorId, vendorName,
    unitPrice, currency, technicalCompliance, specSummary, deliveryDays, validUntil, notes,
  } = req.body;
  if (!opportunityId || !lineKey || !vendorName) {
    return res.status(400).json({ error: 'opportunityId, lineKey ve vendorName zorunlu.' });
  }
  const quote = await prisma.boMLineQuote.create({
    data: {
      tenantId: req.tenantId,
      opportunityId: String(opportunityId),
      lineKey: String(lineKey),
      componentName: componentName || null,
      vendorId: vendorId || null,
      vendorName: String(vendorName),
      unitPrice: parseFloat(String(unitPrice)) || 0,
      currency: currency || 'TRY',
      technicalCompliance: ['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT'].includes(technicalCompliance) ? technicalCompliance : 'COMPLIANT',
      specSummary: specSummary || null,
      deliveryDays: deliveryDays != null ? parseInt(String(deliveryDays)) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'BOM_QUOTE', entityId: quote.id, details: { opportunityId, lineKey, vendorName, technicalCompliance: quote.technicalCompliance } });
  res.json(quote);
}));

router.put('/:qid', asyncHandler(async (req: Request, res: Response) => {
  const qid = String(req.params.qid);
  const existing = await prisma.boMLineQuote.findFirst({ where: { id: qid, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  const { vendorId, vendorName, unitPrice, currency, technicalCompliance, specSummary, deliveryDays, validUntil, notes } = req.body;
  const quote = await prisma.boMLineQuote.update({
    where: { id: qid },
    data: {
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
      ...(vendorName !== undefined && { vendorName: String(vendorName) }),
      ...(unitPrice !== undefined && { unitPrice: parseFloat(String(unitPrice)) || 0 }),
      ...(currency !== undefined && { currency }),
      ...(technicalCompliance !== undefined && ['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT'].includes(technicalCompliance) && { technicalCompliance }),
      ...(specSummary !== undefined && { specSummary: specSummary || null }),
      ...(deliveryDays !== undefined && { deliveryDays: deliveryDays != null ? parseInt(String(deliveryDays)) : null }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });
  res.json(quote);
}));

router.delete('/:qid', asyncHandler(async (req: Request, res: Response) => {
  const qid = String(req.params.qid);
  const existing = await prisma.boMLineQuote.findFirst({ where: { id: qid, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  await prisma.boMLineQuote.delete({ where: { id: qid } });
  res.json({ ok: true });
}));

// Teklif seç → BoM kalemine işle (yalnız teknik-uygun seçilebilir)
router.post('/:qid/select', asyncHandler(async (req: Request, res: Response) => {
  const qid = String(req.params.qid);
  const tenantId = req.tenantId;
  const quote = await prisma.boMLineQuote.findFirst({ where: { id: qid, tenantId } });
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  if (quote.technicalCompliance === 'NON_COMPLIANT') {
    return res.status(422).json({ error: 'Teknik olarak uygun olmayan teklif BoM\'a seçilemez.' });
  }
  // Aynı satırdaki diğerlerini bırak, bunu seç
  await prisma.boMLineQuote.updateMany({ where: { tenantId, opportunityId: quote.opportunityId, lineKey: quote.lineKey }, data: { isSelected: false } });
  const selected = await prisma.boMLineQuote.update({ where: { id: qid }, data: { isSelected: true } });

  // Eşleşen BoMItem'a seçili teklifin fiyat/vendor/kaynağını işle
  await prisma.boMItem.updateMany({
    where: { opportunityId: quote.opportunityId, lineKey: quote.lineKey },
    data: { purchaseCost: quote.unitPrice, vendor: quote.vendorName, source: quote.vendorId ? 'VENDOR_QUOTE' : (quote.specSummary ? 'EVALUATED' : 'VENDOR_QUOTE'), ...(quote.currency ? { currency: quote.currency } : {}) },
  }).catch(() => {});

  await logActivity({ tenantId, userId: req.userId, action: 'SELECT_BOM_QUOTE', entityType: 'BOM_QUOTE', entityId: qid, details: { opportunityId: quote.opportunityId, lineKey: quote.lineKey, vendorName: quote.vendorName, unitPrice: quote.unitPrice } });
  res.json(selected);
}));

// Orijinal teklif dosyası yükle (xls/xlsx/xml/doc/docx/pdf) — seçim kanıtı
const ALLOWED_EXT = ['.pdf', '.xls', '.xlsx', '.xml', '.doc', '.docx', '.csv'];
router.post('/:qid/upload', quoteUpload.single('file'), enforceStorageLimit(), asyncHandler(async (req: Request, res: Response) => {
  const qid = String(req.params.qid);
  const tenantId = req.tenantId;
  if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
  const quote = await prisma.boMLineQuote.findFirst({ where: { id: qid, tenantId } });
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return res.status(415).json({ error: `Desteklenmeyen format. İzinli: ${ALLOWED_EXT.join(', ')}` });
  }

  const folder = slugify(`${quote.opportunityId}_${quote.lineKey}`);
  const uploadDir = getUploadDir(QUOTE_UPLOADS_ROOT, folder);
  const safeName = `${qid.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
  fs.writeFileSync(path.join(uploadDir, safeName), req.file.buffer);
  const localUrl = `/uploads/bom-quotes/${folder}/${safeName}`;
  const ncUrl = await tryUploadToNextcloud(tenantId, req.file.buffer, safeName, `/ENFLOW_DMS/BoM_Teklifleri/${folder}`);
  const fileUrl = ncUrl || localUrl;

  const updated = await prisma.boMLineQuote.update({ where: { id: qid }, data: { fileUrl, fileName: req.file.originalname } });
  await logActivity({ tenantId, userId: req.userId, action: 'UPLOAD_BOM_QUOTE_FILE', entityType: 'BOM_QUOTE', entityId: qid, details: { fileName: req.file.originalname } });
  res.json({ quote: updated, localUrl, nextcloudUrl: ncUrl });
}));

export default router;
