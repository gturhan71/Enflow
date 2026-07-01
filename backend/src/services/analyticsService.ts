// Enflow — Büyüme Analitiği Faz 1 servis katmanı (salt-okunur, tenant-scoped).
// Route'lar ince kalsın diye hesap mantığı burada. Yeni transaction YOK.
import { prisma } from '../prismaClient';

// ── Funnel (dönüşüm hunisi) · #2 ──────────────────────────────────────────────
// Opportunity.status ilerleme sırası. LOST/WITHDRAWN huni-dışı (terminal):
// LOST → lossByReason'a, WITHDRAWN → yönetim kararı (pipeline'a hiç girmemiş sayılır).
const FUNNEL_STAGES: { status: string; label: string }[] = [
  { status: 'NEW', label: 'Yeni' },
  { status: 'CONTACTED', label: 'İletişim' },
  { status: 'QUALIFIED', label: 'Nitelikli' },
  { status: 'PROPOSAL', label: 'Teklif' },
  { status: 'NEGOTIATION', label: 'Pazarlık' },
  { status: 'WON', label: 'Kazanıldı' },
];
const RANK: Record<string, number> = Object.fromEntries(FUNNEL_STAGES.map((s, i) => [s.status, i]));

export interface FunnelResult {
  stages: { name: string; status: string; count: number; conversionToNext: number | null }[];
  lossByReason: { reason: string; count: number; value: number }[];
  entered: number;
}

export async function computeFunnel(tenantId: string): Promise<FunnelResult> {
  const opps = await prisma.opportunity.findMany({
    where: { tenantId },
    select: { status: true, value: true, lostReason: true },
  });

  // Huni: aktif ilerleme aşamalarındaki + kazanılan fırsatlar (LOST/WITHDRAWN hariç).
  const inFunnel = opps.filter((o) => o.status in RANK);
  const reached = FUNNEL_STAGES.map((_, r) => inFunnel.filter((o) => RANK[o.status] >= r).length);

  const stages = FUNNEL_STAGES.map((s, i) => ({
    name: s.label,
    status: s.status,
    count: reached[i],
    conversionToNext: i < FUNNEL_STAGES.length - 1 ? (reached[i] > 0 ? reached[i + 1] / reached[i] : 0) : null,
  }));

  // Kayıp nedenleri (unitReportingService gruplama deseni)
  const lost = opps.filter((o) => o.status === 'LOST');
  const byReason: Record<string, { count: number; value: number }> = {};
  for (const o of lost) {
    const r = o.lostReason || 'Belirtilmemiş';
    if (!byReason[r]) byReason[r] = { count: 0, value: 0 };
    byReason[r].count += 1;
    byReason[r].value += o.value || 0;
  }
  const lossByReason = Object.entries(byReason)
    .map(([reason, v]) => ({ reason, count: v.count, value: v.value }))
    .sort((a, b) => b.count - a.count);

  return { stages, lossByReason, entered: inFunnel.length };
}

// ── Tender Kazanma Kırılımı · #4 ──────────────────────────────────────────────
export interface TenderGroup { key: string; won: number; lost: number; winRate: number; wonValue: number; total: number }
export interface TenderAnalytics {
  byAuthority: TenderGroup[];
  byMethod: TenderGroup[];
  overall: { winRate: number; wonValue: number; lostValue: number; activePipeline: number; avgBidValue: number; wonCount: number; lostCount: number };
}

