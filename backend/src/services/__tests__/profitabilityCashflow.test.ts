import { describe, it, expect } from 'vitest';
import { buildCashflow, buildTreasury, computeTreasury, type CashSeries } from '../profitabilityCashflow';
import type { ProfitEvent } from '../profitabilityLedger';

const ev = (over: Partial<ProfitEvent>): ProfitEvent => ({
  date: new Date('2026-03-01T00:00:00Z'), amount: 0, currency: 'TRY',
  direction: 'IN', basis: 'CASH', source: 'PLAN', category: 'REVENUE',
  projectId: 'p1', opportunityId: 'o1', ref: 'r', confidence: 'FIRM', label: 'x', ...over,
});

const ASOF = new Date('2026-02-01T00:00:00Z');
const DAY = 86_400_000;

describe('profitabilityCashflow — buildCashflow merge policy', () => {
  it('includes all ACTUAL cash events but only PLAN events after asOf', () => {
    const cf = buildCashflow([
      ev({ source: 'ACTUAL', basis: 'CASH', direction: 'IN', amount: 100, date: new Date('2026-01-10T00:00:00Z') }),
      ev({ source: 'PLAN', basis: 'CASH', direction: 'IN', amount: 999, date: new Date('2026-01-15T00:00:00Z') }), // before asOf → dropped
      ev({ source: 'PLAN', basis: 'CASH', direction: 'OUT', amount: 40, date: new Date('2026-03-10T00:00:00Z') }), // after asOf → kept
      ev({ source: 'PLAN', basis: 'ACCRUAL', direction: 'IN', amount: 500, date: new Date('2026-04-01T00:00:00Z') }), // not CASH → dropped
    ], { asOf: ASOF });
    const pts = cf.consolidatedTRY.points;
    expect(pts).toHaveLength(2);
    expect(pts[0].cumulative).toBe(100);
    expect(pts[1].cumulative).toBe(60);
    expect(cf.consolidatedTRY.endingPosition).toBe(60);
  });

  it('tracks the deepest deficit and its date', () => {
    const cf = buildCashflow([
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 100, date: new Date('2026-03-01T00:00:00Z') }),
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 50, date: new Date('2026-03-05T00:00:00Z') }),
      ev({ source: 'ACTUAL', direction: 'IN', amount: 200, date: new Date('2026-03-10T00:00:00Z') }),
    ], { asOf: ASOF });
    expect(cf.consolidatedTRY.maxDeficit).toBe(-150);
    expect(cf.consolidatedTRY.troughDate).toBe(new Date('2026-03-05T00:00:00Z').toISOString());
    expect(cf.consolidatedTRY.endingPosition).toBe(50);
  });

  it('reports contiguous deficit windows per currency', () => {
    const cf = buildCashflow([
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 100, date: new Date('2026-03-01T00:00:00Z') }),
      ev({ source: 'ACTUAL', direction: 'IN', amount: 120, date: new Date('2026-03-10T00:00:00Z') }),   // recovers to +20
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 10, date: new Date('2026-03-20T00:00:00Z') }),   // still positive (+10)
    ], { asOf: ASOF });
    expect(cf.deficitWindows).toHaveLength(1);
    expect(cf.deficitWindows[0]).toMatchObject({
      currency: 'TRY',
      from: new Date('2026-03-01T00:00:00Z').toISOString(),
      to: new Date('2026-03-10T00:00:00Z').toISOString(),
      troughAmount: -100,
    });
  });

  it('converts per-currency events to a TRY consolidated series and flags missing rates', () => {
    const cf = buildCashflow([
      ev({ currency: 'USD', source: 'ACTUAL', direction: 'IN', amount: 1000, date: new Date('2026-03-01T00:00:00Z') }),
      ev({ currency: 'EUR', source: 'ACTUAL', direction: 'OUT', amount: 100, date: new Date('2026-03-02T00:00:00Z') }),
    ], { asOf: ASOF, fxRates: { USD: 40 } });
    expect(cf.consolidatedTRY.points).toHaveLength(1);       // only USD leg converts
    expect(cf.consolidatedTRY.endingPosition).toBe(40_000);
    expect(cf.fxWarnings).toContain('EUR');
    expect(cf.byCurrency.map((s) => s.currency).sort()).toEqual(['EUR', 'USD']);
  });
});

describe('profitabilityCashflow — computeTreasury', () => {
  const series = (points: { date: string; cumulative: number }[]): CashSeries => ({
    currency: 'TRY',
    points: points.map((p) => ({ date: p.date, inflow: 0, outflow: 0, cumulative: p.cumulative, label: 'x', source: 'ACTUAL' as const })),
    maxDeficit: Math.min(0, ...points.map((p) => p.cumulative)),
    troughDate: null,
    endingPosition: points[points.length - 1]?.cumulative ?? 0,
  });

  it('accrues financing cost while the position is negative (step function over time)', () => {
    // −1000 held for exactly 365 days at 50% → cost = 500
    const s = series([
      { date: '2026-01-01T00:00:00Z', cumulative: -1000 },
      { date: '2027-01-01T00:00:00Z', cumulative: 0 },
    ]);
    const r = computeTreasury(s, 50, new Date('2027-01-01T00:00:00Z'));
    expect(r.financingCost).toBeCloseTo(500, 0);
    expect(r.financingBenefit).toBe(0);
    expect(r.treasuryNet).toBeCloseTo(-500, 0);
  });

  it('accrues benefit while the position is positive', () => {
    // +2000 held 365 days at 10% → benefit = 200
    const s = series([
      { date: '2026-01-01T00:00:00Z', cumulative: 2000 },
      { date: '2027-01-01T00:00:00Z', cumulative: 2000 },
    ]);
    const r = computeTreasury(s, 10, new Date('2027-01-01T00:00:00Z'));
    expect(r.financingBenefit).toBeCloseTo(200, 0);
    expect(r.financingCost).toBe(0);
    expect(r.treasuryNet).toBeCloseTo(200, 0);
  });

  it('extends the final segment to the horizon', () => {
    // single point at -1000, horizon 365 days later, 50% → cost 500
    const s = series([{ date: '2026-01-01T00:00:00Z', cumulative: -1000 }]);
    const r = computeTreasury(s, 50, new Date(new Date('2026-01-01T00:00:00Z').getTime() + 365 * DAY));
    expect(r.financingCost).toBeCloseTo(500, 0);
  });
});

describe('profitabilityCashflow — buildTreasury', () => {
  it('produces per-currency lines and a TRY total using tenant interest rates', () => {
    const cf = buildCashflow([
      ev({ currency: 'TRY', source: 'ACTUAL', direction: 'OUT', amount: 1000, date: new Date('2026-01-01T00:00:00Z') }),
      ev({ currency: 'TRY', source: 'ACTUAL', direction: 'IN', amount: 1000, date: new Date('2027-01-01T00:00:00Z') }),
    ], { asOf: new Date('2025-12-01T00:00:00Z') });
    const tr = buildTreasury(cf, { TRY: 50 }, { asOf: new Date('2027-01-01T00:00:00Z') });
    expect(tr.totalTRY.financingCost).toBeCloseTo(500, 0);
    expect(tr.byCurrency).toHaveLength(1);
    expect(tr.byCurrency[0].currency).toBe('TRY');
  });
});
