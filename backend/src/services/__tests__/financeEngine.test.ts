import { describe, it, expect } from 'vitest';
import {
  toMinor, fromMinor, roundMinor, applyVat, lineBreakdown, sumByCurrency,
  convertMinor, presentBreakdown, computeFxGainLoss, computeCompanyOverhead,
  computeUnitParticipationLoad, projectMargins,
} from '../financeEngine';

describe('financeEngine — toMinor/fromMinor/roundMinor', () => {
  it('converts main unit to minor (kuruş) and back', () => {
    expect(toMinor(10.5)).toBe(1050);
    expect(fromMinor(1050)).toBe(10.5);
  });

  it('rounds float remainder instead of truncating', () => {
    expect(toMinor(10.005)).toBe(1001); // 1000.5 → round → 1001 (banker's-neutral half-up via Math.round)
    expect(toMinor(0.1 + 0.2)).toBe(30); // classic float noise (0.30000000000000004) must not leak
  });

  it('treats NaN/undefined-ish input as 0', () => {
    expect(toMinor(Number('not-a-number'))).toBe(0);
  });

  it('roundMinor is a stable half-up rounder', () => {
    expect(roundMinor(100.4)).toBe(100);
    expect(roundMinor(100.5)).toBe(101);
  });
});

describe('financeEngine — applyVat', () => {
  it('computes vat and gross from a net minor amount', () => {
    const r = applyVat(10000, 0.20); // 100.00 TL net, %20 KDV
    expect(r).toEqual({ netMinor: 10000, vatMinor: 2000, grossMinor: 12000 });
  });

  it('defaults vatRate to 0 when omitted', () => {
    const r = applyVat(5000);
    expect(r).toEqual({ netMinor: 5000, vatMinor: 0, grossMinor: 5000 });
  });
});

describe('financeEngine — lineBreakdown', () => {
  it('computes net/vat/gross for a simple line (qty × unitPrice)', () => {
    const b = lineBreakdown({ qty: 3, unitPrice: 100, vatRate: 0.20 });
    expect(b).toEqual({ netMinor: 30000, vatMinor: 6000, grossMinor: 36000, currency: 'TRY' });
  });

  it('applies line discount before vat', () => {
    const b = lineBreakdown({ qty: 1, unitPrice: 1000, discountPct: 10, vatRate: 0.20 });
    // 1000 - %10 = 900 net; %20 KDV = 180; brüt 1080
    expect(b).toEqual({ netMinor: 90000, vatMinor: 18000, grossMinor: 108000, currency: 'TRY' });
  });

  it('clamps discount at 100% (never negative net)', () => {
    const b = lineBreakdown({ qty: 1, unitPrice: 500, discountPct: 150 });
    expect(b.netMinor).toBe(0);
  });

  it('defaults currency to TRY when omitted', () => {
    const b = lineBreakdown({ qty: 1, unitPrice: 10 });
    expect(b.currency).toBe('TRY');
  });

  it('respects an explicit foreign currency', () => {
    const b = lineBreakdown({ qty: 2, unitPrice: 50, currency: 'USD' });
    expect(b.currency).toBe('USD');
    expect(b.netMinor).toBe(10000);
  });
});

describe('financeEngine — sumByCurrency (mixed-currency safety)', () => {
  it('never silently combines different currencies into one total', () => {
    const out = sumByCurrency([
      { qty: 1, unitPrice: 100, currency: 'TRY', vatRate: 0.20 },
      { qty: 1, unitPrice: 50, currency: 'USD', vatRate: 0 },
      { qty: 2, unitPrice: 100, currency: 'TRY', vatRate: 0.20 },
    ]);
    expect(Object.keys(out).sort()).toEqual(['TRY', 'USD']);
    expect(out.TRY.netMinor).toBe(30000); // (100 + 200) * 100
    expect(out.TRY.vatMinor).toBe(6000);
    expect(out.USD.netMinor).toBe(5000);
    expect(out.USD.vatMinor).toBe(0);
  });

  it('returns an empty object for an empty line list', () => {
    expect(sumByCurrency([])).toEqual({});
  });
});