export async function computeTenderAnalytics(tenantId: string): Promise<TenderAnalytics> {
  const tenders = await prisma.tender.findMany({
    where: { tenantId },
    select: { status: true, authority: true, method: true, estimatedValue: true },
  });

  const group = (keyOf: (t: typeof tenders[number]) => string): TenderGroup[] => {
    const m: Record<string, { won: number; lost: number; wonValue: number; total: number }> = {};
    for (const t of tenders) {
      const k = keyOf(t) || 'Belirtilmemiş';
      if (!m[k]) m[k] = { won: 0, lost: 0, wonValue: 0, total: 0 };
      m[k].total += 1;
      if (t.status === 'WON') { m[k].won += 1; m[k].wonValue += t.estimatedValue || 0; }
      else if (t.status === 'LOST') m[k].lost += 1;
    }
    return Object.entries(m)
      .map(([key, v]) => ({ key, won: v.won, lost: v.lost, wonValue: v.wonValue, total: v.total, winRate: (v.won + v.lost) > 0 ? v.won / (v.won + v.lost) : 0 }))
      .sort((a, b) => b.total - a.total);
  };

  const won = tenders.filter(t => t.status === 'WON');
  const lost = tenders.filter(t => t.status === 'LOST');
  const active = tenders.filter(t => t.status === 'SUBMITTED' || t.status === 'EVALUATING');
  const wonValue = won.reduce((s, t) => s + (t.estimatedValue || 0), 0);
  const lostValue = lost.reduce((s, t) => s + (t.estimatedValue || 0), 0);
  const decided = won.length + lost.length;

  return {
    byAuthority: group(t => t.authority ?? ''),
    byMethod: group(t => t.method ?? ''),
    overall: {
      winRate: decided > 0 ? won.length / decided : 0,
      wonValue,
      lostValue,
      activePipeline: active.reduce((s, t) => s + (t.estimatedValue || 0), 0),
      avgBidValue: tenders.length > 0 ? tenders.reduce((s, t) => s + (t.estimatedValue || 0), 0) / tenders.length : 0,
      wonCount: won.length,
      lostCount: lost.length,
    },
  };
}

// ── BoM Maliyet Varyansı · #7 ─────────────────────────────────────────────────
// Teklif-anı BoM maliyeti (seçili BoMLineQuote ya da BoMItem.purchaseCost × adet) vs
// gerçekleşen proje maliyeti (ProjectCostItem.actualAmount). Granülerlik OPPORTUNITY/
// PROJE seviyesinde: ProjectCostItem satırları BoM lineKey'e bağlı olmadığından
// (serbest-metin) satır-bazı fx/tedarikçi ayrımı yapılamaz → o alanlar future (bkz. NOT).
export interface BomVarianceLine { name: string; quoted: number; actual: number; variance: number; variancePct: number }
export interface BomVarianceReport { lines: BomVarianceLine[]; marginErosionPct: number; note: string }

export async function computeBomVariance(tenantId: string): Promise<BomVarianceReport> {
  const opps = await prisma.opportunity.findMany({ where: { tenantId }, select: { id: true, title: true } });
  const oppIds = opps.map(o => o.id);
  if (oppIds.length === 0) return { lines: [], marginErosionPct: 0, note: NOTE };

  const [bomItems, quotes, projects] = await Promise.all([
    prisma.boMItem.findMany({ where: { opportunityId: { in: oppIds } }, select: { opportunityId: true, lineKey: true, quantity: true, purchaseCost: true } }),
    prisma.boMLineQuote.findMany({ where: { opportunityId: { in: oppIds }, isSelected: true }, select: { opportunityId: true, lineKey: true, unitPrice: true } }),
    prisma.project.findMany({ where: { tenantId, opportunityId: { in: oppIds } }, select: { opportunityId: true, projectCostItems: { select: { actualAmount: true } } } }),
  ]);

  // opportunityId → seçili teklif birim fiyatı (lineKey bazında)
  const selByOppLine = new Map<string, number>();
  for (const q of quotes) selByOppLine.set(`${q.opportunityId}|${q.lineKey ?? ''}`, q.unitPrice);
  // opportunityId → gerçekleşen toplam
  const actualByOpp = new Map<string, number>();
  for (const p of projects) if (p.opportunityId) actualByOpp.set(p.opportunityId, (p.projectCostItems ?? []).reduce((s, c) => s + (c.actualAmount || 0), 0));
  // opportunityId → teklif (quoted) toplam
  const quotedByOpp = new Map<string, number>();
  for (const b of bomItems) {
    const unit = selByOppLine.get(`${b.opportunityId}|${b.lineKey ?? ''}`) ?? b.purchaseCost;
    quotedByOpp.set(b.opportunityId, (quotedByOpp.get(b.opportunityId) || 0) + unit * b.quantity);
  }

  const lines: BomVarianceLine[] = [];
  let totalQuoted = 0, totalActual = 0;
  for (const o of opps) {
    const quoted = quotedByOpp.get(o.id) || 0;
    const actual = actualByOpp.get(o.id) || 0;
    if (quoted === 0 && actual === 0) continue;
    const variance = actual - quoted;
    lines.push({ name: o.title, quoted, actual, variance, variancePct: quoted > 0 ? variance / quoted : 0 });
    totalQuoted += quoted; totalActual += actual;
  }

  lines.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  return { lines, marginErosionPct: totalQuoted > 0 ? (totalActual - totalQuoted) / totalQuoted : 0, note: NOTE };
}
const NOTE = 'Varyans proje/fırsat seviyesindedir; döviz/tedarikçi ayrımı satır-bazlı gerçekleşen maliyet (lineKey bağı) gerektirir — ileri faz.';

