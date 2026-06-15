import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';

const GM = requireRole(['GENERAL_MANAGER']);
const router: Router = Router();

router.get('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.tenantId },
    include: { unit: true }
  });
  res.json(users);
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
  res.json(user);
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
  res.json(user);
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
