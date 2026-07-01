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
