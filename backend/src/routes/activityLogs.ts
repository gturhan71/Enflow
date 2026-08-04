import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { runArchive, getArchiveSettings } from '../services/activityLogArchiveService';
import { TargetType } from '../services/backupService';

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

// ── Arşivleme (dışa aktarım + prune) — yazma/silme içerdiği için GM-only ──────
const ARCHIVE_GATE = requireRole(['GENERAL_MANAGER']);

router.get('/archive-settings', ARCHIVE_GATE, asyncHandler(async (req: Request, res: Response) => {
  res.json(await getArchiveSettings(req.tenantId));
}));

router.get('/archives', ARCHIVE_GATE, asyncHandler(async (req: Request, res: Response) => {
  const jobs = await prisma.activityLogArchive.findMany({ where: { tenantId: req.tenantId }, orderBy: { startedAt: 'desc' }, take: 100 });
  res.json(jobs);
}));

router.post('/archive', ARCHIVE_GATE, asyncHandler(async (req: Request, res: Response) => {
  const { retentionDays, targetType, location } = req.body as { retentionDays?: number; targetType?: TargetType; location?: string };
  const job = await runArchive({
    tenantId: req.tenantId,
    trigger: 'MANUAL',
    retentionDays,
    targetType,
    location: location || null,
  });
  const full = await prisma.activityLogArchive.findUnique({ where: { id: job.id } });
  res.json(full);
}));

router.get('/archives/:id/download', ARCHIVE_GATE, asyncHandler(async (req: Request, res: Response) => {
  const job = await prisma.activityLogArchive.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Arşiv bulunamadı.' });
  if (job.targetType !== 'LOCAL') return res.status(400).json({ error: 'İndirme yalnız LOCAL hedef için.' });
  if (!job.location || !path.isAbsolute(job.location) || !fs.existsSync(job.location)) return res.status(404).json({ error: 'Arşiv dosyası bulunamadı.' });
  res.download(job.location, path.basename(job.location));
}));

export default router;
