import { describe, it, expect } from 'vitest';
import { buildBomEvaluationSnapshot, sumBomTotalsByCurrency, type BomQuoteInput } from '../bomHandoff';

const quote = (over: Partial<BomQuoteInput>): BomQuoteInput => ({
  lineKey: 'L1', componentName: null, vendorName: 'Vendor A', unitPrice: 100, currency: 'TRY',
  technicalCompliance: 'COMPLIANT', specSummary: null, fileName: null, fileUrl: null, isSelected: false,
  ...over,
});

describe('bomHandoff — buildBomEvaluationSnapshot', () => {
  it('returns null when there are no quotes (no evaluation to snapshot)', () => {
    expect(buildBomEvaluationSnapshot([])).toBeNull();
  });

  it('groups quotes by lineKey and counts total quotes', () => {
    const snap = buildBomEvaluationSnapshot([
      quote({ lineKey: 'L1', vendorName: 'A' }),
      quote({ lineKey: 'L1', vendorName: 'B' }),
      quote({ lineKey: 'L2', vendorName: 'C' }),
    ]);
    expect(snap).not.toBeNull();
    expect(snap!.totalQuotes).toBe(3);
    expect(snap!.lines).toHaveLength(2);
    expect(snap!.lines.find((l) => l.lineKey === 'L1')!.quoteCount).toBe(2);
  });

  it('puts the isSelected quote in `selected` and the rest in `alternatives`', () => {
    const snap = buildBomEvaluationSnapshot([
      quote({ lineKey: 'L1', vendorName: 'Winner', isSelected: true, unitPrice: 90 }),
      quote({ lineKey: 'L1', vendorName: 'Loser1', isSelected: false, unitPrice: 100 }),
      quote({ lineKey: 'L1', vendorName: 'Loser2', isSelected: false, unitPrice: 110 }),
    ]);
    const line = snap!.lines[0];
    expect(line.selected?.vendorName).toBe('Winner');
    expect(line.alternatives.map((a) => a.vendorName).sort()).toEqual(['Loser1', 'Loser2']);
  });

  it('has a null `selected` when no quote in the line was marked isSelected', () => {
    const snap = buildBomEvaluationSnapshot([quote({ lineKey: 'L1', isSelected: false })]);
    expect(snap!.lines[0].selected).toBeNull();
    expect(snap!.lines[0].alternatives).toHaveLength(1);
  });

  it('takes componentName from the first quote in the line', () => {
    const snap = buildBomEvaluationSnapshot([
      quote({ lineKey: 'L1', componentName: 'Sunucu' }),
      quote({ lineKey: 'L1', componentName: null }),
    ]);
    expect(snap!.lines[0].componentName).toBe('Sunucu');
  });

  it('uses the injected `now` for evaluatedAt (deterministic)', () => {
    const now = new Date('2026-08-04T00:00:00Z');
    const snap = buildBomEvaluationSnapshot([quote({})], now);
    expect(snap!.evaluatedAt).toBe(now.toISOString());
  });
});

describe('bomHandoff — sumBomTotalsByCurrency', () => {
  it('sums purchaseCost × quantity grouped by currency', () => {
    const totals = sumBomTotalsByCurrency([
      { currency: 'TRY', purchaseCost: 100, quantity: 2 },
      { currency: 'TRY', purchaseCost: 50, quantity: 1 },
      { currency: 'USD', purchaseCost: 10, quantity: 5 },
    ]);
    expect(totals).toEqual({ TRY: 250, USD: 50 });
  });

  it('defaults missing currency to TRY', () => {
    const totals = sumBomTotalsByCurrency([{ currency: null, purchaseCost: 100, quantity: 1 }]);
    expect(totals).toEqual({ TRY: 100 });
  });

  it('treats null purchaseCost/quantity as 0 (no NaN leakage)', () => {
    const totals = sumBomTotalsByCurrency([{ currency: 'TRY', purchaseCost: null, quantity: null }]);
    expect(totals).toEqual({ TRY: 0 });
  });

  it('returns an empty object for an empty item list', () => {
    expect(sumBomTotalsByCurrency([])).toEqual({});
  });
});
