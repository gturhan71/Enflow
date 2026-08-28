// Enflow — Kârlılık Faz D: Finansal Enstrüman Senaryoları
// ─────────────────────────────────────────────────────────────────────────────
// Baz nakit-akış/hazine durumuna karşı, finansal enstrümanların yaratabileceği
// EK DEĞERİ deterministik senaryo deltaları olarak modeller:
//   · FACTORING        — gelecek tahsilatları iskontoyla öne çekme
//   · DEPOSIT          — nakit fazlasını vadeli mevduatta değerlendirme (spread)
//   · FORWARD_FX       — gelecek döviz akışlarını forward kurla kilitleme (carry)
//
// Rakamlar GÖSTERGE niteliğindedir (kesin fiyatlama değil) — varsayımlar her
// senaryonun `assumptions` alanında şeffaf. Saf; DB'den zaten çekilmiş olay
// listesi üzerinde çalışır. bkz. docs/KARLILIK_ANALIZI_PLAN.md §7 (Faz D)

import type { ProfitEvent } from './profitabilityLedger';
import { buildCashflow, computeTreasury, type CashflowOpts } from './profitabilityCashflow';

const DAY = 86_400_000;
const YEAR_MS = 365 * DAY;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface InstrumentParams {
  factoringAnnualDiscountPct: number; // yıllık faktoring komisyonu (tenor'la ölçeklenir)
  factoringHorizonDays: number;       // yalnız bu kadar gün içindeki tahsilatlar aday
  depositRatePct: number;             // vadeli mevduat yıllık getiri
  depositTermDays: number;            // asgari vade (bu süreden kısa fazla segmentleri sayılmaz)
  forwardHorizonDays: number;         // forward kilidi için ufuk
}

export const DEFAULT_INSTRUMENT_PARAMS: InstrumentParams = {
  factoringAnnualDiscountPct: 35,
  factoringHorizonDays: 180,
  depositRatePct: 45,
  depositTermDays: 30,
  forwardHorizonDays: 365,
};

export interface InstrumentScenario {
  instrument: 'FACTORING' | 'DEPOSIT' | 'FORWARD_FX';
  label: string;
  description: string;
  delta: number;                       // TRY — pozitif = enstrümanın yarattığı ek değer
  detail: Record<string, number>;
  assumptions: Record<string, number>;
  reversible: boolean;
}

export interface InstrumentsResult {
  asOf: string;
  baseline: { treasuryNet: number; maxDeficitTRY: number; endingPositionTRY: number };
  scenarios: InstrumentScenario[];
  totalOpportunity: number;            // Σ pozitif delta (üst sınır — senaryolar birbirini dışlamıyor varsayımı)
}

function toTRY(e: { amount: number; currency: string }, rates: Record<string, number>): number | null {
  const r = rates[e.currency];
  return r === undefined ? null : e.amount * r;
}

/** Nakit serisinin son olayı ile (opts.to ?? asOf) arasından geç olanı — integrasyon ufku. */
function horizonMs(points: { date: string }[], asOf: Date, to?: Date): number {
  const last = points.length ? new Date(points[points.length - 1].date).getTime() : asOf.getTime();
  return Math.max(last, (to ?? asOf).getTime());
}

/** As-of birleştirilmiş CASH olayları (geçmiş=gerçekleşen, gelecek=plan). */
function mergedCashEvents(events: ProfitEvent[], asOf: Date): ProfitEvent[] {
  const t = asOf.getTime();
  return events.filter((e) => e.basis === 'CASH' && !(e.source === 'PLAN' && e.date.getTime() <= t));
}

// ── FACTORING ──────────────────────────────────────────────────────────────

function scenarioFactoring(
  events: ProfitEvent[], opts: CashflowOpts, interestRates: Record<string, number>, p: InstrumentParams,
): InstrumentScenario {
  const rates = { TRY: 1, ...(opts.fxRates || {}) };
  const asOf = opts.asOf;
  const horizon = asOf.getTime() + p.factoringHorizonDays * DAY;

  const base = buildCashflow(events, opts);
  const baseTre = computeTreasury(base.consolidatedTRY, interestRates.TRY ?? 0,
    new Date(horizonMs(base.consolidatedTRY.points, asOf, opts.to)));

  // Gelecek tahsilatları asOf'a çek + tenor-ölçekli komisyon
  let fee = 0;
  let pulledTRY = 0;
  const shifted = events.map((e) => {
    if (e.basis === 'CASH' && e.direction === 'IN' && e.source !== 'ACTUAL') {
      const et = e.date.getTime();
      if (et > asOf.getTime() && et <= horizon) {
        const daysEarly = (et - asOf.getTime()) / DAY;
        const tv = toTRY(e, rates);
        if (tv !== null) { fee += tv * (p.factoringAnnualDiscountPct / 100) * (daysEarly / 365); pulledTRY += tv; }
        return { ...e, date: new Date(asOf.getTime()) };
      }
    }
    return e;
  });

  const scen = buildCashflow(shifted, opts);
  const scenTre = computeTreasury(scen.consolidatedTRY, interestRates.TRY ?? 0,
    new Date(horizonMs(scen.consolidatedTRY.points, asOf, opts.to)));

  const financingImprovement = scenTre.treasuryNet - baseTre.treasuryNet;
  const delta = round2(financingImprovement - fee);

  return {
    instrument: 'FACTORING',
    label: 'Faktoring / erken tahsilat',
    description: `${p.factoringHorizonDays} gün içindeki planlı tahsilatları bugüne çekmek: finansman rahatlaması ${round2(financingImprovement)} TRY − komisyon ${round2(fee)} TRY.`,
    delta,
    detail: { pulledForwardTRY: round2(pulledTRY), financingImprovementTRY: round2(financingImprovement), feeTRY: round2(fee) },
    assumptions: { factoringAnnualDiscountPct: p.factoringAnnualDiscountPct, factoringHorizonDays: p.factoringHorizonDays },
    reversible: true,
  };
}

