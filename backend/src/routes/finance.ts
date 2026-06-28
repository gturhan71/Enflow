import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';
import { logActivity } from '../services/activityLog';
import { computeFinancingEffect, paymentDate, CashEvent } from '../services/financingEffect';
import { sumByCurrency, presentBreakdown, LineInput } from '../services/financeEngine';

const DEFAULT_RATES: Record<string, number> = { TRY: 50, USD: 10, EUR: 8 };

const router: Router = Router();

const GUARANTEE_UPLOADS_ROOT = path.join(__dirname, '../../uploads/guarantees');
const guaranteeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Opsiyonel docNumber üretimi (CorporateGovernance pattern'i ile aynı).
async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
}

// Fatura statüsü tahsil edilen tutara + vadeye göre türetilir.
function deriveInvoiceStatus(amount: number, paidAmount: number, dueDate: Date | null, current: string): string {
  if (current === 'DRAFT' || current === 'CANCELLED') return current;
  if (paidAmount >= amount && amount > 0) return 'PAID';
  if (paidAmount > 0 && paidAmount < amount) return 'PARTIAL';
  if (dueDate && dueDate.getTime() < Date.now() && paidAmount < amount) return 'OVERDUE';
  return current === 'PAID' || current === 'PARTIAL' ? 'ISSUED' : current;
}

async function recalcInvoice(invoiceId: string): Promise<void> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return;
  const paidAmount = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = deriveInvoiceStatus(inv.amount, paidAmount, inv.dueDate, inv.status);
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, status, paidAt: paidAmount >= inv.amount && inv.amount > 0 ? new Date() : null },
  });
}

// ── 1) Faturalar ─────────────────────────────────────────────────────────────

router.get('/invoices', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { projectId, status, type } = req.query as { projectId?: string; status?: string; type?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (type) where.type = type;
  const items = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { payments: { orderBy: { paidAt: 'desc' } } },
  });
  res.json(items);
}));

router.post('/invoices', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const {
    type, invoiceNo, amount, currency, issueDate, dueDate, status,
    projectId, contractId, milestoneId, customerName, vendorName,
    notes, createdById, categoryCode,
  } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Fatura tutarı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.invoice.create({
    data: {
      tenantId: req.tenantId,
      type: type || 'SALES',
      invoiceNo: invoiceNo || null,
      amount: Number(amount) || 0,
      currency: currency || 'TRY',
      issueDate: issueDate ? new Date(issueDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'DRAFT',
      projectId: projectId || null,
      contractId: contractId || null,
      milestoneId: milestoneId || null,
      customerName: customerName || null,
      vendorName: vendorName || null,
      notes: notes || null,
      createdById: createdById || null,
      docNumber,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'INVOICE', entityId: item.id, details: { type: item.type, amount: item.amount, invoiceNo: item.invoiceNo } });
  res.json(item);
}));

router.put('/invoices/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.invoice.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Fatura bulunamadı.' });
  const {
    type, invoiceNo, amount, currency, issueDate, dueDate, status,
    projectId, contractId, milestoneId, customerName, vendorName, notes,
  } = req.body;
  await prisma.invoice.update({
    where: { id },
    data: {
      type, invoiceNo,
      amount: amount != null ? Number(amount) : record.amount,
      currency, status,
      issueDate: issueDate ? new Date(issueDate) : record.issueDate,
      dueDate: dueDate ? new Date(dueDate) : record.dueDate,
      projectId, contractId, milestoneId, customerName, vendorName, notes,
    },
  });
  await recalcInvoice(id);
  const item = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  res.json(item);
}));

router.delete('/invoices/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.invoice.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Fatura bulunamadı.' });
  await prisma.invoice.delete({ where: { id } });
  res.json({ message: 'Silindi.' });
}));

// ── 2) Tahsilat / Ödemeler ─────────────────────────────────────────────────────

router.get('/invoices/:id/payments', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.invoice.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Fatura bulunamadı.' });
  const items = await prisma.payment.findMany({ where: { invoiceId: id }, orderBy: { paidAt: 'desc' } });
  res.json(items);
}));

