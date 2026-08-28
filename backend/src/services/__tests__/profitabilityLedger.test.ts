import { describe, it, expect } from 'vitest';
import {
  buildPlanEvents, buildActualEvents, resolveReferenceStart,
  type LedgerProject, type BuildPlanInput, type BuildActualInput,
} from '../profitabilityLedger';

const DAY = 86_400_000;

const proj = (over: Partial<LedgerProject> = {}): LedgerProject => ({
  id: 'p1', name: 'Proje', totalValue: 100_000, contractCurrency: 'TRY', progress: 0,
  startDate: new Date('2026-01-01T00:00:00Z'), plannedEndDate: new Date('2026-07-01T00:00:00Z'),
  createdAt: new Date('2025-12-01T00:00:00Z'), opportunityId: 'o1',
  applyOverhead: false, overheadAmount: 0, ...over,
});

const planInput = (over: Partial<BuildPlanInput> = {}): BuildPlanInput => ({
  project: proj(), installments: [], milestones: [], boms: [], costItems: [], projectCostItems: [], ...over,
});

describe('profitabilityLedger — resolveReferenceStart', () => {
  it('prefers startDate, then opportunity won date, then createdAt', () => {
    expect(resolveReferenceStart(proj())).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(resolveReferenceStart(proj({ startDate: null }), new Date('2026-02-02T00:00:00Z')))
      .toEqual(new Date('2026-02-02T00:00:00Z'));
    expect(resolveReferenceStart(proj({ startDate: null }), null)).toEqual(new Date('2025-12-01T00:00:00Z'));
  });
});