describe('financeEngine — convertMinor / presentBreakdown', () => {
  it('applies an explicit fx rate (never implicit)', () => {
    expect(convertMinor(10000, 30)).toBe(300000); // 100 TL-denominated minor units × 30
  });

  it('defaults fx rate to 1 when falsy', () => {
    expect(convertMinor(10000, 0)).toBe(10000);
  });

  it('presents a breakdown back in main-unit form', () => {
    const p = presentBreakdown({ netMinor: 10050, vatMinor: 2010, grossMinor: 12060, currency: 'TRY' });
    expect(p).toEqual({ net: 100.5, vat: 20.1, gross: 120.6, currency: 'TRY' });
  });
});

describe('financeEngine — computeFxGainLoss (B-18)', () => {
  it('is positive when the payment-day rate is higher than issue rate (fx gain)', () => {
    // 1000 USD, kesim kuru 30, tahsilat kuru 32 → kazanç = 1000 * (32-30) = 2000 TL
    expect(computeFxGainLoss(1000, 30, 32)).toBe(2000);
  });

  it('is negative when the payment-day rate is lower than issue rate (fx loss)', () => {
    expect(computeFxGainLoss(1000, 32, 30)).toBe(-2000);
  });

  it('is zero when rates are identical', () => {
    expect(computeFxGainLoss(500, 30, 30)).toBe(0);
  });
});

describe('financeEngine — computeCompanyOverhead (Katman 1)', () => {
  it('PCT_OF_VALUE / PCT_OF_DIRECT_COST: rate is a percentage (e.g. 8 = %8)', () => {
    expect(computeCompanyOverhead(100000, 'PCT_OF_VALUE', 8)).toBe(8000);
    expect(computeCompanyOverhead(50000, 'PCT_OF_DIRECT_COST', 10)).toBe(5000);
  });

  it('POOL_RATE: rate is already a decimal ratio (e.g. 0.12)', () => {
    expect(computeCompanyOverhead(100000, 'POOL_RATE', 0.12)).toBe(12000);
  });

  it('treats a falsy base/rate as 0 overhead', () => {
    expect(computeCompanyOverhead(0, 'PCT_OF_VALUE', 8)).toBe(0);
    expect(computeCompanyOverhead(100000, 'PCT_OF_VALUE', 0)).toBe(0);
  });
});

describe('financeEngine — computeUnitParticipationLoad (Katman 2)', () => {
  it('applies each unit coefficient to its period cost and sums the total', () => {
    const r = computeUnitParticipationLoad(
      [{ unitId: 'u1', coefficient: 0.5 }, { unitId: 'u2', coefficient: 0.25 }],
      { u1: 10000, u2: 8000 },
    );
    expect(r.breakdown).toEqual([
      { unitId: 'u1', coefficient: 0.5, periodCost: 10000, amount: 5000 },
      { unitId: 'u2', coefficient: 0.25, periodCost: 8000, amount: 2000 },
    ]);
    expect(r.total).toBe(7000);
  });

  it('clamps out-of-range coefficients into [0,1]', () => {
    const r = computeUnitParticipationLoad([{ unitId: 'u1', coefficient: 1.5 }], { u1: 1000 });
    expect(r.breakdown[0].coefficient).toBe(1);
    const r2 = computeUnitParticipationLoad([{ unitId: 'u1', coefficient: -0.5 }], { u1: 1000 });
    expect(r2.breakdown[0].coefficient).toBe(0);
  });

  it('treats a unit missing from unitPeriodCosts as 0 cost', () => {
    const r = computeUnitParticipationLoad([{ unitId: 'ghost', coefficient: 1 }], {});
    expect(r.breakdown[0]).toEqual({ unitId: 'ghost', coefficient: 1, periodCost: 0, amount: 0 });
    expect(r.total).toBe(0);
  });
});

describe('financeEngine — projectMargins', () => {
  it('computes contribution margin (direct only) and net margin (with overhead)', () => {
    const m = projectMargins(100000, 60000, 10000);
    expect(m.contributionMargin).toBeCloseTo(0.4, 10);   // (100000-60000)/100000
    expect(m.netMargin).toBeCloseTo(0.3, 10);             // (100000-60000-10000)/100000
  });

  it('returns zero margins when value is 0 or negative (no division by zero)', () => {
    expect(projectMargins(0, 1000, 100)).toEqual({ contributionMargin: 0, netMargin: 0 });
    expect(projectMargins(-500, 1000, 100)).toEqual({ contributionMargin: 0, netMargin: 0 });
  });

  it('net margin can go negative when overhead exceeds contribution', () => {
    const m = projectMargins(10000, 9000, 5000);
    expect(m.netMargin).toBeLessThan(0);
  });
});
