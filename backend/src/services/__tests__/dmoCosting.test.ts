import { describe, it, expect } from 'vitest';
import { effectiveRisturnRate, computeOrderCosting, COST_FX_STALE_DAYS, type DmoCostParams } from '../dmoCosting';

describe('dmoCosting — effectiveRisturnRate', () => {
  const tiers = [
    { thresholdMin: 0, rate: 0 },
    { thresholdMin: 100000, rate: 0.02 },
    { thresholdMin: 500000, rate: 0.05 },
  ];

  it('picks the highest tier whose threshold the turnover has reached', () => {
    expect(effectiveRisturnRate(50000, tiers)).toBe(0);
    expect(effectiveRisturnRate(150000, tiers)).toBe(0.02);
    expect(effectiveRisturnRate(600000, tiers)).toBe(0.05);
  });

  it('is inclusive at the exact threshold boundary', () => {
    expect(effectiveRisturnRate(100000, tiers)).toBe(0.02);
    expect(effectiveRisturnRate(99999.99, tiers)).toBe(0);
  });

  it('does not depend on the caller passing tiers pre-sorted', () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];
    expect(effectiveRisturnRate(150000, shuffled)).toBe(0.02);
  });

  it('ignores tiers with non-finite threshold or rate', () => {
    const dirty = [{ thresholdMin: 0, rate: 0 }, { thresholdMin: NaN, rate: 0.9 }];
    expect(effectiveRisturnRate(1000, dirty)).toBe(0);
  });

  it('returns 0 for an empty tier list', () => {
    expect(effectiveRisturnRate(999999, [])).toBe(0);
  });
});

