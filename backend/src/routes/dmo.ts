import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { getDmoParams, setDmoParams, recomputeOrderCosting, effectiveRisturnRate, DmoCostParams } from '../services/dmoCosting';

const router: Router = Router();
const editRoles = requireRole(['GENERAL_MANAGER', 'SALES_MGR']);
const paramRoles = requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']);

const toDate = (v: unknown): Date | null => (v ? new Date(String(v)) : null);
const num = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// ── Katalog ──────────────────────────────────────────────────────────────────
router.get('/catalog', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.dmoCatalogItem.findMany({ where: { tenantId: req.tenantId }, orderBy: { updatedAt: 'desc' } });
  res.json(items);
}));

router.post('/catalog', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const item = await prisma.dmoCatalogItem.create({
    data: {
      tenantId: req.tenantId,
      dmoCode: String(b.dmoCode || ''), name: String(b.name || ''),
      brand: b.brand ? String(b.brand) : null, model: b.model ? String(b.model) : null,
      unit: b.unit ? String(b.unit) : 'ADET',
      listPrice: num(b.listPrice), vatRate: num(b.vatRate, 20), currency: String(b.currency || 'TRY'),
      unitCost: num(b.unitCost), costCurrency: String(b.costCurrency || 'TRY'),
      category: b.category ? String(b.category) : null,
      validFrom: toDate(b.validFrom), validTo: toDate(b.validTo),
      status: String(b.status || 'ACTIVE'),
      frameworkAgreementId: b.frameworkAgreementId ? String(b.frameworkAgreementId) : null,
      notes: b.notes ? String(b.notes) : null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'DMO_CATALOG_ITEM', entityId: item.id, details: { name: item.name, dmoCode: item.dmoCode } });
  res.json(item);
}));

router.put('/catalog/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoCatalogItem.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Kalem bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['dmoCode', 'name', 'brand', 'model', 'unit', 'currency', 'costCurrency', 'category', 'status', 'notes', 'frameworkAgreementId']) if (b[k] !== undefined) data[k] = b[k] === null ? null : String(b[k]);
  for (const k of ['listPrice', 'vatRate', 'unitCost']) if (b[k] !== undefined) data[k] = num(b[k]);
  for (const k of ['validFrom', 'validTo']) if (b[k] !== undefined) data[k] = toDate(b[k]);
  const item = await prisma.dmoCatalogItem.update({ where: { id }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'DMO_CATALOG_ITEM', entityId: id });
  res.json(item);
}));

router.delete('/catalog/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoCatalogItem.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Kalem bulunamadı.' });
  await prisma.dmoCatalogItem.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'DMO_CATALOG_ITEM', entityId: id });
  res.json({ message: 'Katalog kalemi silindi.' });
}));

// ── Çerçeve Anlaşmalar ───────────────────────────────────────────────────────
router.get('/agreements', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.dmoFrameworkAgreement.findMany({ where: { tenantId: req.tenantId }, orderBy: { updatedAt: 'desc' } });
  res.json(items);
}));

router.post('/agreements', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const item = await prisma.dmoFrameworkAgreement.create({
    data: {
      tenantId: req.tenantId,
      agreementNo: String(b.agreementNo || ''), title: String(b.title || ''),
      validFrom: toDate(b.validFrom), validTo: toDate(b.validTo),
      quotaTotal: b.quotaTotal !== undefined && b.quotaTotal !== null ? num(b.quotaTotal) : null,
      status: String(b.status || 'ACTIVE'), notes: b.notes ? String(b.notes) : null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'DMO_AGREEMENT', entityId: item.id, details: { agreementNo: item.agreementNo } });
  res.json(item);
}));

router.put('/agreements/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoFrameworkAgreement.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Anlaşma bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['agreementNo', 'title', 'status', 'notes']) if (b[k] !== undefined) data[k] = b[k] === null ? null : String(b[k]);
  for (const k of ['quotaTotal', 'quotaUsed']) if (b[k] !== undefined) data[k] = b[k] === null ? null : num(b[k]);
  for (const k of ['validFrom', 'validTo']) if (b[k] !== undefined) data[k] = toDate(b[k]);
  const item = await prisma.dmoFrameworkAgreement.update({ where: { id }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'DMO_AGREEMENT', entityId: id });
  res.json(item);
}));

