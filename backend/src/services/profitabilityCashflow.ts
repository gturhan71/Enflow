// Enflow — Kârlılık: Nakit Pozisyonu & Hazine Etkisi (Faz B)
// ─────────────────────────────────────────────────────────────────────────────
// `profitabilityLedger` CASH olaylarından konsolide nakit pozisyonu serisi +
// nakit açığı/fazlası üzerinden faiz maliyeti/getirisi (hazine katkısı — Faz 1).
//
// Birleştirme kuralı (as-of projeksiyonu): geçmiş = gerçekleşen, gelecek = plan.
//   ACTUAL olay → her zaman dahil
//   PLAN olay   → yalnız date > asOf ise dahil (gerçekleşen onu geçersiz kılar)
//
// Saf ve yan etkisiz. bkz. docs/KARLILIK_ANALIZI_PLAN.md §3 · §7 (Faz B)

import type { ProfitEvent } from './profitabilityLedger';

const DAY = 86_400_000;
const YEAR_MS = 365 * DAY;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CashPoint {
  date: string;
  inflow: number;
  outflow: number;
  cumulative: number;
  label: string;
  source: 'PLAN' | 'ACTUAL';
}

export interface CashSeries {
  currency: string;               // döviz kodu veya 'TRY' (konsolide)
  points: CashPoint[];
  maxDeficit: number;             // en düşük kümülatif (≤ 0); açık yoksa 0
  troughDate: string | null;
  endingPosition: number;
}

export interface DeficitWindow {
  currency: string;
  from: string;
  to: string;
  troughDate: string;
  troughAmount: number;
}

export interface CashflowResult {
  asOf: string;
  fxRates: Record<string, number>;
  byCurrency: CashSeries[];
  consolidatedTRY: CashSeries;
  deficitWindows: DeficitWindow[];
  fxWarnings: string[];
}

export interface CashflowOpts {
  asOf: Date;
  from?: Date;
  to?: Date;
  fxRates?: Record<string, number>;
}

interface FlatEvent { t: number; date: string; amount: number; currency: string; direction: 'IN' | 'OUT'; source: 'PLAN' | 'ACTUAL'; label: string }

/** CASH olayları as-of birleştirme + aralık filtresi ile düz listeye indirger. */
function flattenCashEvents(events: ProfitEvent[], opts: CashflowOpts): FlatEvent[] {
  const asOf = opts.asOf.getTime();
  const out: FlatEvent[] = [];
  for (const e of events) {
    if (e.basis !== 'CASH') continue;
    const t = e.date.getTime();
    if (Number.isNaN(t)) continue;
    if (e.source === 'PLAN' && t <= asOf) continue;         // gerçekleşen geçersiz kılar
    if (opts.from && t < opts.from.getTime()) continue;
    if (opts.to && t > opts.to.getTime()) continue;
    out.push({ t, date: e.date.toISOString(), amount: e.amount, currency: e.currency, direction: e.direction, source: e.source, label: e.label });
  }
  return out.sort((a, b) => a.t - b.t);
}

function buildSeries(currency: string, flats: FlatEvent[]): CashSeries {
  let cum = 0;
  let maxDeficit = 0;
  let troughDate: string | null = null;
  const points: CashPoint[] = flats.map((f) => {
    const inflow = f.direction === 'IN' ? f.amount : 0;
    const outflow = f.direction === 'OUT' ? f.amount : 0;
    cum += inflow - outflow;
    if (cum < maxDeficit) { maxDeficit = cum; troughDate = f.date; }
    return { date: f.date, inflow: round2(inflow), outflow: round2(outflow), cumulative: round2(cum), label: f.label, source: f.source };
  });
  return { currency, points, maxDeficit: round2(maxDeficit), troughDate, endingPosition: round2(cum) };
}

function deficitWindowsOf(series: CashSeries): DeficitWindow[] {
  const wins: DeficitWindow[] = [];
  let open: { from: string; troughDate: string; troughAmount: number } | null = null;
  for (const p of series.points) {
    if (p.cumulative < 0) {
      if (!open) open = { from: p.date, troughDate: p.date, troughAmount: p.cumulative };
      else if (p.cumulative < open.troughAmount) { open.troughDate = p.date; open.troughAmount = p.cumulative; }
    } else if (open) {
      wins.push({ currency: series.currency, from: open.from, to: p.date, troughDate: open.troughDate, troughAmount: round2(open.troughAmount) });
      open = null;
    }
  }
  if (open) {
    const last = series.points[series.points.length - 1];
    wins.push({ currency: series.currency, from: open.from, to: last.date, troughDate: open.troughDate, troughAmount: round2(open.troughAmount) });
  }
  return wins;
}

