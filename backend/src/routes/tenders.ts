import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';
import { analyzeSpec } from '../services/specAnalysis';
import { sweepTenderReminders } from '../services/tenderReminders';

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
  await sweepTenderReminders(req.tenantId); // zaman-eşiği hatırlatmaları (non-throwing)
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
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'TENDER', entityId: item.id, details: { name: item.name, ikn: item.ikn } });
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
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CONTRACT_WORKFLOW_CREATED', entityType: 'TENDER', entityId: id, details: { contractWorkflowId: wf.id } });
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'TENDER', entityId: id, details: { name: item.name, status: item.status } });
  res.json(item);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.tender.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İhale bulunamadı.' });
  await prisma.tender.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'TENDER', entityId: id });
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
  const { name, isRequired, sortOrder, notes, docType } = req.body;
  if (!name) return res.status(400).json({ error: 'Evrak adı zorunlu.' });
  const count = await prisma.tenderChecklistItem.count({ where: { tenderId: id } });
  const item = await prisma.tenderChecklistItem.create({
    data: {
      tenderId: id,
      name,
      isRequired: isRequired !== false,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : count,
      notes: notes || null,
      docType: docType || null,
      source: 'MANUAL',
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

// ── İhale dosyası analizi: şartname → verilecek dökümanlar listesi ─────────────
function trLower(s: string): string { return (s || '').toLocaleLowerCase('tr-TR'); }
function nameMatches(itemName: string, docName: string): boolean {
  const a = trLower(itemName), b = trLower(docName);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const at = new Set(a.split(/\s+/).filter(w => w.length > 3));
  const bt = b.split(/\s+/).filter(w => w.length > 3);
  const overlap = bt.filter(w => at.has(w)).length;
  return overlap >= 2; // en az 2 anlamlı ortak kelime
}

/** Şirket Evrakları envanterinden geçerli evrakları checklist'e otomatik eşle. Eşlenen sayısını döner. */
async function autoMatchCorporateDocs(tenantId: string, tenderId: string, deadline: Date | null): Promise<number> {
  const items = await prisma.tenderChecklistItem.findMany({ where: { tenderId, status: 'PENDING' } });
  const corpDocs = await prisma.corporateDocument.findMany({ where: { tenantId } });
  const validRef = deadline || new Date();
  let matched = 0;
  for (const item of items) {
    const cand = corpDocs.find(d => nameMatches(item.name, d.name) && (!d.expiryDate || d.expiryDate > validRef));
    if (cand) {
      await prisma.tenderChecklistItem.update({
        where: { id: item.id },
        data: {
          status: 'DONE', source: 'CORPORATE_DOC', corporateDocId: cand.id,
          ...(cand.fileUrl ? { fileUrl: cand.fileUrl } : {}),
          notes: `Şirket Evrakları envanterinden otomatik eklendi${cand.expiryDate ? ` (geçerli: ${cand.expiryDate.toLocaleDateString('tr-TR')})` : ''}`,
        },
      });
      matched++;
    }
  }
  return matched;
}

router.post('/:id/analyze', tenantMiddleware, tenderUpload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const tender = await prisma.tender.findFirst({ where: { id, tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });

  // Girdi: yüklenen dosya (PDF/TXT) veya body.specText
  let specText = String(req.body.specText || tender.specText || '');
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.pdf') {
      try {
        const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
        const parsed = await pdfParse(req.file.buffer);
        specText = parsed.text || specText;
      } catch {
        return res.status(422).json({ error: 'PDF metni çıkarılamadı (taranmış olabilir). Metni elle yapıştırın veya manuel liste oluşturun.' });
      }
    } else {
      specText = req.file.buffer.toString('utf-8');
    }
  }
  if (!specText.trim()) {
    return res.status(400).json({ error: 'Analiz için şartname metni veya dosya gerekli.' });
  }

  const { analysis, usedAI } = await analyzeSpec(specText, { tenantId: req.tenantId, fallbackName: tender.name, fallbackNo: tender.ikn });

  await prisma.tender.update({ where: { id }, data: { specText, aiAnalysis: JSON.stringify(analysis), status: tender.status === 'DRAFT' ? 'PREPARING' : tender.status } });

  // Eski AI-üretilen kalemleri tazele, yenilerini ekle (manuel kalemler korunur)
  await prisma.tenderChecklistItem.deleteMany({ where: { tenderId: id, isAiGenerated: true } });
  const base = await prisma.tenderChecklistItem.count({ where: { tenderId: id } });
  await prisma.tenderChecklistItem.createMany({
    data: analysis.documents.map((d, i) => ({
      tenderId: id, name: d.name, docType: d.docType || 'OTHER', isRequired: d.deadline_priority !== 'LOW',
      isAiGenerated: true, source: 'AI', sortOrder: base + i,
      deadline: tender.submissionDeadline, notes: d.notes || null,
    })),
  });

  const matched = await autoMatchCorporateDocs(tenantId, id, tender.submissionDeadline);
  await logActivity({ tenantId, userId: req.userId, action: 'TENDER_ANALYZE', entityType: 'TENDER', entityId: id, details: { usedAI, docs: analysis.documents.length, autoMatched: matched } });

  const items = await prisma.tenderChecklistItem.findMany({ where: { tenderId: id }, orderBy: { sortOrder: 'asc' } });
  res.json({ usedAI, autoMatched: matched, checklist: items });
}));

