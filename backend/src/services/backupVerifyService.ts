// Enflow — Yedek doğrulama (arka plan görevi tarafından da çağrılır)
// ─────────────────────────────────────────────────────────────────────────────
// DATA artefaktı: sha256 checksum eşleşmesi + JSON parse + model satır sayıları
// eşleşmesi. STATE (SQLite): ayrı bağlantıda PRAGMA integrity_check. Sonuç
// BackupJob.verifyStatus + verifyReport'a yazılır.

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { LocalTarget, NextcloudTarget, S3Target, BackupTarget } from './backupTargets';
import { getBackupSettings } from './backupService';

function sha256File(p: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

async function resolveTarget(targetType: string, location: string | null, tenantId: string): Promise<BackupTarget> {
  const settings = await getBackupSettings(tenantId);
  if (targetType === 'NEXTCLOUD' && settings?.nextcloud) {
    return new NextcloudTarget({ url: settings.nextcloud.url!, username: settings.nextcloud.username!, appPassword: settings.nextcloud.appPassword!, folder: location || settings.nextcloud.folder });
  }
  if (targetType === 'S3' && settings?.s3) {
    return new S3Target({ ...(settings.s3 as { bucket: string; accessKeyId: string; secretAccessKey: string }), prefix: location || settings.s3.prefix });
  }
  return new LocalTarget(location);
}

/** SQLite state dosyasının bütünlüğünü ayrı bir libsql bağlantısıyla denetler. */
async function sqliteIntegrity(filePath: string): Promise<{ ok: boolean; detail: string }> {
  try {
    // @libsql/client adapter-libsql'in bağımlılığı — lazy require.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@libsql/client');
    const client = createClient({ url: `file:${filePath}` });
    const res = await client.execute('PRAGMA integrity_check');
    const val = String(res.rows?.[0]?.integrity_check ?? res.rows?.[0]?.[0] ?? '').toLowerCase();
    await client.close?.();
    return { ok: val === 'ok', detail: val || 'bilinmiyor' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'integrity_check hatası' };
  }
}

export async function verifyBackup(jobId: string): Promise<{ status: 'PASSED' | 'FAILED'; report: Record<string, unknown> }> {
  const job = await prisma.backupJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('BackupJob bulunamadı.');

  const report: Record<string, unknown> = { checkedAt: new Date().toISOString() };
  let ok = true;
  const tmpDir = path.join(os.tmpdir(), `enflow-verify-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // ── DATA: checksum + counts ──
    if (job.dataRef) {
      let localData: string | null = null;
      if (job.targetType === 'LOCAL') {
        localData = path.isAbsolute(job.dataRef) ? job.dataRef : null;
      }
      if (!localData) {
        try {
          const target = await resolveTarget(job.targetType, job.location, job.tenantId);
          localData = path.join(tmpDir, 'data.json');
          await target.get(job.dataRef, localData);
        } catch (e) {
          report.dataFetch = `indirilemedi: ${e instanceof Error ? e.message : ''}`;
          localData = null;
        }
      }
      if (localData && fs.existsSync(localData)) {
        const csum = sha256File(localData);
        const csumMatch = !job.checksum || csum === job.checksum;
        report.checksumMatch = csumMatch;
        if (!csumMatch) ok = false;
        try {
          const parsed = JSON.parse(fs.readFileSync(localData, 'utf-8')) as { counts?: Record<string, number> };
          const expected = JSON.parse(job.modelCounts || '{}') as Record<string, number>;
          const mismatches: string[] = [];
          for (const [k, v] of Object.entries(expected)) {
            if ((parsed.counts?.[k] ?? -1) !== v) mismatches.push(`${k}: ${parsed.counts?.[k]} ≠ ${v}`);
          }
          report.countMatch = mismatches.length === 0;
          if (mismatches.length) { ok = false; report.countMismatches = mismatches; }
        } catch {
          ok = false; report.dataParse = 'JSON parse başarısız';
        }
      } else {
        ok = false; report.data = 'DATA artefaktı doğrulanamadı';
      }
    }

    // ── STATE: SQLite integrity_check (LOCAL) ──
    if (job.stateRef && job.dbProvider === 'SQLITE') {
      let localState: string | null = job.targetType === 'LOCAL' && path.isAbsolute(job.stateRef) ? job.stateRef : null;
      if (!localState) {
        try {
          const target = await resolveTarget(job.targetType, job.location, job.tenantId);
          localState = path.join(tmpDir, 'state.db');
          await target.get(job.stateRef, localState);
        } catch { localState = null; }
      }
      if (localState && fs.existsSync(localState)) {
        const integ = await sqliteIntegrity(localState);
        report.stateIntegrity = integ.detail;
        if (!integ.ok) ok = false;
      } else {
        report.state = 'STATE dosyası doğrulanamadı (uzak hedef GET desteklenmiyor olabilir)';
      }
    }

    const status: 'PASSED' | 'FAILED' = ok ? 'PASSED' : 'FAILED';
    await prisma.backupJob.update({
      where: { id: jobId },
      data: { verifyStatus: status, verifyReport: JSON.stringify(report), verifiedAt: new Date() },
    });
    return { status, report };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* yut */ }
  }
}

/** verifyStatus=PENDING + COMPLETED yedekleri sırayla doğrular (scheduler kullanır). */
export async function drainVerifyQueue(limit = 5): Promise<number> {
  const pending = await prisma.backupJob.findMany({
    where: { status: 'COMPLETED', verifyStatus: 'PENDING' },
    orderBy: { startedAt: 'asc' },
    take: limit,
  });
  let n = 0;
  for (const job of pending) {
    try { await verifyBackup(job.id); n++; } catch { /* tek iş hatası kuyruğu durdurmaz */ }
  }
  return n;
}