router.post('/invoices/:id/payments', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.invoice.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Fatura bulunamadı.' });
  const { amount, currency, paidAt, method, reference, notes } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Ödeme tutarı zorunlu.' });
  const payment = await prisma.payment.create({
    data: {
      tenantId: req.tenantId,
      invoiceId: id,
      amount: Number(amount) || 0,
      currency: currency || record.currency,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: method || null,
      reference: reference || null,
      notes: notes || null,
    },
  });
  await recalcInvoice(id);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'PAYMENT', entityType: 'INVOICE', entityId: id, details: { amount: payment.amount, paidTotal: invoice?.paidAmount, status: invoice?.status } });
  res.json({ payment, invoice });
}));

router.delete('/payments/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.payment.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Ödeme kaydı bulunamadı.' });
  await prisma.payment.delete({ where: { id } });
  await recalcInvoice(record.invoiceId);
  res.json({ message: 'Silindi.' });
}));

// ── 3) Teminat Mektupları ──────────────────────────────────────────────────────

router.get('/guarantees', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { status, type, projectId, tenderId } = req.query as
    { status?: string; type?: string; projectId?: string; tenderId?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (projectId) where.projectId = projectId;
  if (tenderId) where.tenderId = tenderId;
  const items = await prisma.guaranteeLetter.findMany({ where, orderBy: { expiryDate: 'asc' } });
  res.json(items);
}));

router.post('/guarantees', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const {
    type, bankName, amount, currency, issueDate, expiryDate, status,
    refNo, projectId, contractId, tenderId, notes, categoryCode,
    isIndefinite, requestedById, requestNote, sampleText, sampleFileUrl,
  } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Teminat tutarı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const indefinite = isIndefinite === true;
  const item = await prisma.guaranteeLetter.create({
    data: {
      tenantId: req.tenantId,
      type: type || 'PERFORMANCE',
      bankName: bankName || null,
      amount: Number(amount) || 0,
      currency: currency || 'TRY',
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: indefinite ? null : (expiryDate ? new Date(expiryDate) : null),
      isIndefinite: indefinite,
      status: status || 'ACTIVE',
      refNo: refNo || null,
      projectId: projectId || null,
      contractId: contractId || null,
      tenderId: tenderId || null,
      notes: notes || null,
      requestedById: requestedById || req.userId || null,
      requestNote: requestNote || null,
      sampleText: sampleText || null,
      sampleFileUrl: sampleFileUrl || null,
      docNumber,
    },
  });
  // Satış Destek → Finans teminat talebi: Finans birimini bilgilendir
  if (item.status === 'REQUESTED') {
    const fin = await prisma.user.findFirst({ where: { tenantId: req.tenantId, role: 'FINANCE_MGR' } });
    if (fin) {
      await prisma.notification.create({ data: {
        tenantId: req.tenantId, userId: fin.id, type: 'APPROVAL',
        title: 'Teminat mektubu talebi',
        message: `Satış Destek ${item.type === 'BID_BOND' ? 'geçici' : 'kesin'} teminat talep etti: ${item.amount.toLocaleString('tr-TR')} ${item.currency}${indefinite ? ' (süresiz)' : item.expiryDate ? ` · vade ${item.expiryDate.toLocaleDateString('tr-TR')}` : ''}. Örnek metinle düzenleyin.`,
      } }).catch(() => {});
    }
  }
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: item.status === 'REQUESTED' ? 'GUARANTEE_REQUESTED' : 'CREATE', entityType: 'GUARANTEE', entityId: item.id, details: { type: item.type, amount: item.amount, status: item.status } });
  res.json(item);
}));

router.put('/guarantees/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.guaranteeLetter.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Teminat bulunamadı.' });
  const { type, bankName, amount, currency, issueDate, expiryDate, status, refNo, projectId, contractId, tenderId, notes, isIndefinite, sampleText } = req.body;
  const indefinite = isIndefinite !== undefined ? isIndefinite === true : record.isIndefinite;
  const item = await prisma.guaranteeLetter.update({
    where: { id },
    data: {
      type, bankName,
      amount: amount != null ? Number(amount) : record.amount,
      currency,
      issueDate: issueDate ? new Date(issueDate) : record.issueDate,
      expiryDate: indefinite ? null : (expiryDate ? new Date(expiryDate) : record.expiryDate),
      isIndefinite: indefinite,
      status, refNo, projectId, contractId, tenderId, notes,
      ...(sampleText !== undefined && { sampleText: sampleText || null }),
    },
  });
  if (status && status !== record.status) {
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `GUARANTEE_${status}`, entityType: 'GUARANTEE', entityId: id, details: { from: record.status, to: status } });
  }
  res.json(item);
}));

