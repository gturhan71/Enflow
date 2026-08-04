import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import { documentUpload } from '../utils/secureUpload';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';
import { logActivity } from '../services/activityLog';
import { computeFinancingEffect, paymentDate, CashEvent } from '../services/financingEffect';
import { sumByCurrency, presentBreakdown, LineInput, computeFxGainLoss } from '../services/financeEngine';
import { sweepGuaranteeReminders } from '../services/guaranteeReminders';
import { recalcInvoice } from '../services/invoiceEngine';
import { computeFinanceSummary } from '../services/financeSummary';

const DEFAULT_RATES: Record<string, number> = { TRY: 50, USD: 10, EUR: 8 };

const router: Router = Router();

const GUARANTEE_UPLOADS_ROOT = path.join(__dirname, '../../uploads/guarantees');
const guaranteeUpload = documentUpload(50);

// Opsiyonel docNumber üretimi (CorporateGovernance pattern'i ile aynı).
async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
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
    projectId, contractId, milestoneId, customerId, customerName, vendorName,
    notes, createdById, categoryCode, issueRateToTRY,
  } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Fatura tutarı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);

  // customerId verildiyse müşteri adını oradan doğrula/doldur (elle girilen
  // ismin üzerine yazmaz, yalnız boşsa doldurur) — bkz. computeCustomerHealth.
  let resolvedCustomerName = customerName || null;
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: req.tenantId }, select: { name: true } });
    if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
    if (!resolvedCustomerName) resolvedCustomerName = customer.name;
  }

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
      customerId: customerId || null,
      customerName: resolvedCustomerName,
      vendorName: vendorName || null,
      notes: notes || null,
      createdById: createdById || null,
      docNumber,
      // B-18 — yabancı para birimli faturada kesim kuru (döviz kur farkı hesabı için)
      issueRateToTRY: (currency && currency !== 'TRY' && issueRateToTRY) ? Number(issueRateToTRY) : null,
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
    projectId, contractId, milestoneId, customerName, vendorName, notes, issueRateToTRY,
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
      ...(issueRateToTRY !== undefined && { issueRateToTRY: issueRateToTRY ? Number(issueRateToTRY) : null }),
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
  const { amount, currency, paidAt, method, reference, notes, allowOverpayment, fxRate } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Ödeme tutarı zorunlu.' });
  const amt = Number(amount) || 0;

  // B-05 — fatura tutarını aşan tahsilat sessizce kaybolmasın: üst sınır kontrolü.
  // Gerçekten fazla ödeme yapıldıysa (çift transfer, kur farkı vb.) kayıt yine de
  // alınır (para kaybolmaz) ama `allowOverpayment` açıkça onaylanmalı ve Finans'a
  // "Alacak/İade" takibi için otomatik bildirim üretilir.
  const existingPayments = await prisma.payment.findMany({ where: { invoiceId: id } });
  const paidSoFar = existingPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = record.amount - paidSoFar;
  const overpay = amt - remaining;
  if (overpay > 0.01 && !allowOverpayment) {
    return res.status(400).json({
      error: `Ödeme tutarı (${amt.toLocaleString('tr-TR')}) kalan bakiyeyi (${Math.max(remaining, 0).toLocaleString('tr-TR')}) aşıyor. Fazla ödeme gerçekten alındıysa allowOverpayment:true ile tekrar gönderin.`,
      remaining: Math.max(remaining, 0),
    });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: req.tenantId,
      invoiceId: id,
      amount: amt,
      currency: currency || record.currency,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: method || null,
      reference: reference || null,
      notes: overpay > 0.01 ? `${notes || ''} [Fazla ödeme: +${overpay.toLocaleString('tr-TR')} ${currency || record.currency} — Alacak/İade takibi gerekir]`.trim() : (notes || null),
    },
  });

  if (overpay > 0.01) {
    const financeUsers = await prisma.user.findMany({ where: { tenantId: req.tenantId, role: 'FINANCE_MGR', status: 'ACTIVE' } });
    for (const u of financeUsers) {
      await prisma.notification.create({
        data: {
          tenantId: req.tenantId, userId: u.id, type: 'WARNING',
          title: 'Fazla ödeme — Alacak/İade takibi gerekiyor',
          message: `${record.invoiceNo || record.id} faturasına ${overpay.toLocaleString('tr-TR')} ${currency || record.currency} fazla ödeme kaydedildi.`,
          relatedModule: 'finance', relatedItemId: id,
        },
      }).catch(() => {});
    }
  }

  // B-18 — döviz kur farkı: yabancı para birimli faturada kesim kuru biliniyorsa
  // (Invoice.issueRateToTRY) ve bu tahsilatın gerçek kuru girildiyse (fxRate),
  // gerçek TRY kâr/zararı ayrı bir FxAdjustment kalemi olarak kaydedilir.
  let fxAdjustment: { id: string; gainLossTRY: number } | null = null;
  const invCurrency = currency || record.currency;
  if (invCurrency !== 'TRY' && record.issueRateToTRY && fxRate) {
    const gainLossTRY = computeFxGainLoss(amt, record.issueRateToTRY, Number(fxRate));
    fxAdjustment = await prisma.fxAdjustment.create({
      data: {
        tenantId: req.tenantId, invoiceId: id, paymentId: payment.id,
        currency: invCurrency, amountFx: amt, issueRate: record.issueRateToTRY, paymentRate: Number(fxRate), gainLossTRY,
      },
    });
  }

  await recalcInvoice(id);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'PAYMENT', entityType: 'INVOICE', entityId: id, details: { amount: payment.amount, paidTotal: invoice?.paidAmount, status: invoice?.status, overpay: overpay > 0.01 ? overpay : undefined, fxGainLossTRY: fxAdjustment?.gainLossTRY } });
  res.json({ payment, invoice, fxAdjustment });
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
  await sweepGuaranteeReminders(req.tenantId); // sona erme hatırlatmaları (non-throwing)
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
        logger.warn('[Nextcloud] Guarantee upload failed, using local:', (e as Error).message);
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
  const summary = await computeFinanceSummary(req.tenantId);
  res.json(summary);
}));

