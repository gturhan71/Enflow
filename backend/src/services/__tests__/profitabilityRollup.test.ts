import { describe, it, expect } from 'vitest';
import { bucketBy, periodKeyOf, type PeriodRow } from '../profitabilityRollup';
import type { ProfitEvent } from '../profitabilityLedger';

const ev = (over: Partial<ProfitEvent>): ProfitEvent => ({
  date: new Date('2026-03-15T00:00:00Z'), amount: 0, currency: 'TRY',
  direction: 'IN', basis: 'ACCRUAL', source: 'PLAN', category: 'REVENUE',
  projectId: 'p1', opportunityId: 'o1', ref: 'r', confidence: 'FIRM', label: 'x', ...over,
});

const ASOF = new Date('2026-04-01T00:00:00Z');

describe('profitabilityRollup — periodKeyOf', () => {
  it('formats month/quarter/year keys in UTC', () => {
    const d = new Date('2026-08-20T00:00:00Z');
    expect(periodKeyOf(d, 'MONTH')).toBe('2026-08');
    expect(periodKeyOf(d, 'QUARTER')).toBe('2026-Q3');
    expect(periodKeyOf(d, 'YEAR')).toBe('2026');
    expect(periodKeyOf(new Date('2026-01-01T00:00:00Z'), 'QUARTER')).toBe('2026-Q1');
    expect(periodKeyOf(new Date('2026-12-31T00:00:00Z'), 'QUARTER')).toBe('2026-Q4');
  });
});

describe('profitabilityRollup — bucketBy margins', () => {
  it('computes planned & actual margin independently per period', () => {
    const rows = bucketBy([
      ev({ source: 'PLAN', direction: 'IN', amount: 100_000 }),
      ev({ source: 'PLAN', direction: 'OUT', amount: 60_000, category: 'PROCUREMENT' }),
      ev({ source: 'ACTUAL', direction: 'IN', amount: 90_000 }),
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 72_000, category: 'PROCUREMENT' }),
    ], { grain: 'MONTH', asOf: ASOF });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.periodKey).toBe('2026-03');
    expect(r.plannedRevenue).toBe(100_000);
    expect(r.plannedMarginPct).toBeCloseTo(40, 5);
    expect(r.actualMarginPct).toBeCloseTo(20, 5);
    expect(r.varianceMarginPct).toBeCloseTo(20, 5);
  });

  it('returns 0 margin (not NaN) when revenue is zero', () => {
    const rows = bucketBy([ev({ source: 'PLAN', direction: 'OUT', amount: 5000, category: 'COST_ITEM' })], { grain: 'MONTH', asOf: ASOF });
    expect(rows[0].plannedMarginPct).toBe(0);
    expect(rows[0].actualMarginPct).toBe(0);
  });
});

describe('profitabilityRollup — CASH vs ACCRUAL separation', () => {
  it('routes CASH events to cash columns and ACCRUAL to margin columns', () => {
    const rows = bucketBy([
      ev({ source: 'ACTUAL', basis: 'ACCRUAL', direction: 'IN', amount: 50_000 }),
      ev({ source: 'ACTUAL', basis: 'CASH', direction: 'IN', amount: 30_000 }),
      ev({ source: 'ACTUAL', basis: 'CASH', direction: 'OUT', amount: 12_000, category: 'PROCUREMENT' }),
      ev({ source: 'PLAN', basis: 'CASH', direction: 'IN', amount: 40_000 }),
    ], { grain: 'MONTH', asOf: ASOF });
    const r = rows[0];
    expect(r.actualRevenue).toBe(50_000);        // ACCRUAL only
    expect(r.actualCashIn).toBe(30_000);
    expect(r.actualCashOut).toBe(12_000);
    expect(r.actualCashNet).toBe(18_000);
    expect(r.plannedCashIn).toBe(40_000);
    expect(r.plannedCashNet).toBe(40_000);
  });
});

describe('profitabilityRollup — EAC cost', () => {
  it('sums actual OUT up to asOf plus plan OUT after asOf', () => {
    const rows = bucketBy([
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 30_000, category: 'PROCUREMENT', date: new Date('2026-03-10T00:00:00Z') }), // past → counts
      ev({ source: 'ACTUAL', direction: 'OUT', amount: 5_000, category: 'PROCUREMENT', date: new Date('2026-05-10T00:00:00Z') }),  // future actual → ignored for EAC
      ev({ source: 'PLAN', direction: 'OUT', amount: 20_000, category: 'PROCUREMENT', date: new Date('2026-03-20T00:00:00Z') }),   // past plan → ignored
      ev({ source: 'PLAN', direction: 'OUT', amount: 25_000, category: 'PROCUREMENT', date: new Date('2026-06-20T00:00:00Z') }),   // future plan → counts
      ev({ source: 'ACTUAL', direction: 'IN', amount: 100_000, date: new Date('2026-03-05T00:00:00Z') }),
    ], { grain: 'YEAR', asOf: ASOF });
    const r = rows[0];
    expect(r.eacCost).toBe(55_000);              // 30k actual + 25k future plan
    expect(r.eacMarginPct).toBeCloseTo(45, 5);   // (100k - 55k)/100k
  });
});

describe('profitabilityRollup — FX', () => {
  it('converts with provided rates and flags currencies without a rate', () => {
    const rows = bucketBy([
      ev({ source: 'PLAN', direction: 'IN', amount: 1000, currency: 'USD' }),
      ev({ source: 'PLAN', direction: 'OUT', amount: 500, currency: 'EUR', category: 'PROCUREMENT' }),
    ], { grain: 'MONTH', asOf: ASOF, fxRates: { USD: 40 } });
    const r = rows[0];
    expect(r.plannedRevenue).toBe(40_000);       // 1000 USD × 40
    expect(r.plannedCost).toBe(0);               // EUR skipped from TRY headline
    expect(r.fxWarnings).toContain('EUR');
    expect(r.byCurrency.EUR.plannedCost).toBe(500); // still visible in raw breakdown
    expect(r.fxAssumptions.USD).toBe(40);
  });
});

describe('profitabilityRollup — PROJECT grain', () => {
  it('buckets by projectId and labels from projectNames', () => {
    const rows = bucketBy([
      ev({ projectId: 'p1', source: 'PLAN', direction: 'IN', amount: 10_000 }),
      ev({ projectId: 'p2', source: 'PLAN', direction: 'IN', amount: 20_000 }),
      ev({ projectId: 'p1', source: 'ACTUAL', direction: 'IN', amount: 8_000 }),
    ], { grain: 'PROJECT', asOf: ASOF, projectNames: { p1: 'Alfa', p2: 'Beta' } });
    expect(rows.map((r) => r.label)).toEqual(['Alfa', 'Beta']);
    const alfa = rows.find((r: PeriodRow) => r.periodKey === 'p1')!;
    expect(alfa.plannedRevenue).toBe(10_000);
    expect(alfa.actualRevenue).toBe(8_000);
  });
});

describe('profitabilityRollup — chronological ordering', () => {
  it('orders period rows by key ascending', () => {
    const rows = bucketBy([
      ev({ date: new Date('2026-06-01T00:00:00Z'), amount: 1 }),
      ev({ date: new Date('2026-01-01T00:00:00Z'), amount: 1 }),
      ev({ date: new Date('2026-03-01T00:00:00Z'), amount: 1 }),
    ], { grain: 'MONTH', asOf: ASOF });
    expect(rows.map((r) => r.periodKey)).toEqual(['2026-01', '2026-03', '2026-06']);
  });
});
