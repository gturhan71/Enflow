// Enflow — Denetim İzi arşivleme servisi
// ─────────────────────────────────────────────────────────────────────────────
// Belirlenen saklama süresinden (retentionDays) eski ActivityLog kayıtlarını
// NDJSON dosyasına yazar, sha256 ile mühürler (checksum = içerik mührü,
// startedAt = zaman mührü), hedefe (LOCAL|NEXTCLOUD|S3 — backupTargets ile
// aynı soyutlama) yazdıktan SONRA canlı tablodan siler. Desen backupService.ts
// (runBackup) ile birebir aynı — bkz. o dosyadaki yorumlar.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../prismaClient';
import { BACKUPS_ROOT, ensureDir } from './backupTargets';
import { sha256File, makeTarget, BackupModuleSettings, TargetType } from './backupService';
import { logActivity } from './activityLog';

export const ARCHIVES_ROOT = path.join(BACKUPS_ROOT, 'activity-log-archives');

export interface ArchiveModuleSettings {
  enabled?: boolean;
  intervalDays?: number;     // kaç günde bir taransın (varsayılan 30 — aylık)
  retentionDays?: number;    // canlı tabloda kaç gün tutulsun (varsayılan 180)
  targetType?: TargetType;
  location?: string;
  nextcloud?: { url?: string; username?: string; appPassword?: string; folder?: string };
  s3?: { endpoint?: string; region?: string; bucket?: string; accessKeyId?: string; secretAccessKey?: string; prefix?: string };
}

const DEFAULTS: { enabled: boolean; intervalDays: number; retentionDays: number; targetType: TargetType } = {
  enabled: true,
  intervalDays: 30,
  retentionDays: 180,
  targetType: 'LOCAL',
};

/** moduleSettings.activityLogArchive oku; tenant hiç yapılandırmadıysa varsayılan
 *  (aktif, aylık, 180 gün) döner — özellik opt-in DEĞİL, varsayılan politikadır. */
export async function getArchiveSettings(tenantId: string): Promise<ArchiveModuleSettings> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const stored = (ms.activityLogArchive as ArchiveModuleSettings) || {};
  return { ...DEFAULTS, ...stored };
}

export interface RunArchiveOpts {
  tenantId: string;
  trigger?: 'MANUAL' | 'SCHEDULED';
  retentionDays?: number;
  targetType?: TargetType;
  location?: string | null;
  settings?: ArchiveModuleSettings | null;
}

/** Bir arşivleme işini baştan sona çalıştırır; ActivityLogArchive kaydı döner. */
export async function runArchive(opts: RunArchiveOpts): Promise<{ id: string }> {
  const settings = opts.settings || await getArchiveSettings(opts.tenantId);
  const retentionDays = opts.retentionDays ?? settings.retentionDays ?? DEFAULTS.retentionDays;
  const targetType = opts.targetType || settings.targetType || DEFAULTS.targetType;
  const defaultLocalLocation = targetType === 'LOCAL' ? ARCHIVES_ROOT : undefined;
  const location = opts.location ?? settings.location ?? defaultLocalLocation ?? null;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);

  const job = await prisma.activityLogArchive.create({
    data: { tenantId: opts.tenantId, trigger: opts.trigger || 'MANUAL', targetType, location, status: 'RUNNING' },
  });

  const tmpDir = path.join(os.tmpdir(), `enflow-activity-archive-${job.id}`);
  ensureDir(tmpDir);

  try {
    const rows = await prisma.activityLog.findMany({
      where: { tenantId: opts.tenantId, timestamp: { lt: cutoff } },
      orderBy: { timestamp: 'asc' },
    });

    if (rows.length === 0) {
      await prisma.activityLogArchive.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', recordCount: 0, completedAt: new Date() },
      });
      return { id: job.id };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(tmpDir, `activity-log-${opts.tenantId}-${stamp}.ndjson`);
    fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const checksum = sha256File(file);
    const sizeBytes = fs.statSync(file).size;

    const target = makeTarget(targetType, location, settings as BackupModuleSettings);
    const ref = await target.put(file, `${opts.tenantId}/activity-log-${stamp}.ndjson`);

    // Hedefe yazma başarılı — şimdi (ve YALNIZ şimdi) canlı tablodan sil.
    // Bu çalışmanın başında ÇEKİLEN id listesiyle sınırlı: sweep sırasında
    // yeni yazılan log satırları (cutoff'un altında bile olsa) etkilenmez.
    const ids = rows.map((r) => r.id);
    await prisma.activityLog.deleteMany({ where: { id: { in: ids } } });

    await prisma.activityLogArchive.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        location: ref,
        recordCount: rows.length,
        sizeBytes,
        checksum,
        pruned: true,
        fromTimestamp: rows[0].timestamp,
        toTimestamp: rows[rows.length - 1].timestamp,
        completedAt: new Date(),
      },
    });

    await logActivity({
      tenantId: opts.tenantId,
      action: 'ACTIVITY_LOG_ARCHIVED',
      entityType: 'ACTIVITY_LOG_ARCHIVE',
      entityId: job.id,
      details: { recordCount: rows.length, checksum, from: rows[0].timestamp, to: rows[rows.length - 1].timestamp, targetType },
    });

    return { id: job.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    await prisma.activityLogArchive.update({ where: { id: job.id }, data: { status: 'FAILED', error: msg, completedAt: new Date() } });
    throw e;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* yut */ }
  }
}