// ── Alacak Yaşlandırma + DSO (Büyüme Analitiği Faz 1 · #9) ────────────────────
// SALES faturaları vade-geçmişi kovalarına ayırır + DSO (ort. tahsil süresi) hesaplar.
// Salt-okunur; tenant-scoped. Para birimi bazında da ayrıştırılır (karışık kur sağlıklı toplanamaz).
router.get('/aging', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({ where: { tenantId: req.tenantId, type: 'SALES' } });
  const now = Date.now();
  const DAY = 86_400_000;
  const emptyBuckets = () => ({ notDue: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });

  // Açık (tahsil edilmemiş) SALES alacakları — DRAFT/CANCELLED/PAID hariç
  const open = invoices.filter(i => i.status !== 'DRAFT' && i.status !== 'CANCELLED' && i.status !== 'PAID' && (i.amount - i.paidAmount) > 0);

  const buckets = emptyBuckets();
  const byCurrency: Record<string, { totalReceivable: number; buckets: ReturnType<typeof emptyBuckets> }> = {};
  let totalReceivable = 0;

  for (const inv of open) {
    const rem = inv.amount - inv.paidAmount;
    const cur = inv.currency || 'TRY';
    if (!byCurrency[cur]) byCurrency[cur] = { totalReceivable: 0, buckets: emptyBuckets() };
    const dpd = inv.dueDate ? Math.floor((now - inv.dueDate.getTime()) / DAY) : -1; // vade yoksa "vadesi gelmemiş"
    const key = dpd <= 0 ? 'notDue' : dpd <= 30 ? 'd0_30' : dpd <= 60 ? 'd31_60' : dpd <= 90 ? 'd61_90' : 'd90plus';
    buckets[key] += rem; totalReceivable += rem;
    byCurrency[cur].buckets[key] += rem; byCurrency[cur].totalReceivable += rem;
  }

  // DSO = toplam açık alacak / (son 365g tahsil-esaslı SALES tutarı) × 365
  const yearAgo = now - 365 * DAY;
  const salesLast365 = invoices
    .filter(i => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
    .filter(i => (i.issueDate ?? i.createdAt).getTime() >= yearAgo)
    .reduce((s, i) => s + i.amount, 0);
  const dso = salesLast365 > 0 ? Math.round((totalReceivable / salesLast365) * 365) : 0;

  res.json({ buckets, dso, totalReceivable, byCurrency });
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
    const b = await prisma.boMItem.findFirst({ where: { id: itemId, opportunity: { tenantId: req.tenantId } } });
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

// ── İşletme Maliyeti Havuzu (OperatingCostPool) — Faz 1 ──────────────────────
const overheadRoles = requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']);
const toNum = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

router.get('/operating-cost-pool', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const pools = await prisma.operatingCostPool.findMany({ where: { tenantId: req.tenantId }, orderBy: { periodStart: 'desc' } });
  res.json(pools);
}));

