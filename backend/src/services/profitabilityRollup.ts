// Enflow — Kârlılık Rollup (dönem kovalama)
// ─────────────────────────────────────────────────────────────────────────────
// `profitabilityLedger` üreticilerinin verdiği `ProfitEvent[]` üzerinde
// proje / aylık / çeyreklik / yıllık toplama. Planlanan ve gerçekleşen
// bağımsız kolonlar olarak raporlanır (Faz A — birleştirme/dedup Faz B/C).
//
// FX: opts.fxRates (→ TRY) ile TRY'ye çevrilir; oranı olmayan döviz TRY
// başlığına KATILMAZ, yalnız byCurrency ham kırılımında görünür + fxWarnings.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §3

import type { ProfitEvent } from './profitabilityLedger';

export type Grain = 'PROJECT' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface RollupOpts {
  grain: Grain;
  asOf: Date;
  fxRates?: Record<string, number>;   // currency → TRY çarpanı; TRY:1 varsayılan
  reportCurrency?: string;            // yalnız etiket amaçlı (varsayılan 'TRY')
  /** PROJECT grain'de kova etiketi için proje adı sözlüğü. */
  projectNames?: Record<string, string>;
}

export interface CurrencyBreak {
  plannedRevenue: number; plannedCost: number;
  actualRevenue: number; actualCost: number;
}

export interface PeriodRow {
  periodKey: string;
  label: string;
  currency: string;                  // rapor para birimi (TRY)

  plannedRevenue: number; plannedCost: number; plannedMarginPct: number;
  actualRevenue: number; actualCost: number; actualMarginPct: number;

  plannedCashIn: number; plannedCashOut: number; plannedCashNet: number;
  actualCashIn: number; actualCashOut: number; actualCashNet: number;

  eacCost: number; eacMarginPct: number;        // actual (date<=asOf) + plan (date>asOf), ACCRUAL/OUT
  varianceMarginPct: number;                     // plannedMarginPct - actualMarginPct

  eventCount: number;
  byCurrency: Record<string, CurrencyBreak>;
  fxAssumptions: Record<string, number>;
  fxWarnings: string[];
}

const Q = (m: number) => Math.floor(m / 3) + 1;

export function periodKeyOf(date: Date, grain: Grain): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (grain === 'YEAR') return String(y);
  if (grain === 'QUARTER') return `${y}-Q${Q(m)}`;
  if (grain === 'MONTH') return `${y}-${String(m + 1).padStart(2, '0')}`;
  return ''; // PROJECT — anahtar projectId'den gelir
}

