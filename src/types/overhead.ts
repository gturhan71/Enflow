export interface OperatingCostPool {
  id: string; periodStart: string; periodEnd: string;
  personnelCost: number; otherOpex: number; totalPool: number;
  method: 'PCT_OF_VALUE' | 'PCT_OF_DIRECT_COST' | 'POOL_RATE'; rate: number;
  status: string; notes?: string | null;
}
export interface UnitBudget {
  id: string; unitId: string; periodStart: string; periodEnd: string;
  personnelBudget: number; opexBudget: number; totalBudget: number; periodCost: number; notes?: string | null;
}
export interface UnitLoadLine { unitId: string; unitName: string; coefficient: number; periodCost: number; amount: number; }
export interface OverheadResult {
  directCost: number; method: string | null; rate: number; base: number;
  companyAmount: number; unitAmount: number; totalOverhead: number;
  unitBreakdown: UnitLoadLine[];
  contributionMargin: number; netMargin: number; applyOverhead: boolean; hasPool: boolean;
}
export interface ProjectUnitParticipation {
  id: string; projectId: string; unitId: string; coefficient: number;
  role?: string | null; notes?: string | null; unit?: { name: string };
}
export interface UnitAbsorptionLine {
  unitId: string; unitName: string; totalBudget: number; periodCost: number;
  allocated: number; absorptionPct: number; projectCount: number; coeffSum: number; overAllocated: boolean;
}
export interface UnitAbsorptionReport {
  units: UnitAbsorptionLine[];
  summary: { totalBudget: number; totalAllocated: number; avgAbsorption: number; idleCost: number; overAllocatedCount: number };
  note: string;
}
