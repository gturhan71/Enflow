import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();
router.use(tenantMiddleware);

// Denetim-izi okuma: GET /api/activity-logs?entityType=&entityId=&action=&limit=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, action } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await prisma.activityLog.findMany({
    where: {
      tenantId: req.tenantId,
      ...(entityType ? { entityType: String(entityType) } : {}),
      ...(entityId ? { entityId: String(entityId) } : {}),
      ...(action ? { action: String(action) } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  res.json(logs);
}));

export default router;
