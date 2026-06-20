import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';

const GM = requireRole(['GENERAL_MANAGER']);
const router: Router = Router();

router.get('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.archiveItem.findMany({ where: { tenantId: req.tenantId } });
  res.json(items);
}));

router.post('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { date, tags, ...rest } = req.body;
  const item = await prisma.archiveItem.create({
    data: {
      ...rest,
      date: date ? new Date(date as string) : new Date(),
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      tenantId: req.tenantId
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'ARCHIVE', entityId: item.id, details: { category: item.category } });
  res.json(item);
}));

router.put('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { date, tags, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.archiveItem.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (date) data.date = new Date(date as string);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const item = await prisma.archiveItem.update({ where: { id }, data });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'ARCHIVE', entityId: id });
  res.json(item);
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.archiveItem.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.archiveItem.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'ARCHIVE', entityId: id });
  res.json({ message: 'Arşiv kaydı silindi.' });
}));

export default router;
