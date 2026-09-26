// Enflow — Yedekleme zamanlayıcı (in-process; süreç çalışırken)
// ─────────────────────────────────────────────────────────────────────────────
// Her tenant'ın moduleSettings.backup.enabled + intervalHours değerine göre
// zamanı gelen yedeği tetikler, ardından doğrulama kuyruğunu boşaltır.
// Not: süreç dışı kalıcı değil (ileride cron/queue). 60sn'de bir tarar.
// Çoklu-replika: schedulerLock.ts ile korunur — yalnız bir replika tick çalıştırır
// (bkz. docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz A / S-01).

import { prisma } from '../prismaClient';
import { runBackup, getBackupSettings, BackupScope, BackupKind, TargetType } from './backupService';
import { drainVerifyQueue } from './backupVerifyService';
import { logActivity } from './activityLog';
import { acquireLock, releaseLock } from './schedulerLock';
import { runWithTenant } from './tenantContext';
import { schedulePeriodic, type StopFn } from './periodic';
import { logger } from '../utils/logger';

const LOCK_NAME = 'backup-scheduler';
const LOCK_TTL_MS = 10 * 60_000; // 10dk — runBackup uzun sürebilir (VACUUM INTO)

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!(await acquireLock(LOCK_NAME, LOCK_TTL_MS))) return;
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    // Çok kiracılıda PLATFORM kapsamı diğer kiracıların verisini sızdırır (backupService) →
    // zamanlanmış yedek TENANT/DATA'ya indirgenir (yalnız kendi kiracısının verisi).
    const multiTenant = tenants.length > 1;
    for (const t of tenants) {
      // Postgres RLS (Faz 3) — bu döngü hiçbir HTTP isteğinin İÇİNDE değil,
      // her iterasyon kendi tenant-context'ini kurmalı.
      await runWithTenant(t.id, async () => {
        const s = await getBackupSettings(t.id);
        if (!s?.enabled || !s.intervalHours || s.intervalHours <= 0) return;

        const last = await prisma.backupJob.findFirst({
          where: { tenantId: t.id, trigger: 'SCHEDULED' },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true },
        });
        const dueMs = s.intervalHours * 3600 * 1000;
        if (last && Date.now() - new Date(last.startedAt).getTime() < dueMs) return;

        try {
          let scope = (s.scope as BackupScope) || 'PLATFORM';
          let kind = (s.kind as BackupKind) || 'FULL';
          if (multiTenant && scope === 'PLATFORM') {
            scope = 'TENANT';
            kind = 'DATA'; // STATE (tüm veritabanı kopyası) yalnız PLATFORM'da anlamlı ve çok kiracılıda yasak
            logger.warn(`[backup] çok kiracılı kurulum: ${t.id} için zamanlanmış PLATFORM yedeği TENANT/DATA'ya indirgendi.`);
          }
          const job = await runBackup({
            tenantId: t.id,
            scope,
            kind,
            targetType: (s.targetType as TargetType) || 'LOCAL',
            location: s.location || null,
            trigger: 'SCHEDULED',
            startedByName: 'scheduler',
            settings: s,
          });
          await logActivity({ tenantId: t.id, action: 'BACKUP_SCHEDULED_RUN', entityType: 'BACKUP_JOB', entityId: job.id, details: { intervalHours: s.intervalHours } });
        } catch { /* tek tenant hatası diğerlerini durdurmaz */ }
      });
    }

    // Doğrulama kuyruğu (manuel + zamanlı tüm bekleyenler)
    await drainVerifyQueue(5);
  } catch { /* sweep ana akışı bozmaz */ } finally {
    await releaseLock(LOCK_NAME);
    running = false;
  }
}

export function startBackupScheduler(): StopFn {
  // İlk tarama 30sn sonra (boot yükünü dağıt), sonra 60sn'de bir.
  return schedulePeriodic(30_000, 60_000, () => { void tick(); });
}
