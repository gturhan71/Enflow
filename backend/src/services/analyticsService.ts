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

// ── Weighted Forecast + Coverage · #1 ────────────────────────────────────────
// Olasılık-ağırlıklı pipeline (Σ value×probability/100) + hedefe (kota) kapsama oranı.
// Hedef Tenant.moduleSettings.salesTarget'ta tutulur (yeni model yok).
const OPEN_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION']);
export interface ForecastReport {
  rawPipeline: number; weightedPipeline: number; wonValue: number;
  target: number; coverage: number;
  byStage: { status: string; count: number; weighted: number }[];
}

export async function getSalesTarget(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  try { const n = Number((JSON.parse(t?.moduleSettings || '{}') as Record<string, unknown>).salesTarget); return Number.isFinite(n) ? n : 0; } catch { return 0; }
}

export async function computeForecast(tenantId: string): Promise<ForecastReport> {
  const opps = await prisma.opportunity.findMany({ where: { tenantId }, select: { value: true, probability: true, status: true } });
  const target = await getSalesTarget(tenantId);

  const open = opps.filter(o => OPEN_STATUSES.has(o.status));
  const rawPipeline = open.reduce((s, o) => s + (o.value || 0), 0);
  const weightedPipeline = open.reduce((s, o) => s + (o.value || 0) * ((o.probability || 0) / 100), 0);
  const wonValue = opps.filter(o => o.status === 'WON').reduce((s, o) => s + (o.value || 0), 0);

  const stageMap: Record<string, { count: number; weighted: number }> = {};
  for (const o of open) {
    if (!stageMap[o.status]) stageMap[o.status] = { count: 0, weighted: 0 };
    stageMap[o.status].count += 1;
    stageMap[o.status].weighted += (o.value || 0) * ((o.probability || 0) / 100);
  }
  const byStage = Object.entries(stageMap).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.weighted - a.weighted);

  return { rawPipeline, weightedPipeline, wonValue, target, coverage: target > 0 ? weightedPipeline / target : 0, byStage };
}

