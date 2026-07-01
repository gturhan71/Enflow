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
