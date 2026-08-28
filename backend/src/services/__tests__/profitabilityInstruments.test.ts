import { describe, it, expect } from 'vitest';
import { buildInstrumentScenarios, DEFAULT_INSTRUMENT_PARAMS } from '../profitabilityInstruments';
import type { ProfitEvent } from '../profitabilityLedger';

const ev = (over: Partial<ProfitEvent>): ProfitEvent => ({
  date: new Date('2026-06-01T00:00:00Z'), amount: 0, currency: 'TRY',
  direction: 'IN', basis: 'CASH', source: 'PLAN', category: 'REVENUE',
  projectId: 'p1', opportunityId: 'o1', ref: 'r', confidence: 'FIRM', label: 'x', ...over,
});

const ASOF = new Date('2026-01-01T00:00:00Z');
const RATES = { TRY: 50, USD: 10 };

describe('profitabilityInstruments — buildInstrumentScenarios', () => {
  it('returns the three instrument scenarios sorted by delta desc', () => {
    const r = buildInstrumentScenarios([
      ev({ direction: 'OUT', amount: 100_000, category: 'PROCUREMENT', date: new Date('2026-02-01T00:00:00Z') }),
      ev({ direction: 'IN', amount: 120_000, date: new Date('2026-05-01T00:00:00Z') }),
    ], { asOf: ASOF, fxRates: {} }, RATES);
    expect(r.scenarios.map((s) => s.instrument).sort()).toEqual(['DEPOSIT', 'FACTORING', 'FORWARD_FX']);
    for (let i = 1; i < r.scenarios.length; i++) {
      expect(r.scenarios[i - 1].delta).toBeGreaterThanOrEqual(r.scenarios[i].delta);
    }
  });

  it('FACTORING: pulling a future collection forward eases a financing deficit', () => {
    // Big outflow early → deficit; collection 4 months later. Factoring should net positive
    // when the financing relief outweighs the (tenor-scaled) fee.
    const r = buildInstrumentScenarios([
      ev({ direction: 'OUT', amount: 1_000_000, category: 'PROCUREMENT', date: new Date('2026-02-01T00:00:00Z') }),
      ev({ direction: 'IN', amount: 1_000_000, date: new Date('2026-05-01T00:00:00Z') }),
    ], { asOf: ASOF, fxRates: {} }, { TRY: 50 });
    const f = r.scenarios.find((s) => s.instrument === 'FACTORING')!;
    expect(f.detail.pulledForwardTRY).toBe(1_000_000);
    expect(f.detail.feeTRY).toBeGreaterThan(0);
    expect(typeof f.delta).toBe('number');
  });

  it('DEPOSIT: surplus held past the term earns the rate spread (base rate vs deposit rate)', () => {
    const surplus: ProfitEvent[] = [
      ev({ direction: 'IN', amount: 1_000_000, date: new Date('2026-01-15T00:00:00Z') }),
      ev({ direction: 'OUT', amount: 1, category: 'COST_ITEM', date: new Date('2027-01-10T00:00:00Z') }),
    ];
    // deposit 45% vs base 50% → negative spread → delta ≤ 0
    const neg = buildInstrumentScenarios(surplus, { asOf: ASOF, fxRates: {} }, { TRY: 50 }, { depositRatePct: 45 });
    expect(neg.scenarios.find((s) => s.instrument === 'DEPOSIT')!.delta).toBeLessThanOrEqual(0);
    // deposit 60% vs base 50% → positive spread → delta > 0
    const pos = buildInstrumentScenarios(surplus, { asOf: ASOF, fxRates: {} }, { TRY: 50 }, { depositRatePct: 60 });
    expect(pos.scenarios.find((s) => s.instrument === 'DEPOSIT')!.delta).toBeGreaterThan(0);
  });

  it('FORWARD_FX: carry captured on a future foreign-currency inflow (TRY rate > USD rate → positive)', () => {
    const r = buildInstrumentScenarios([
      ev({ currency: 'USD', direction: 'IN', amount: 10_000, date: new Date('2026-07-01T00:00:00Z') }),
    ], { asOf: ASOF, fxRates: { USD: 40 } }, { TRY: 50, USD: 10 });
    const fx = r.scenarios.find((s) => s.instrument === 'FORWARD_FX')!;
    expect(fx.detail.coveredNotionalTRY).toBe(400_000); // 10k × 40
    expect(fx.delta).toBeGreaterThan(0);                 // (50% - 10%) carry over half a year, positive on an inflow
  });

  it('reports totalOpportunity as the sum of positive deltas only', () => {
    const r = buildInstrumentScenarios([
      ev({ direction: 'OUT', amount: 500_000, category: 'PROCUREMENT', date: new Date('2026-02-01T00:00:00Z') }),
      ev({ direction: 'IN', amount: 500_000, date: new Date('2026-04-01T00:00:00Z') }),
    ], { asOf: ASOF, fxRates: {} }, { TRY: 50 });
    const posSum = r.scenarios.filter((s) => s.delta > 0).reduce((s, x) => s + x.delta, 0);
    expect(r.totalOpportunity).toBeCloseTo(Math.round(posSum * 100) / 100, 2);
  });

  it('exposes default params', () => {
    expect(DEFAULT_INSTRUMENT_PARAMS.factoringHorizonDays).toBe(180);
    expect(DEFAULT_INSTRUMENT_PARAMS.depositTermDays).toBe(30);
  });
});
