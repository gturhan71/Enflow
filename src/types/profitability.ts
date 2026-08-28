// Enflow — Kârlılık analizi tipleri (backend profitabilityRollup/Service ile eş)
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §3

export type ProfitGrain = 'PROJECT' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ProfitEvent {
  date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  basis: 'ACCRUAL' | 'CASH';
  source: 'PLAN' | 'ACTUAL';
  category: string;
  projectId: string | null;
  opportunityId: string | null;
  ref: string;
  confidence: 'FIRM' | 'ESTIMATED';
  label: string;
}

export interface ProfitCurrencyBreak {
  plannedRevenue: number; plannedCost: number;
  actualRevenue: number; actualCost: number;
}

export interface ProfitPeriodRow {
  periodKey: string;
  label: string;
  currency: string;
  plannedRevenue: number; plannedCost: number; plannedMarginPct: number;
  actualRevenue: number; actualCost: number; actualMarginPct: number;
  plannedCashIn: number; plannedCashOut: number; plannedCashNet: number;
  actualCashIn: number; actualCashOut: number; actualCashNet: number;
  eacCost: number; eacMarginPct: number;
  varianceMarginPct: number;
  eventCount: number;
  byCurrency: Record<string, ProfitCurrencyBreak>;
  fxAssumptions: Record<string, number>;
  fxWarnings: string[];
}

export interface ProfitScope { kind: 'ALL' | 'PROJECT'; projectId?: string }

export interface ProfitSummaryResult {
  scope: ProfitScope;
  grain: ProfitGrain;
  asOf: string;
  reportCurrency: string;
  fxRates: Record<string, number>;
  rows: ProfitPeriodRow[];
}

export interface ProfitLedgerResult {
  scope: ProfitScope;
  asOf: string;
  fxRates: Record<string, number>;
  plan: ProfitEvent[];
  actual: ProfitEvent[];
}

// ── Faz B: nakit pozisyonu + hazine ────────────────────────────────────────

export interface CashPoint {
  date: string;
  inflow: number;
  outflow: number;
  cumulative: number;
  label: string;
  source: 'PLAN' | 'ACTUAL';
}

export interface CashSeries {
  currency: string;
  points: CashPoint[];
  maxDeficit: number;
  troughDate: string | null;
  endingPosition: number;
}

export interface DeficitWindow {
  currency: string;
  from: string;
  to: string;
  troughDate: string;
  troughAmount: number;
}

export interface CashflowResult {
  scope: ProfitScope;
  asOf: string;
  fxRates: Record<string, number>;
  byCurrency: CashSeries[];
  consolidatedTRY: CashSeries;
  deficitWindows: DeficitWindow[];
  fxWarnings: string[];
}

export interface TreasuryLine {
  currency: string;
  ratePct: number;
  financingCost: number;
  financingBenefit: number;
  treasuryNet: number;
  timeWeightedDeficit: number;
  timeWeightedSurplus: number;
}

export interface TreasuryResult {
  scope: ProfitScope;
  asOf: string;
  horizon: string;
  byCurrency: TreasuryLine[];
  totalTRY: TreasuryLine;
  interestRates: Record<string, number>;
  fxRates: Record<string, number>;
  fxWarnings: string[];
}
