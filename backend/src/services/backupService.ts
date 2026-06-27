// Enflow — Yedekleme servisi (DB-tipi farkında, kapsam: PLATFORM | TENANT)
// ─────────────────────────────────────────────────────────────────────────────
// DATA  = tüm modellerin mantıksal JSON export'u (taşınabilir, DB-bağımsız).
// STATE = SQLite `VACUUM INTO` (sıcak tutarlı kopya) / Postgres pg_dump.
// FULL  = STATE + DATA.
// Hedef: LOCAL | NEXTCLOUD | S3 (backupTargets).
// Kimlik bilgileri moduleSettings.backup'tan; ASLA loglanmaz.

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { BackupTarget, LocalTarget, NextcloudTarget, S3Target, BACKUPS_ROOT, ensureDir } from './backupTargets';

export type BackupScope = 'PLATFORM' | 'TENANT';
export type BackupKind = 'FULL' | 'STATE' | 'DATA';
export type TargetType = 'LOCAL' | 'NEXTCLOUD' | 'S3';
export type DbProvider = 'SQLITE' | 'POSTGRES';

// Yedek dışı tutulan modeller (yedek metadatası kendini yedeklemesin)
const EXCLUDED_MODELS = new Set(['BackupJob', 'RestoreJob']);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export interface ModelMeta {
  name: string;
  delegateKey: string;
  hasTenantId: boolean;
}

/** dmmf'ten dışa aktarılacak modeller (yedek modelleri hariç). */
export function listModels(): ModelMeta[] {
  return Prisma.dmmf.datamodel.models
    .filter(m => !EXCLUDED_MODELS.has(m.name))
    .map(m => ({
      name: m.name,
      delegateKey: lowerFirst(m.name),
      hasTenantId: m.fields.some(f => f.name === 'tenantId'),
    }));
}

export function detectProvider(): DbProvider {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  return /^postgres(ql)?:\/\//i.test(url) ? 'POSTGRES' : 'SQLITE';
}

function sqliteFilePath(): string {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const rel = url.replace(/^file:/, '');
  return path.isAbsolute(rel) ? rel : path.resolve(__dirname, '../../prisma', rel);
}

/** Tüm (yedeklenebilir) modelleri JSON nesnesine export eder. */
export async function exportLogicalData(
  scope: BackupScope,
  tenantId?: string,
): Promise<{ data: Record<string, unknown[]>; counts: Record<string, number> }> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const m of listModels()) {
    // TENANT kapsamda yalnız tenantId'li modeller, filtreli.
    if (scope === 'TENANT' && !m.hasTenantId) continue;
    const where = scope === 'TENANT' && m.hasTenantId ? { tenantId } : undefined;
    const delegate = (prisma as unknown as Record<string, { findMany: (a?: unknown) => Promise<unknown[]> }>)[m.delegateKey];
    if (!delegate?.findMany) continue;
    const rows = await delegate.findMany(where ? { where } : undefined);
    data[m.name] = rows;
    counts[m.name] = rows.length;
  }
  return { data, counts };
}

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function makeTarget(targetType: TargetType, location: string | null, settings: BackupModuleSettings | null): BackupTarget {
  if (targetType === 'NEXTCLOUD') {
    const nc = settings?.nextcloud;
    if (!nc?.url || !nc?.username || !nc?.appPassword) throw new Error('Nextcloud kimlik bilgileri eksik (Şirket Profili → Yedekleme).');
    return new NextcloudTarget({ url: nc.url, username: nc.username, appPassword: nc.appPassword, folder: location || nc.folder });
  }
  if (targetType === 'S3') {
    const s3 = settings?.s3;
    if (!s3?.bucket || !s3?.accessKeyId || !s3?.secretAccessKey) throw new Error('S3 kimlik bilgileri eksik (Şirket Profili → Yedekleme).');
    return new S3Target({
      endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket,
      accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey,
      prefix: location || s3.prefix,
    });
  }
  return new LocalTarget(location);
}

export interface BackupModuleSettings {
  enabled?: boolean;
  intervalHours?: number;
  scope?: BackupScope;
  kind?: BackupKind;
  targetType?: TargetType;
  location?: string;
  nextcloud?: { url?: string; username?: string; appPassword?: string; folder?: string };
  s3?: { endpoint?: string; region?: string; bucket?: string; accessKeyId?: string; secretAccessKey?: string; prefix?: string };
}