router.delete('/agreements/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoFrameworkAgreement.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Anlaşma bulunamadı.' });
  await prisma.dmoFrameworkAgreement.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'DMO_AGREEMENT', entityId: id });
  res.json({ message: 'Çerçeve anlaşma silindi.' });
}));

// ── Döviz Kurları (DMO sicili) ───────────────────────────────────────────────
router.get('/rates', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.dmoExchangeRate.findMany({ where: { tenantId: req.tenantId }, orderBy: { validFrom: 'desc' } });
  res.json(items);
}));

router.post('/rates', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const item = await prisma.dmoExchangeRate.create({
    data: {
      tenantId: req.tenantId,
      currency: String(b.currency || 'USD'), rate: num(b.rate),
      validFrom: toDate(b.validFrom) || new Date(), validTo: toDate(b.validTo),
      source: b.source ? String(b.source) : null, notes: b.notes ? String(b.notes) : null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'DMO_RATE', entityId: item.id, details: { currency: item.currency, rate: item.rate } });
  res.json(item);
}));

router.put('/rates/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoExchangeRate.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Kur bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['currency', 'source', 'notes']) if (b[k] !== undefined) data[k] = b[k] === null ? null : String(b[k]);
  if (b.rate !== undefined) data.rate = num(b.rate);
  for (const k of ['validFrom', 'validTo']) if (b[k] !== undefined) data[k] = toDate(b[k]);
  const item = await prisma.dmoExchangeRate.update({ where: { id }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'DMO_RATE', entityId: id });
  res.json(item);
}));

router.delete('/rates/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoExchangeRate.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Kur bulunamadı.' });
  await prisma.dmoExchangeRate.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'DMO_RATE', entityId: id });
  res.json({ message: 'Kur kaydı silindi.' });
}));

// ── Siparişler ───────────────────────────────────────────────────────────────
// Faz A: kalem satır toplamları + revenue/cost toplamı. Tam maliyetlendirme
// (risturn/komisyon/alarm) Faz B'de computeOrderCosting ile bağlanacak.
interface ItemInput { catalogItemId?: string; name?: string; qty?: number; unitPrice?: number; sellCurrency?: string; unitCost?: number; costCurrency?: string; vatRate?: number; }
function normalizeItems(raw: unknown): { name: string; catalogItemId: string | null; qty: number; unitPrice: number; sellCurrency: string; unitCost: number; costCurrency: string; vatRate: number; lineRevenue: number; lineCost: number }[] {
  const arr = Array.isArray(raw) ? (raw as ItemInput[]) : [];
  return arr.map(it => {
    const qty = num(it.qty, 1), unitPrice = num(it.unitPrice), unitCost = num(it.unitCost);
    return {
      name: String(it.name || ''), catalogItemId: it.catalogItemId ? String(it.catalogItemId) : null,
      qty, unitPrice, sellCurrency: String(it.sellCurrency || 'TRY'), unitCost, costCurrency: String(it.costCurrency || 'TRY'), vatRate: num(it.vatRate, 20),
      lineRevenue: qty * unitPrice, lineCost: qty * unitCost,
    };
  });
}

router.get('/orders', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const orders = await prisma.dmoOrder.findMany({ where: { tenantId: req.tenantId }, include: { items: true }, orderBy: { orderDate: 'desc' } });
  res.json(orders);
}));

router.get('/orders/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const order = await prisma.dmoOrder.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  res.json(order);
}));

router.post('/orders', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const items = normalizeItems(b.items);
  const params = await getDmoParams(req.tenantId);
  const created = await prisma.dmoOrder.create({
    data: {
      tenantId: req.tenantId,
      orderNo: String(b.orderNo || ''), institutionName: String(b.institutionName || ''),
      orderDate: toDate(b.orderDate) || new Date(), deliveryDeadline: toDate(b.deliveryDeadline),
      frameworkAgreementId: b.frameworkAgreementId ? String(b.frameworkAgreementId) : null,
      currency: String(b.currency || 'TRY'), status: String(b.status || 'EVALUATION'),
      ownerId: b.ownerId ? String(b.ownerId) : null, ownerName: b.ownerName ? String(b.ownerName) : null,
      notes: b.notes ? String(b.notes) : null,
      commissionType: b.commissionType ? String(b.commissionType) : params.defaultCommission.type,
      commissionValue: b.commissionValue !== undefined ? num(b.commissionValue) : params.defaultCommission.value,
      commissionBasis: b.commissionBasis ? String(b.commissionBasis) : params.defaultCommission.basis,
      items: { create: items },
    },
    include: { items: true },
  });
  await recomputeOrderCosting(req.tenantId, created.id);
  const order = await prisma.dmoOrder.findFirst({ where: { id: created.id, tenantId: req.tenantId }, include: { items: true } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'DMO_ORDER', entityId: created.id, details: { orderNo: created.orderNo, institution: created.institutionName } });
  res.json(order);
}));

