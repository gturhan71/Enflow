// Enflow — Para alanı temiz-yuvarlama (Float depolama, kuruş hassasiyeti)
// ─────────────────────────────────────────────────────────────────────────────
// Şema şimdilik Float; ama hiçbir "kirli" float saklanmaz: tüm para yazımları
// 2 ondalığa (kuruş) yuvarlanır. Hesaplar financeEngine (kuruş tabanlı) ile yapılır.
// Bu, rapor C/Float'taki asıl riski (yuvarlama/birikme) kapatır; şema göçü gerekmez.
// (Tam BigInt(kuruş) göçü ileri/aşamalı iş — bkz. docs/MONEY_MIGRATION_PLAN.md.)

import { toMinor, fromMinor } from './financeEngine';

// Yalnız PARA alanları. Yüzde/oran/miktar/rating/KPI buraya GİRMEZ.
export const MONEY_FIELDS: Record<string, string[]> = {
  Customer: ['creditLimit'],
  Opportunity: ['value'],
  BoMItem: ['purchaseCost', 'unitSalePrice', 'totalSalePrice'],
  BoMLineQuote: ['unitPrice'],
  CostItem: ['amount'],
  Project: ['totalValue', 'budgetTotal'],
  ProjectMilestone: ['budgetAmount', 'actualCost'],
  ProjectCostItem: ['plannedAmount', 'actualAmount', 'amountTRY'],
  Contract: ['guaranteeAmount'],
  ContractWorkflow: ['contractValue'],
  PurchaseRequest: ['budgetAmount', 'budgetAmountTRY', 'invoiceAmount'],
  PurchaseItem: ['estimatedUnitPrice', 'actualUnitPrice'],
  PurchaseQuote: ['totalAmount', 'totalAmountTRY'],
  Invoice: ['amount', 'paidAmount'],
  Payment: ['amount'],
  GuaranteeLetter: ['amount'],
  Tender: ['estimatedValue'],
  CollectionInstallment: ['amount'],
};

/** 2 ondalığa yuvarla (kuruş) — financeEngine SoT üzerinden. */
export const round2 = (v: number): number => fromMinor(toMinor(v));

// Prisma update alanı {set|increment|decrement: number} formlarını da yuvarlar.
function roundField(val: unknown): unknown {
  if (typeof val === 'number' && Number.isFinite(val)) return round2(val);
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>;
    for (const op of ['set', 'increment', 'decrement', 'multiply'] as const) {
      if (typeof o[op] === 'number' && Number.isFinite(o[op] as number)) o[op] = round2(o[op] as number);
    }
  }
  return val;
}

/** Bir create/update data nesnesindeki para alanlarını yerinde yuvarlar. */
export function roundMoneyData(model: string | undefined, data: unknown): void {
  if (!model || !data || typeof data !== 'object') return;
  const fields = MONEY_FIELDS[model];
  if (!fields) return;
  const d = data as Record<string, unknown>;
  for (const f of fields) {
    if (f in d && d[f] != null) d[f] = roundField(d[f]);
  }
}
