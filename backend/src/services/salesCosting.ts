import { prisma } from '../prismaClient';

// ── Satış Fiyatlama / Marj Motoru ────────────────────────────────────────────
// Önceden bu hesap yalnız tarayıcıda (CostAnalysisModule.tsx + lib/procurementCosts.ts)
// yaşıyordu; backend istemcinin gönderdiği unitSalePrice/costConfig'i doğrulamadan
// kaydediyordu. Bu servis dmoCosting.ts ile aynı desende AYNI formülü backend'de
// tekrar üretir — kayıtlı/onaylanan sayı artık sunucu kaynaklıdır, API tüketicileri
// ve sanal agent'lar da aynı sayıyı görür. Frontend'deki hesap artık yalnız canlı önizleme.

export interface SalesMethodCostLine {
  label: string;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  category: string;
}

export interface SalesCostConfig {
  baseCurrency: string;
  spotRates?: Record<string, number>;
  forwardOverrides?: Record<string, number>;
  annualDepreciation?: number;
  collectionDate?: string;
  targetMargin?: number;
  procurementMethod?: string;
  methodCostLines?: SalesMethodCostLine[];
}

export interface SalesBoMItemInput {
  partNumber?: string;
  description?: string;
  quantity: number;
  purchaseCost: number;
  currency?: string;
  vatRate?: number;
  vendor?: string;
  source?: string;
  lineKey?: string;
}

export interface SalesManualCostItemInput {
  description?: string;
  category?: string;
  amount: number;
  currency?: string;
}

// ── Forward kur (procurementCosts.ts ile birebir aynı formül — tek kaynak burası) ──
export function monthsUntil(collectionDate?: string): number {
  if (!collectionDate) return 0;
  const d = new Date(collectionDate).getTime();
  if (Number.isNaN(d)) return 0;
  const months = (d - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0, months);
}

export function forwardRate(spot: number, annualDepreciationPct: number, months: number): number {
  return spot * (1 + (annualDepreciationPct / 100) * (months / 12));
}

export function computeForwardRates(
  spotRates: Record<string, number>,
  annualDepreciationPct: number,
  collectionDate: string | undefined,
  overrides?: Record<string, number>,
): Record<string, number> {
  const months = monthsUntil(collectionDate);
  const out: Record<string, number> = {};
  for (const [c, spot] of Object.entries(spotRates || {})) {
    out[c] = overrides && overrides[c] != null ? overrides[c] : Math.round(forwardRate(spot, annualDepreciationPct, months) * 10000) / 10000;
  }
  return out;
}

export interface SalesCostingResult {
  forwardRates: Record<string, number>;
  bomCost: number;
  opsCost: number;
  methodCostTotal: number;
  methodCostItems: { description: string; category: string; amount: number; currency: string; auto: true }[];
  grandCost: number;
  offer: number;
  profit: number;
  marginPct: number;
  pricedBomItems: (SalesBoMItemInput & { unitSalePrice: number; totalSalePrice: number })[];
  marginFloorPct: number;
  belowFloor: boolean;
  alarmReason: string | null;
}

/**
 * CostAnalysisModule.tsx'teki hesapla BİREBİR aynı formül: usul-masrafı tabanı
 * (BoM+ops)/(1−m); teklif = toplamMaliyet/(1−m); marj = kâr/satış.
 */
