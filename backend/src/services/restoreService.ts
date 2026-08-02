// Enflow — Geri yükleme servisi (analiz + diff raporu + mantıksal/state restore)
// ─────────────────────────────────────────────────────────────────────────────
// analyze : backup DATA vs canlı veri → model-bazlı eklenen/silinen/değişen.
// applyLogical : güvenlik snapshot → FK kapalı → tüm modelleri sil + yeniden yükle
//                (in-place, kesintisiz). DateTime alanları dmmf'e göre coerce edilir.
// stageState : state dosyasını indirip stage eder (kontrollü-restart; operasyonel).

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { LocalTarget, NextcloudTarget, S3Target, BackupTarget, BACKUPS_ROOT, ensureDir } from './backupTargets';
import { runBackup, getBackupSettings, listModels } from './backupService';

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

interface BackupPayload {
  meta: { version: number; scope: 'PLATFORM' | 'TENANT'; tenantId: string | null };
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
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

async function loadBackupData(backupId: string): Promise<BackupPayload> {
  const job = await prisma.backupJob.findUnique({ where: { id: backupId } });
  if (!job) throw new Error('BackupJob bulunamadı.');
  if (!job.dataRef) throw new Error('Bu yedekte mantıksal veri (DATA) yok; geri yükleme için DATA/FULL gerekir.');

  let localData: string | null = job.targetType === 'LOCAL' && path.isAbsolute(job.dataRef) ? job.dataRef : null;
  let tmp: string | null = null;
  if (!localData) {
    const target = await resolveTarget(job.targetType, job.location, job.tenantId);
    tmp = path.join(os.tmpdir(), `enflow-restore-${backupId}.json`);
    await target.get(job.dataRef, tmp);
    localData = tmp;
  }
  const parsed = JSON.parse(fs.readFileSync(localData, 'utf-8')) as BackupPayload;
  if (tmp) { try { fs.rmSync(tmp, { force: true }); } catch { /* yut */ } }
  return parsed;
}

function rowHash(row: Record<string, unknown>): string {
  return crypto.createHash('sha1').update(JSON.stringify(row, Object.keys(row).sort())).digest('hex');
}

/** backup vs canlı veri farkını hesaplar; RestoreJob (AWAITING_CONFIRM) oluşturur. */
export async function analyzeRestore(
  tenantId: string,
  backupId: string,
  startedBy?: { id?: string; name?: string },
): Promise<{ id: string; diffReport: Record<string, unknown> }> {
  const payload = await loadBackupData(backupId);
  const scope = payload.meta.scope;
  const scopeTenant = payload.meta.tenantId || tenantId;

  const diff: Record<string, { added: number; removed: number; changed: number; samples: { added: string[]; removed: string[]; changed: string[] } }> = {};

  for (const m of listModels()) {
    const backupRows = payload.data[m.name] || [];
    if (!payload.data[m.name] && backupRows.length === 0 && !m.hasTenantId && scope === 'TENANT') continue;
    const delegate = (prisma as unknown as Record<string, { findMany: (a?: unknown) => Promise<Record<string, unknown>[]> }>)[m.delegateKey];
    if (!delegate?.findMany) continue;
    const where = scope === 'TENANT' && m.hasTenantId ? { where: { tenantId: scopeTenant } } : undefined;
    const currentRows = await delegate.findMany(where);

    const backupById = new Map(backupRows.map(r => [String(r.id), r]));
    const currentById = new Map(currentRows.map(r => [String(r.id), r]));

    const added: string[] = [];   // backup'ta var, canlıda yok
    const removed: string[] = []; // canlıda var, backup'ta yok
    const changed: string[] = []; // aynı id, farklı içerik
    for (const [id, br] of backupById) {
      const cr = currentById.get(id);
      if (!cr) added.push(id);
      else if (rowHash(br) !== rowHash(cr)) changed.push(id);
    }
    for (const id of currentById.keys()) if (!backupById.has(id)) removed.push(id);

    if (added.length || removed.length || changed.length) {
      diff[m.name] = {
        added: added.length, removed: removed.length, changed: changed.length,
        samples: { added: added.slice(0, 5), removed: removed.slice(0, 5), changed: changed.slice(0, 5) },
      };
    }
  }

  // B-24 — tutarlılık kontrolü: applyLogicalRestore payload.data'da bulunan TÜM
  // modelleri tek transaction'da (FK deferred) sil+yeniden-yükler, yani ilişkili
  // tablolar (ör. Invoice+Payment) her zaman birlikte ve atomik geri yüklenir —
  // "yalnız Invoice'ı geri yükle" gibi seçmeli/kısmi bir mod YOK. Asıl risk bu
  // değil, şema kayması: yedek alındıktan SONRA eklenmiş bir model varsa backup
  // payload'ında hiç yer almaz → o modelin canlı verisi geri yüklemeden
  // etkilenmez ve az önce geri yüklenen (farklı id'li) ilişkili kayıtlara sarkan
  // referanslar tutarsız kalabilir. Bunu görünür kılıyoruz.
  const backupModelNames = new Set(Object.keys(payload.data));
  const schemaModelsNotInBackup = listModels()
    .filter(m => !backupModelNames.has(m.name))
    .map(m => m.name);

  const diffReport = {
    backupId, scope, analyzedAt: new Date().toISOString(),
    totalModelsWithDiff: Object.keys(diff).length,
    models: diff,
    schemaModelsNotInBackup, // bu modeller geri yüklemede DOKUNULMAZ (yedek onları hiç içermiyor)
  };

  const job = await prisma.restoreJob.create({
    data: {
      tenantId, backupId, mode: 'LOGICAL', status: 'AWAITING_CONFIRM',
      diffReport: JSON.stringify(diffReport),
      startedById: startedBy?.id, startedByName: startedBy?.name,
    },
  });
  return { id: job.id, diffReport };
}

// dmmf'ten model alan tiplerini al (DateTime coerce için)
function modelFieldTypes(modelName: string): Record<string, string> {
  const m = Prisma.dmmf.datamodel.models.find(x => x.name === modelName);
  const map: Record<string, string> = {};
  for (const f of m?.fields || []) {
    if (f.kind === 'scalar') map[f.name] = f.type;
  }
  return map;
}

function coerceRow(modelName: string, row: Record<string, unknown>): Record<string, unknown> {
  const types = modelFieldTypes(modelName);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const t = types[k];
    if (!t) continue; // skaler olmayan (relation) alanı atla
    if (v !== null && t === 'DateTime' && typeof v === 'string') out[k] = new Date(v);
    else out[k] = v;
  }
  return out;
}

