import { describe, it, expect } from 'vitest';
import { summarizeProject, type ProjectForSummary } from '../projectSummary';

const NOW = new Date('2026-08-04T12:00:00Z').getTime();
const DAY = 86_400_000;

const project = (over: Partial<ProjectForSummary>): ProjectForSummary => ({
  id: 'p1', name: 'Proje', type: 'HARDWARE', status: 'IN_PROGRESS', phase: 'Kurulum',
  customerName: null, pmName: null, totalValue: 0, contractCurrency: 'TRY',
  progress: 0, plannedEndDate: null, projectCostItems: [], milestones: [],
  ...over,
});

describe('projectSummary — summarizeProject', () => {
  it('sums plannedAmount and amountTRY across cost items separately', () => {
    const r = summarizeProject(project({
      projectCostItems: [{ plannedAmount: 1000, amountTRY: 800 }, { plannedAmount: 500, amountTRY: 600 }],
    }), NOW);
    expect(r.totalPlanned).toBe(1500);
    expect(r.totalActual).toBe(1400);
  });

  it('computes planned/actual margin as a percentage of totalValue', () => {
    const r = summarizeProject(project({
      totalValue: 10000,
      projectCostItems: [{ plannedAmount: 6000, amountTRY: 7000 }],
    }), NOW);
    expect(r.plannedMargin).toBeCloseTo(40, 10); // (10000-6000)/10000*100
    expect(r.actualMargin).toBeCloseTo(30, 10);  // (10000-7000)/10000*100
  });

  it('avoids division by zero when totalValue is 0 (margins are 0, not NaN/Infinity)', () => {
    const r = summarizeProject(project({ totalValue: 0, projectCostItems: [{ plannedAmount: 100, amountTRY: 50 }] }), NOW);
    expect(r.plannedMargin).toBe(0);
    expect(r.actualMargin).toBe(0);
  });

  it('counts a milestone as delayed only when unfinished AND past its plannedEnd', () => {
    const r = summarizeProject(project({
      milestones: [
        { status: 'IN_PROGRESS', plannedEnd: new Date(NOW - DAY) },   // delayed
        { status: 'NOT_STARTED', plannedEnd: new Date(NOW + DAY) },   // not due yet
        { status: 'COMPLETED', plannedEnd: new Date(NOW - DAY) },     // done, excluded even though past due
        { status: 'CANCELLED', plannedEnd: new Date(NOW - DAY) },     // cancelled, excluded
        { status: 'IN_PROGRESS', plannedEnd: null },                  // no planned end, excluded
      ],
    }), NOW);
    expect(r.delayedMs).toBe(1);
    expect(r.milestoneCount).toBe(5);
    expect(r.completedMs).toBe(1);
  });

  it('passes through identity/display fields unchanged', () => {
    const r = summarizeProject(project({ id: 'px', name: 'X', type: 'SOFTWARE', status: 'PLANNING', phase: 'Planlama', customerName: 'ACME', pmName: 'Ayşe', contractCurrency: 'USD', progress: 42 }), NOW);
    expect(r).toMatchObject({ id: 'px', name: 'X', type: 'SOFTWARE', status: 'PLANNING', phase: 'Planlama', customerName: 'ACME', pmName: 'Ayşe', contractCurrency: 'USD', progress: 42 });
  });

  it('handles a project with no cost items or milestones', () => {
    const r = summarizeProject(project({}), NOW);
    expect(r.totalPlanned).toBe(0);
    expect(r.totalActual).toBe(0);
    expect(r.delayedMs).toBe(0);
    expect(r.milestoneCount).toBe(0);
    expect(r.completedMs).toBe(0);
  });
});