router.post('/:id/auto-match', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const tender = await prisma.tender.findFirst({ where: { id, tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  const matched = await autoMatchCorporateDocs(tenantId, id, tender.submissionDeadline);
  await logActivity({ tenantId, userId: req.userId, action: 'TENDER_AUTOMATCH', entityType: 'TENDER', entityId: id, details: { autoMatched: matched } });
  const items = await prisma.tenderChecklistItem.findMany({ where: { tenderId: id }, orderBy: { sortOrder: 'asc' } });
  res.json({ autoMatched: matched, checklist: items });
}));

// "Teklif İletildi" — dosyayı "Girilen İhaleler" arşivine taşı (status=SUBMITTED)
router.post('/:id/submit', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const { force } = req.body as { force?: boolean };
  const tender = await prisma.tender.findFirst({ where: { id, tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  if (['SUBMITTED', 'EVALUATING', 'WON', 'LOST'].includes(tender.status)) {
    return res.status(409).json({ error: 'İhale zaten teslim edilmiş/sonuçlanmış.' });
  }

  // Eksik zorunlu döküman kontrolü (force ile geçilebilir)
  const items = await prisma.tenderChecklistItem.findMany({ where: { tenderId: id } });
  const missing = items.filter(i => i.isRequired && !['DONE', 'WAIVED'].includes(i.status));
  if (missing.length > 0 && !force) {
    return res.status(422).json({ error: 'Eksik zorunlu döküman var.', missing: missing.map(m => m.name) });
  }

  const updated = await prisma.tender.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  await logActivity({ tenantId, userId: req.userId, action: 'TENDER_SUBMITTED', entityType: 'TENDER', entityId: id, details: { name: tender.name, forced: !!force, missing: missing.length } });
  res.json(updated);
}));

// Yönetim "iştirak etme" kararı — akışı keser, KPI-nötr (yalnız GM, teklif verilmeden önce)
router.post('/:id/withdraw', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'Çekilme gerekçesi zorunludur.' });

  const tender = await prisma.tender.findFirst({ where: { id, tenantId } });
  if (!tender) return res.status(404).json({ error: 'İhale bulunamadı.' });
  if (!['DRAFT', 'PREPARING'].includes(tender.status)) {
    return res.status(409).json({ error: 'Yalnız teklif verilmeden önce (taslak/hazırlık) iştirak kararı alınabilir.' });
  }

  const updated = await prisma.tender.update({
    where: { id },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnById: req.userId || null, withdrawReason: reason },
  });

  // Bağlı fırsat: LOST değil → nötr WITHDRAWN (KPI cezası yok, kayıp arşivi tetiklenmez)
  let opp: { assignedToId: string } | null = null;
  if (tender.opportunityId) {
    opp = await prisma.opportunity.update({
      where: { id: tender.opportunityId },
      data: { status: 'WITHDRAWN' },
      select: { assignedToId: true },
    }).catch(() => null);
  }

  // Emek-birimlerini bilgilendir: karar yönetimsel, KPI'yı etkilemez
  const effortUsers = await prisma.user.findMany({ where: { tenantId, role: { in: ['SALES_SUPPORT', 'PRESALES_ENG', 'PRESALES_MGR'] } }, select: { id: true } });
  const recipientIds = [...new Set([opp?.assignedToId, ...effortUsers.map(u => u.id)].filter(Boolean) as string[])];
  for (const userId of recipientIds) {
    await prisma.notification.create({
      data: {
        tenantId, userId, type: 'INFO',
        title: 'Yönetim kararı: iştirak edilmedi',
        message: `"${tender.name}" ihalesine yönetim kararıyla iştirak edilmeyecek. Gerekçe: ${reason}. Bu karar emeğinizi geçersiz kılmaz ve birim KPI'nıza olumsuz etki etmez.`,
      },
    }).catch(() => {});
  }

  await logActivity({ tenantId, userId: req.userId, action: 'TENDER_WITHDRAWN', entityType: 'TENDER', entityId: id, details: { name: tender.name, reason, opportunityId: tender.opportunityId } });
  res.json(updated);
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