function marginPct(revenue: number, cost: number): number {
  if (revenue <= 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Olayları dönem kovalarına toplar. `plan` ve `actual` olayları AYNI listede
 * gelebilir (`buildPlanEvents` + `buildActualEvents` birleşimi) — `source`
 * alanına göre ayrıştırılır.
 */
export function bucketBy(events: ProfitEvent[], opts: RollupOpts): PeriodRow[] {
  const { grain, asOf } = opts;
  const rates: Record<string, number> = { TRY: 1, ...(opts.fxRates || {}) };
  const reportCur = opts.reportCurrency || 'TRY';

  const buckets = new Map<string, ProfitEvent[]>();
  for (const e of events) {
    const key = grain === 'PROJECT' ? (e.projectId || '—') : periodKeyOf(e.date, grain);
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push(e);
  }

  const rows: PeriodRow[] = [];
  for (const [periodKey, evs] of buckets) {
    const byCurrency: Record<string, CurrencyBreak> = {};
    const fxWarnings = new Set<string>();
    const usedRates: Record<string, number> = {};

    let plannedRevenue = 0, plannedCost = 0;
    let actualRevenue = 0, actualCost = 0;
    let plannedCashIn = 0, plannedCashOut = 0;
    let actualCashIn = 0, actualCashOut = 0;
    let eacCost = 0;

    for (const e of evs) {
      const rate = rates[e.currency];
      const cur = (byCurrency[e.currency] ??= { plannedRevenue: 0, plannedCost: 0, actualRevenue: 0, actualCost: 0 });

      // Ham (döviz) kırılım — ACCRUAL üzerinden
      if (e.basis === 'ACCRUAL') {
        if (e.source === 'PLAN' && e.direction === 'IN') cur.plannedRevenue += e.amount;
        if (e.source === 'PLAN' && e.direction === 'OUT') cur.plannedCost += e.amount;
        if (e.source === 'ACTUAL' && e.direction === 'IN') cur.actualRevenue += e.amount;
        if (e.source === 'ACTUAL' && e.direction === 'OUT') cur.actualCost += e.amount;
      }

      if (rate === undefined) { fxWarnings.add(e.currency); continue; }
      usedRates[e.currency] = rate;
      const v = e.amount * rate;

      if (e.basis === 'ACCRUAL') {
        if (e.source === 'PLAN' && e.direction === 'IN') plannedRevenue += v;
        else if (e.source === 'PLAN' && e.direction === 'OUT') plannedCost += v;
        else if (e.source === 'ACTUAL' && e.direction === 'IN') actualRevenue += v;
        else if (e.source === 'ACTUAL' && e.direction === 'OUT') actualCost += v;

        // EAC maliyet: geçmiş (<=asOf) gerçekleşen + gelecek (>asOf) planlanan
        if (e.direction === 'OUT') {
          const past = e.date.getTime() <= asOf.getTime();
          if (e.source === 'ACTUAL' && past) eacCost += v;
          else if (e.source === 'PLAN' && !past) eacCost += v;
        }
      } else { // CASH
        if (e.source === 'PLAN' && e.direction === 'IN') plannedCashIn += v;
        else if (e.source === 'PLAN' && e.direction === 'OUT') plannedCashOut += v;
        else if (e.source === 'ACTUAL' && e.direction === 'IN') actualCashIn += v;
        else if (e.source === 'ACTUAL' && e.direction === 'OUT') actualCashOut += v;
      }
    }

    const label = grain === 'PROJECT'
      ? (opts.projectNames?.[periodKey] || periodKey)
      : periodKey;

    const plannedMarginPct = marginPct(plannedRevenue, plannedCost);
    const actualMarginPct = marginPct(actualRevenue, actualCost);
    // EAC marj paydası: gerçekleşen gelir varsa o, yoksa planlanan gelir
    const eacRevenue = actualRevenue > 0 ? actualRevenue : plannedRevenue;

    rows.push({
      periodKey, label, currency: reportCur,
      plannedRevenue: round2(plannedRevenue), plannedCost: round2(plannedCost), plannedMarginPct: round2(plannedMarginPct),
      actualRevenue: round2(actualRevenue), actualCost: round2(actualCost), actualMarginPct: round2(actualMarginPct),
      plannedCashIn: round2(plannedCashIn), plannedCashOut: round2(plannedCashOut), plannedCashNet: round2(plannedCashIn - plannedCashOut),
      actualCashIn: round2(actualCashIn), actualCashOut: round2(actualCashOut), actualCashNet: round2(actualCashIn - actualCashOut),
      eacCost: round2(eacCost), eacMarginPct: round2(marginPct(eacRevenue, eacCost)),
      varianceMarginPct: round2(plannedMarginPct - actualMarginPct),
      eventCount: evs.length,
      byCurrency: Object.fromEntries(
        Object.entries(byCurrency).map(([k, v]) => [k, {
          plannedRevenue: round2(v.plannedRevenue), plannedCost: round2(v.plannedCost),
          actualRevenue: round2(v.actualRevenue), actualCost: round2(v.actualCost),
        }]),
      ),
      fxAssumptions: usedRates,
      fxWarnings: [...fxWarnings],
    });
  }

  // Sırala: dönem grain'de kronolojik (periodKey lexicographic çalışır), proje grain'de etikete göre
  rows.sort((a, b) => (grain === 'PROJECT' ? a.label.localeCompare(b.label, 'tr') : a.periodKey.localeCompare(b.periodKey)));
  return rows;
}