/** Mantıksal geri yükleme: güvenlik snapshot + FK kapalı + sil/yeniden-yükle. */
export async function applyLogicalRestore(restoreId: string, actor?: { id?: string; name?: string }): Promise<{ restored: Record<string, number> }> {
  const restore = await prisma.restoreJob.findUnique({ where: { id: restoreId } });
  if (!restore) throw new Error('RestoreJob bulunamadı.');
  const payload = await loadBackupData(restore.backupId);
  const scope = payload.meta.scope;
  const scopeTenant = payload.meta.tenantId || restore.tenantId;

  await prisma.restoreJob.update({ where: { id: restoreId }, data: { status: 'RESTORING' } });

  // 1) Güvenlik ön-snapshot (aynı kapsam, FULL)
  let preId: string | null = null;
  try {
    const settings = await getBackupSettings(restore.tenantId);
    const pre = await runBackup({
      tenantId: restore.tenantId, scope, kind: scope === 'TENANT' ? 'DATA' : 'FULL',
      targetType: 'LOCAL', location: null, trigger: 'MANUAL',
      startedById: actor?.id, startedByName: `pre-restore (${actor?.name || ''})`, settings,
    });
    preId = pre.id;
  } catch { /* snapshot başarısızsa devam etme — güvenlik gereği fırlat */ throw new Error('Güvenlik snapshot alınamadı; geri yükleme iptal.'); }

  const restored: Record<string, number> = {};
  // Tek transaction (tek bağlantı) + defer_foreign_keys: FK kontrolü COMMIT'e ertelenir
  // → sil/yeniden-yükle sırasından bağımsız çalışır. (foreign_keys=OFF havuzlu
  // bağlantılarda insert bağlantısına uygulanmıyordu.)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('PRAGMA defer_foreign_keys=ON');
    // 2) Sil
    for (const m of listModels()) {
      if (!payload.data[m.name]) continue;
      const delegate = (tx as unknown as Record<string, { deleteMany: (a?: unknown) => Promise<unknown> }>)[m.delegateKey];
      if (!delegate?.deleteMany) continue;
      const where = scope === 'TENANT' && m.hasTenantId ? { where: { tenantId: scopeTenant } } : undefined;
      await delegate.deleteMany(where);
    }
    // 3) Yeniden yükle
    for (const m of listModels()) {
      const rows = payload.data[m.name];
      if (!rows || rows.length === 0) continue;
      const delegate = (tx as unknown as Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>)[m.delegateKey];
      if (!delegate?.createMany) continue;
      const coerced = rows.map(r => coerceRow(m.name, r));
      const res = await delegate.createMany({ data: coerced });
      restored[m.name] = res.count;
    }
  }, { timeout: 120_000, maxWait: 15_000 });

  await prisma.restoreJob.update({
    where: { id: restoreId },
    data: { status: 'COMPLETED', preRestoreBackupId: preId, completedAt: new Date() },
  });
  return { restored };
}

/** State dosyasını stage eder (kontrollü-restart ile uygulanır). */
export async function stageStateRestore(restoreId: string): Promise<{ stagedPath: string; note: string }> {
  const restore = await prisma.restoreJob.findUnique({ where: { id: restoreId } });
  if (!restore) throw new Error('RestoreJob bulunamadı.');
  const job = await prisma.backupJob.findUnique({ where: { id: restore.backupId } });
  if (!job?.stateRef) throw new Error('Bu yedekte state dosyası yok.');

  const stagedDir = path.join(BACKUPS_ROOT, 'staged');
  ensureDir(stagedDir);
  const staged = path.join(stagedDir, `restore-${restoreId}.db`);
  if (job.targetType === 'LOCAL' && path.isAbsolute(job.stateRef)) {
    fs.copyFileSync(job.stateRef, staged);
  } else {
    const target = await resolveTarget(job.targetType, job.location, job.tenantId);
    await target.get(job.stateRef, staged);
  }
  await prisma.restoreJob.update({ where: { id: restoreId }, data: { mode: 'STATE', status: 'AWAITING_CONFIRM' } });
  return {
    stagedPath: staged,
    note: 'State dosyası hazırlandı. Canlı DB dosyasını değiştirmek kontrollü yeniden başlatma gerektirir: servis durdurulur, dev.db bu dosyayla değiştirilir, servis başlatılır.',
  };
}
