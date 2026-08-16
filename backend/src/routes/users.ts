import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { hashPassword } from '../services/auth';
import { getOwnedItems, transferOwnership, deactivateUser, hardDeleteUser } from '../services/personnelTransferService';
import { checkUserSeatLimit } from '../usageService';

const GM = requireRole(['GENERAL_MANAGER']);
const router: Router = Router();

// `permissions` DB'de JSON string olarak saklanır; frontend'e her zaman
// parse edilmiş bir dizi olarak gönderilir. Aksi halde frontend tarafında
// `[...user.permissions]` gibi bir spread, string'i karakter dizisine
// bozar — geçmişte tam olarak bu corrupt veriye yol açmıştı (2026-06-16).
function parsePermissions<T extends { permissions: string }>(user: T): Omit<T, 'permissions' | 'password'> & { permissions: string[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(user.permissions); } catch { parsed = []; }
  const clean = Array.isArray(parsed)
    ? Array.from(new Set(parsed.filter((p): p is string => typeof p === 'string' && p.length > 3)))
    : [];
  // Parola hash'ini ve ham permissions string'ini ASLA olduğu gibi döndürme.
  const { password: _pw, permissions: _perm, ...rest } = user as T & { password?: string };
  return { ...rest, permissions: clean } as Omit<T, 'permissions' | 'password'> & { permissions: string[] };
}

router.get('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.tenantId },
    include: { unit: true }
  });
  res.json(users.map(parsePermissions));
}));

router.post('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions, password } = req.body;
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Kullanıcı için en az 6 karakterli bir şifre zorunludur.' });
  }
  const seat = await checkUserSeatLimit(req.tenantId);
  if (!seat.ok) {
    return res.status(402).json({ error: `Kullanıcı limitinize ulaştınız (${seat.current}/${seat.limit}). Planınızı yükseltin ya da pasif kullanıcıları temizleyin.` });
  }
  const user = await prisma.user.create({
    data: {
      name, email, role, unitId: unitId || null,
      password: await hashPassword(password),
      tenantId: req.tenantId,
      permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions || ['DASHBOARD_VIEW']),
      status: 'ACTIVE'
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'USER', entityId: user.id, details: { email: user.email, role: user.role } });
  res.json(parsePermissions(user));
}));

// Oturum açık kullanıcının GÜNCEL kaydı — rol kapısı yok (herkes yalnız
// kendi kaydını görür, req.userId'den gelir). AuthContext.tsx bunu uygulama
// her açıldığında çağırır ki bir GM Yetkiler'den izinlerini değiştirdiğinde
// zaten açık bir oturum, çıkış yapmadan güncel `permissions`'ı görsün — eskiden
// currentUser yalnız girişte localStorage'a yazılıp bir daha hiç tazelenmiyordu.
// MUTLAKA /:id'den ÖNCE tanımlanmalı (aksi halde Express 'me' değerini :id olarak yakalar).
router.get('/me', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findFirst({ where: { id: req.userId, tenantId: req.tenantId } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json(parsePermissions(user));
}));

