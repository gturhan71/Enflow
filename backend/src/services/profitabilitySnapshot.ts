// Enflow — Kârlılık Faz C: Planlı Defter Anlık Görüntüsü (plan-drift)
// ─────────────────────────────────────────────────────────────────────────────
// Aylık cron + on-demand ile planlı (PLAN) aylık `PeriodRow`'ları
// `ProfitabilitySnapshot`'a dondurur. "Planın o gün ne dediği" — gerçekleşen
// burada tutulmaz (her an canlı hesaplanır). Idempotency: (tenant, scope,
// projectKey, periodKey, asOfKey="YYYY-MM").
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §4 · §7 (Faz C)

import { prisma } from '../prismaClient';
import { getSummary } from './profitabilityService';

export function asOfKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface SnapshotResult {
  asOf: string;
  asOfKey: string;
  written: number;
  periodKeys: string[];
}

/**
 * Bir tenant için planlı aylık `PeriodRow`'ların anlık görüntüsünü alır (scope=ALL,
 * grain=MONTH). Aynı ay içinde tekrar çağrılırsa mevcut satırları GÜNCELLER
 * (upsert — plan gün içinde değişmişse en güncel hali yansır).
 */
export async function takeSnapshot(tenantId: string, opts: { asOf?: Date } = {}): Promise<SnapshotResult> {
  const asOf = opts.asOf ?? new Date();
  const asOfKey = asOfKeyOf(asOf);

  const summary = await getSummary(tenantId, { kind: 'ALL' }, 'MONTH', { asOf });

  let written = 0;
  const periodKeys: string[] = [];
  for (const r of summary.rows) {
    // Yalnız plan tarafı anlamlı olan satırları dondur (planlı gelir veya gider varsa)
    if (r.plannedRevenue === 0 && r.plannedCost === 0 && r.plannedCashIn === 0 && r.plannedCashOut === 0) continue;
    periodKeys.push(r.periodKey);
    await prisma.profitabilitySnapshot.upsert({
      where: {
        tenantId_scope_projectKey_periodKey_asOfKey: {
          tenantId, scope: 'ALL', projectKey: 'ALL', periodKey: r.periodKey, asOfKey,
        },
      },
      create: {
        tenantId, scope: 'ALL', projectKey: 'ALL', asOf, asOfKey, grain: 'MONTH',
        periodKey: r.periodKey, currency: r.currency,
        plannedRevenue: r.plannedRevenue, plannedCost: r.plannedCost, plannedMargin: r.plannedMarginPct,
        cashInPlanned: r.plannedCashIn, cashOutPlanned: r.plannedCashOut,
        payloadJson: JSON.stringify({ row: r, fxRates: summary.fxRates }),
      },
      update: {
        asOf,
        plannedRevenue: r.plannedRevenue, plannedCost: r.plannedCost, plannedMargin: r.plannedMarginPct,
        cashInPlanned: r.plannedCashIn, cashOutPlanned: r.plannedCashOut,
        payloadJson: JSON.stringify({ row: r, fxRates: summary.fxRates }),
      },
    });
    written++;
  }

  return { asOf: asOf.toISOString(), asOfKey, written, periodKeys };
}

export interface SnapshotRow {
  id: string;
  scope: string;
  projectKey: string;
  asOf: string;
  asOfKey: string;
  periodKey: string;
  currency: string;
  plannedRevenue: number;
  plannedCost: number;
  plannedMargin: number;
  cashInPlanned: number;
  cashOutPlanned: number;
  createdAt: string;
}

export async function listSnapshots(
  tenantId: string, filter: { periodKey?: string; scope?: string; limit?: number } = {},
): Promise<SnapshotRow[]> {
  const rows = await prisma.profitabilitySnapshot.findMany({
    where: {
      tenantId,
      ...(filter.periodKey ? { periodKey: filter.periodKey } : {}),
      ...(filter.scope ? { scope: filter.scope } : {}),
    },
    orderBy: [{ periodKey: 'asc' }, { asOf: 'asc' }],
    take: Math.min(filter.limit ?? 500, 2000),
  });
  return rows.map((r) => ({
    id: r.id, scope: r.scope, projectKey: r.projectKey,
    asOf: r.asOf.toISOString(), asOfKey: r.asOfKey, periodKey: r.periodKey, currency: r.currency,
    plannedRevenue: r.plannedRevenue, plannedCost: r.plannedCost, plannedMargin: r.plannedMargin,
    cashInPlanned: r.cashInPlanned, cashOutPlanned: r.cashOutPlanned,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface PlanDriftPoint { asOfKey: string; asOf: string; plannedRevenue: number; plannedCost: number; plannedMargin: number }
export interface PlanDriftSeries { periodKey: string; points: PlanDriftPoint[] }

/**
 * Her hedef dönem için, o dönemin planlı tahmininin snapshot'lar boyunca nasıl
 * değiştiği (asOfKey ekseninde). "Q3 planı Temmuz'da %40 marj diyordu, Ağustos'ta %32'ye düştü."
 */
export async function getPlanDrift(tenantId: string, opts: { periodKey?: string } = {}): Promise<PlanDriftSeries[]> {
  const rows = await prisma.profitabilitySnapshot.findMany({
    where: { tenantId, scope: 'ALL', ...(opts.periodKey ? { periodKey: opts.periodKey } : {}) },
    orderBy: [{ periodKey: 'asc' }, { asOf: 'asc' }],
    take: 2000,
  });
  const byPeriod = new Map<string, PlanDriftPoint[]>();
  for (const r of rows) {
    let arr = byPeriod.get(r.periodKey);
    if (!arr) { arr = []; byPeriod.set(r.periodKey, arr); }
    arr.push({
      asOfKey: r.asOfKey, asOf: r.asOf.toISOString(),
      plannedRevenue: r.plannedRevenue, plannedCost: r.plannedCost, plannedMargin: r.plannedMargin,
    });
  }
  return [...byPeriod.entries()].map(([periodKey, points]) => ({ periodKey, points }));
}
