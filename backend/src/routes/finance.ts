import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import { slugify, getUploadDir, uploadToNextcloud } from '../utils/fileUpload';

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
  } = req.body;
  if (amount == null) return res.status(400).json({ error: 'Teminat tutarı zorunlu.' });
  const docNumber = await maybeDocNumber(req.tenantId, categoryCode);
  const item = await prisma.guaranteeLetter.create({
    data: {
      tenantId: req.tenantId,
      type: type || 'PERFORMANCE',
      bankName: bankName || null,
      amount: Number(amount) || 0,
      currency: currency || 'TRY',
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: status || 'ACTIVE',
      refNo: refNo || null,
      projectId: projectId || null,
      contractId: contractId || null,
      tenderId: tenderId || null,
      notes: notes || null,
      docNumber,
    },
  });
  res.json(item);
}));

router.put('/guarantees/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.guaranteeLetter.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Teminat bulunamadı.' });
  const { type, bankName, amount, currency, issueDate, expiryDate, status, refNo, projectId, contractId, tenderId, notes } = req.body;
  const item = await prisma.guaranteeLetter.update({
    where: { id },
    data: {
      type, bankName,
      amount: amount != null ? Number(amount) : record.amount,
      currency,
      issueDate: issueDate ? new Date(issueDate) : record.issueDate,
      expiryDate: expiryDate ? new Date(expiryDate) : record.expiryDate,
      status, refNo, projectId, contractId, tenderId, notes,
    },
  });
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

export default router;
