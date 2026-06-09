import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tasks = await prisma.todoTask.findMany({ where: { tenantId: req.tenantId } });
  res.json(tasks);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, ...rest } = req.body;
  const task = await prisma.todoTask.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate as string) : null,
      progressNotes: typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes || []),
      tenantId: req.tenantId
    }
  });
  res.json(task);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (dueDate) data.dueDate = new Date(dueDate as string);
  if (progressNotes !== undefined) {
    data.progressNotes = typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes);
  }
  const task = await prisma.todoTask.update({ where: { id }, data });
  res.json(task);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.todoTask.delete({ where: { id } });
  res.json({ message: 'Görev silindi.' });
}));

export default router;
