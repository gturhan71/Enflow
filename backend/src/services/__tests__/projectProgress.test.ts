import { describe, it, expect } from 'vitest';
import { computeProjectProgress } from '../projectProgress';

const ms = (over: Partial<{ title: string; status: string; progress: number }>) => ({
  title: 'M', status: 'NOT_STARTED', progress: 0, ...over,
});

describe('projectProgress — computeProjectProgress', () => {
  it('averages progress across all milestones, rounded', () => {
    const r = computeProjectProgress([ms({ progress: 10 }), ms({ progress: 15 }), ms({ progress: 20 })]);
    expect(r.progress).toBe(15); // (10+15+20)/3 = 15
  });

  it('rounds a non-integer average to the nearest whole number', () => {
    const r = computeProjectProgress([ms({ progress: 10 }), ms({ progress: 11 })]);
    expect(r.progress).toBe(11); // 10.5 rounds up (Math.round)
  });

  it('uses the IN_PROGRESS milestone title as the phase when one exists', () => {
    const r = computeProjectProgress([
      ms({ title: 'Planlama', status: 'COMPLETED' }),
      ms({ title: 'Kurulum', status: 'IN_PROGRESS' }),
      ms({ title: 'Kabul', status: 'NOT_STARTED' }),
    ]);
    expect(r.phase).toBe('Kurulum');
    expect(r.completed).toBe(false);
  });

  it('picks the FIRST IN_PROGRESS milestone when multiple are in progress (array order)', () => {
    const r = computeProjectProgress([ms({ title: 'A', status: 'IN_PROGRESS' }), ms({ title: 'B', status: 'IN_PROGRESS' })]);
    expect(r.phase).toBe('A');
  });

  it('is "Tamamlandı" and completed=true when every milestone is COMPLETED or CANCELLED', () => {
    const r = computeProjectProgress([ms({ status: 'COMPLETED' }), ms({ status: 'CANCELLED' })]);
    expect(r.phase).toBe('Tamamlandı');
    expect(r.completed).toBe(true);
  });

  it('falls back to the first milestone\'s title when none are in progress and not all are done', () => {
    const r = computeProjectProgress([ms({ title: 'İlk Aşama', status: 'NOT_STARTED' }), ms({ title: 'İkinci', status: 'NOT_STARTED' })]);
    expect(r.phase).toBe('İlk Aşama');
    expect(r.completed).toBe(false);
  });

  it('empty milestone list: progress=0, completed=true, phase="Tamamlandı" (vacuous-truth quirk, preserved as-is)', () => {
    // Bkz. dosya yorumu: [].every() JS'te her zaman true döner. Pratikte projeler
    // şablonla birlikte milestone'larla oluşturulduğu için bu dal muhtemelen hiç
    // tetiklenmiyor, ama mevcut davranış (route'tan birebir taşındı) burada kilitleniyor.
    const r = computeProjectProgress([]);
    expect(r).toEqual({ progress: 0, phase: 'Tamamlandı', completed: true });
  });
});
