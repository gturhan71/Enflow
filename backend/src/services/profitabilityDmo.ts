// Enflow — Kârlılık Faz E: DMO Kanalı Kârlılığı (lisanslı; kümülatifin DIŞINDA)
// ─────────────────────────────────────────────────────────────────────────────
// DMO satıcı kanalının ekonomisi (risturn iadesi + komisyon + DMO kur açığı)
// proje marjından farklıdır → proje kümülatifine KARIŞMAZ, ayrı sekmede sunulur.
// Yalnız DMO_MODULE entitlement'ı olan tenant'a açıktır (route kapısı).
//
// `DmoOrder` zaten kendi maliyetlendirme motoruyla (dmoCosting.ts) revenueTotal/
// costTotal/grossProfit/risturnDeduction/commissionDeduction/netProfit/netMarginPct
// snapshot'ını taşır — burada bunları döneme kovalıyoruz.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §7 (Faz E)

import { prisma } from '../prismaClient';
import { periodKeyOf, type Grain } from './profitabilityRollup';

export type DmoGrain = 'MONTH' | 'QUARTER' | 'YEAR' | 'INSTITUTION';

// Değerlendirme dışı "gerçek" siparişler — kârlılık toplamı bunlar üzerinden.
const ACTIVE = new Set(['CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'INVOICED', 'CLOSED']);
const EXCLUDED = new Set(['REJECTED', 'CANCELLED']);

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DmoPeriodRow {
  periodKey: string;
  label: string;
  orderCount: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  risturn: number;
  commission: number;
  netProfit: number;
  netMarginPct: number;         // aggregate: netProfit / revenue
  unprofitableCount: number;
}

export interface DmoProfitResult {
  grain: DmoGrain;
  year: number | null;
  asOf: string;
  rows: DmoPeriodRow[];
  totals: Omit<DmoPeriodRow, 'periodKey' | 'label'>;
  pipeline: { evaluationCount: number; evaluationValue: number };  // EVALUATION statüsü — henüz kesinleşmemiş
  currency: string;
}

interface OrderLite {
  status: string; institutionName: string; orderDate: Date; costedAt: Date | null;
  revenueTotal: number; costTotal: number; grossProfit: number;
  risturnDeduction: number; commissionDeduction: number;
  netProfit: number; netMarginPct: number; isProfitable: boolean;
}

function bucketKey(o: OrderLite, grain: DmoGrain): { key: string; label: string } {
  if (grain === 'INSTITUTION') {
    const k = o.institutionName || '—';
    return { key: k, label: k };
  }
  const d = o.costedAt ?? o.orderDate;
  const k = periodKeyOf(d, grain as Grain);
  return { key: k, label: k };
}

const emptyAgg = (): Omit<DmoPeriodRow, 'periodKey' | 'label'> => ({
  orderCount: 0, revenue: 0, cost: 0, grossProfit: 0, risturn: 0, commission: 0,
  netProfit: 0, netMarginPct: 0, unprofitableCount: 0,
});

export async function getDmoProfitability(
  tenantId: string, opts: { grain?: DmoGrain; year?: number; asOf?: Date } = {},
): Promise<DmoProfitResult> {
  const grain: DmoGrain = opts.grain ?? 'QUARTER';
  const asOf = opts.asOf ?? new Date();

  const orders = await prisma.dmoOrder.findMany({
    where: { tenantId },
    select: {
      status: true, institutionName: true, orderDate: true, costedAt: true,
      revenueTotal: true, costTotal: true, grossProfit: true,
      risturnDeduction: true, commissionDeduction: true,
      netProfit: true, netMarginPct: true, isProfitable: true, currency: true,
    },
  });

  const currency = orders.find((o) => o.currency)?.currency || 'TRY';

  // Pipeline (değerlendirmedeki) — toplamların dışında ayrı gösterilir
  const evalOrders = orders.filter((o) => o.status === 'EVALUATION');
  const pipeline = {
    evaluationCount: evalOrders.length,
    evaluationValue: round2(evalOrders.reduce((s, o) => s + (o.revenueTotal || 0), 0)),
  };

  let active = orders.filter((o) => ACTIVE.has(o.status) && !EXCLUDED.has(o.status)) as OrderLite[];
  if (opts.year) {
    active = active.filter((o) => (o.costedAt ?? o.orderDate).getUTCFullYear() === opts.year);
  }

  const buckets = new Map<string, { label: string; agg: Omit<DmoPeriodRow, 'periodKey' | 'label'> }>();
  const totals = emptyAgg();

  for (const o of active) {
    const { key, label } = bucketKey(o, grain);
    let b = buckets.get(key);
    if (!b) { b = { label, agg: emptyAgg() }; buckets.set(key, b); }
    for (const target of [b.agg, totals]) {
      target.orderCount += 1;
      target.revenue += o.revenueTotal || 0;
      target.cost += o.costTotal || 0;
      target.grossProfit += o.grossProfit || 0;
      target.risturn += o.risturnDeduction || 0;
      target.commission += o.commissionDeduction || 0;
      target.netProfit += o.netProfit || 0;
      if (!o.isProfitable) target.unprofitableCount += 1;
    }
  }

  const rows: DmoPeriodRow[] = [...buckets.entries()].map(([periodKey, b]) => ({
    periodKey, label: b.label,
    orderCount: b.agg.orderCount,
    revenue: round2(b.agg.revenue), cost: round2(b.agg.cost), grossProfit: round2(b.agg.grossProfit),
    risturn: round2(b.agg.risturn), commission: round2(b.agg.commission),
    netProfit: round2(b.agg.netProfit),
    netMarginPct: b.agg.revenue > 0 ? round2((b.agg.netProfit / b.agg.revenue) * 100) : 0,
    unprofitableCount: b.agg.unprofitableCount,
  })).sort((a, b) => (grain === 'INSTITUTION' ? b.revenue - a.revenue : a.periodKey.localeCompare(b.periodKey)));

  return {
    grain, year: opts.year ?? null, asOf: asOf.toISOString(),
    rows,
    totals: {
      ...totals,
      revenue: round2(totals.revenue), cost: round2(totals.cost), grossProfit: round2(totals.grossProfit),
      risturn: round2(totals.risturn), commission: round2(totals.commission), netProfit: round2(totals.netProfit),
      netMarginPct: totals.revenue > 0 ? round2((totals.netProfit / totals.revenue) * 100) : 0,
    },
    pipeline,
    currency,
  };
}
