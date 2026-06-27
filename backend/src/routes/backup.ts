// Enflow — Yedekleme / Geri Yükleme API'si (Backup Admin + GM)
// Salt-okunur rol guard'ından muaf (yedek/restore Backup Admin'in izinli işi).

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { prisma } from '../prismaClient';
import { logActivity } from '../services/activityLog';
import { runBackup, getBackupSettings, BackupScope, BackupKind, TargetType, BackupModuleSettings } from '../services/backupService';
import { verifyBackup } from '../services/backupVerifyService';
import { analyzeRestore, applyLogicalRestore, stageStateRestore } from '../services/restoreService';

const router: Router = Router();
router.use(tenantMiddleware);
const GATE = requireRole(['BACKUP_ADMIN', 'GENERAL_MANAGER']);
router.use(GATE);

const sid = (req: Request) => String(req.params.id);

async function actorName(req: Request): Promise<string | undefined> {
  if (!req.userId) return undefined;
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
  return u?.name || undefined;
}

// ── Yedek işleri ──────────────────────────────────────────────────────────────
router.get('/jobs', asyncHandler(async (req: Request, res: Response) => {
  const jobs = await prisma.backupJob.findMany({ where: { tenantId: req.tenantId }, orderBy: { startedAt: 'desc' }, take: 100 });
  res.json(jobs);
}));

router.post('/jobs', asyncHandler(async (req: Request, res: Response) => {
  const { scope, kind, targetType, location } = req.body as { scope?: BackupScope; kind?: BackupKind; targetType?: TargetType; location?: string };
  const settings = await getBackupSettings(req.tenantId);
  const job = await runBackup({
    tenantId: req.tenantId,
    scope: scope || 'PLATFORM',
    kind: kind || 'FULL',
    targetType: targetType || 'LOCAL',
    location: location || null,
    trigger: 'MANUAL',
    startedById: req.userId,
    startedByName: await actorName(req),
    settings,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'BACKUP_CREATE', entityType: 'BACKUP_JOB', entityId: job.id, details: { scope, kind, targetType } });
  const full = await prisma.backupJob.findUnique({ where: { id: job.id } });
  res.json(full);
}));

