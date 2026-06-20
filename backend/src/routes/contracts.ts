import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const contracts = await prisma.contract.findMany({ where: { tenantId: req.tenantId } });
  res.json(contracts);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { signedDate, endDate, guaranteeExpiry, ...rest } = req.body;
  const contract = await prisma.contract.create({
    data: {
      ...rest,
      signedDate: signedDate ? new Date(signedDate as string) : null,
      endDate: endDate ? new Date(endDate as string) : null,
      guaranteeExpiry: guaranteeExpiry ? new Date(guaranteeExpiry as string) : null,
      tenantId: req.tenantId
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'CONTRACT', entityId: contract.id });
  res.json(contract);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { signedDate, endDate, guaranteeExpiry, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (signedDate) data.signedDate = new Date(signedDate as string);
  if (endDate) data.endDate = new Date(endDate as string);
  if (guaranteeExpiry) data.guaranteeExpiry = new Date(guaranteeExpiry as string);
  const contract = await prisma.contract.update({ where: { id }, data });
  await logActivity({ tenantId, userId: req.userId, action: 'UPDATE', entityType: 'CONTRACT', entityId: id });
  res.json(contract);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.contract.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'CONTRACT', entityId: id });
  res.json({ message: 'Sözleşme silindi.' });
}));

export default router;
