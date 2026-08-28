import { describe, it, expect } from 'vitest';
import { asOfKeyOf } from '../profitabilitySnapshot';

describe('profitabilitySnapshot — asOfKeyOf', () => {
  it('formats YYYY-MM in UTC with zero-padded month', () => {
    expect(asOfKeyOf(new Date('2026-08-28T10:00:00Z'))).toBe('2026-08');
    expect(asOfKeyOf(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
    expect(asOfKeyOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('is stable across a whole month (idempotency key)', () => {
    const a = asOfKeyOf(new Date('2026-03-01T00:00:00Z'));
    const b = asOfKeyOf(new Date('2026-03-31T23:00:00Z'));
    expect(a).toBe(b);
  });
});
