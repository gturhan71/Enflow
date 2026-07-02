import { prisma } from '../prismaClient';
import { round2 } from './moneyRounding';

// ── DMO Kârlılık / Maliyetlendirme Motoru ────────────────────────────────────
// Kritik: DMO SATIŞ fiyatı DMO'nun kendi kuruyla (belirsiz geçerlilik) TRY'ye
// çevrilir; MALİYET ise piyasa kuruyla. İki kur farklı kaynaktan → satış zarar
// edebilir. Risturn (ciro üzerinden kademeli kesinti) + üçüncü-şahıs komisyonu
// da düşülür. Her sipariş için o anki koşullarla yeniden hesaplanır; kârsızsa alarm.

export interface RisturnTier { thresholdMin: number; rate: number; } // rate: 0..1
export interface DmoCommission { type: 'PERCENT' | 'FIXED'; value: number; basis: 'REVENUE' | 'PROFIT'; }
export interface DmoCostParams {
  risturnTiers: RisturnTier[];
  minMarginPct: number;              // alarm eşiği (0..1)
  defaultCommission: DmoCommission;
  costFxRates: Record<string, number>; // alış maliyeti para birimi → TRY (piyasa)
}

export const DEFAULT_DMO_PARAMS: DmoCostParams = {
  risturnTiers: [{ thresholdMin: 0, rate: 0 }],
  minMarginPct: 0.05,
  defaultCommission: { type: 'PERCENT', value: 0, basis: 'REVENUE' },
  costFxRates: { TRY: 1 },
};

export async function getDmoParams(tenantId: string): Promise<DmoCostParams> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  let dmo: Partial<DmoCostParams> = {};
  try { dmo = (JSON.parse(t?.moduleSettings || '{}') as { dmo?: Partial<DmoCostParams> }).dmo || {}; } catch { dmo = {}; }
  return {
    risturnTiers: Array.isArray(dmo.risturnTiers) && dmo.risturnTiers.length ? dmo.risturnTiers : DEFAULT_DMO_PARAMS.risturnTiers,
    minMarginPct: typeof dmo.minMarginPct === 'number' ? dmo.minMarginPct : DEFAULT_DMO_PARAMS.minMarginPct,
    defaultCommission: dmo.defaultCommission || DEFAULT_DMO_PARAMS.defaultCommission,
    costFxRates: { TRY: 1, ...(dmo.costFxRates || {}) },
  };
}