// ── Bid / No-Bid Skorkartı · #3 ──────────────────────────────────────────────
// Karar-öncesi ihaleleri (DRAFT|PREPARING) deterministik puanlar; şema değişmez.
// Faktörler: idare kazanma geçmişi · son teslim tarihine kalan · checklist hazırlığı ·
// değer uyumu (kazanılan medyana göre) + bağlı fırsatın İGPD agentTriage kademesi.
const DECISION_STATUSES = new Set(['DRAFT', 'PREPARING']);
export interface BidScoreLine {
  id: string; name: string; authority: string; estimatedValue: number; currency: string;
  deadline: string | null; daysLeft: number | null;
  score: number; recommendation: 'BID' | 'REVIEW' | 'NO_BID';
  factors: { authorityWinRate: number; deadline: number; readiness: number; valueFit: number };
  authorityWinPct: number | null; readinessPct: number; triageTier: string | null;
}
export interface BidScorecard {
  tenders: BidScoreLine[];
  summary: { total: number; bid: number; review: number; noBid: number; avgScore: number };
  note: string;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function computeBidScorecard(tenantId: string): Promise<BidScorecard> {
  const tenders = await prisma.tender.findMany({ where: { tenantId }, include: { checklist: true } });

  // İdare bazlı kazanma geçmişi (WON/LOST çözülmüş ihaleler)
  const winByAuth: Record<string, { won: number; lost: number }> = {};
  const wonValues: number[] = [];
  for (const t of tenders) {
    const auth = (t.authority || '—').trim() || '—';
    if (t.status === 'WON') { (winByAuth[auth] ??= { won: 0, lost: 0 }).won += 1; if (t.estimatedValue > 0) wonValues.push(t.estimatedValue); }
    else if (t.status === 'LOST') { (winByAuth[auth] ??= { won: 0, lost: 0 }).lost += 1; }
  }
  const medianWon = median(wonValues);

  // Bağlı fırsatların İGPD triyaj kademesi
  const oppIds = tenders.filter(t => t.opportunityId && DECISION_STATUSES.has(t.status)).map(t => t.opportunityId as string);
  const triageByOpp: Record<string, string> = {};
  if (oppIds.length) {
    const opps = await prisma.opportunity.findMany({ where: { tenantId, id: { in: oppIds } }, select: { id: true, agentTriage: true } });
    for (const o of opps) {
      try { const tier = (JSON.parse(o.agentTriage || '{}') as { igpd?: { valueTier?: string } }).igpd?.valueTier; if (tier) triageByOpp[o.id] = tier; }
      catch { /* yok say */ }
    }
  }

  const now = Date.now();
  const lines: BidScoreLine[] = [];
  for (const t of tenders.filter(x => DECISION_STATUSES.has(x.status))) {
    const auth = (t.authority || '—').trim() || '—';
    const hist = winByAuth[auth];
    const winPct = hist && (hist.won + hist.lost) > 0 ? hist.won / (hist.won + hist.lost) : null;
    const fAuthority = Math.round(winPct === null ? 15 : winPct * 30); // 0–30

    const daysLeft = t.submissionDeadline ? Math.ceil((new Date(t.submissionDeadline).getTime() - now) / 86400000) : null;
    const fDeadline = daysLeft === null ? 12 : daysLeft >= 14 ? 25 : daysLeft >= 7 ? 18 : daysLeft >= 3 ? 10 : daysLeft >= 0 ? 3 : 0; // 0–25

    const total = t.checklist.length;
    const done = t.checklist.filter(c => c.status === 'DONE' || c.status === 'WAIVED').length;
    const readinessPct = total > 0 ? done / total : 0;
    const fReadiness = total > 0 ? Math.round(readinessPct * 20) : 8; // 0–20

    let fValue: number; // 0–25
    if (t.estimatedValue <= 0) fValue = 6;
    else if (medianWon <= 0) fValue = 12;
    else { const r = t.estimatedValue / medianWon; fValue = r >= 0.5 && r <= 2 ? 25 : r >= 0.25 && r <= 4 ? 15 : 8; }

    const tier = t.opportunityId ? triageByOpp[t.opportunityId] ?? null : null;
    const tierAdj = tier === 'HIGH' ? 5 : tier === 'LOW' ? -5 : 0;

    const score = Math.max(0, Math.min(100, fAuthority + fDeadline + fReadiness + fValue + tierAdj));
    const recommendation: BidScoreLine['recommendation'] = score >= 65 ? 'BID' : score >= 45 ? 'REVIEW' : 'NO_BID';

    lines.push({
      id: t.id, name: t.name, authority: auth, estimatedValue: t.estimatedValue, currency: t.currency,
      deadline: t.submissionDeadline ? new Date(t.submissionDeadline).toISOString() : null, daysLeft,
      score, recommendation,
      factors: { authorityWinRate: fAuthority, deadline: fDeadline, readiness: fReadiness, valueFit: fValue },
      authorityWinPct: winPct, readinessPct, triageTier: tier,
    });
  }
  lines.sort((a, b) => b.score - a.score);

  const bid = lines.filter(l => l.recommendation === 'BID').length;
  const review = lines.filter(l => l.recommendation === 'REVIEW').length;
  const noBid = lines.filter(l => l.recommendation === 'NO_BID').length;
  const avgScore = lines.length ? Math.round(lines.reduce((s, l) => s + l.score, 0) / lines.length) : 0;

  return {
    tenders: lines,
    summary: { total: lines.length, bid, review, noBid, avgScore },
    note: 'Deterministik skor: idare kazanma geçmişi + son teslim tarihi + evrak hazırlığı + değer uyumu (kazanılan medyan) + İGPD triyaj kademesi. Karar-öncesi (DRAFT/PREPARING) ihaleler.',
  };
}

// ── Belge Portföyü · #11 ─────────────────────────────────────────────────────
// Şirket Evrakları (CorporateDocument) envanteri: kategori dağılımı + geçerlilik
// (süresi dolan/dolacak) + ihale checklist'lerinde yeniden-kullanım kaldıracı.
const EXPIRING_WINDOW_DAYS = 90;
export interface DocPortfolioLine {
  id: string; name: string; category: string; expiryDate: string | null;
  daysLeft: number | null; status: 'EXPIRED' | 'EXPIRING';
}
export interface DocumentPortfolio {
  summary: { total: number; valid: number; expiringSoon: number; expired: number; noExpiry: number; reuseCount: number };
  categories: { category: string; count: number }[];
  attention: DocPortfolioLine[];
  note: string;
}

export async function computeDocumentPortfolio(tenantId: string): Promise<DocumentPortfolio> {
  const docs = await prisma.corporateDocument.findMany({ where: { tenantId } });
  const reuseCount = await prisma.tenderChecklistItem.count({ where: { source: 'CORPORATE_DOC', tender: { tenantId } } });

  const now = Date.now();
  const soonCut = now + EXPIRING_WINDOW_DAYS * 86400000;
  let valid = 0, expiringSoon = 0, expired = 0, noExpiry = 0;
  const catMap: Record<string, number> = {};
  const attention: DocPortfolioLine[] = [];

  for (const d of docs) {
    catMap[d.category || '—'] = (catMap[d.category || '—'] || 0) + 1;
    if (!d.expiryDate) { noExpiry++; continue; }
    const exp = new Date(d.expiryDate).getTime();
    const daysLeft = Math.ceil((exp - now) / 86400000);
    if (exp < now) { expired++; attention.push({ id: d.id, name: d.name, category: d.category || '—', expiryDate: new Date(d.expiryDate).toISOString(), daysLeft, status: 'EXPIRED' }); }
    else if (exp <= soonCut) { expiringSoon++; attention.push({ id: d.id, name: d.name, category: d.category || '—', expiryDate: new Date(d.expiryDate).toISOString(), daysLeft, status: 'EXPIRING' }); }
    else { valid++; }
  }
  attention.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const categories = Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

  return {
    summary: { total: docs.length, valid, expiringSoon, expired, noExpiry, reuseCount },
    categories,
    attention,
    note: `Şirket Evrakları envanteri. Süresi ${EXPIRING_WINDOW_DAYS} gün içinde dolacak/dolmuş belgeler dikkat listesinde; yeniden-kullanım, ihale checklist'lerinde otomatik eşlenen evrak sayısıdır.`,
  };
}

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

// ── Kurumsal Kompozit Sağlık Skoru · #14a ────────────────────────────────────
// Mevcut analitik boyutlarını 5 sütuna toplayan tek iş-sağlığı skoru (0-100).
// Salt-okunur; alt-compute'ları yeniden kullanır + finans sinyalini yerinde hesaplar.
const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export interface HealthPillar { key: string; label: string; score: number; detail: string; }
export interface BusinessHealth {
  overall: number;
  status: 'GÜÇLÜ' | 'ORTA' | 'ZAYIF';
  pillars: HealthPillar[];
  weakest: string;
  note: string;
}

export async function computeBusinessHealth(tenantId: string): Promise<BusinessHealth> {
  const [funnel, tender, scorecard, conc, portfolio, forecast] = await Promise.all([
    computeFunnel(tenantId), computeTenderAnalytics(tenantId), computeBidScorecard(tenantId),
    computeConcentration(tenantId), computeDocumentPortfolio(tenantId), computeForecast(tenantId),
  ]);

  // Finans sinyali: açık SALES alacaklarında vadesi geçmiş oranı
  const invoices = await prisma.invoice.findMany({ where: { tenantId, type: 'SALES' }, select: { amount: true, paidAmount: true, status: true, dueDate: true } });
  const now = Date.now();
  const open = invoices.filter(i => i.status !== 'DRAFT' && i.status !== 'CANCELLED' && i.status !== 'PAID' && (i.amount - i.paidAmount) > 0);
  let totalReceivable = 0, overdueReceivable = 0;
  for (const i of open) {
    const rem = i.amount - i.paidAmount;
    totalReceivable += rem;
    if (i.dueDate && i.dueDate.getTime() < now) overdueReceivable += rem;
  }
  const overdueRatio = totalReceivable > 0 ? overdueReceivable / totalReceivable : 0;

  // 1) Satış — hedef varsa kapsama, yoksa huni dönüşümü (%25 dönüşüm = tam sağlık)
  const wonStage = funnel.stages.find(s => s.status === 'WON');
  const overallConv = funnel.entered > 0 && wonStage ? wonStage.count / funnel.entered : 0;
  const salesScore = forecast.target > 0 ? clampScore(Math.min(1, forecast.coverage) * 100) : clampScore(Math.min(1, overallConv / 0.25) * 100);

  // 2) İhale — kazanma oranı (0.6) + teklif hazırlığı (0.4)
  const hasTenderHistory = tender.overall.wonCount + tender.overall.lostCount > 0;
  const tenderScore = hasTenderHistory
    ? clampScore(0.6 * tender.overall.winRate * 100 + 0.4 * scorecard.summary.avgScore)
    : clampScore(scorecard.summary.total > 0 ? scorecard.summary.avgScore : 50);

  // 3) Finans — vadesi geçmiş oranı cezası
  const financeScore = totalReceivable > 0 ? clampScore(100 - overdueRatio * 70) : 70;

  // 4) Müşteri — yoğunlaşma (HHI) + kamu bağımlılığı cezası
  const customerScore = conc.customerCount > 0 ? clampScore(100 - (conc.hhi / 10000) * 70 - conc.publicPct * 30) : 60;

  // 5) Uyum — belge geçerliliği (süresi dolmuş/dolacak cezası)
  const dt = portfolio.summary.total;
  const complianceScore = dt > 0 ? clampScore(100 - (portfolio.summary.expired / dt) * 70 - (portfolio.summary.expiringSoon / dt) * 25) : 60;

  const pillars: (HealthPillar & { weight: number })[] = [
    { key: 'sales', label: 'Satış', score: salesScore, weight: 0.25, detail: forecast.target > 0 ? `Hedef kapsama %${Math.round(forecast.coverage * 100)}` : `Huni dönüşümü %${Math.round(overallConv * 100)}` },
    { key: 'tender', label: 'İhale', score: tenderScore, weight: 0.20, detail: hasTenderHistory ? `Kazanma %${Math.round(tender.overall.winRate * 100)} · hazırlık ${scorecard.summary.avgScore}` : 'Geçmiş yok · hazırlık bazlı' },
    { key: 'finance', label: 'Finans', score: financeScore, weight: 0.25, detail: totalReceivable > 0 ? `Vadesi geçmiş alacak %${Math.round(overdueRatio * 100)}` : 'Açık alacak yok' },
    { key: 'customer', label: 'Müşteri', score: customerScore, weight: 0.15, detail: `HHI ${conc.hhi} · kamu %${Math.round(conc.publicPct * 100)}` },
    { key: 'compliance', label: 'Uyum', score: complianceScore, weight: 0.15, detail: dt > 0 ? `${portfolio.summary.expired} dolmuş · ${portfolio.summary.expiringSoon} dolacak` : 'Belge yok' },
  ];

  const overall = clampScore(pillars.reduce((s, p) => s + p.score * p.weight, 0));
  const status: BusinessHealth['status'] = overall >= 75 ? 'GÜÇLÜ' : overall >= 55 ? 'ORTA' : 'ZAYIF';
  const weakest = pillars.reduce((a, b) => (b.score < a.score ? b : a)).label;

  return {
    overall, status,
    pillars: pillars.map(({ weight, ...p }) => { void weight; return p; }),
    weakest,
    note: 'Kompozit skor: Satış (25%) · İhale (20%) · Finans (25%) · Müşteri (15%) · Uyum (15%). Alt-analitiklerden türetilir; deterministik.',
  };
}

// ── Proje Sağlık Skoru · #14b ────────────────────────────────────────────────
// Aktif projelerin (PLANNING|IN_PROGRESS|ON_HOLD) marj/takvim/bütçe sağlığı.
const ACTIVE_PROJECT_STATUSES = new Set(['PLANNING', 'IN_PROGRESS', 'ON_HOLD']);
export interface ProjectHealthLine {
  id: string; code: string | null; name: string;
  score: number; status: 'CRITICAL' | 'WATCH' | 'HEALTHY';
  actualMarginPct: number; overdueMilestones: number; milestoneCount: number;
  budgetUsedPct: number; progress: number; deadlineRisk: boolean;
  factors: { margin: number; schedule: number; budget: number };
}
export interface ProjectHealthReport {
  projects: ProjectHealthLine[];
  summary: { total: number; critical: number; watch: number; healthy: number; avgScore: number };
  note: string;
}

export async function computeProjectHealth(tenantId: string): Promise<ProjectHealthReport> {
  const projects = await prisma.project.findMany({
    where: { tenantId },
    include: { milestones: true, projectCostItems: true },
  });
  const now = Date.now();
  const lines: ProjectHealthLine[] = [];

  for (const p of projects.filter(x => ACTIVE_PROJECT_STATUSES.has(x.status))) {
    const actualCost = p.projectCostItems.filter(c => c.approvalStatus !== 'REJECTED').reduce((s, c) => s + (c.actualAmount || 0), 0);
    const contractValue = p.totalValue || 0;

    // Marj: sözleşme değerine göre gerçek marj
    const actualMargin = contractValue > 0 ? (contractValue - actualCost) / contractValue : 0;
    const fMargin = contractValue > 0 ? clampScore(Math.min(1, Math.max(0, actualMargin / 0.20)) * 100) : 50;

    // Takvim: geciken milestone oranı + proje son tarihi riski
    const msCount = p.milestones.length;
    const overdue = p.milestones.filter(m => m.plannedEnd && m.plannedEnd.getTime() < now && m.status !== 'COMPLETED' && m.status !== 'CANCELLED').length;
    const projDeadline = p.deadline || p.plannedEndDate;
    const deadlineRisk = !!(projDeadline && projDeadline.getTime() < now && p.status !== 'COMPLETED');
    let fSchedule = msCount > 0 ? clampScore(100 - (overdue / msCount) * 100) : 60;
    if (deadlineRisk) fSchedule = Math.min(fSchedule, 40);

    // Bütçe: gerçek maliyet / bütçe (aşım cezası)
    const overrun = p.budgetTotal > 0 ? actualCost / p.budgetTotal : 0;
    const fBudget = p.budgetTotal > 0 ? (overrun <= 1 ? 100 : clampScore(100 - (overrun - 1) * 100)) : 60;

    const score = clampScore(0.4 * fMargin + 0.35 * fSchedule + 0.25 * fBudget);
    const status: ProjectHealthLine['status'] = score < 40 ? 'CRITICAL' : score < 70 ? 'WATCH' : 'HEALTHY';

    lines.push({
      id: p.id, code: p.code, name: p.name,
      score, status,
      actualMarginPct: actualMargin, overdueMilestones: overdue, milestoneCount: msCount,
      budgetUsedPct: overrun, progress: p.progress || 0, deadlineRisk,
      factors: { margin: fMargin, schedule: fSchedule, budget: fBudget },
    });
  }
  lines.sort((a, b) => a.score - b.score); // en riskli önce

  const critical = lines.filter(l => l.status === 'CRITICAL').length;
  const watch = lines.filter(l => l.status === 'WATCH').length;
  const healthy = lines.filter(l => l.status === 'HEALTHY').length;
  const avgScore = lines.length ? Math.round(lines.reduce((s, l) => s + l.score, 0) / lines.length) : 0;

  return {
    projects: lines,
    summary: { total: lines.length, critical, watch, healthy, avgScore },
    note: 'Aktif proje sağlığı: Marj (40%, sözleşme değeri vs gerçek maliyet) · Takvim (35%, geciken milestone + son tarih riski) · Bütçe (25%, aşım). Deterministik.',
  };
}

// ── Müşteri Sağlık Skoru · #14c ──────────────────────────────────────────────
// Müşteri bazında ödeme davranışı + kazanma oranı + aktivite + sadakat/kayıp.
export interface CustomerHealthLine {
  id: string; name: string;
  score: number; status: 'LOYAL' | 'STABLE' | 'AT_RISK';
  wonRevenue: number; openPipeline: number; winPct: number | null;
  overdueAmount: number; lastActivityDays: number | null; oppCount: number;
  factors: { payment: number; winRate: number; activity: number; loyalty: number };
}
export interface CustomerHealthReport {
  customers: CustomerHealthLine[];
  summary: { total: number; loyal: number; stable: number; atRisk: number; avgScore: number };
  note: string;
}

export async function computeCustomerHealth(tenantId: string): Promise<CustomerHealthReport> {
  const [customers, opps, invoices] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.opportunity.findMany({ where: { tenantId }, select: { customerId: true, value: true, status: true, updatedAt: true } }),
    prisma.invoice.findMany({ where: { tenantId, type: 'SALES' }, select: { customerName: true, amount: true, paidAmount: true, status: true, dueDate: true } }),
  ]);

  const now = Date.now();
  const oppsByCust = new Map<string, typeof opps>();
  for (const o of opps) { const a = oppsByCust.get(o.customerId) || []; a.push(o); oppsByCust.set(o.customerId, a); }

  // Fatura → müşteri adı eşleşmesi (Invoice'ta customerId FK yok)
  const recByName = new Map<string, { overdue: number; open: number }>();
  for (const inv of invoices) {
    const name = (inv.customerName || '').trim();
    if (!name) continue;
    const rem = inv.amount - inv.paidAmount;
    if (inv.status === 'DRAFT' || inv.status === 'CANCELLED' || inv.status === 'PAID' || rem <= 0) continue;
    const cur = recByName.get(name) || { overdue: 0, open: 0 };
    cur.open += rem;
    if (inv.dueDate && inv.dueDate.getTime() < now) cur.overdue += rem;
    recByName.set(name, cur);
  }

  const lines: CustomerHealthLine[] = [];
  for (const c of customers) {
    const co = oppsByCust.get(c.id) || [];
    const rec = recByName.get(c.name.trim());
    if (co.length === 0 && !rec) continue; // aktivitesi olmayan müşteriyi atla

    const won = co.filter(o => o.status === 'WON');
    const lost = co.filter(o => o.status === 'LOST');
    const open = co.filter(o => !['WON', 'LOST', 'WITHDRAWN'].includes(o.status));
    const wonRevenue = won.reduce((s, o) => s + (o.value || 0), 0);
    const openPipeline = open.reduce((s, o) => s + (o.value || 0), 0);
    const resolved = won.length + lost.length;
    const winPct = resolved > 0 ? won.length / resolved : null;

    // Ödeme (0.35) — vadesi geçmiş oranı
    const overdueAmount = rec?.overdue || 0;
    const openReceivable = rec?.open || 0;
    const overdueRatio = openReceivable > 0 ? overdueAmount / openReceivable : 0;
    const fPayment = rec ? clampScore(100 - overdueRatio * 100) : 70;

    // Kazanma (0.30)
    const fWin = winPct === null ? 50 : clampScore(winPct * 100);

    // Aktivite (0.20) — son fırsat güncellemesi tazeliği (90g tam → 365g sıfır)
    const lastAt = co.length ? Math.max(...co.map(o => o.updatedAt.getTime())) : null;
    const lastActivityDays = lastAt ? Math.floor((now - lastAt) / 86400000) : null;
    const fActivity = lastActivityDays === null ? 40 : lastActivityDays <= 90 ? 100 : clampScore(100 - ((lastActivityDays - 90) / 275) * 100);

    // Sadakat (0.15) — kayıp sıklığı + kazanılmış gelir varlığı
    const lossRatio = co.length > 0 ? lost.length / co.length : 0;
    const fLoyalty = clampScore(100 - lossRatio * 100 + (wonRevenue > 0 ? 10 : 0));

    const score = clampScore(0.35 * fPayment + 0.30 * fWin + 0.20 * fActivity + 0.15 * fLoyalty);
    const status: CustomerHealthLine['status'] = score >= 70 ? 'LOYAL' : score >= 45 ? 'STABLE' : 'AT_RISK';

    lines.push({
      id: c.id, name: c.name,
      score, status,
      wonRevenue, openPipeline, winPct,
      overdueAmount, lastActivityDays, oppCount: co.length,
      factors: { payment: fPayment, winRate: fWin, activity: fActivity, loyalty: fLoyalty },
    });
  }
  lines.sort((a, b) => a.score - b.score); // en riskli önce

  const loyal = lines.filter(l => l.status === 'LOYAL').length;
  const stable = lines.filter(l => l.status === 'STABLE').length;
  const atRisk = lines.filter(l => l.status === 'AT_RISK').length;
  const avgScore = lines.length ? Math.round(lines.reduce((s, l) => s + l.score, 0) / lines.length) : 0;

  return {
    customers: lines,
    summary: { total: lines.length, loyal, stable, atRisk, avgScore },
    note: 'Müşteri sağlığı: Ödeme (35%, vadesi geçmiş alacak) · Kazanma (30%) · Aktivite (20%, son fırsat tazeliği) · Sadakat (15%, kayıp sıklığı). Fatura eşleşmesi müşteri adına göre. Deterministik.',
  };
}
