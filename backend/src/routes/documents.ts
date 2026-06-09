import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const docs = await prisma.corporateDocument.findMany({ where: { tenantId: req.tenantId } });
  res.json(docs);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const doc = await prisma.corporateDocument.create({
    data: {
      ...rest,
      expiryDate: expiryDate ? new Date(expiryDate as string) : null,
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      tenantId: req.tenantId
    }
  });
  res.json(doc);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (expiryDate) data.expiryDate = new Date(expiryDate as string);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const doc = await prisma.corporateDocument.update({ where: { id }, data });
  res.json(doc);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.corporateDocument.delete({ where: { id } });
  res.json({ message: 'Doküman silindi.' });
}));

export default router;
