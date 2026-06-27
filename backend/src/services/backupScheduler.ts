// Enflow — Yedekleme zamanlayıcı (in-process; süreç çalışırken)
// ─────────────────────────────────────────────────────────────────────────────
// Her tenant'ın moduleSettings.backup.enabled + intervalHours değerine göre
// zamanı gelen yedeği tetikler, ardından doğrulama kuyruğunu boşaltır.
// Not: süreç dışı kalıcı değil (ileride cron/queue). 60sn'de bir tarar.

import { prisma } from '../prismaClient';
import { runBackup, getBackupSettings, BackupScope, BackupKind, TargetType } from './backupService';
import { drainVerifyQueue } from './backupVerifyService';
import { logActivity } from './activityLog';

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      const s = await getBackupSettings(t.id);
      if (!s?.enabled || !s.intervalHours || s.intervalHours <= 0) continue;

      const last = await prisma.backupJob.findFirst({
        where: { tenantId: t.id, trigger: 'SCHEDULED' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      const dueMs = s.intervalHours * 3600 * 1000;
      if (last && Date.now() - new Date(last.startedAt).getTime() < dueMs) continue;

      try {
        const job = await runBackup({
          tenantId: t.id,
          scope: (s.scope as BackupScope) || 'PLATFORM',
          kind: (s.kind as BackupKind) || 'FULL',
          targetType: (s.targetType as TargetType) || 'LOCAL',
          location: s.location || null,
          trigger: 'SCHEDULED',
          startedByName: 'scheduler',
          settings: s,
        });
        await logActivity({ tenantId: t.id, action: 'BACKUP_SCHEDULED_RUN', entityType: 'BACKUP_JOB', entityId: job.id, details: { intervalHours: s.intervalHours } });
      } catch { /* tek tenant hatası diğerlerini durdurmaz */ }
    }

    // Doğrulama kuyruğu (manuel + zamanlı tüm bekleyenler)
    await drainVerifyQueue(5);
  } catch { /* sweep ana akışı bozmaz */ } finally {
    running = false;
  }
}

export function startBackupScheduler(): void {
  // İlk tarama 30sn sonra (boot yükünü dağıt), sonra 60sn'de bir.
  setTimeout(() => { void tick(); }, 30_000);
  setInterval(() => { void tick(); }, 60_000);
}