export function computeSalesCosting(input: {
  bomItems: SalesBoMItemInput[];
  manualCostItems: SalesManualCostItemInput[];
  costConfig: SalesCostConfig;
  marginFloorPct: number;
}): SalesCostingResult {
  const { bomItems, manualCostItems, costConfig, marginFloorPct } = input;
  const baseCurrency = costConfig.baseCurrency || 'TRY';
  const spotRates = costConfig.spotRates || {};
  const forwardRates = computeForwardRates(spotRates, costConfig.annualDepreciation || 0, costConfig.collectionDate, costConfig.forwardOverrides);
  const toBase = (amount: number, currency?: string): number => {
    if (!currency || currency === baseCurrency) return amount;
    return amount * (forwardRates[currency] ?? 1);
  };

  const targetMargin = costConfig.targetMargin ?? 20;
  const mFrac = Math.min(0.99, Math.max(0, targetMargin / 100));

  const bomCost = bomItems.reduce((s, i) => s + toBase(i.purchaseCost, i.currency) * i.quantity, 0);
  const opsCost = manualCostItems.reduce((s, i) => s + toBase(Number(i.amount) || 0, i.currency), 0);

  const preOffer = mFrac < 1 ? (bomCost + opsCost) / (1 - mFrac) : (bomCost + opsCost);
  const methodCostLines = costConfig.methodCostLines || [];
  const methodLineAmount = (l: SalesMethodCostLine) => l.kind === 'PERCENT' ? (l.value / 100) * preOffer : l.value;
  const methodCostTotal = methodCostLines.reduce((s, l) => s + methodLineAmount(l), 0);

  const grandCost = bomCost + opsCost + methodCostTotal;
  const offer = mFrac < 1 ? grandCost / (1 - mFrac) : grandCost;
  const profit = offer - grandCost;
  const marginPct = offer > 0 ? (profit / offer) * 100 : 0;

  const pricedBomItems = bomItems.map((item) => {
    const costInBase = toBase(item.purchaseCost, item.currency);
    const unitSale = mFrac < 1 ? costInBase / (1 - mFrac) : costInBase;
    return {
      ...item,
      unitSalePrice: Math.round(unitSale * 100) / 100,
      totalSalePrice: Math.round(unitSale * item.quantity * 100) / 100,
    };
  });

  const methodCostItems = methodCostLines.map((l) => ({
    description: l.label + (l.kind === 'PERCENT' ? ` (%${l.value})` : ''),
    category: l.category,
    amount: Math.round(methodLineAmount(l) * 100) / 100,
    currency: baseCurrency,
    auto: true as const,
  }));

  const belowFloor = marginPct < marginFloorPct;

  return {
    forwardRates,
    bomCost: Math.round(bomCost * 100) / 100,
    opsCost: Math.round(opsCost * 100) / 100,
    methodCostTotal: Math.round(methodCostTotal * 100) / 100,
    methodCostItems,
    grandCost: Math.round(grandCost * 100) / 100,
    offer: Math.round(offer * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    marginPct: Math.round(marginPct * 100) / 100,
    pricedBomItems,
    marginFloorPct,
    belowFloor,
    alarmReason: belowFloor ? `Marj %${marginPct.toFixed(1)} < eşik %${marginFloorPct} — onaylayan bunu görecek.` : null,
  };
}

// ── Proposal (Teklif) marj doğrulaması ───────────────────────────────────────
// Proposal içeriği (kalem/proje-geneli marj modu + pazarlık için manuel toplam
// fiyat override) kasıtlı olarak frontend'de hesaplanmaya devam ediyor — bu
// negotiation UX'inin bir parçası. Ama kaydedilen totalPrice/totalCostBase
// (bkz. ProposalEditor.tsx onSave) burada aynı marj-eşiği mantığıyla (belowFloor/
// alarmReason, computeSalesCosting ile aynı format) doğrulanıp denetlenebilir
// hâle getiriliyor — reddetmiyor, yalnız görünür + audit edilebilir kılıyor.
export interface ProposalMarginCheck {
  marginPct: number;
  belowFloor: boolean;
  marginFloorPct: number;
  alarmReason: string | null;
}

export function evaluateProposalMargin(totalPrice: number, totalCostBase: number, marginFloorPct: number): ProposalMarginCheck {
  const profit = totalPrice - totalCostBase;
  const marginPct = totalPrice > 0 ? Math.round((profit / totalPrice) * 100 * 100) / 100 : 0;
  const belowFloor = marginPct < marginFloorPct;
  return {
    marginPct,
    belowFloor,
    marginFloorPct,
    alarmReason: belowFloor ? `Marj %${marginPct.toFixed(1)} < eşik %${marginFloorPct} — onaylayan bunu görecek.` : null,
  };
}

// ── Yönetici-ayarlı marj eşiği (Tenant.moduleSettings.sales — DMO'daki getDmoParams/setDmoParams ile aynı desen) ──
const DEFAULT_MARGIN_FLOOR_PCT = 10;

export async function getSalesMarginFloor(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  try {
    const ms = JSON.parse(t?.moduleSettings || '{}') as { sales?: { marginFloorPct?: number } };
    return typeof ms.sales?.marginFloorPct === 'number' ? ms.sales.marginFloorPct : DEFAULT_MARGIN_FLOOR_PCT;
  } catch {
    return DEFAULT_MARGIN_FLOOR_PCT;
  }
}

export async function setSalesMarginFloor(tenantId: string, marginFloorPct: number): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  const clamped = Math.min(99, Math.max(0, marginFloorPct));
  ms.sales = { ...(ms.sales as object || {}), marginFloorPct: clamped };
  await prisma.tenant.update({ where: { id: tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  return clamped;
}
