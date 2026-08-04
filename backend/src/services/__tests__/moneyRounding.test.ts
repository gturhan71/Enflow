import { describe, it, expect } from 'vitest';
import { round2 } from '../moneyRounding';

describe('moneyRounding — round2', () => {
  it('rounds to 2 decimals (kuruş) via the financeEngine minor-unit path', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
  });

  it('cleans up classic float accumulation noise', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('leaves an already-clean 2-decimal value untouched', () => {
    expect(round2(1234.56)).toBe(1234.56);
  });
});
