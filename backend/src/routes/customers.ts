import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { name: 'asc' }
  });
  res.json(customers);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.create({
    data: { ...req.body, tenantId: req.tenantId }
  });
  res.json(customer);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const customer = await prisma.customer.update({ where: { id }, data: req.body });
  res.json(customer);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.customer.delete({ where: { id } });
  res.json({ message: 'Müşteri silindi.' });
}));

export default router;
