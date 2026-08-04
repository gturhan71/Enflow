import { describe, it, expect } from 'vitest';
import { median } from '../analyticsService';

describe('analyticsService — median (bid-scorecard "typical won value")', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for an odd-length list', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('averages the two middle values for an even-length list', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('does not mutate the input array (sorts a copy)', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it('handles a single-element list', () => {
    expect(median([42])).toBe(42);
  });
});
