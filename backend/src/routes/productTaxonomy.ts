import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

// Düzenleme yalnız GM + Satış Müdürü — okuma tüm tenant kullanıcılarına açık
// (Presales/DMO/Satınalma bu listelerden seçim yapıyor, tümü okuyabilmeli).
const editRoles = requireRole(['GENERAL_MANAGER', 'SALES_MGR']);

// ── Markalar ─────────────────────────────────────────────────────────────
router.get('/brands', asyncHandler(async (req: Request, res: Response) => {
  const brands = await prisma.brand.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(brands);
}));

router.post('/brands', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'Marka adı zorunludur.' });
  const brand = await prisma.brand.create({ data: { tenantId: req.tenantId, name: name.trim() } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'BRAND', entityId: brand.id, details: { name: brand.name } });
  res.status(201).json(brand);
}));

router.put('/brands/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };
  const brand = await prisma.brand.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { name: name?.trim() || undefined, isActive: isActive ?? undefined },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'BRAND', entityId: String(req.params.id), details: { name: brand.name } });
  res.json(brand);
}));

router.delete('/brands/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  // Soft delete — BoMItem/DmoCatalogItem FK'ları onDelete:SetNull; hard-delete
  // veri kaybettirmez ama geçmiş kayıtların etiketini sessizce sıfırlar.
  await prisma.brand.update({ where: { id: String(req.params.id), tenantId: req.tenantId }, data: { isActive: false } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'BRAND', entityId: String(req.params.id) });
  res.json({ ok: true });
}));

// ── Marka Kaynakları (distribütör/bayi) ─────────────────────────────────────
router.get('/brands/:brandId/sources', asyncHandler(async (req: Request, res: Response) => {
  const sources = await prisma.brandSource.findMany({
    where: { tenantId: req.tenantId, brandId: String(req.params.brandId), isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(sources);
}));

router.post('/brands/:brandId/sources', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name, notes } = req.body as { name?: string; notes?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'Kaynak adı zorunludur.' });
  const brandId = String(req.params.brandId);
  const owns = await prisma.brand.findFirst({ where: { id: brandId, tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Marka bulunamadı.' });
  const source = await prisma.brandSource.create({ data: { tenantId: req.tenantId, brandId, name: name.trim(), notes: notes || null } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'BRAND_SOURCE', entityId: source.id, details: { name: source.name, brandId } });
  res.status(201).json(source);
}));

router.put('/brand-sources/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name, notes, isActive } = req.body as { name?: string; notes?: string; isActive?: boolean };
  const source = await prisma.brandSource.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { name: name?.trim() || undefined, notes: notes ?? undefined, isActive: isActive ?? undefined },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'BRAND_SOURCE', entityId: String(req.params.id), details: { name: source.name } });
  res.json(source);
}));

router.delete('/brand-sources/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  await prisma.brandSource.update({ where: { id: String(req.params.id), tenantId: req.tenantId }, data: { isActive: false } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'BRAND_SOURCE', entityId: String(req.params.id) });
  res.json({ ok: true });
}));

// ── Ürün Grupları ────────────────────────────────────────────────────────
router.get('/product-categories', asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.productCategory.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
}));

router.post('/product-categories', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'Ürün grubu adı zorunludur.' });
  const category = await prisma.productCategory.create({ data: { tenantId: req.tenantId, name: name.trim() } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PRODUCT_CATEGORY', entityId: category.id, details: { name: category.name } });
  res.status(201).json(category);
}));

router.put('/product-categories/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };
  const category = await prisma.productCategory.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { name: name?.trim() || undefined, isActive: isActive ?? undefined },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'PRODUCT_CATEGORY', entityId: String(req.params.id), details: { name: category.name } });
  res.json(category);
}));

router.delete('/product-categories/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  await prisma.productCategory.update({ where: { id: String(req.params.id), tenantId: req.tenantId }, data: { isActive: false } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'PRODUCT_CATEGORY', entityId: String(req.params.id) });
  res.json({ ok: true });
}));

export default router;
