import { Router, Request, Response } from 'express';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { getSalesMarginFloor, setSalesMarginFloor } from '../services/salesCosting';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_SALES_MGR = requireRole(['GENERAL_MANAGER', 'SALES_MGR']);

router.get('/', tenantMiddleware, GM_OR_SALES_MGR, asyncHandler(async (req: Request, res: Response) => {
  res.json({ marginFloorPct: await getSalesMarginFloor(req.tenantId) });
}));

router.put('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { marginFloorPct } = req.body as { marginFloorPct?: unknown };
  if (typeof marginFloorPct !== 'number' && typeof marginFloorPct !== 'string') {
    return res.status(400).json({ error: 'marginFloorPct sayısal olmalı.' });
  }
  const value = await setSalesMarginFloor(req.tenantId, Number(marginFloorPct));
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'SALES_SETTINGS_UPDATED', entityType: 'TENANT', entityId: req.tenantId, details: { marginFloorPct: value } });
  res.json({ marginFloorPct: value });
}));

export default router;
