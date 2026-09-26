// Enflow — Kârlılık planlı-defter anlık görüntüsü zamanlayıcı (in-process)
// ─────────────────────────────────────────────────────────────────────────────
// Her tenant için ayda bir kez planlı aylık `PeriodRow`'ları ProfitabilitySnapshot'a
// dondurur (plan-drift izlemesi). activityLogArchiveScheduler.ts ile aynı desen;
// aylık taneli bir iş olduğundan 6 saatte bir tarar. schedulerLock ile çoklu-replika
// korumalı. bkz. docs/KARLILIK_ANALIZI_PLAN.md §7 (Faz C)

import { prisma } from '../prismaClient';
import { takeSnapshot, asOfKeyOf } from './profitabilitySnapshot';
import { acquireLock, releaseLock } from './schedulerLock';
import { runWithTenant } from './tenantContext';
import { schedulePeriodic, type StopFn } from './periodic';

const LOCK_NAME = 'profitability-snapshot-scheduler';
const LOCK_TTL_MS = 2 * 3_600_000;

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!(await acquireLock(LOCK_NAME, LOCK_TTL_MS))) return;
    const now = new Date();
    const asOfKey = asOfKeyOf(now);
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      // Postgres RLS (Faz 3) — bu döngü hiçbir HTTP isteğinin İÇİNDE değil,
      // her iterasyon kendi tenant-context'ini kurmalı.
      await runWithTenant(t.id, async () => {
        const existing = await prisma.profitabilitySnapshot.findFirst({
          where: { tenantId: t.id, asOfKey },
          select: { id: true },
        });
        if (existing) return; // bu ay zaten alındı
        try {
          await takeSnapshot(t.id, { asOf: now });
        } catch { /* tek tenant hatası diğerlerini durdurmaz */ }
      });
    }
  } catch { /* sweep ana akışı bozmaz */ } finally {
    await releaseLock(LOCK_NAME);
    running = false;
  }
}

export function startProfitabilitySnapshotScheduler(): StopFn {
  return schedulePeriodic(60_000, 6 * 3_600_000, () => { void tick(); });  // 6 saatte bir
}