router.put('/orders/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['orderNo', 'institutionName', 'currency', 'status', 'ownerId', 'ownerName', 'notes', 'frameworkAgreementId', 'commissionType', 'commissionBasis']) if (b[k] !== undefined) data[k] = b[k] === null ? null : String(b[k]);
  if (b.commissionValue !== undefined) data.commissionValue = num(b.commissionValue);
  for (const k of ['orderDate', 'deliveryDeadline']) if (b[k] !== undefined) data[k] = toDate(b[k]);
  // Kalemler verilmişse tümünü değiştir (replace)
  if (b.items !== undefined) {
    await prisma.dmoOrderItem.deleteMany({ where: { orderId: id } });
    data.items = { create: normalizeItems(b.items) };
  }
  await prisma.dmoOrder.update({ where: { id }, data });
  await recomputeOrderCosting(req.tenantId, id); // o anki koşullarla maliyetlendir
  const order = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId }, include: { items: true } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'DMO_ORDER', entityId: id });
  res.json(order);
}));

// Yeniden maliyetlendir (o anki kur + parametrelerle)
router.post('/orders/:id/recost', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const result = await recomputeOrderCosting(req.tenantId, id);
  if (!result) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DMO_RECOST', entityType: 'DMO_ORDER', entityId: id, details: { netProfit: result.netProfit, isProfitable: result.isProfitable } });
  const order = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId }, include: { items: true } });
  res.json(order);
}));

// Statü ilerlet — yan etkiler: CONFIRMED→kota+kârsız uyarı, DELIVERED→SALES Invoice
// B-02 — durum geçiş matrisi: yalnız izinli önceki→sonraki çiftlerine izin ver (ara adım atlanamaz).
const DMO_TRANSITIONS: Record<string, string[]> = {
  EVALUATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_DELIVERY', 'CANCELLED', 'REJECTED'],
  IN_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['INVOICED'],
  INVOICED: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
};
// Kota bu aşamalardan birine ulaşıldığında artırılmış olur (bkz. CONFIRMED bloğu) — decrement simetrisi için.
const QUOTA_CONSUMED_STATUSES = ['CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'INVOICED'];
router.post('/orders/:id/status', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const status = String((req.body as { status?: unknown }).status || '');
  const prev = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!prev) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (status !== prev.status) {
    const allowed = DMO_TRANSITIONS[prev.status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({ error: `${prev.status} → ${status} geçişine izin verilmiyor.` });
    }
  }

  await prisma.dmoOrder.update({ where: { id }, data: { status } });
  await recomputeOrderCosting(req.tenantId, id); // güncel kur/parametrelerle
  const order = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });

  // CONFIRMED'e ilk geçişte: çerçeve anlaşma kotası + kârsızsa uyarı
  if (status === 'CONFIRMED' && prev.status !== 'CONFIRMED') {
    if (order.frameworkAgreementId) {
      await prisma.dmoFrameworkAgreement.updateMany({
        where: { id: order.frameworkAgreementId, tenantId: req.tenantId },
        data: { quotaUsed: { increment: order.revenueTotal } },
      });
    }
    if (!order.isProfitable) {
      await prisma.notification.create({
        data: {
          tenantId: req.tenantId, userId: order.ownerId || req.userId,
          type: 'WARNING', title: 'Kârsız DMO siparişi onaylandı',
          message: `${order.orderNo} (${order.institutionName}) — net ${Math.round(order.netProfit).toLocaleString('tr-TR')} ₺. ${order.alarmReason || ''}`,
          relatedModule: 'dmo', relatedItemId: order.id,
        },
      });
    }
  }

  // B-20 — CANCELLED/REJECTED'e geçişte, kota daha önce tüketilmişse (CONFIRMED'den sonra) simetrik decrement.
  if ((status === 'CANCELLED' || status === 'REJECTED') && QUOTA_CONSUMED_STATUSES.includes(prev.status)) {
    if (order.frameworkAgreementId) {
      await prisma.dmoFrameworkAgreement.updateMany({
        where: { id: order.frameworkAgreementId, tenantId: req.tenantId },
        data: { quotaUsed: { decrement: order.revenueTotal } },
      });
    }
  }

  // DELIVERED'e geçişte: SALES Invoice upsert (idempotent, dmoOrderId)
  if (status === 'DELIVERED') {
    const invData = {
      type: 'SALES', amount: order.revenueTotal, currency: 'TRY',
      customerName: order.institutionName, status: 'ISSUED',
      issueDate: new Date(), notes: `DMO siparişinden: ${order.orderNo}`,
    };
    const existing = await prisma.invoice.findFirst({ where: { dmoOrderId: order.id, tenantId: req.tenantId } });
    if (existing) await prisma.invoice.update({ where: { id: existing.id }, data: invData });
    else await prisma.invoice.create({ data: { tenantId: req.tenantId, dmoOrderId: order.id, ...invData } });
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `STATUS_${status}`, entityType: 'DMO_ORDER', entityId: id, details: { from: prev.status, to: status, net: order.netProfit } });
  res.json(order);
}));

