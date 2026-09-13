import { describe, it, expect } from 'vitest';
import { computePenaltyExposure } from '../deliveryPenalty';

const dueDate = new Date('2026-01-01T00:00:00Z');

describe('deliveryPenalty — computePenaltyExposure', () => {
  it('returns null when not yet overdue', () => {
    expect(computePenaltyExposure({
      contractValue: 100_000, dailyRatePct: 0.1, capPct: null, dueDate, asOf: dueDate,
    })).toBeNull();
    expect(computePenaltyExposure({
      contractValue: 100_000, dailyRatePct: 0.1, capPct: null, dueDate, asOf: new Date('2025-12-31T00:00:00Z'),
    })).toBeNull();
  });

  it('returns null when no daily rate is configured', () => {
    expect(computePenaltyExposure({
      contractValue: 100_000, dailyRatePct: null, capPct: null, dueDate, asOf: new Date('2026-02-01T00:00:00Z'),
    })).toBeNull();
    expect(computePenaltyExposure({
      contractValue: 100_000, dailyRatePct: 0, capPct: null, dueDate, asOf: new Date('2026-02-01T00:00:00Z'),
    })).toBeNull();
  });

  it('computes raw penalty = contractValue * (dailyRatePct/100) * overdueDays, uncapped', () => {
    const asOf = new Date('2026-01-11T00:00:00Z'); // 10 gün gecikme
    const result = computePenaltyExposure({ contractValue: 100_000, dailyRatePct: 0.1, capPct: null, dueDate, asOf });
    expect(result).not.toBeNull();
    expect(result!.overdueDays).toBe(10);
    expect(result!.rawPenalty).toBeCloseTo(1_000); // 100000 * 0.001 * 10
    expect(result!.cappedPenalty).toBeCloseTo(result!.rawPenalty);
    expect(result!.isCapped).toBe(false);
  });

  it('caps the penalty at contractValue * capPct/100 and flags isCapped', () => {
    const asOf = new Date('2026-03-01T00:00:00Z'); // ~59 gün gecikme, büyük ceza
    const result = computePenaltyExposure({ contractValue: 100_000, dailyRatePct: 1, capPct: 10, dueDate, asOf });
    expect(result).not.toBeNull();
    expect(result!.rawPenalty).toBeGreaterThan(10_000);
    expect(result!.cappedPenalty).toBeCloseTo(10_000);
    expect(result!.isCapped).toBe(true);
  });
});
