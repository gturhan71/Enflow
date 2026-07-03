import { prisma } from '../prismaClient';
import { computeCompanyOverhead, computeUnitParticipationLoad, projectMargins, OverheadMethod } from './financeEngine';

// İşletme maliyeti (overhead) orkestrasyonu — Faz 1: Katman-1 (şirket genel gider %).
// Katman-2 (birim iştirak katsayısı) Faz 2'de eklenecek (unitAmount şimdilik 0).

export interface UnitLoadLine { unitId: string; unitName: string; coefficient: number; periodCost: number; amount: number; }
export interface OverheadResult {
  directCost: number;
  method: OverheadMethod | null; rate: number; base: number;
  companyAmount: number; unitAmount: number; totalOverhead: number;
  unitBreakdown: UnitLoadLine[];
  contributionMargin: number; netMargin: number;
  applyOverhead: boolean; hasPool: boolean;
}

/** Bir birimin cari dönem maliyeti (en yeni UnitBudget.periodCost). */
async function unitPeriodCostMap(tenantId: string, unitIds: string[]): Promise<Record<string, number>> {
  if (!unitIds.length) return {};
  const budgets = await prisma.unitBudget.findMany({ where: { tenantId, unitId: { in: unitIds } }, orderBy: { periodStart: 'desc' } });
  const map: Record<string, number> = {};
  for (const b of budgets) if (map[b.unitId] === undefined) map[b.unitId] = b.periodCost || 0; // en yeni (desc) ilk
  return map;
}

/** Projenin direkt (overhead-dışı, reddedilmemiş) maliyeti — TRY. */
function directCostOf(items: { actualAmount: number; amountTRY: number; approvalStatus: string; category: string }[]): number {
  return items
    .filter(c => c.approvalStatus !== 'REJECTED' && c.category !== 'OVERHEAD')
    .reduce((s, c) => s + (c.amountTRY || c.actualAmount || 0), 0);
}

/** Cari ACTIVE işletme maliyeti havuzu (en yeni). */
export async function getActivePool(tenantId: string) {
  return prisma.operatingCostPool.findFirst({ where: { tenantId, status: 'ACTIVE' }, orderBy: { periodStart: 'desc' } });
}

/** Projeye Katman-1 overhead + marjları hesapla (persist etmez). rateOverride verilirse havuz oranı yerine kullanılır. */
export async function computeProjectOverhead(tenantId: string, projectId: string, rateOverride?: number): Promise<OverheadResult | null> {
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId }, include: { projectCostItems: true } });
  if (!project) return null;
  const pool = await getActivePool(tenantId);
  const directCost = directCostOf(project.projectCostItems);
  const value = project.totalValue || 0;

  const method = (pool?.method as OverheadMethod) || null;
  const rate = rateOverride != null ? rateOverride : (pool?.rate ?? 0);
  const base = method === 'PCT_OF_VALUE' ? value : directCost; // POOL_RATE & PCT_OF_DIRECT_COST → direkt maliyet tabanı
  const companyAmount = method ? computeCompanyOverhead(base, method, rate) : 0;

  // Katman 2 — birim iştirak katsayısı yükü
  const parts = await prisma.projectUnitParticipation.findMany({ where: { projectId }, include: { unit: { select: { name: true } } } });
  const periodCosts = await unitPeriodCostMap(tenantId, parts.map(p => p.unitId));
  const load = computeUnitParticipationLoad(parts.map(p => ({ unitId: p.unitId, coefficient: p.coefficient })), periodCosts);
  const unitBreakdown = load.breakdown.map(b => ({ ...b, unitName: parts.find(p => p.unitId === b.unitId)?.unit?.name || '—' }));
  const unitAmount = load.total;

  const totalOverhead = companyAmount + unitAmount;
  const m = projectMargins(value, directCost, totalOverhead);

  return {
    directCost, method, rate, base,
    companyAmount, unitAmount, totalOverhead, unitBreakdown,
    contributionMargin: m.contributionMargin,
    netMargin: m.netMargin,           // her zaman tam-yüklü (önizleme); uygulama durumu applyOverhead'te
    applyOverhead: project.applyOverhead, hasPool: !!pool,
  };
}

/** Yönetim insiyatifi: overhead uygula/kaldır + snapshot'ı projeye yaz. */
export async function applyProjectOverhead(tenantId: string, projectId: string, apply: boolean, rateOverride?: number): Promise<OverheadResult | null> {
  const r = await computeProjectOverhead(tenantId, projectId, rateOverride);
  if (!r) return null;
  const m = projectMargins((await prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { totalValue: true } }))?.totalValue || 0, r.directCost, r.totalOverhead);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      applyOverhead: apply,
      overheadAmount: r.totalOverhead,                 // hesaplanan (bilgi amaçlı, her durumda saklanır)
      netMargin: apply ? m.netMargin : m.contributionMargin,
    },
  });
  return { ...r, applyOverhead: apply, netMargin: apply ? m.netMargin : m.contributionMargin };
}
