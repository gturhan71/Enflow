// Enflow — Denetim İzi arşivleme zamanlayıcı (in-process; süreç çalışırken)
// ─────────────────────────────────────────────────────────────────────────────
// Her tenant'ın moduleSettings.activityLogArchive.{enabled, intervalDays}
// değerine göre zamanı gelen arşivlemeyi tetikler (varsayılan: aktif, 30 günde
// bir, 180 günden eski kayıtlar). backupScheduler.ts ile aynı desen — süreç
// dışı kalıcı değil (ileride cron/queue); 1 saatte bir tarar (backup'tan daha
// seyrek — arşivleme günlük değil aylık taneli bir iştir).
// Çoklu-replika: schedulerLock.ts ile korunur — yalnız bir replika tick çalıştırır
// (bkz. docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz A / S-01).

import { prisma } from '../prismaClient';
import { runArchive, getArchiveSettings } from './activityLogArchiveService';
import { acquireLock, releaseLock } from './schedulerLock';

const LOCK_NAME = 'activity-log-archive-scheduler';
const LOCK_TTL_MS = 2 * 3_600_000; // 2sa — tick aralığından (1sa) büyük

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!(await acquireLock(LOCK_NAME, LOCK_TTL_MS))) return;
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      const s = await getArchiveSettings(t.id);
      if (!s.enabled || !s.intervalDays || s.intervalDays <= 0) continue;

      const last = await prisma.activityLogArchive.findFirst({
        where: { tenantId: t.id, trigger: 'SCHEDULED' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      const dueMs = s.intervalDays * 24 * 3600 * 1000;
      if (last && Date.now() - new Date(last.startedAt).getTime() < dueMs) continue;

      try {
        await runArchive({ tenantId: t.id, trigger: 'SCHEDULED', settings: s });
      } catch { /* tek tenant hatası diğerlerini durdurmaz */ }
    }
  } catch { /* sweep ana akışı bozmaz */ } finally {
    await releaseLock(LOCK_NAME);
    running = false;
  }
}

export function startActivityLogArchiveScheduler(): void {
  // İlk tarama 45sn sonra (boot yükünü backup scheduler'ın 30sn'lik ilk
  // taramasıyla çakıştırmamak için), sonra 1 saatte bir.
  setTimeout(() => { void tick(); }, 45_000);
  setInterval(() => { void tick(); }, 3_600_000);
}