router.get('/jobs/:id', asyncHandler(async (req: Request, res: Response) => {
  const job = await prisma.backupJob.findFirst({ where: { id: sid(req), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  res.json(job);
}));

router.post('/jobs/:id/verify', asyncHandler(async (req: Request, res: Response) => {
  const job = await prisma.backupJob.findFirst({ where: { id: sid(req), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  const result = await verifyBackup(job.id);
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'BACKUP_VERIFY', entityType: 'BACKUP_JOB', entityId: job.id, details: { status: result.status } });
  res.json(result);
}));

router.get('/jobs/:id/download', asyncHandler(async (req: Request, res: Response) => {
  const which = req.query.artifact === 'state' ? 'state' : 'data';
  const job = await prisma.backupJob.findFirst({ where: { id: sid(req), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  if (job.targetType !== 'LOCAL') return res.status(400).json({ error: 'İndirme yalnız LOCAL hedef için.' });
  const ref = which === 'state' ? job.stateRef : job.dataRef;
  if (!ref || !path.isAbsolute(ref) || !fs.existsSync(ref)) return res.status(404).json({ error: 'Artefakt bulunamadı.' });
  res.download(ref, path.basename(ref));
}));

// ── Geri yükleme ──────────────────────────────────────────────────────────────
router.post('/restore/analyze', asyncHandler(async (req: Request, res: Response) => {
  const { backupId } = req.body as { backupId?: string };
  if (!backupId) return res.status(400).json({ error: 'backupId zorunlu.' });
  const job = await prisma.backupJob.findFirst({ where: { id: backupId, tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  const result = await analyzeRestore(req.tenantId, backupId, { id: req.userId, name: await actorName(req) });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'RESTORE_ANALYZE', entityType: 'RESTORE_JOB', entityId: result.id, details: { backupId } });
  res.json(result);
}));

router.get('/restore', asyncHandler(async (req: Request, res: Response) => {
  const jobs = await prisma.restoreJob.findMany({ where: { tenantId: req.tenantId }, orderBy: { startedAt: 'desc' }, take: 50 });
  res.json(jobs);
}));

router.get('/restore/:id', asyncHandler(async (req: Request, res: Response) => {
  const job = await prisma.restoreJob.findFirst({ where: { id: sid(req), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Geri yükleme bulunamadı.' });
  res.json(job);
}));

router.post('/restore/:id/confirm', asyncHandler(async (req: Request, res: Response) => {
  const { mode } = req.body as { mode?: 'LOGICAL' | 'STATE' };
  const job = await prisma.restoreJob.findFirst({ where: { id: sid(req), tenantId: req.tenantId } });
  if (!job) return res.status(404).json({ error: 'Geri yükleme bulunamadı.' });
  const actor = { id: req.userId, name: await actorName(req) };
  if (mode === 'STATE') {
    const r = await stageStateRestore(job.id);
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'RESTORE_STATE_STAGE', entityType: 'RESTORE_JOB', entityId: job.id });
    return res.json(r);
  }
  const r = await applyLogicalRestore(job.id, actor);
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'RESTORE_APPLY', entityType: 'RESTORE_JOB', entityId: job.id, details: { models: Object.keys(r.restored).length } });
  res.json(r);
}));

// ── Ayarlar (moduleSettings.backup; kimlik bilgileri maskeli) ──────────────────
function maskedSettings(s: BackupModuleSettings | null) {
  const nc = s?.nextcloud || {};
  const s3 = s?.s3 || {};
  return {
    enabled: s?.enabled ?? false,
    intervalHours: s?.intervalHours ?? 0,
    scope: s?.scope ?? 'PLATFORM',
    kind: s?.kind ?? 'FULL',
    targetType: s?.targetType ?? 'LOCAL',
    location: s?.location ?? '',
    nextcloud: { url: nc.url ?? '', username: nc.username ?? '', folder: nc.folder ?? '', hasPassword: Boolean(nc.appPassword) },
    s3: { endpoint: s3.endpoint ?? '', region: s3.region ?? '', bucket: s3.bucket ?? '', prefix: s3.prefix ?? '', hasSecret: Boolean(s3.secretAccessKey), accessKeyId: s3.accessKeyId ?? '' },
  };
}

router.get('/settings', asyncHandler(async (req: Request, res: Response) => {
  res.json(maskedSettings(await getBackupSettings(req.tenantId)));
}));

router.put('/settings', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as BackupModuleSettings;
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const prev = (ms.backup as BackupModuleSettings) || {};

  // Sırlar boş gelirse mevcut korunur.
  const next: BackupModuleSettings = {
    enabled: body.enabled ?? prev.enabled ?? false,
    intervalHours: body.intervalHours ?? prev.intervalHours ?? 0,
    scope: body.scope ?? prev.scope ?? 'PLATFORM',
    kind: body.kind ?? prev.kind ?? 'FULL',
    targetType: body.targetType ?? prev.targetType ?? 'LOCAL',
    location: body.location ?? prev.location ?? '',
    nextcloud: {
      url: body.nextcloud?.url ?? prev.nextcloud?.url ?? '',
      username: body.nextcloud?.username ?? prev.nextcloud?.username ?? '',
      folder: body.nextcloud?.folder ?? prev.nextcloud?.folder ?? '',
      appPassword: body.nextcloud?.appPassword?.trim() ? body.nextcloud.appPassword.trim() : (prev.nextcloud?.appPassword ?? ''),
    },
    s3: {
      endpoint: body.s3?.endpoint ?? prev.s3?.endpoint ?? '',
      region: body.s3?.region ?? prev.s3?.region ?? '',
      bucket: body.s3?.bucket ?? prev.s3?.bucket ?? '',
      prefix: body.s3?.prefix ?? prev.s3?.prefix ?? '',
      accessKeyId: body.s3?.accessKeyId ?? prev.s3?.accessKeyId ?? '',
      secretAccessKey: body.s3?.secretAccessKey?.trim() ? body.s3.secretAccessKey.trim() : (prev.s3?.secretAccessKey ?? ''),
    },
  };
  ms.backup = next;
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'BACKUP_SETTINGS_UPDATED', entityType: 'TENANT', entityId: req.tenantId, details: { enabled: next.enabled, intervalHours: next.intervalHours, targetType: next.targetType } });
  res.json(maskedSettings(next));
}));

export default router;