// Hafif, herkese açık kullanıcı seçici — ör. Presales Müdürü'nün BoM devri için
// bir mühendis seçmesi (bkz. approvalChains.ts CRM_HANDOFF onayı). Tam liste
// (`GET /`, yukarıda) GM-only'dir (email/izin gibi hassas alanlar taşır); bu uç
// yalnız ad+id+birim döner, RBAC riski taşımaz. MUTLAKA /:id'den ÖNCE tanımlanmalı.
router.get('/lookup', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.query as { role?: string };
  if (!role) return res.status(400).json({ error: 'role parametresi zorunludur.' });
  const users = await prisma.user.findMany({
    where: { tenantId: req.tenantId, role, status: 'ACTIVE' },
    select: { id: true, name: true, unitId: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

// Kişiselleştirilmiş Dashboard düzeni — herkes kendi görünümünü düzenler (rol kapısı yok).
// MUTLAKA /:id'den ÖNCE tanımlanmalı (aksi halde Express 'me' değerini :id olarak yakalar).
router.put('/me/dashboard-layout', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { widgets, order } = req.body;
  if (!Array.isArray(order) || !Array.isArray(widgets)) {
    return res.status(400).json({ error: 'Geçersiz düzen verisi.' });
  }
  const dashboardLayout = JSON.stringify({ widgets, order });
  await prisma.user.update({ where: { id: req.userId }, data: { dashboardLayout } });
  res.json({ dashboardLayout });
}));

router.put('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions, status, password, delegateToUserId, delegateUntil } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  // B-08 — vekalet: null gönderilirse vekalet kaldırılır (Prisma'da undefined = "değiştirme").
  const data: Record<string, unknown> = { name, email, role, unitId, status };
  if (delegateToUserId !== undefined) data.delegateToUserId = delegateToUserId || null;
  if (delegateUntil !== undefined) data.delegateUntil = delegateUntil ? new Date(delegateUntil) : null;
  if (permissions) {
    data.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
  }
  // Şifre yalnızca yeni bir değer verildiyse güncellenir (boş → mevcut korunur).
  if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
    data.password = await hashPassword(password);
  }
  const user = await prisma.user.update({ where: { id }, data });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'USER', entityId: id, details: { email: user.email, role: user.role, status: user.status } });
  res.json(parsePermissions(user));
}));

// ── Personel devri (terfi/işten ayrılma) ─────────────────────────────────────
// Sahip olduğu aktif iş kayıtlarının önizlemesi — devir modalının veri kaynağı.
router.get('/:id/owned-items', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const record = await prisma.user.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json(await getOwnedItems(req.tenantId, id));
}));

// Sahiplik devri (silme/deaktivasyon gerektirmeden de çağrılabilir — terfi sonrası opsiyonel devir).
router.post('/:id/transfer', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const fromId = req.params.id as string;
  const { toUserId, categoryKeys } = req.body as { toUserId?: string; categoryKeys?: string[] };
  if (!toUserId) return res.status(400).json({ error: 'toUserId zorunlu.' });

  const fromUser = await prisma.user.findFirst({ where: { id: fromId, tenantId } });
  if (!fromUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  let result;
  try {
    result = await transferOwnership({ tenantId, fromUserId: fromId, toUserId, categoryKeys });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Devir başarısız.' });
  }

  const toUser = await prisma.user.findFirst({ where: { id: toUserId, tenantId } });
  await logActivity({
    tenantId, userId: req.userId, action: 'PERSONNEL_TRANSFER', entityType: 'USER', entityId: fromId,
    details: { toUserId, toUserName: toUser?.name, transferred: result.transferred, clearedInboundDelegations: result.clearedInboundDelegations },
  });
  res.json(result);
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const { transferToUserId, hardDelete } = req.body as { transferToUserId?: string; hardDelete?: boolean };

  if (id === req.userId) return res.status(400).json({ error: 'Kendi hesabınızı silemez/pasifleştiremezsiniz.' });

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const owned = await getOwnedItems(tenantId, id);
  if (owned.totalActive > 0 && !transferToUserId) {
    return res.status(400).json({
      error: 'TRANSFER_REQUIRED',
      message: `Bu kullanıcının ${owned.totalActive} aktif iş kaydı var — önce başka bir kullanıcıya devredilmeli.`,
      categories: owned.categories.filter((c) => c.count > 0),
    });
  }

  if (transferToUserId) {
    try {
      await transferOwnership({ tenantId, fromUserId: id, toUserId: transferToUserId });
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Devir başarısız.' });
    }
  }

  if (hardDelete) {
    const result = await hardDeleteUser(tenantId, id);
    if (!result.ok) {
      return res.status(409).json({ error: 'HARD_DELETE_BLOCKED', message: result.reason, blockingCount: result.blockingCount });
    }
    await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'USER', entityId: id, details: { email: record.email, transferredTo: transferToUserId || null } });
    return res.json({ message: 'Kullanıcı kalıcı olarak silindi.' });
  }

  await deactivateUser(tenantId, id);
  await logActivity({ tenantId, userId: req.userId, action: 'DEACTIVATE', entityType: 'USER', entityId: id, details: { email: record.email, transferredTo: transferToUserId || null } });
  res.json({ message: 'Kullanıcı pasifleştirildi.' });
}));

export default router;
