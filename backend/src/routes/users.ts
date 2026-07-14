import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { hashPassword } from '../services/auth';

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

router.put('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions, status, password } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { name, email, role, unitId, status };
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

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.user.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'USER', entityId: id, details: { email: record.email } });
  res.json({ message: 'Kullanıcı silindi.' });
}));

export default router;
