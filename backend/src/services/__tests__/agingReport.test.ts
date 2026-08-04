import { describe, it, expect } from 'vitest';
import { computeAging } from '../agingReport';

const DAY = 86_400_000;
const NOW = new Date('2026-08-04T12:00:00Z').getTime();

const inv = (over: Partial<{ status: string; amount: number; paidAmount: number; dueDate: Date | null; currency: string; issueDate: Date | null; createdAt: Date }>) => ({
  status: 'ISSUED', amount: 0, paidAmount: 0, dueDate: null, currency: 'TRY',
  issueDate: null, createdAt: new Date(NOW), ...over,
});

describe('agingReport — computeAging (buckets)', () => {
  it('excludes DRAFT, CANCELLED, PAID, and fully-collected invoices from open receivables', () => {
    const r = computeAging([
      inv({ amount: 100, status: 'DRAFT' }),
      inv({ amount: 100, status: 'CANCELLED' }),
      inv({ amount: 100, paidAmount: 100, status: 'PAID' }),
      inv({ amount: 100, paidAmount: 100, status: 'ISSUED' }), // fully paid but status not updated — still excluded (amount-paid<=0)
    ], NOW);
    expect(r.totalReceivable).toBe(0);
  });

  it('buckets an invoice with no due date as notDue', () => {
    const r = computeAging([inv({ amount: 500, dueDate: null })], NOW);
    expect(r.buckets.notDue).toBe(500);
    expect(r.totalReceivable).toBe(500);
  });

  it('buckets by days-past-due at the correct boundaries', () => {
    const dueAt = (daysAgo: number) => new Date(NOW - daysAgo * DAY);
    const r = computeAging([
      inv({ amount: 10, dueDate: dueAt(-5) }),   // not due yet (future)
      inv({ amount: 20, dueDate: dueAt(15) }),   // d0_30
      inv({ amount: 30, dueDate: dueAt(45) }),   // d31_60
      inv({ amount: 40, dueDate: dueAt(75) }),   // d61_90
      inv({ amount: 50, dueDate: dueAt(120) }),  // d90plus
    ], NOW);
    expect(r.buckets).toEqual({ notDue: 10, d0_30: 20, d31_60: 30, d61_90: 40, d90plus: 50 });
    expect(r.totalReceivable).toBe(150);
  });

  it('splits totals by currency independently', () => {
    const r = computeAging([
      inv({ amount: 100, currency: 'TRY' }),
      inv({ amount: 50, currency: 'USD' }),
    ], NOW);
    expect(r.byCurrency.TRY.totalReceivable).toBe(100);
    expect(r.byCurrency.USD.totalReceivable).toBe(50);
    expect(r.totalReceivable).toBe(150); // cross-currency sum is informational, not converted
  });

  it('only counts the unpaid remainder, not the full invoice amount', () => {
    const r = computeAging([inv({ amount: 1000, paidAmount: 400 })], NOW);
    expect(r.totalReceivable).toBe(600);
  });
});

describe('agingReport — computeAging (DSO)', () => {
  it('is 0 when there is no sales volume in the trailing 365 days', () => {
    const r = computeAging([], NOW);
    expect(r.dso).toBe(0);
  });

  it('computes DSO as receivable / trailing-365d sales × 365', () => {
    // 100 açık alacak, son 365 günde 1000 satış → DSO = 100/1000*365 = 36.5 → round 37 (ya da 36, half-even)
    const r = computeAging([
      inv({ amount: 100, issueDate: new Date(NOW - 10 * DAY) }), // still open — contributes to both receivable AND sales volume
    ], NOW);
    expect(r.totalReceivable).toBe(100);
    expect(r.dso).toBe(365); // 100/100*365
  });

  it('excludes DRAFT and CANCELLED from the trailing-365d sales volume', () => {
    const r = computeAging([
      inv({ amount: 100, status: 'DRAFT', issueDate: new Date(NOW - 10 * DAY) }),
      inv({ amount: 200, paidAmount: 200, status: 'PAID', issueDate: new Date(NOW - 10 * DAY) }),
    ], NOW);
    // DRAFT excluded entirely from sales volume; PAID counts toward sales volume (200) but not receivable (0)
    expect(r.totalReceivable).toBe(0);
    expect(r.dso).toBe(0); // 0/200*365 = 0
  });

  it('excludes sales older than 365 days from the DSO denominator', () => {
    const r = computeAging([
      inv({ amount: 500, paidAmount: 500, status: 'PAID', issueDate: new Date(NOW - 400 * DAY) }),
      inv({ amount: 100, issueDate: new Date(NOW - 10 * DAY) }),
    ], NOW);
    // only the 100 (within 365d) counts toward sales volume; the 400-day-old 500 is excluded
    expect(r.dso).toBe(365); // 100/100*365
  });

  it('falls back to createdAt when issueDate is null', () => {
    const r = computeAging([
      inv({ amount: 100, issueDate: null, createdAt: new Date(NOW - 10 * DAY) }),
    ], NOW);
    expect(r.dso).toBe(365);
  });
});
