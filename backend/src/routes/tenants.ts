import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Şirket adı zorunludur.' });

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({ data: { name } });
    await tx.subscription.create({ data: { tenantId: newTenant.id, plan: 'STARTER' } });
    return newTenant;
  });

  res.json(tenant);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const tenant = await prisma.tenant.update({
    where: { id: req.params.id as string },
    data: { name }
  });
  res.json(tenant);
}));

router.put('/:id/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const { plan } = req.body;

  if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ error: 'Geçersiz plan tipi.' });
  }

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: tenantId as string },
    update: { plan },
    create: { tenantId: tenantId as string, plan }
  });

  res.json(subscription);
}));

export default router;