// ── Müşteri & Kamu Konsantrasyonu · #12 ──────────────────────────────────────
// Kazanılan (WON) gelir üzerinden müşteri yoğunlaşması (HHI + top-N) + kamu payı.
// Kamu payı best-effort: müşteri adı/sektörü kamu terimleri içeriyor mu (heuristik, note).
const PUBLIC_RE = /bakanlı|beledi|genel müdürl|müdürlüğü|kamu|üniversite|hastane|il özel|valilik|başkanlığ|müsteşarl|kaymakam/i;
export interface ConcentrationReport {
  topCustomers: { name: string; revenue: number; sharePct: number; isPublic: boolean }[];
  hhi: number; top1Pct: number; top3Pct: number;
  totalRevenue: number; customerCount: number;
  publicPct: number; note: string;
}

export async function computeConcentration(tenantId: string): Promise<ConcentrationReport> {
  const won = await prisma.opportunity.findMany({
    where: { tenantId, status: 'WON' },
    select: { value: true, customer: { select: { name: true, industry: true } } },
  });

  const byCustomer = new Map<string, { revenue: number; isPublic: boolean }>();
  let total = 0;
  for (const o of won) {
    const name = o.customer?.name || 'Bilinmeyen';
    const isPublic = PUBLIC_RE.test(name) || PUBLIC_RE.test(o.customer?.industry || '');
    const cur = byCustomer.get(name) || { revenue: 0, isPublic };
    cur.revenue += o.value || 0; cur.isPublic = cur.isPublic || isPublic;
    byCustomer.set(name, cur);
    total += o.value || 0;
  }
  const T = total || 1;

  const rows = [...byCustomer.entries()]
    .map(([name, v]) => ({ name, revenue: v.revenue, sharePct: v.revenue / T, isPublic: v.isPublic }))
    .sort((a, b) => b.revenue - a.revenue);

  const hhi = Math.round(rows.reduce((s, r) => s + Math.pow(r.sharePct * 100, 2), 0));
  const publicRev = rows.filter(r => r.isPublic).reduce((s, r) => s + r.revenue, 0);

  return {
    topCustomers: rows.slice(0, 8),
    hhi,
    top1Pct: rows[0]?.sharePct ?? 0,
    top3Pct: rows.slice(0, 3).reduce((s, r) => s + r.sharePct, 0),
    totalRevenue: total,
    customerCount: rows.length,
    publicPct: publicRev / T,
    note: 'Kamu payı, müşteri adı/sektör metnindeki kamu terimlerinden türetilir (heuristik). HHI 0–10000; >2500 yüksek yoğunlaşma.',
  };
}
