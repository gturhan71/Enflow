import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';

const GM = requireRole(['GENERAL_MANAGER']);
const router: Router = Router();

// `permissions` DB'de JSON string olarak saklanır; frontend'e her zaman
// parse edilmiş bir dizi olarak gönderilir. Aksi halde frontend tarafında
// `[...user.permissions]` gibi bir spread, string'i karakter dizisine
// bozar — geçmişte tam olarak bu corrupt veriye yol açmıştı (2026-06-16).
function parsePermissions<T extends { permissions: string }>(user: T): Omit<T, 'permissions'> & { permissions: string[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(user.permissions); } catch { parsed = []; }
  const clean = Array.isArray(parsed)
    ? Array.from(new Set(parsed.filter((p): p is string => typeof p === 'string' && p.length > 3)))
    : [];
  return { ...user, permissions: clean };
}

router.get('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.tenantId },
    include: { unit: true }
  });
  res.json(users.map(parsePermissions));
}));

router.post('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions } = req.body;
  const user = await prisma.user.create({
    data: {
      name, email, role, unitId: unitId || null,
      tenantId: req.tenantId,
      permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions || ['DASHBOARD_VIEW']),
      status: 'ACTIVE'
    }
  });
  res.json(parsePermissions(user));
}));

router.put('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions, status } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { name, email, role, unitId, status };
  if (permissions) {
    data.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
  }
  const user = await prisma.user.update({ where: { id }, data });
  res.json(parsePermissions(user));
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.user.delete({ where: { id } });
  res.json({ message: 'Kullanıcı silindi.' });
}));

export default router;