export interface RunBackupOpts {
  tenantId: string;
  scope: BackupScope;
  kind: BackupKind;
  targetType: TargetType;
  location?: string | null;
  trigger?: 'MANUAL' | 'SCHEDULED';
  startedById?: string;
  startedByName?: string;
  settings: BackupModuleSettings | null;
}

/** Bir yedek işini baştan sona çalıştırır; BackupJob kaydı döner. */
export async function runBackup(opts: RunBackupOpts): Promise<{ id: string }> {
  const provider = detectProvider();
  const job = await prisma.backupJob.create({
    data: {
      tenantId: opts.tenantId,
      scope: opts.scope,
      kind: opts.kind,
      dbProvider: provider,
      trigger: opts.trigger || 'MANUAL',
      targetType: opts.targetType,
      location: opts.location || null,
      status: 'RUNNING',
      startedById: opts.startedById,
      startedByName: opts.startedByName,
    },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tmpDir = path.join(os.tmpdir(), `enflow-backup-${job.id}`);
  ensureDir(tmpDir);

  try {
    const target = makeTarget(opts.targetType, opts.location || null, opts.settings);
    let stateRef: string | null = null;
    let dataRef: string | null = null;
    let checksum: string | null = null;
    let counts: Record<string, number> = {};
    let totalSize = 0;

    // DATA (mantıksal) — FULL veya DATA
    if (opts.kind === 'FULL' || opts.kind === 'DATA') {
      const { data, counts: c } = await exportLogicalData(opts.scope, opts.tenantId);
      counts = c;
      const payload = {
        meta: { version: 1, scope: opts.scope, provider, tenantId: opts.scope === 'TENANT' ? opts.tenantId : null, createdAt: new Date().toISOString() },
        counts: c,
        data,
      };
      const dataFile = path.join(tmpDir, `data-${stamp}.json`);
      fs.writeFileSync(dataFile, JSON.stringify(payload));
      checksum = sha256File(dataFile);
      totalSize += fs.statSync(dataFile).size;
      dataRef = await target.put(dataFile, `${job.id}/data-${stamp}.json`);
    }

    // STATE (dosya/dump) — FULL veya STATE; yalnız PLATFORM anlamlı
    if ((opts.kind === 'FULL' || opts.kind === 'STATE') && opts.scope === 'PLATFORM') {
      if (provider === 'SQLITE') {
        const stateFile = path.join(tmpDir, `state-${stamp}.db`);
        // VACUUM INTO — sıcak, tutarlı kopya
        await prisma.$executeRawUnsafe(`VACUUM INTO '${stateFile.replace(/'/g, "''")}'`);
        totalSize += fs.statSync(stateFile).size;
        stateRef = await target.put(stateFile, `${job.id}/state-${stamp}.db`);
      } else {
        // POSTGRES — pg_dump (yoksa zarifçe atla)
        const dumpFile = path.join(tmpDir, `state-${stamp}.dump`);
        try {
          const { execFileSync } = await import('child_process');
          const url = process.env.DATABASE_URL as string;
          execFileSync('pg_dump', ['-Fc', '-f', dumpFile, url], { stdio: 'ignore' });
          totalSize += fs.statSync(dumpFile).size;
          stateRef = await target.put(dumpFile, `${job.id}/state-${stamp}.dump`);
        } catch {
          // pg_dump yok → state atlanır (DATA yine alındıysa iş başarılı sayılır)
        }
      }
    }

    await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        sizeBytes: totalSize,
        checksum,
        stateRef,
        dataRef,
        modelCounts: JSON.stringify(counts),
        completedAt: new Date(),
      },
    });
    return { id: job.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
    await prisma.backupJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: msg, completedAt: new Date() } });
    throw e;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* yut */ }
  }
}

/** moduleSettings.backup oku (kimlik dahil — yalnız sunucu içi kullanım). */
export async function getBackupSettings(tenantId: string): Promise<BackupModuleSettings | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  return (ms.backup as BackupModuleSettings) || null;
}

export { BACKUPS_ROOT };
