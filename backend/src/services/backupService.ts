// Enflow — Yedekleme servisi (DB-tipi farkında, kapsam: PLATFORM | TENANT)
// ─────────────────────────────────────────────────────────────────────────────
// DATA  = tüm modellerin mantıksal JSON export'u (taşınabilir, DB-bağımsız).
// STATE = SQLite `VACUUM INTO` (sıcak tutarlı kopya) / Postgres pg_dump.
// FULL  = STATE + DATA.
// Hedef: LOCAL | NEXTCLOUD | S3 (backupTargets).
// Kimlik bilgileri moduleSettings.backup'tan; ASLA loglanmaz.

import { logger } from '../utils/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { BackupTarget, LocalTarget, NextcloudTarget, S3Target, BACKUPS_ROOT, ensureDir } from './backupTargets';

// Bağlantı URL'sini libpq ortam değişkenlerine çevirir (pg_dump/psql'e URL'yi argv ile
// vermek parolayı `ps` çıktısında yerel kullanıcılara açar). Prisma-özel parametreler
// (?schema=…) doğal olarak düşer; libpq'nun tanıdığı sslmode taşınır.
export function pgConnEnv(url: string): Record<string, string> {
  const u = new URL(url);
  const env: Record<string, string> = {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
  const ssl = u.searchParams.get('sslmode');
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

// Prisma bağlantı URL'sindeki Prisma'ya özgü parametreler (ör. wizard'ın yazdığı
// `?schema=public`) libpq araçlarında (pg_dump) "invalid URI query parameter" hatası
// verir → pg_dump'a vermeden önce ayıklanır. libpq'nun tanıdıkları (sslmode vb.) kalır.

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

// PLATFORM kapsamı TÜM kiracıların verisini (kullanıcı parola hash'leri dahil) tek dosyaya yazar.
// Çok kiracılı kurulumda bir kiracının GM/Backup Admin'i bunu alıp indirebilirse diğer kiracıların
// verisini okur (RLS yalnız Postgres'te ve opt-in; SQLite'ta hiç yok). Bu yüzden PLATFORM kapsamı
// YALNIZ tek kiracılı kurulumda (PLATFORM == kiracı) kullanılabilir; çok kiracılıda TENANT kapsamı
// kullanılır, tüm platformun yedeği operatör düzeyindedir (pg_dump / SQLite kopyası — upgrade-tool).
export class PlatformScopeForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super('Çok kiracılı kurulumda PLATFORM kapsamı kullanılamaz (diğer kiracıların verisini içerir). TENANT kapsamını kullanın; tüm platformun yedeği operatör düzeyinde (pg_dump / SQLite dosya kopyası) alınır.');
  }
}
/** Birden fazla kiracı var mı? (Tenant tablosu RLS istisnasıdır → bağlamdan bağımsız doğru sayı.) */
export async function isMultiTenant(): Promise<boolean> {
  return (await prisma.tenant.count()) > 1;
}
/** PLATFORM kapsamı bu kurulumda izinli mi — değilse PlatformScopeForbiddenError. */
export async function assertScopeAllowed(scope: BackupScope): Promise<void> {
  if (scope === 'PLATFORM' && (await isMultiTenant())) throw new PlatformScopeForbiddenError();
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
  await assertScopeAllowed(opts.scope); // derinlemesine savunma — route/scheduler de ayrıca kontrol eder
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
        // POSTGRES — pg_dump (yoksa zarifçe atla). RLS (FORCE) açıkken pg_dump varsayılan
        // olarak "row-level security policy" hatasıyla durur (tablo sahibi dahil) →
        // --enable-row-security + oturum-başı app.bypass_rls=on (politika bunu tanır).
        const dumpFile = path.join(tmpDir, `state-${stamp}.dump`);
        try {
          const { execFileSync } = await import('child_process');
          // Bağlantı bilgisi ARGV'de değil ortam değişkenlerinde (parola `ps` çıktısında görünmesin)
          execFileSync('pg_dump', ['-Fc', '--enable-row-security', '-f', dumpFile], {
            stdio: ['ignore', 'ignore', 'pipe'],
            env: { ...process.env, ...pgConnEnv(process.env.DATABASE_URL as string), PGOPTIONS: `${process.env.PGOPTIONS ?? ''} -c app.bypass_rls=on`.trim() },
          });
          totalSize += fs.statSync(dumpFile).size;
          stateRef = await target.put(dumpFile, `${job.id}/state-${stamp}.dump`);
        } catch (e: unknown) {
          // pg_dump yok → state atlanır (DATA yine alındıysa iş başarılı sayılır).
          // Başka bir hata SESSİZCE yutulmaz — iş yine COMPLETED (DATA var) ama loglanır.
          const err = e as { code?: string; stderr?: Buffer };
          if (err.code === 'ENOENT') logger.warn('[backup] pg_dump bulunamadı — STATE (pg dump) atlandı.');
          else logger.error('[backup] pg_dump başarısız — STATE atlandı:', String(err.stderr ?? e).slice(0, 500));
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

export { BACKUPS_ROOT, sha256File, makeTarget };
