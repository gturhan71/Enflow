import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { sweepTenderReminders } from '../services/tenderReminders';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await sweepTenderReminders(req.tenantId); // poll'de zaman-eşiği hatırlatmaları üret
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const notifications = await prisma.notification.findMany({
    where: { tenantId: req.tenantId, ...(userId ? { userId } : {}) },
    orderBy: { timestamp: 'desc' }
  });
  res.json(notifications);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const notification = await prisma.notification.create({
    data: { ...req.body, tenantId: req.tenantId }
  });
  res.json(notification);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.notification.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const notification = await prisma.notification.update({ where: { id }, data: req.body });
  res.json(notification);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.notification.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.notification.delete({ where: { id } });
  res.json({ message: 'Bildirim silindi.' });
}));

export default router;