router.delete('/guarantees/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.guaranteeLetter.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Teminat bulunamadı.' });
  await prisma.guaranteeLetter.delete({ where: { id } });
  res.json({ message: 'Silindi.' });
}));

router.post(
  '/guarantees/:id/upload',
  tenantMiddleware,
  guaranteeUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
    const record = await prisma.guaranteeLetter.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!record) return res.status(404).json({ error: 'Teminat bulunamadı.' });

    const folder = slugify(record.refNo || record.id);
    const uploadDir = getUploadDir(GUARANTEE_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${id.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);
    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/guarantees/${folder}/${safeName}`;
    let fileUrl = localUrl;
    let ncUrl: string | null = null;

    const NC_URL = process.env.NEXTCLOUD_URL;
    const NC_USER = process.env.NEXTCLOUD_USER;
    const NC_PASS = process.env.NEXTCLOUD_PASS;
    if (NC_URL && NC_USER && NC_PASS) {
      try {
        const remotePath = `/ENFLOW_DMS/Teminatlar/${folder}`;
        ncUrl = await uploadToNextcloud(req.file.buffer, safeName, remotePath, NC_URL, NC_USER, NC_PASS);
        fileUrl = ncUrl;
      } catch (e) {
        console.warn('[Nextcloud] Guarantee upload failed, using local:', (e as Error).message);
        fileUrl = localUrl;
      }
    }

    const item = await prisma.guaranteeLetter.update({ where: { id }, data: { fileUrl } });
    res.json({ guarantee: item, localUrl, nextcloudUrl: ncUrl });
  })
);

// ── 4) Maliyet Onayı (proje maliyet kalemleri) ──────────────────────────────────

router.get('/cost-approvals', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.projectCostItem.findMany({
    where: { approvalStatus: 'PENDING', project: { tenantId: req.tenantId } },
    include: { project: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}));

router.put('/costs/:id/approve', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.projectCostItem.findFirst({
    where: { id, project: { tenantId: req.tenantId } },
  });
  if (!record) return res.status(404).json({ error: 'Maliyet kalemi bulunamadı.' });
  const { decision, approvedById, approvalNote } = req.body as
    { decision?: string; approvedById?: string; approvalNote?: string };
  const approvalStatus = decision === 'REJECT' ? 'REJECTED' : 'APPROVED';
  const item = await prisma.projectCostItem.update({
    where: { id },
    data: {
      approvalStatus,
      approvedById: approvedById || null,
      approvedAt: new Date(),
      approvalNote: approvalNote || null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: approvedById || req.userId, action: `COST_${approvalStatus}`, entityType: 'PROJECT_COST', entityId: id, details: { description: item.description, amount: item.amountTRY } });
  res.json(item);
}));

// ── 5) Finans Özeti ──────────────────────────────────────────────────────────

router.get('/summary', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({ where: { tenantId: req.tenantId } });
  const guarantees = await prisma.guaranteeLetter.findMany({
    where: { tenantId: req.tenantId, status: 'ACTIVE' },
  });

  const sales = invoices.filter(i => i.type === 'SALES');
  const totalReceivable = sales
    .filter(i => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const totalCollected = sales.reduce((s, i) => s + i.paidAmount, 0);
  const now = Date.now();
  const overdue = sales
    .filter(i => i.dueDate && i.dueDate.getTime() < now && i.paidAmount < i.amount && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  const soon = now + 30 * 24 * 60 * 60 * 1000;
  const expiringGuarantees = guarantees.filter(g => g.expiryDate && g.expiryDate.getTime() <= soon);

  const pendingCostApprovals = await prisma.projectCostItem.count({
    where: { approvalStatus: 'PENDING', project: { tenantId: req.tenantId } },
  });

  res.json({
    totalReceivable,
    totalCollected,
    overdue,
    invoiceCount: invoices.length,
    salesCount: sales.length,
    activeGuarantees: guarantees.length,
    expiringGuarantees: expiringGuarantees.length,
    pendingCostApprovals,
  });
}));

// ── Vade & Finansman Etkisi (Faz B) ──────────────────────────────────────────

// Banka faiz oranları (tenant ayarı — moduleSettings.finance.interestRates)
router.get('/settings', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const fin = (ms.finance as { interestRates?: Record<string, number> }) || {};
  res.json({ interestRates: { ...DEFAULT_RATES, ...(fin.interestRates || {}) } });
}));

router.put('/settings', tenantMiddleware, requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']), asyncHandler(async (req: Request, res: Response) => {
  const { interestRates } = req.body as { interestRates?: Record<string, number> };
  const tenant = await prisma.tenant.findFirst({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const fin = (ms.finance as Record<string, unknown>) || {};
  ms.finance = { ...fin, interestRates: { ...DEFAULT_RATES, ...(interestRates || {}) } };
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'FINANCE_RATES_UPDATED', entityType: 'TENANT', entityId: req.tenantId, details: { interestRates } });
  res.json({ interestRates: (ms.finance as { interestRates: Record<string, number> }).interestRates });
}));

// Taksitli tahsilat planı
router.get('/collection-installments', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.query.opportunityId ? String(req.query.opportunityId) : undefined;
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId zorunlu.' });
  const items = await prisma.collectionInstallment.findMany({ where: { tenantId: req.tenantId, opportunityId }, orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] });
  res.json(items);
}));

router.post('/collection-installments', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { opportunityId, dueDate, amount, currency, note, sortOrder } = req.body;
  if (!opportunityId || !dueDate) return res.status(400).json({ error: 'opportunityId ve dueDate zorunlu.' });
  const item = await prisma.collectionInstallment.create({
    data: { tenantId: req.tenantId, opportunityId: String(opportunityId), dueDate: new Date(dueDate), amount: parseFloat(String(amount)) || 0, currency: currency || 'TRY', note: note || null, sortOrder: typeof sortOrder === 'number' ? sortOrder : 0 },
  });
  res.json(item);
}));

router.put('/collection-installments/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.collectionInstallment.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Taksit bulunamadı.' });
  const { dueDate, amount, currency, note } = req.body;
  const item = await prisma.collectionInstallment.update({ where: { id }, data: {
    ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
    ...(amount !== undefined && { amount: parseFloat(String(amount)) || 0 }),
    ...(currency !== undefined && { currency }),
    ...(note !== undefined && { note: note || null }),
  } });
  res.json(item);
}));

router.delete('/collection-installments/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.collectionInstallment.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Taksit bulunamadı.' });
  await prisma.collectionInstallment.delete({ where: { id } });
  res.json({ ok: true });
}));

// Finansman etkisi hesabı (ödeme kalemleri + taksitli tahsilat)
async function buildFinancing(tenantId: string, opportunityId: string, referenceStart?: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const rates = { ...DEFAULT_RATES, ...(((ms.finance as { interestRates?: Record<string, number> })?.interestRates) || {}) };

  const [boms, costs, installments] = await Promise.all([
    prisma.boMItem.findMany({ where: { opportunityId } }),
    prisma.costItem.findMany({ where: { opportunityId, tenantId } }),
    prisma.collectionInstallment.findMany({ where: { tenantId, opportunityId } }),
  ]);

  const events: CashEvent[] = [];
  for (const b of boms) events.push({ kind: 'PAYMENT', label: `BoM: ${b.partNumber}`, date: paymentDate(referenceStart, b.paymentTermDays), amount: (b.purchaseCost || 0) * (b.quantity || 0), currency: b.currency || 'TRY' });
  for (const c of costs) {
    if (c.category === 'FINANCE') continue; // önceki finansman kalemini hesaba katma (döngü önleme)
    events.push({ kind: 'PAYMENT', label: c.description, date: paymentDate(referenceStart, c.paymentTermDays), amount: c.amount || 0, currency: c.currency || 'TRY' });
  }
  for (const i of installments) events.push({ kind: 'COLLECTION', label: i.note || 'Tahsilat taksiti', date: i.dueDate.toISOString(), amount: i.amount || 0, currency: i.currency || 'TRY' });

  const result = computeFinancingEffect(events, rates, referenceStart);
  return { rates, result };
}

// Kalem ödeme vadesi (gün) güncelle — BoM veya CostItem
router.put('/payment-term', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { kind, itemId, paymentTermDays } = req.body as { kind?: string; itemId?: string; paymentTermDays?: number };
  if (!itemId || !kind) return res.status(400).json({ error: 'kind ve itemId zorunlu.' });
  const days = paymentTermDays == null || paymentTermDays === undefined ? null : parseInt(String(paymentTermDays));
  if (kind === 'BOM') {
    const b = await prisma.boMItem.findFirst({ where: { id: itemId } });
    if (!b) return res.status(404).json({ error: 'Kalem bulunamadı.' });
    await prisma.boMItem.update({ where: { id: itemId }, data: { paymentTermDays: days } });
  } else if (kind === 'COST') {
    const c = await prisma.costItem.findFirst({ where: { id: itemId, tenantId: req.tenantId } });
    if (!c) return res.status(404).json({ error: 'Kalem bulunamadı.' });
    await prisma.costItem.update({ where: { id: itemId }, data: { paymentTermDays: days } });
  } else return res.status(400).json({ error: 'Geçersiz kind.' });
  res.json({ ok: true });
}));

router.get('/financing-effect', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.query.opportunityId ? String(req.query.opportunityId) : undefined;
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId zorunlu.' });
  const referenceStart = req.query.referenceStart ? String(req.query.referenceStart) : undefined;
  const { rates, result } = await buildFinancing(req.tenantId, opportunityId, referenceStart);
  res.json({ interestRates: rates, ...result });
}));

// Net negatif (maliyet) etkiyi maliyet analizine CostItem olarak iter (yönetim onayı; döviz-bazlı)
router.post('/financing-effect/apply', tenantMiddleware, requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']), asyncHandler(async (req: Request, res: Response) => {
  const { opportunityId, referenceStart } = req.body as { opportunityId?: string; referenceStart?: string };
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId zorunlu.' });
  const { result } = await buildFinancing(req.tenantId, opportunityId, referenceStart);
  // Önceki otomatik finansman kalemlerini temizle (idempotent)
  await prisma.costItem.deleteMany({ where: { opportunityId, tenantId: req.tenantId, category: 'FINANCE' } });
  const created: { currency: string; amount: number }[] = [];
  for (const [cur, v] of Object.entries(result.byCurrency)) {
    if (v.net < 0) { // net negatif = finansman MALİYETİ
      const amount = Math.round(-v.net * 100) / 100;
      await prisma.costItem.create({ data: { tenantId: req.tenantId, opportunityId, description: `Finansman Maliyeti (vade etkisi)`, category: 'FINANCE', amount, currency: cur, auto: true } });
      created.push({ currency: cur, amount });
    }
  }
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'FINANCING_COST_APPLIED', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { created } });
  res.json({ ok: true, created, byCurrency: result.byCurrency });
}));

// ── Finance Engine önizleme — canonical net/KDV/brüt, kuruş, döviz-bazlı ──────
// POST /finance/calc { lines:[{ qty, unitPrice, vatRate?, currency?, discountPct? }] }
// → byCurrency: { TRY:{net,vat,gross}, USD:{...} } (sessiz tek-toplam YOK).
router.post('/calc', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { lines } = req.body as { lines?: LineInput[] };
  if (!Array.isArray(lines)) return res.status(400).json({ error: 'lines dizisi zorunlu.' });
  const totals = sumByCurrency(lines);
  const byCurrency: Record<string, { net: number; vat: number; gross: number; currency: string }> = {};
  for (const [cur, b] of Object.entries(totals)) byCurrency[cur] = presentBreakdown(b);
  res.json({ byCurrency, currencies: Object.keys(byCurrency) });
}));

export default router;
