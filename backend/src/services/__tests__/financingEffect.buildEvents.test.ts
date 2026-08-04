import { describe, it, expect } from 'vitest';
import { buildFinancingEvents } from '../financingEffect';

describe('financingEffect — buildFinancingEvents', () => {
  it('turns a BoM item into a PAYMENT event costed at purchaseCost × quantity', () => {
    const events = buildFinancingEvents(
      [{ partNumber: 'PN-1', purchaseCost: 100, quantity: 3, currency: 'USD', paymentTermDays: 30 }],
      [], [],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'PAYMENT', label: 'BoM: PN-1', amount: 300, currency: 'USD' });
  });

  it('turns a CostItem into a PAYMENT event using its own amount (not purchaseCost×qty)', () => {
    const events = buildFinancingEvents([], [{ description: 'Kurulum', category: 'TRAVEL', amount: 500, currency: 'TRY', paymentTermDays: 15 }], []);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'PAYMENT', label: 'Kurulum', amount: 500, currency: 'TRY' });
  });

  it('skips CostItems with category FINANCE (avoids feeding a prior financing-cost back into the calc)', () => {
    const events = buildFinancingEvents([], [
      { description: 'Finansman Maliyeti (vade etkisi)', category: 'FINANCE', amount: 999, currency: 'TRY', paymentTermDays: 0 },
      { description: 'Normal masraf', category: 'TRAVEL', amount: 100, currency: 'TRY', paymentTermDays: 0 },
    ], []);
    expect(events).toHaveLength(1);
    expect(events[0].label).toBe('Normal masraf');
  });

  it('turns a collection installment into a COLLECTION event', () => {
    const dueDate = new Date('2026-09-01T00:00:00Z');
    const events = buildFinancingEvents([], [], [{ note: 'İlk taksit', dueDate, amount: 1000, currency: 'TRY' }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'COLLECTION', label: 'İlk taksit', amount: 1000, currency: 'TRY', date: dueDate.toISOString() });
  });

  it('falls back to a default label when an installment has no note', () => {
    const events = buildFinancingEvents([], [], [{ note: null, dueDate: new Date(), amount: 100, currency: 'TRY' }]);
    expect(events[0].label).toBe('Tahsilat taksiti');
  });

  it('defaults currency to TRY and null amounts to 0 across all three sources', () => {
    const events = buildFinancingEvents(
      [{ partNumber: 'X', purchaseCost: null, quantity: null, currency: null, paymentTermDays: null }],
      [{ description: 'Y', category: 'OTHER', amount: null, currency: null, paymentTermDays: null }],
      [{ note: null, dueDate: new Date(), amount: null, currency: null }],
    );
    expect(events.every((e) => e.currency === 'TRY')).toBe(true);
    expect(events[0].amount).toBe(0);
    expect(events[1].amount).toBe(0);
    expect(events[2].amount).toBe(0);
  });

  it('combines all three sources in BoM→CostItem→Installment order', () => {
    const events = buildFinancingEvents(
      [{ partNumber: 'A', purchaseCost: 10, quantity: 1, currency: 'TRY', paymentTermDays: 0 }],
      [{ description: 'B', category: 'OTHER', amount: 20, currency: 'TRY', paymentTermDays: 0 }],
      [{ note: 'C', dueDate: new Date(), amount: 30, currency: 'TRY' }],
    );
    expect(events.map((e) => e.label)).toEqual(['BoM: A', 'B', 'C']);
  });
});