describe('profitabilityLedger — buildPlanEvents revenue', () => {
  it('uses CollectionInstallments for CASH revenue and milestone schedule for ACCRUAL', () => {
    const ev = buildPlanEvents(planInput({
      installments: [
        { dueDate: new Date('2026-03-01T00:00:00Z'), amount: 40_000, currency: 'TRY' },
        { dueDate: new Date('2026-06-01T00:00:00Z'), amount: 60_000, currency: 'TRY' },
      ],
      milestones: [
        { plannedEnd: new Date('2026-04-01T00:00:00Z'), budgetAmount: null, status: 'NOT_STARTED', title: 'Kabul' },
      ],
    }));
    const cashIn = ev.filter((e) => e.direction === 'IN' && e.basis === 'CASH');
    const accIn = ev.filter((e) => e.direction === 'IN' && e.basis === 'ACCRUAL');
    expect(cashIn.map((e) => e.amount)).toEqual([40_000, 60_000]);
    expect(cashIn.every((e) => e.confidence === 'FIRM')).toBe(true);
    // ACCRUAL falls back to the single dated milestone → full contract value on it
    expect(accIn).toHaveLength(1);
    expect(accIn[0].amount).toBe(100_000);
  });

  it('falls back to even 6-way spread when no installments and no dated milestones', () => {
    const ev = buildPlanEvents(planInput({ project: proj({ progress: 0 }) }));
    const cashIn = ev.filter((e) => e.direction === 'IN' && e.basis === 'CASH');
    expect(cashIn).toHaveLength(6);
    expect(cashIn.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(100_000, 5);
    expect(cashIn.every((e) => e.confidence === 'ESTIMATED')).toBe(true);
  });

  it('spreads only the remaining (uncollected) value based on progress', () => {
    const ev = buildPlanEvents(planInput({ project: proj({ progress: 25 }) }));
    const cashIn = ev.filter((e) => e.direction === 'IN' && e.basis === 'CASH');
    expect(cashIn.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(75_000, 5);
  });
});

describe('profitabilityLedger — buildPlanEvents cost', () => {
  it('emits ACCRUAL at referenceStart and CASH at +paymentTermDays for BoM', () => {
    const ev = buildPlanEvents(planInput({
      boms: [{ id: 'b1', partNumber: 'PN-1', purchaseCost: 1000, quantity: 3, currency: 'USD', paymentTermDays: 30 }],
    }));
    const acc = ev.find((e) => e.category === 'PROCUREMENT' && e.basis === 'ACCRUAL')!;
    const cash = ev.find((e) => e.category === 'PROCUREMENT' && e.basis === 'CASH')!;
    expect(acc.amount).toBe(3000);
    expect(acc.currency).toBe('USD');
    expect(acc.date).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(cash.date.getTime()).toBe(new Date('2026-01-01T00:00:00Z').getTime() + 30 * DAY);
  });

  it('skips FINANCE-category cost items (avoids financing feedback loop)', () => {
    const ev = buildPlanEvents(planInput({
      costItems: [
        { amount: 5000, currency: 'TRY', paymentTermDays: 0, category: 'LOGISTICS' },
        { amount: 9999, currency: 'TRY', paymentTermDays: 0, category: 'FINANCE' },
      ],
    }));
    const costs = ev.filter((e) => e.category === 'COST_ITEM');
    expect(costs).toHaveLength(2); // one LOGISTICS × (ACCRUAL + CASH); FINANCE excluded
    expect(costs.every((e) => e.amount === 5000)).toBe(true);
  });

  it('emits overhead events only when applyOverhead is true', () => {
    const off = buildPlanEvents(planInput());
    expect(off.some((e) => e.category === 'OVERHEAD')).toBe(false);
    const on = buildPlanEvents(planInput({ project: proj({ applyOverhead: true, overheadAmount: 60_000 }) }));
    const ovh = on.filter((e) => e.category === 'OVERHEAD' && e.basis === 'ACCRUAL');
    expect(ovh).toHaveLength(6);
    expect(ovh.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(60_000, 5);
  });
});

describe('profitabilityLedger — buildActualEvents', () => {
  const actualInput = (over: Partial<BuildActualInput> = {}): BuildActualInput => ({
    project: proj(), invoices: [], payments: [], projectCostItems: [], ...over,
  });

  it('maps SALES invoice to IN/ACCRUAL and PURCHASE to OUT/ACCRUAL on issueDate', () => {
    const ev = buildActualEvents(actualInput({
      invoices: [
        { id: 'i1', type: 'SALES', amount: 50_000, currency: 'TRY', issueDate: new Date('2026-03-10T00:00:00Z'), dueDate: null, paidAmount: 0, paidAt: null },
        { id: 'i2', type: 'PURCHASE', amount: 20_000, currency: 'TRY', issueDate: new Date('2026-02-10T00:00:00Z'), dueDate: null, paidAmount: 0, paidAt: null },
      ],
    }));
    const acc = ev.filter((e) => e.basis === 'ACCRUAL');
    expect(acc.find((e) => e.direction === 'IN')!.amount).toBe(50_000);
    expect(acc.find((e) => e.direction === 'OUT')!.amount).toBe(20_000);
  });

  it('prefers Payment records for CASH; falls back to invoice paidAmount/paidAt', () => {
    const withPayments = buildActualEvents(actualInput({
      payments: [{ id: 'pay1', amount: 30_000, currency: 'TRY', paidAt: new Date('2026-04-01T00:00:00Z'), invoiceType: 'SALES' }],
      invoices: [{ id: 'i1', type: 'SALES', amount: 50_000, currency: 'TRY', issueDate: new Date('2026-03-10T00:00:00Z'), dueDate: null, paidAmount: 50_000, paidAt: new Date('2026-05-01T00:00:00Z') }],
    }));
    const cash = withPayments.filter((e) => e.basis === 'CASH');
    expect(cash).toHaveLength(1);
    expect(cash[0].amount).toBe(30_000);

    const noPayments = buildActualEvents(actualInput({
      invoices: [{ id: 'i1', type: 'SALES', amount: 50_000, currency: 'TRY', issueDate: null, dueDate: null, paidAmount: 45_000, paidAt: new Date('2026-05-01T00:00:00Z') }],
    }));
    const cash2 = noPayments.filter((e) => e.basis === 'CASH');
    expect(cash2).toHaveLength(1);
    expect(cash2[0].amount).toBe(45_000);
  });

  it('books ProjectCostItem actuals as OUT/ACCRUAL in TRY using amountTRY', () => {
    const ev = buildActualEvents(actualInput({
      projectCostItems: [{ id: 'pc1', category: 'PROCUREMENT', plannedAmount: 10_000, actualAmount: 12_000, amountTRY: 12_000, currency: 'TRY', date: new Date('2026-03-15T00:00:00Z'), createdAt: new Date('2026-03-01T00:00:00Z') }],
    }));
    const pc = ev.filter((e) => e.category === 'PROJECT_COST');
    expect(pc).toHaveLength(1);
    expect(pc[0]).toMatchObject({ direction: 'OUT', basis: 'ACCRUAL', amount: 12_000, currency: 'TRY' });
    expect(pc[0].date).toEqual(new Date('2026-03-15T00:00:00Z'));
  });

  it('books ONLY the elapsed (absorbed) overhead share on the actual side (symmetry with plan)', () => {
    // Proje 2026-01-01 → 2026-07-01, overhead 60k, 6 eşit pay (10k/ay-ish).
    // asOf 2026-04-01 → süresinin ~yarısı geçmiş → yaklaşık yarı overhead.
    const p = proj({ applyOverhead: true, overheadAmount: 60_000 });
    const midway = buildActualEvents({
      project: p, invoices: [], payments: [], projectCostItems: [],
      asOf: new Date('2026-04-01T00:00:00Z'),
    });
    const ovhAcc = midway.filter((e) => e.category === 'OVERHEAD' && e.basis === 'ACCRUAL');
    expect(ovhAcc.length).toBeGreaterThan(0);
    expect(ovhAcc.length).toBeLessThan(6);            // henüz tüm paylar absorbe edilmedi
    const absorbed = ovhAcc.reduce((s, e) => s + e.amount, 0);
    expect(absorbed).toBeGreaterThan(0);
    expect(absorbed).toBeLessThan(60_000);
    expect(ovhAcc.every((e) => e.date.getTime() <= new Date('2026-04-01T00:00:00Z').getTime())).toBe(true);

    // asOf projenin sonundan sonra → tüm 6 pay
    const done = buildActualEvents({
      project: p, invoices: [], payments: [], projectCostItems: [],
      asOf: new Date('2026-09-01T00:00:00Z'),
    });
    expect(done.filter((e) => e.category === 'OVERHEAD' && e.basis === 'ACCRUAL').reduce((s, e) => s + e.amount, 0)).toBeCloseTo(60_000, 5);
  });

  it('emits no actual-side overhead when applyOverhead is false', () => {
    const ev = buildActualEvents(actualInput({}));
    expect(ev.some((e) => e.category === 'OVERHEAD')).toBe(false);
  });
});