describe('dmoCosting — computeOrderCosting', () => {
  const baseParams: DmoCostParams = {
    risturnTiers: [{ thresholdMin: 0, rate: 0 }],
    minMarginPct: 0.05,
    defaultCommission: { type: 'PERCENT', value: 0, basis: 'REVENUE' },
    costFxRates: { TRY: 1 },
    costFxRatesUpdatedAt: new Date().toISOString(),
  };

  it('is profitable with no alarms for a simple all-TRY line above the margin threshold', () => {
    const r = computeOrderCosting({
      items: [{ qty: 10, unitPrice: 100, sellCurrency: 'TRY', unitCost: 60, costCurrency: 'TRY' }],
      commission: baseParams.defaultCommission,
      params: baseParams,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.revenueTotal).toBe(1000);
    expect(r.costTotal).toBe(600);
    expect(r.grossProfit).toBe(400);
    expect(r.netProfit).toBe(400);
    expect(r.netMarginPct).toBeCloseTo(0.4, 10);
    expect(r.isProfitable).toBe(true);
    expect(r.alarmReason).toBeNull();
  });

  it('flags a loss with the negative-profit alarm and isProfitable=false', () => {
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 50, sellCurrency: 'TRY', unitCost: 80, costCurrency: 'TRY' }],
      commission: baseParams.defaultCommission,
      params: baseParams,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.netProfit).toBe(-30);
    expect(r.isProfitable).toBe(false);
    expect(r.alarmReason).toContain('Net kâr negatif');
  });

  it('flags below-threshold margin even when still profitable', () => {
    const params = { ...baseParams, minMarginPct: 0.10 };
    const r = computeOrderCosting({
      items: [{ qty: 10, unitPrice: 100, sellCurrency: 'TRY', unitCost: 95, costCurrency: 'TRY' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.netProfit).toBe(50); // profitable...
    expect(r.netMarginPct).toBeCloseTo(0.05, 10);
    expect(r.isProfitable).toBe(false); // ...but below the %10 threshold
    expect(r.alarmReason).toContain('Net marj %5 < eşik %10');
  });

  it('applies the DMO sell-side fx rate and flags a missing rate for a foreign currency', () => {
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 100, sellCurrency: 'USD', unitCost: 50, costCurrency: 'TRY' }],
      commission: baseParams.defaultCommission,
      params: baseParams,
      dmoRates: {}, // no USD rate registered
      periodTurnover: 0,
    });
    // sellFx falls back to 1 when the rate is missing — revenue is NOT silently zeroed
    expect(r.revenueTotal).toBe(100);
    expect(r.dmoRateSnapshot).toBeNull();
    expect(r.rateCurrency).toBe('USD');
    expect(r.alarmReason).toContain('USD için DMO kuru tanımlı değil');
  });

  it('applies a registered DMO rate and flags an expired validTo', () => {
    const past = new Date(Date.now() - 86_400_000);
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 100, sellCurrency: 'USD', unitCost: 50, costCurrency: 'TRY' }],
      commission: baseParams.defaultCommission,
      params: baseParams,
      dmoRates: { USD: { rate: 30, validFrom: past, validTo: past } },
      periodTurnover: 0,
    });
    expect(r.revenueTotal).toBe(3000); // 1 * 100 * 30
    expect(r.dmoRateSnapshot).toBe(30);
    expect(r.alarmReason).toContain('geçerlilik süresi dolmuş');
  });

  it('flags a foreign cost currency whose market rate was never set', () => {
    const params = { ...baseParams, costFxRatesUpdatedAt: null };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 100, sellCurrency: 'TRY', unitCost: 50, costCurrency: 'USD' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.alarmReason).toContain('Piyasa kuru (maliyet) hiç güncellenmemiş');
  });

  it('flags a foreign cost currency whose market rate is stale (> COST_FX_STALE_DAYS)', () => {
    const staleDate = new Date(Date.now() - (COST_FX_STALE_DAYS + 3) * 86_400_000);
    const params = { ...baseParams, costFxRatesUpdatedAt: staleDate.toISOString() };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 100, sellCurrency: 'TRY', unitCost: 50, costCurrency: 'USD' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.alarmReason).toContain('bayat olabilir');
  });

  it('does NOT flag a foreign cost currency whose market rate is fresh', () => {
    const fresh = new Date(Date.now() - 1 * 86_400_000);
    const params = { ...baseParams, costFxRatesUpdatedAt: fresh.toISOString() };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 100, sellCurrency: 'TRY', unitCost: 50, costCurrency: 'USD' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.alarmReason).toBeNull();
  });

  it('risturn deduction uses ONLY this order\'s own revenue, even though the tier lookup uses cumulative turnover', () => {
    // Bu davranış kasıtlı: kademe (tier) seçimi periodTurnover+revenueTotal'a göre yapılır,
    // ama kesinti yalnız BU siparişin cirosuna uygulanır — geçmiş cironun kendisi yeniden kesintiye uğramaz.
    const params: DmoCostParams = {
      ...baseParams,
      risturnTiers: [{ thresholdMin: 0, rate: 0 }, { thresholdMin: 100000, rate: 0.10 }],
    };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 10000, sellCurrency: 'TRY', unitCost: 5000, costCurrency: 'TRY' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 95000, // + 10000 revenue = 105000 → crosses the 100000 tier
    });
    expect(r.risturnRateApplied).toBe(0.10);
    expect(r.risturnDeduction).toBe(1000); // %10 of THIS order's 10000 revenue, not of 105000
  });

  it('commission PERCENT basis=PROFIT is computed on gross profit, not revenue', () => {
    const params: DmoCostParams = {
      ...baseParams,
      defaultCommission: { type: 'PERCENT', value: 10, basis: 'PROFIT' },
    };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 1000, sellCurrency: 'TRY', unitCost: 600, costCurrency: 'TRY' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    // grossProfit = 400 → commission = %10 of 400 = 40 (not %10 of 1000 revenue = 100)
    expect(r.commissionDeduction).toBe(40);
    expect(r.netProfit).toBe(360);
  });

  it('commission FIXED is a flat deduction regardless of revenue/profit', () => {
    const params: DmoCostParams = {
      ...baseParams,
      defaultCommission: { type: 'FIXED', value: 75, basis: 'REVENUE' },
    };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 1000, sellCurrency: 'TRY', unitCost: 600, costCurrency: 'TRY' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.commissionDeduction).toBe(75);
    expect(r.netProfit).toBe(325); // 400 - 75
  });

  it('never lets a negative FIXED commission become a credit (clamped at 0)', () => {
    const params: DmoCostParams = {
      ...baseParams,
      defaultCommission: { type: 'FIXED', value: -50, basis: 'REVENUE' },
    };
    const r = computeOrderCosting({
      items: [{ qty: 1, unitPrice: 1000, sellCurrency: 'TRY', unitCost: 600, costCurrency: 'TRY' }],
      commission: params.defaultCommission,
      params,
      dmoRates: {},
      periodTurnover: 0,
    });
    expect(r.commissionDeduction).toBe(0);
  });

  it('snapshots a single foreign sell currency but marks MIX when more than one is used', () => {
    const r = computeOrderCosting({
      items: [
        { qty: 1, unitPrice: 100, sellCurrency: 'USD', unitCost: 50, costCurrency: 'TRY' },
        { qty: 1, unitPrice: 100, sellCurrency: 'EUR', unitCost: 50, costCurrency: 'TRY' },
      ],
      commission: baseParams.defaultCommission,
      params: baseParams,
      dmoRates: { USD: { rate: 30, validFrom: null, validTo: null }, EUR: { rate: 33, validFrom: null, validTo: null } },
      periodTurnover: 0,
    });
    expect(r.rateCurrency).toBe('MIX');
    expect(r.dmoRateSnapshot).toBeNull();
  });
});
