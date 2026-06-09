import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: req.tenantId }
  });
  res.json(subscription || { plan: 'STARTER' });
}));

router.get('/usage', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const period = new Date().toISOString().slice(0, 7);
  const usage = await prisma.usageMetric.findMany({ where: { tenantId, period } });
  res.json(usage);
}));

export default router;