export function buildCashflow(events: ProfitEvent[], opts: CashflowOpts): CashflowResult {
  const rates: Record<string, number> = { TRY: 1, ...(opts.fxRates || {}) };
  const flats = flattenCashEvents(events, opts);

  const currencies = [...new Set(flats.map((f) => f.currency))];
  const byCurrency = currencies.map((c) => buildSeries(c, flats.filter((f) => f.currency === c)));

  // Konsolide TRY: her olayı kuruyla çevir, tarih sırasıyla kümülatif
  const fxWarnings = new Set<string>();
  const tryFlats: FlatEvent[] = [];
  for (const f of flats) {
    const r = rates[f.currency];
    if (r === undefined) { fxWarnings.add(f.currency); continue; }
    tryFlats.push({ ...f, amount: f.amount * r, currency: 'TRY' });
  }
  const consolidatedTRY = buildSeries('TRY', tryFlats);

  const deficitWindows = [
    ...byCurrency.flatMap(deficitWindowsOf),
  ];

  return {
    asOf: opts.asOf.toISOString(),
    fxRates: rates,
    byCurrency,
    consolidatedTRY,
    deficitWindows,
    fxWarnings: [...fxWarnings],
  };
}

// ── Hazine etkisi (Faz 1: faiz — nakit açığı/fazlası) ───────────────────────

export interface TreasuryLine {
  currency: string;
  ratePct: number;                // yıllık faiz %
  financingCost: number;          // açık finansmanı maliyeti (kalemin dövizinde)
  financingBenefit: number;       // fazla değerlendirme getirisi
  treasuryNet: number;            // benefit − cost
  timeWeightedDeficit: number;    // ortalama açık (bilgi)
  timeWeightedSurplus: number;    // ortalama fazla (bilgi)
}

export interface TreasuryResult {
  asOf: string;
  horizon: string;                // integrasyon ufku (son olay veya asOf/to)
  byCurrency: TreasuryLine[];
  totalTRY: TreasuryLine;
  interestRates: Record<string, number>;
  fxRates: Record<string, number>;
  fxWarnings: string[];
}

/**
 * Nakit pozisyonu eğrisini zaman üzerinde integre eder (adım fonksiyonu — pozisyon
 * bir sonraki olaya kadar sabit): açık segmentlerinde faiz maliyeti, fazla
 * segmentlerinde getiri birikir. Son segment `horizon`'a kadar uzatılır.
 */
export function computeTreasury(
  series: CashSeries, ratePct: number, horizon: Date,
): Omit<TreasuryLine, 'currency'> {
  let cost = 0, benefit = 0, twDeficit = 0, twSurplus = 0, totalSpan = 0;
  const pts = series.points;
  for (let i = 0; i < pts.length; i++) {
    const startT = new Date(pts[i].date).getTime();
    const endT = i + 1 < pts.length ? new Date(pts[i + 1].date).getTime() : horizon.getTime();
    const span = Math.max(0, endT - startT);
    if (span === 0) continue;
    const years = span / YEAR_MS;
    const pos = pts[i].cumulative;
    totalSpan += span;
    if (pos < 0) { cost += -pos * (ratePct / 100) * years; twDeficit += -pos * span; }
    else if (pos > 0) { benefit += pos * (ratePct / 100) * years; twSurplus += pos * span; }
  }
  return {
    ratePct,
    financingCost: round2(cost),
    financingBenefit: round2(benefit),
    treasuryNet: round2(benefit - cost),
    timeWeightedDeficit: round2(totalSpan ? twDeficit / totalSpan : 0),
    timeWeightedSurplus: round2(totalSpan ? twSurplus / totalSpan : 0),
  };
}

export function buildTreasury(
  cashflow: CashflowResult, interestRates: Record<string, number>, opts: CashflowOpts,
): TreasuryResult {
  const horizonBase = opts.to ?? opts.asOf;
  const byCurrency: TreasuryLine[] = cashflow.byCurrency.map((s) => {
    const lastT = s.points.length ? new Date(s.points[s.points.length - 1].date).getTime() : horizonBase.getTime();
    const horizon = new Date(Math.max(lastT, horizonBase.getTime()));
    const rate = interestRates[s.currency] ?? interestRates.TRY ?? 0;
    return { currency: s.currency, ...computeTreasury(s, rate, horizon) };
  });

  // TRY toplam: konsolide seriyi TRY faiziyle
  const lastTryT = cashflow.consolidatedTRY.points.length
    ? new Date(cashflow.consolidatedTRY.points[cashflow.consolidatedTRY.points.length - 1].date).getTime()
    : horizonBase.getTime();
  const tryHorizon = new Date(Math.max(lastTryT, horizonBase.getTime()));
  const totalTRY: TreasuryLine = {
    currency: 'TRY',
    ...computeTreasury(cashflow.consolidatedTRY, interestRates.TRY ?? 0, tryHorizon),
  };

  return {
    asOf: cashflow.asOf,
    horizon: tryHorizon.toISOString(),
    byCurrency,
    totalTRY,
    interestRates,
    fxRates: cashflow.fxRates,
    fxWarnings: cashflow.fxWarnings,
  };
}