// ── Maliyet parametreleri (moduleSettings.dmo) ───────────────────────────────
router.get('/settings', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await getDmoParams(req.tenantId));
}));

router.put('/settings', tenantMiddleware, paramRoles, asyncHandler(async (req: Request, res: Response) => {
  const next = await setDmoParams(req.tenantId, req.body as Partial<DmoCostParams>);
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DMO_SETTINGS_UPDATED', entityType: 'TENANT', entityId: req.tenantId });
  res.json(next);
}));

// ── Kârlılık uyarıları (kârsız / eşik-altı siparişler) ───────────────────────
router.get('/alarms', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const orders = await prisma.dmoOrder.findMany({
    where: { tenantId: req.tenantId, isProfitable: false, status: { notIn: ['REJECTED', 'CANCELLED'] } },
    orderBy: { netMarginPct: 'asc' },
    include: { items: true },
  });
  res.json(orders);
}));

// ── Risturn dönem mutabakatı (tahakkuk vs gerçek) ────────────────────────────
router.get('/risturn-reconciliation', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const start = req.query.start ? new Date(String(req.query.start)) : new Date(now.getFullYear(), 0, 1);
  const end = req.query.end ? new Date(String(req.query.end)) : now;
  const params = await getDmoParams(req.tenantId);
  const orders = await prisma.dmoOrder.findMany({
    where: {
      tenantId: req.tenantId,
      status: { in: ['CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'INVOICED', 'CLOSED'] },
      orderDate: { gte: start, lte: end },
    },
    select: { revenueTotal: true, risturnDeduction: true },
  });
  const totalTurnover = orders.reduce((s, o) => s + (o.revenueTotal || 0), 0);
  const accruedRisturn = orders.reduce((s, o) => s + (o.risturnDeduction || 0), 0);
  const actualRate = effectiveRisturnRate(totalTurnover, params.risturnTiers);
  const actualRisturn = totalTurnover * actualRate;
  res.json({
    periodStart: start.toISOString(), periodEnd: end.toISOString(),
    orderCount: orders.length, totalTurnover,
    actualRate, actualRisturn,
    accruedRisturn, difference: actualRisturn - accruedRisturn,
    tiers: params.risturnTiers,
    note: 'Tahakkuk: siparişlere yansıyan risturn toplamı. Gerçek: dönem toplam cirosuna uygulanan efektif kademe. Fark, dönem sonu düzeltmesidir.',
  });
}));

router.delete('/orders/:id', tenantMiddleware, editRoles, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const rec = await prisma.dmoOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  await prisma.dmoOrder.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'DMO_ORDER', entityId: id });
  res.json({ message: 'Sipariş silindi.' });
}));

export default router;
