import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';

const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_SALES = requireRole(['GENERAL_MANAGER', 'SALES_REP']);
const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { name: 'asc' }
  });
  res.json(customers);
}));

router.post('/', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.create({
    data: { ...req.body, tenantId: req.tenantId }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'CUSTOMER', entityId: customer.id, details: { name: customer.name } });
  res.json(customer);
}));

router.put('/:id', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const customer = await prisma.customer.update({ where: { id }, data: req.body });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'CUSTOMER', entityId: id, details: { name: customer.name } });
  res.json(customer);
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.customer.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'CUSTOMER', entityId: id });
  res.json({ message: 'Müşteri silindi.' });
}));

export default router;