export async function setDmoParams(tenantId: string, patch: Partial<DmoCostParams>): Promise<DmoCostParams> {
  const current = await getDmoParams(tenantId);
  const next: DmoCostParams = {
    risturnTiers: patch.risturnTiers ?? current.risturnTiers,
    minMarginPct: patch.minMarginPct ?? current.minMarginPct,
    defaultCommission: patch.defaultCommission ?? current.defaultCommission,
    costFxRates: { TRY: 1, ...current.costFxRates, ...(patch.costFxRates || {}) },
  };
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.dmo = next;
  await prisma.tenant.update({ where: { id: tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  return next;
}

/** Kümülatif ciroya karşılık gelen efektif risturn oranı (en yüksek eşiği geçen kademe). */
export function effectiveRisturnRate(turnover: number, tiers: RisturnTier[]): number {
  const sorted = [...tiers].filter(t => Number.isFinite(t.thresholdMin) && Number.isFinite(t.rate)).sort((a, b) => a.thresholdMin - b.thresholdMin);
  let rate = 0;
  for (const t of sorted) if (turnover >= t.thresholdMin) rate = t.rate;
  return rate;
}

/** Cari dönem (takvim yılı) — CONFIRMED ve sonrası siparişlerin toplam cirosu (kümülatif risturn tabanı). */
export async function getPeriodTurnover(tenantId: string, excludeOrderId?: string): Promise<number> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const orders = await prisma.dmoOrder.findMany({
    where: {
      tenantId,
      status: { in: ['CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'INVOICED', 'CLOSED'] },
      orderDate: { gte: yearStart },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { revenueTotal: true },
  });
  return orders.reduce((s, o) => s + (o.revenueTotal || 0), 0);
}

/** Cari geçerli DMO kuru (currency için); yoksa en yeni kayıt. */
export async function getActiveDmoRate(tenantId: string, currency: string): Promise<{ rate: number; validFrom: Date | null; validTo: Date | null } | null> {
  if (!currency || currency === 'TRY') return { rate: 1, validFrom: null, validTo: null };
  const now = new Date();
  const active = await prisma.dmoExchangeRate.findFirst({
    where: { tenantId, currency, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
    orderBy: { validFrom: 'desc' },
  });
  const rec = active || await prisma.dmoExchangeRate.findFirst({ where: { tenantId, currency }, orderBy: { validFrom: 'desc' } });
  return rec ? { rate: rec.rate, validFrom: rec.validFrom, validTo: rec.validTo } : null;
}

export interface CostingResult {
  revenueTotal: number; costTotal: number; grossProfit: number;
  dmoRateSnapshot: number | null; rateCurrency: string | null; rateValidFrom: Date | null; rateValidTo: Date | null;
  risturnRateApplied: number; risturnDeduction: number;
  commissionType: string; commissionValue: number; commissionBasis: string; commissionDeduction: number;
  netProfit: number; netMarginPct: number; isProfitable: boolean; alarmReason: string | null;
  costedAt: Date;
}

type RateInfo = { rate: number; validFrom: Date | null; validTo: Date | null };
interface CostingInput {
  items: { qty: number; unitPrice: number; sellCurrency: string; unitCost: number; costCurrency: string }[];
  commission: DmoCommission;
  params: DmoCostParams;
  dmoRates: Record<string, RateInfo | null>; // satış para birimi → DMO kuru (TRY dışı)
  periodTurnover: number;
}

export function computeOrderCosting(inp: CostingInput): CostingResult {
  const { items, commission, params, dmoRates, periodTurnover } = inp;

  let revenueTotal = 0, costTotal = 0;
  for (const it of items) {
    const sellFx = it.sellCurrency === 'TRY' ? 1 : (dmoRates[it.sellCurrency]?.rate ?? 1);
    revenueTotal += it.qty * it.unitPrice * sellFx;
    const costFx = it.costCurrency === 'TRY' ? 1 : (params.costFxRates[it.costCurrency] ?? 1);
    costTotal += it.qty * it.unitCost * costFx;
  }
  revenueTotal = round2(revenueTotal); costTotal = round2(costTotal);
  const grossProfit = round2(revenueTotal - costTotal);

  const risturnRate = effectiveRisturnRate(periodTurnover + revenueTotal, params.risturnTiers);
  const risturnDeduction = round2(revenueTotal * risturnRate);

  let commissionDeduction = 0;
  if (commission.type === 'PERCENT') commissionDeduction = (commission.basis === 'PROFIT' ? grossProfit : revenueTotal) * (commission.value / 100);
  else commissionDeduction = commission.value; // FIXED (kardan sabit tutar)
  commissionDeduction = round2(Math.max(0, commissionDeduction));

  const netProfit = round2(grossProfit - risturnDeduction - commissionDeduction);
  const netMarginPct = revenueTotal > 0 ? netProfit / revenueTotal : 0;

  // Kullanılan TRY-dışı satış para birimleri (kur snapshot + alarm için)
  const foreign = [...new Set(items.map(i => i.sellCurrency).filter(c => c && c !== 'TRY'))];
  const alarms: string[] = [];
  if (netProfit < 0) alarms.push('Net kâr negatif — bu satış zarar ettiriyor.');
  else if (netMarginPct < params.minMarginPct) alarms.push(`Net marj %${Math.round(netMarginPct * 100)} < eşik %${Math.round(params.minMarginPct * 100)}.`);
  for (const c of foreign) {
    if (!dmoRates[c]) alarms.push(`${c} için DMO kuru tanımlı değil.`);
    else if (dmoRates[c]!.validTo && dmoRates[c]!.validTo!.getTime() < Date.now()) alarms.push(`${c} DMO kurunun geçerlilik süresi dolmuş — yeniden hesaplayın.`);
  }

  // Snapshot: tek yabancı satış para birimi varsa onu; birden çoksa MIX
  let dmoRateSnapshot: number | null = null, rateCurrency: string | null = null, rateValidFrom: Date | null = null, rateValidTo: Date | null = null;
  if (foreign.length === 1) { const r = dmoRates[foreign[0]]; dmoRateSnapshot = r?.rate ?? null; rateCurrency = foreign[0]; rateValidFrom = r?.validFrom ?? null; rateValidTo = r?.validTo ?? null; }
  else if (foreign.length > 1) { rateCurrency = 'MIX'; }

  return {
    revenueTotal, costTotal, grossProfit,
    dmoRateSnapshot, rateCurrency, rateValidFrom, rateValidTo,
    risturnRateApplied: risturnRate, risturnDeduction,
    commissionType: commission.type, commissionValue: commission.value, commissionBasis: commission.basis, commissionDeduction,
    netProfit, netMarginPct, isProfitable: netProfit >= 0 && netMarginPct >= params.minMarginPct,
    alarmReason: alarms.length ? alarms.join(' ') : null,
    costedAt: new Date(),
  };
}

/** Siparişi o anki koşullarla yeniden hesapla ve snapshot'ı DB'ye yaz. */
export async function recomputeOrderCosting(tenantId: string, orderId: string): Promise<CostingResult | null> {
  const order = await prisma.dmoOrder.findFirst({ where: { id: orderId, tenantId }, include: { items: true } });
  if (!order) return null;
  const params = await getDmoParams(tenantId);
  const periodTurnover = await getPeriodTurnover(tenantId, orderId);
  // Kalemlerin TRY-dışı satış para birimleri için DMO kurları
  const currencies = [...new Set(order.items.map(i => i.sellCurrency).filter(c => c && c !== 'TRY'))];
  const dmoRates: Record<string, { rate: number; validFrom: Date | null; validTo: Date | null } | null> = {};
  for (const c of currencies) dmoRates[c] = await getActiveDmoRate(tenantId, c);
  const commission: DmoCommission = {
    type: (order.commissionType as 'PERCENT' | 'FIXED') || params.defaultCommission.type,
    value: order.commissionValue ?? params.defaultCommission.value,
    basis: (order.commissionBasis as 'REVENUE' | 'PROFIT') || params.defaultCommission.basis,
  };
  const r = computeOrderCosting({
    items: order.items.map(i => ({ qty: i.qty, unitPrice: i.unitPrice, sellCurrency: i.sellCurrency, unitCost: i.unitCost, costCurrency: i.costCurrency })),
    commission, params, dmoRates, periodTurnover,
  });
  await prisma.dmoOrder.update({
    where: { id: orderId },
    data: {
      revenueTotal: r.revenueTotal, costTotal: r.costTotal, grossProfit: r.grossProfit,
      dmoRateSnapshot: r.dmoRateSnapshot, rateCurrency: r.rateCurrency, rateValidFrom: r.rateValidFrom, rateValidTo: r.rateValidTo,
      risturnRateApplied: r.risturnRateApplied, risturnDeduction: r.risturnDeduction,
      commissionType: r.commissionType, commissionValue: r.commissionValue, commissionBasis: r.commissionBasis, commissionDeduction: r.commissionDeduction,
      netProfit: r.netProfit, netMarginPct: r.netMarginPct, isProfitable: r.isProfitable, alarmReason: r.alarmReason, costedAt: r.costedAt,
    },
  });
  return r;
}
