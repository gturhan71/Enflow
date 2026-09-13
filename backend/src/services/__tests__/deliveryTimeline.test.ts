import { describe, it, expect } from 'vitest';
import { buildDeliveryTimeline, computeDeliveryDueDate, DEFAULT_DELIVERY_PHASES } from '../deliveryTimeline';

const start = new Date('2026-01-01T00:00:00Z');

describe('deliveryTimeline — buildDeliveryTimeline', () => {
  it('produces one step per default phase, in order', () => {
    const steps = buildDeliveryTimeline(start, 100);
    expect(steps).toHaveLength(DEFAULT_DELIVERY_PHASES.length);
    expect(steps.map((s) => s.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(steps.map((s) => s.title)).toEqual(['Sipariş Onayı', 'Üretim/Tedarik', 'Sevkiyat', 'Teslim/Kabul']);
  });

  it('last phase date equals referenceStart + totalDays (== computeDeliveryDueDate)', () => {
    const totalDays = 90;
    const steps = buildDeliveryTimeline(start, totalDays);
    const last = steps[steps.length - 1];
    expect(last.plannedDate).toEqual(computeDeliveryDueDate(start, totalDays));
  });

  it('scales proportionally with different totalDays', () => {
    const steps60 = buildDeliveryTimeline(start, 60);
    const steps120 = buildDeliveryTimeline(start, 120);
    const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
    // Üretim/Tedarik fazı (%60) her iki durumda da toplam sürenin %60'ında olmalı
    expect(daysBetween(start, steps60[1].plannedDate)).toBe(Math.round(60 * 0.6));
    expect(daysBetween(start, steps120[1].plannedDate)).toBe(Math.round(120 * 0.6));
  });

  it('clamps negative totalDays to 0', () => {
    const steps = buildDeliveryTimeline(start, -10);
    expect(steps.every((s) => s.plannedDate.getTime() === start.getTime())).toBe(true);
  });
});

describe('deliveryTimeline — computeDeliveryDueDate', () => {
  it('adds totalDays to referenceStart', () => {
    expect(computeDeliveryDueDate(start, 30)).toEqual(new Date('2026-01-31T00:00:00Z'));
  });

  it('clamps negative totalDays to 0', () => {
    expect(computeDeliveryDueDate(start, -5)).toEqual(start);
  });
});