router.post('/operating-cost-pool', tenantMiddleware, overheadRoles, asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const personnelCost = toNum(b.personnelCost), otherOpex = toNum(b.otherOpex);
  const pool = await prisma.operatingCostPool.create({
    data: {
      tenantId: req.tenantId,
      periodStart: new Date(String(b.periodStart)), periodEnd: new Date(String(b.periodEnd)),
      personnelCost, otherOpex, totalPool: personnelCost + otherOpex,
      method: String(b.method || 'PCT_OF_VALUE'), rate: toNum(b.rate),
      status: String(b.status || 'ACTIVE'), notes: b.notes ? String(b.notes) : null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'OPERATING_COST_POOL', entityId: pool.id, details: { totalPool: pool.totalPool, method: pool.method, rate: pool.rate } });
  res.json(pool);
}));

router.put('/operating-cost-pool/:id', tenantMiddleware, overheadRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.operatingCostPool.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Havuz bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['method', 'status', 'notes']) if (b[k] !== undefined) data[k] = b[k] === null ? null : String(b[k]);
  for (const k of ['personnelCost', 'otherOpex', 'rate']) if (b[k] !== undefined) data[k] = toNum(b[k]);
  for (const k of ['periodStart', 'periodEnd']) if (b[k] !== undefined) data[k] = new Date(String(b[k]));
  const pc = data.personnelCost !== undefined ? Number(data.personnelCost) : rec.personnelCost;
  const oo = data.otherOpex !== undefined ? Number(data.otherOpex) : rec.otherOpex;
  data.totalPool = pc + oo;
  const pool = await prisma.operatingCostPool.update({ where: { id }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'OPERATING_COST_POOL', entityId: id });
  res.json(pool);
}));

router.delete('/operating-cost-pool/:id', tenantMiddleware, overheadRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.operatingCostPool.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Havuz bulunamadı.' });
  await prisma.operatingCostPool.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'OPERATING_COST_POOL', entityId: id });
  res.json({ message: 'Havuz silindi.' });
}));

// B-18 — Döviz kur farkı raporu: fatura/proje bazında kayıtlı kur kazanç/zararları.
router.get('/fx-adjustments', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };
  const items = await prisma.fxAdjustment.findMany({
    where: { tenantId: req.tenantId, ...(projectId ? { invoice: { projectId } } : {}) },
    include: { invoice: { select: { id: true, invoiceNo: true, projectId: true, customerName: true, vendorName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const totalGainLossTRY = items.reduce((s, i) => s + i.gainLossTRY, 0);
  res.json({ items, totalGainLossTRY });
}));

export default router;
