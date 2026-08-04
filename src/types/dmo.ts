// ── DMO Katalog & Kârlılık ────────────────────────────────────────────────────
export interface DmoCatalogItem {
  id: string; dmoCode: string; name: string; brand?: string | null; model?: string | null;
  unit: string; listPrice: number; vatRate: number; currency: string;
  unitCost: number; costCurrency: string; category?: string | null;
  validFrom?: string | null; validTo?: string | null; status: string;
  frameworkAgreementId?: string | null; notes?: string | null;
}
export interface DmoFrameworkAgreement {
  id: string; agreementNo: string; title: string; validFrom?: string | null; validTo?: string | null;
  quotaTotal?: number | null; quotaUsed: number; status: string; notes?: string | null;
}
export interface DmoExchangeRate {
  id: string; currency: string; rate: number; validFrom: string; validTo?: string | null;
  source?: string | null; notes?: string | null;
}
export interface DmoOrderItem {
  id?: string; catalogItemId?: string | null; name: string; qty: number; unitPrice: number; sellCurrency: string;
  unitCost: number; costCurrency: string; vatRate: number; lineRevenue?: number; lineCost?: number;
}
export interface DmoOrder {
  id: string; orderNo: string; institutionName: string; orderDate: string; deliveryDeadline?: string | null;
  frameworkAgreementId?: string | null; currency: string; status: string;
  ownerId?: string | null; ownerName?: string | null; notes?: string | null;
  revenueTotal: number; costTotal: number; dmoRateSnapshot?: number | null; rateCurrency?: string | null;
  rateValidFrom?: string | null; rateValidTo?: string | null;
  risturnRateApplied: number; risturnDeduction: number;
  commissionType: string; commissionValue: number; commissionBasis: string; commissionDeduction: number;
  grossProfit: number; netProfit: number; netMarginPct: number; isProfitable: boolean;
  alarmReason?: string | null; costedAt?: string | null; items: DmoOrderItem[];
}
export interface DmoCommission { type: 'PERCENT' | 'FIXED'; value: number; basis: 'REVENUE' | 'PROFIT'; }
export interface DmoCostParams {
  risturnTiers: { thresholdMin: number; rate: number }[];
  minMarginPct: number; defaultCommission: DmoCommission; costFxRates: Record<string, number>;
}
export interface DmoReconciliation {
  periodStart: string; periodEnd: string; orderCount: number; totalTurnover: number;
  actualRate: number; actualRisturn: number; accruedRisturn: number; difference: number;
  tiers: { thresholdMin: number; rate: number }[]; note: string;
}