// ── DEPOSIT (nakit fazlası → vadeli mevduat spread'i) ───────────────────────

function scenarioDeposit(
  events: ProfitEvent[], opts: CashflowOpts, interestRates: Record<string, number>, p: InstrumentParams,
): InstrumentScenario {
  const cf = buildCashflow(events, opts);
  const baseRate = interestRates.TRY ?? 0;
  const spread = (p.depositRatePct - baseRate) / 100;
  const pts = cf.consolidatedTRY.points;
  const horizonT = horizonMs(pts, opts.asOf, opts.to);

  let extraYield = 0;
  let placeableAvg = 0, spanSum = 0;
  for (let i = 0; i < pts.length; i++) {
    const startT = new Date(pts[i].date).getTime();
    const endT = i + 1 < pts.length ? new Date(pts[i + 1].date).getTime() : horizonT;
    const span = Math.max(0, endT - startT);
    if (span < p.depositTermDays * DAY) continue;       // vade tutmayan fazla segmenti bağlanamaz
    const pos = pts[i].cumulative;
    if (pos <= 0) continue;
    const years = span / YEAR_MS;
    extraYield += pos * spread * years;
    placeableAvg += pos * span; spanSum += span;
  }

  return {
    instrument: 'DEPOSIT',
    label: 'Vadeli mevduat (fazla değerlendirme)',
    description: `Vade tutan nakit fazlasını %${p.depositRatePct} mevduatta değerlendirmek — baz faiz %${baseRate} üzerine +%${round2(p.depositRatePct - baseRate)} spread.`,
    delta: round2(extraYield),
    detail: { extraYieldTRY: round2(extraYield), avgPlaceableTRY: round2(spanSum ? placeableAvg / spanSum : 0), spreadPct: round2(p.depositRatePct - baseRate) },
    assumptions: { depositRatePct: p.depositRatePct, depositTermDays: p.depositTermDays, baseRatePct: baseRate },
    reversible: true,
  };
}

// ── FORWARD FX (gelecek döviz akışlarını kilitleme — carry) ─────────────────

function scenarioForwardFx(
  events: ProfitEvent[], opts: CashflowOpts, interestRates: Record<string, number>, p: InstrumentParams,
): InstrumentScenario {
  const rates: Record<string, number> = { TRY: 1, ...(opts.fxRates || {}) };
  const asOf = opts.asOf;
  const horizon = asOf.getTime() + p.forwardHorizonDays * DAY;
  const rTRY = interestRates.TRY ?? 0;

  let carry = 0;
  let coveredTRY = 0;
  const missing = new Set<string>();
  for (const e of mergedCashEvents(events, asOf)) {
    if (e.currency === 'TRY') continue;
    const et = e.date.getTime();
    if (et <= asOf.getTime() || et > horizon) continue;
    const spot = rates[e.currency];
    if (spot === undefined) { missing.add(e.currency); continue; }
    const rFor = interestRates[e.currency] ?? 0;
    const years = (et - asOf.getTime()) / YEAR_MS;
    const forward = spot * (1 + ((rTRY - rFor) / 100) * years);   // kapsanmış faiz paritesi (basit)
    const sign = e.direction === 'IN' ? 1 : -1;
    carry += sign * e.amount * (forward - spot);
    coveredTRY += e.amount * spot;
  }

  return {
    instrument: 'FORWARD_FX',
    label: 'Forward kur kilidi',
    description: `${p.forwardHorizonDays} gün içindeki döviz akışlarını forward kurla kilitlemek: belirsizlik kalkar, taşıma (carry) farkı yakalanır/ödenir.`,
    delta: round2(carry),
    detail: { carryTRY: round2(carry), coveredNotionalTRY: round2(coveredTRY), missingRates: missing.size },
    assumptions: { forwardHorizonDays: p.forwardHorizonDays },
    reversible: true,
  };
}

export function buildInstrumentScenarios(
  events: ProfitEvent[], opts: CashflowOpts, interestRates: Record<string, number>,
  params: Partial<InstrumentParams> = {},
): InstrumentsResult {
  const p: InstrumentParams = { ...DEFAULT_INSTRUMENT_PARAMS, ...params };
  const cf = buildCashflow(events, opts);
  const baseTre = computeTreasury(cf.consolidatedTRY, interestRates.TRY ?? 0,
    new Date(horizonMs(cf.consolidatedTRY.points, opts.asOf, opts.to)));

  const scenarios = [
    scenarioFactoring(events, opts, interestRates, p),
    scenarioDeposit(events, opts, interestRates, p),
    scenarioForwardFx(events, opts, interestRates, p),
  ].sort((a, b) => b.delta - a.delta);

  return {
    asOf: opts.asOf.toISOString(),
    baseline: {
      treasuryNet: baseTre.treasuryNet,
      maxDeficitTRY: cf.consolidatedTRY.maxDeficit,
      endingPositionTRY: cf.consolidatedTRY.endingPosition,
    },
    scenarios,
    totalOpportunity: round2(scenarios.filter((s) => s.delta > 0).reduce((s, x) => s + x.delta, 0)),
  };
}
