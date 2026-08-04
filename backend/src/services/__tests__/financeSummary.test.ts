import { describe, it, expect } from 'vitest';
import { summarizeFinance } from '../financeSummary';

const inv = (over: Partial<{ type: string; status: string; amount: number; paidAmount: number; dueDate: Date | null }>) => ({
  type: 'SALES', status: 'ISSUED', amount: 0, paidAmount: 0, dueDate: null, ...over,
});

describe('financeSummary — summarizeFinance', () => {
  it('only counts SALES invoices toward receivable/collected (PURCHASE excluded)', () => {
    const r = summarizeFinance(
      [inv({ amount: 1000, paidAmount: 0 }), inv({ type: 'PURCHASE', amount: 5000, paidAmount: 0 })],
      [],
      0,
    );
    expect(r.totalReceivable).toBe(1000);
    expect(r.salesCount).toBe(1);
    expect(r.invoiceCount).toBe(2); // invoiceCount is the raw total, unlike salesCount
  });

  it('excludes DRAFT and CANCELLED from receivable', () => {
    const r = summarizeFinance(
      [inv({ amount: 1000, status: 'DRAFT' }), inv({ amount: 2000, status: 'CANCELLED' }), inv({ amount: 500, paidAmount: 100 })],
      [],
      0,
    );
    expect(r.totalReceivable).toBe(400); // only the third invoice: 500-100
  });

  it('totalCollected sums paidAmount across all SALES regardless of status', () => {
    const r = summarizeFinance(
      [inv({ amount: 1000, paidAmount: 400 }), inv({ amount: 500, paidAmount: 500, status: 'PAID' })],
      [],
      0,
    );
    expect(r.totalCollected).toBe(900);
  });

  it('overdue catches partially-paid-and-past-due invoices even though their status stays PARTIAL', () => {
    // Bkz. memory: invoice-status-partial-before-overdue — status alanı OVERDUE'yu
    // hiç yansıtmaz burada, bu yüzden bu hesap dueDate/paidAmount'a bakıyor (doğru).
    const pastDue = new Date(Date.now() - 86_400_000);
    const r = summarizeFinance(
      [inv({ amount: 1000, paidAmount: 400, dueDate: pastDue, status: 'PARTIAL' })],
      [],
      0,
    );
    expect(r.overdue).toBe(600);
  });

  it('overdue excludes CANCELLED even if past due and unpaid', () => {
    const pastDue = new Date(Date.now() - 86_400_000);
    const r = summarizeFinance([inv({ amount: 1000, dueDate: pastDue, status: 'CANCELLED' })], [], 0);
    expect(r.overdue).toBe(0);
  });

  it('overdue excludes invoices with a future due date', () => {
    const futureDue = new Date(Date.now() + 86_400_000);
    const r = summarizeFinance([inv({ amount: 1000, dueDate: futureDue })], [], 0);
    expect(r.overdue).toBe(0);
  });

  it('counts guarantees expiring within 30 days, ignores ones without an expiry or further out', () => {
    const in10days = new Date(Date.now() + 10 * 86_400_000);
    const in60days = new Date(Date.now() + 60 * 86_400_000);
    const r = summarizeFinance([], [{ expiryDate: in10days }, { expiryDate: in60days }, { expiryDate: null }], 0);
    expect(r.activeGuarantees).toBe(3); // all passed-in guarantees are already ACTIVE-filtered by the caller
    expect(r.expiringGuarantees).toBe(1);
  });

  it('passes pendingCostApprovals through unchanged', () => {
    const r = summarizeFinance([], [], 7);
    expect(r.pendingCostApprovals).toBe(7);
  });
});
