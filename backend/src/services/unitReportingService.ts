import { prisma } from '../prismaClient';

// ── Birim sözlüğü ────────────────────────────────────────────────────────────
// Her operasyonel birim: key (rapor/route anahtarı), label (TR etiket),
// role (ApprovalChain/ROLE_LABELS ile hizalı sorumlu rol).
export interface UnitDefinition {
  key: string;
  label: string;
  role: string;
}

export const UNIT_DEFINITIONS: UnitDefinition[] = [
  { key: 'CRM', label: 'CRM / Satış', role: 'SALES_MGR' },
  { key: 'PRESALES', label: 'Presales / Teknik', role: 'PRESALES_MGR' },
  { key: 'PROCUREMENT', label: 'Satınalma', role: 'PROCUREMENT_MGR' },
  { key: 'FINANCE', label: 'Finans', role: 'FINANCE_MGR' },
  { key: 'LEGAL', label: 'Hukuk', role: 'LEGAL_MGR' },
  { key: 'TENDER', label: 'İhale / İSAB', role: 'ISAB_MGR' },
  { key: 'PROJECT', label: 'Proje Yönetimi', role: 'PROJECT_MGR' },
];

export function getUnitDefinition(unitKey: string): UnitDefinition | undefined {
  return UNIT_DEFINITIONS.find(u => u.key === unitKey);
}

// ── Dönem yardımcıları ───────────────────────────────────────────────────────
export interface Period {
  start: Date;
  end: Date;
}

/** Verilmeyen tarihler için içinde bulunulan ayı varsayılan döner.
 *  Dönem sonu tarih-only/gün-başı (00:00) verildiğinde o günün SONUNA (23:59:59.999)
 *  çekilir → son günün verisi kapsam dışı kalmaz (kapsayıcı dönem-sonu). */
export function resolvePeriod(startStr?: string, endStr?: string): Period {
  const now = new Date();
  const start = startStr ? new Date(startStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  let end: Date;
  if (endStr) {
    end = new Date(endStr);
    if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0) {
      end.setUTCHours(23, 59, 59, 999); // gün-başı → gün-sonu (kapsayıcı)
    }
  } else {
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return { start, end };
}

// ── Tek metrik kayıt tipi (UI kartları için ortak şekil) ─────────────────────
export interface Metric {
  label: string;
  value: number | string;
  unit?: string;          // ₺, %, adet...
  hint?: string;          // ek açıklama
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface ChartSeries {
  title: string;
  type: 'bar' | 'pie' | 'line';
  data: { name: string; value: number }[];
}

export interface UnitMetricsResult {
  unitKey: string;
  label: string;
  role: string;
  period: { start: string; end: string };
  metrics: Metric[];
  charts: ChartSeries[];
}

const fmt = (n: number) => Math.round(n * 100) / 100;

// ── CRM / Satış ──────────────────────────────────────────────────────────────
async function crmMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const opened = await prisma.opportunity.findMany({
    where: { tenantId, createdAt: { gte: p.start, lte: p.end } },
  });
  const wonInPeriod = await prisma.opportunity.findMany({
    where: { tenantId, status: 'WON', updatedAt: { gte: p.start, lte: p.end } },
  });
  const lostInPeriod = await prisma.opportunity.findMany({
    where: { tenantId, status: 'LOST', updatedAt: { gte: p.start, lte: p.end } },
  });
  const openPipeline = await prisma.opportunity.findMany({
    where: { tenantId, status: { notIn: ['WON', 'LOST'] } },
  });

  const pipelineValue = openPipeline.reduce((s, o) => s + (o.value || 0), 0);
  const wonValue = wonInPeriod.reduce((s, o) => s + (o.value || 0), 0);
  const lostValue = lostInPeriod.reduce((s, o) => s + (o.value || 0), 0);
  const decided = wonInPeriod.length + lostInPeriod.length;
  const winRate = decided > 0 ? (wonInPeriod.length / decided) * 100 : 0;

  // En sık kayıp nedenleri
  const reasonCounts: Record<string, number> = {};
  for (const o of lostInPeriod) {
    const r = o.lostReason || 'Belirtilmemiş';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  }

  const metrics: Metric[] = [
    { label: 'Açılan Fırsat', value: opened.length, unit: 'adet' },
    { label: 'Kazanılan', value: wonInPeriod.length, unit: 'adet', tone: 'positive' },
    { label: 'Kaybedilen', value: lostInPeriod.length, unit: 'adet', tone: lostInPeriod.length > 0 ? 'warning' : 'default' },
    { label: 'Kazanım Oranı', value: fmt(winRate), unit: '%', tone: winRate >= 50 ? 'positive' : 'default' },
    { label: 'Açık Pipeline Değeri', value: fmt(pipelineValue), unit: '₺' },
    { label: 'Kazanılan Değer', value: fmt(wonValue), unit: '₺', tone: 'positive' },
    { label: 'Kaybedilen Değer', value: fmt(lostValue), unit: '₺', tone: lostValue > 0 ? 'danger' : 'default' },
  ];

  const charts: ChartSeries[] = [
    {
      title: 'Fırsat Sonuçları (dönem)',
      type: 'bar',
      data: [
        { name: 'Açılan', value: opened.length },
        { name: 'Kazanılan', value: wonInPeriod.length },
        { name: 'Kaybedilen', value: lostInPeriod.length },
      ],
    },
  ];
  if (Object.keys(reasonCounts).length > 0) {
    charts.push({
      title: 'Kayıp Nedenleri',
      type: 'pie',
      data: Object.entries(reasonCounts).map(([name, value]) => ({ name, value })),
    });
  }
  return { metrics, charts };
}

// ── Presales / Teknik ──────────────────────────────────────────────────────
async function presalesMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const proposals = await prisma.proposal.findMany({
    where: { tenantId, createdAt: { gte: p.start, lte: p.end } },
  });
  const byStatus: Record<string, number> = {};
  for (const pr of proposals) byStatus[pr.status] = (byStatus[pr.status] || 0) + 1;

  // BoM kalemleri (dönemde oluşturulan)
  const bomItems = await prisma.boMItem.findMany({
    where: { opportunity: { tenantId }, createdAt: { gte: p.start, lte: p.end } },
  });
  const avgMargin = bomItems.length > 0
    ? bomItems.reduce((s, b) => s + (b.marginPercentage || 0), 0) / bomItems.length
    : 0;

  const metrics: Metric[] = [
    { label: 'Teklif (dönem)', value: proposals.length, unit: 'adet' },
    { label: 'Taslak', value: byStatus['DRAFT'] || 0, unit: 'adet' },
    { label: 'Gönderilen', value: byStatus['SENT'] || 0, unit: 'adet' },
    { label: 'Kabul Edilen', value: byStatus['ACCEPTED'] || 0, unit: 'adet', tone: 'positive' },
    { label: 'BoM Kalemi', value: bomItems.length, unit: 'adet' },
    { label: 'Ortalama Marj', value: fmt(avgMargin), unit: '%', tone: avgMargin >= 20 ? 'positive' : 'default' },
  ];
  const charts: ChartSeries[] = [{
    title: 'Teklif Durum Dağılımı',
    type: 'pie',
    data: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
  }];
  return { metrics, charts };
}

// ── Satınalma ────────────────────────────────────────────────────────────────
async function procurementMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const prs = await prisma.purchaseRequest.findMany({
    where: { tenantId, createdAt: { gte: p.start, lte: p.end } },
  });
  const byStatus: Record<string, number> = {};
  for (const r of prs) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  const poIssued = prs.filter(r => r.poNumber);
  const poValue = poIssued.reduce((s, r) => s + (r.budgetAmountTRY || r.budgetAmount || 0), 0);
  const deliveries = await prisma.deliveryRecord.count({
    where: { purchaseRequest: { tenantId }, createdAt: { gte: p.start, lte: p.end } },
  });
  const pendingApprovals = prs.filter(r =>
    ['PENDING_UNIT', 'PENDING_PROCUREMENT', 'PENDING_GM'].includes(r.status)
  ).length;

  const metrics: Metric[] = [
    { label: 'Talep (dönem)', value: prs.length, unit: 'adet' },
    { label: 'PO Çıkarılan', value: poIssued.length, unit: 'adet' },
    { label: 'PO Değeri', value: fmt(poValue), unit: '₺' },
    { label: 'Teslimat', value: deliveries, unit: 'adet' },
    { label: 'Bekleyen Onay', value: pendingApprovals, unit: 'adet', tone: pendingApprovals > 0 ? 'warning' : 'default' },
  ];
  const charts: ChartSeries[] = [{
    title: 'Talep Statü Dağılımı',
    type: 'bar',
    data: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
  }];
  return { metrics, charts };
}

// ── Finans (finance.ts /summary genelleştirilmiş) ────────────────────────────
async function financeMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const now = new Date();
  const salesInvoices = await prisma.invoice.findMany({
    where: { tenantId, type: 'SALES', issueDate: { gte: p.start, lte: p.end } },
  });
  const allOpenSales = await prisma.invoice.findMany({
    where: { tenantId, type: 'SALES', status: { notIn: ['CANCELLED', 'DRAFT'] } },
  });

  const issuedCount = salesInvoices.length;
  const issuedAmount = salesInvoices.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = allOpenSales.reduce((s, i) => s + Math.max(0, i.amount - i.paidAmount), 0);
  const totalCollected = allOpenSales.reduce((s, i) => s + i.paidAmount, 0);
  const overdue = allOpenSales
    .filter(i => i.dueDate && new Date(i.dueDate) < now && i.paidAmount < i.amount)
    .reduce((s, i) => s + Math.max(0, i.amount - i.paidAmount), 0);

  const in30 = new Date(now.getTime() + 30 * 86400000);
  const activeGuarantees = await prisma.guaranteeLetter.count({ where: { tenantId, status: 'ACTIVE' } });
  const expiringGuarantees = await prisma.guaranteeLetter.count({
    where: { tenantId, status: 'ACTIVE', expiryDate: { lte: in30, gte: now } },
  });
  const pendingCostApprovals = await prisma.projectCostItem.count({
    where: { project: { tenantId }, approvalStatus: 'PENDING' },
  });

  const metrics: Metric[] = [
    { label: 'Kesilen Fatura', value: issuedCount, unit: 'adet', hint: 'dönem' },
    { label: 'Faturalanan Tutar', value: fmt(issuedAmount), unit: '₺', hint: 'dönem' },
    { label: 'Toplam Alacak', value: fmt(totalReceivable), unit: '₺' },
    { label: 'Tahsil Edilen', value: fmt(totalCollected), unit: '₺', tone: 'positive' },
    { label: 'Vadesi Geçen', value: fmt(overdue), unit: '₺', tone: overdue > 0 ? 'danger' : 'default' },
    { label: 'Aktif Teminat', value: activeGuarantees, unit: 'adet' },
    { label: 'Yaklaşan Teminat (30g)', value: expiringGuarantees, unit: 'adet', tone: expiringGuarantees > 0 ? 'warning' : 'default' },
    { label: 'Bekleyen Maliyet Onayı', value: pendingCostApprovals, unit: 'adet', tone: pendingCostApprovals > 0 ? 'warning' : 'default' },
  ];
  const charts: ChartSeries[] = [{
    title: 'Alacak vs Tahsilat vs Vadesi Geçen',
    type: 'bar',
    data: [
      { name: 'Alacak', value: fmt(totalReceivable) },
      { name: 'Tahsilat', value: fmt(totalCollected) },
      { name: 'Vadesi Geçen', value: fmt(overdue) },
    ],
  }];
  return { metrics, charts };
}

// ── Hukuk ──────────────────────────────────────────────────────────────────
async function legalMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const now = new Date();
  const opened = await prisma.legalCase.findMany({
    where: { tenantId, createdAt: { gte: p.start, lte: p.end } },
  });
  const closedInPeriod = await prisma.legalCase.count({
    where: { tenantId, status: 'CLOSED', closedAt: { gte: p.start, lte: p.end } },
  });
  const openCases = await prisma.legalCase.findMany({
    where: { tenantId, status: { not: 'CLOSED' } },
  });
  const overdue = openCases.filter(c => c.dueDate && new Date(c.dueDate) < now).length;

  const byType: Record<string, number> = {};
  for (const c of opened) byType[c.type] = (byType[c.type] || 0) + 1;
  const byPriority: Record<string, number> = {};
  for (const c of openCases) byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;

  const metrics: Metric[] = [
    { label: 'Açılan Vaka', value: opened.length, unit: 'adet', hint: 'dönem' },
    { label: 'Kapatılan Vaka', value: closedInPeriod, unit: 'adet', tone: 'positive', hint: 'dönem' },
    { label: 'Açık Vaka', value: openCases.length, unit: 'adet' },
    { label: 'Yüksek Öncelik', value: byPriority['HIGH'] || 0, unit: 'adet', tone: (byPriority['HIGH'] || 0) > 0 ? 'warning' : 'default' },
    { label: 'Gecikmiş (vadesi geçen)', value: overdue, unit: 'adet', tone: overdue > 0 ? 'danger' : 'default' },
  ];
  const charts: ChartSeries[] = [{
    title: 'Vaka Tipi (dönem)',
    type: 'pie',
    data: Object.entries(byType).map(([name, value]) => ({ name, value })),
  }];
  return { metrics, charts };
}

// ── İhale / İSAB ─────────────────────────────────────────────────────────────
async function tenderMetrics(tenantId: string, p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const now = new Date();
  const created = await prisma.tender.findMany({
    where: { tenantId, createdAt: { gte: p.start, lte: p.end } },
    include: { checklist: true },
  });
  const byStatus: Record<string, number> = {};
  for (const t of created) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

  const won = created.filter(t => t.status === 'WON').length;
  const lost = created.filter(t => t.status === 'LOST').length;
  const active = await prisma.tender.findMany({
    where: { tenantId, status: { in: ['DRAFT', 'PREPARING', 'SUBMITTED', 'EVALUATING'] } },
    include: { checklist: true },
  });
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const upcoming = active.filter(t => t.submissionDeadline && new Date(t.submissionDeadline) <= in7 && new Date(t.submissionDeadline) >= now).length;

  // Checklist tamamlanma oranı (aktif ihaleler)
  let reqTotal = 0, reqDone = 0;
  for (const t of active) {
    for (const c of t.checklist) {
      if (c.isRequired) {
        reqTotal++;
        if (c.status === 'DONE' || c.status === 'WAIVED') reqDone++;
      }
    }
  }
  const checklistRate = reqTotal > 0 ? (reqDone / reqTotal) * 100 : 0;

  const metrics: Metric[] = [
    { label: 'İhale (dönem)', value: created.length, unit: 'adet' },
    { label: 'Aktif İhale', value: active.length, unit: 'adet' },
    { label: 'Kazanılan', value: won, unit: 'adet', tone: 'positive' },
    { label: 'Kaybedilen', value: lost, unit: 'adet', tone: lost > 0 ? 'warning' : 'default' },
    { label: 'Yaklaşan Deadline (7g)', value: upcoming, unit: 'adet', tone: upcoming > 0 ? 'warning' : 'default' },
    { label: 'Evrak Tamamlanma', value: fmt(checklistRate), unit: '%', tone: checklistRate >= 80 ? 'positive' : 'default' },
  ];
  const charts: ChartSeries[] = [{
    title: 'İhale Statü Dağılımı (dönem)',
    type: 'bar',
    data: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
  }];
  return { metrics, charts };
}

// ── Proje Yönetimi (projects.ts /summary/all yeniden kullanımı) ──────────────
async function projectMetrics(tenantId: string, _p: Period): Promise<{ metrics: Metric[]; charts: ChartSeries[] }> {
  const projects = await prisma.project.findMany({
    where: { tenantId, status: { not: 'CANCELLED' } },
    include: { milestones: true, projectCostItems: true },
  });
  const active = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
  const completed = projects.filter(p => p.status === 'COMPLETED');
  const avgProgress = projects.length > 0
    ? projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length
    : 0;

  let delayedMilestones = 0;
  for (const p of projects) {
    delayedMilestones += p.milestones.filter(m =>
      m.status !== 'COMPLETED' && m.status !== 'CANCELLED' &&
      m.plannedEnd && new Date(m.plannedEnd) < new Date()
    ).length;
  }

  // Toplam planlanan/gerçekleşen marj (değer ağırlıklı)
  let totalValue = 0, totalPlanned = 0, totalActual = 0;
  for (const p of projects) {
    totalValue += p.totalValue || 0;
    totalPlanned += p.projectCostItems.reduce((s, c) => s + c.plannedAmount, 0);
    totalActual += p.projectCostItems.reduce((s, c) => s + c.amountTRY, 0);
  }
  const plannedMargin = totalValue > 0 ? ((totalValue - totalPlanned) / totalValue) * 100 : 0;
  const actualMargin = totalValue > 0 ? ((totalValue - totalActual) / totalValue) * 100 : 0;

  const metrics: Metric[] = [
    { label: 'Aktif Proje', value: active.length, unit: 'adet' },
    { label: 'Tamamlanan', value: completed.length, unit: 'adet', tone: 'positive' },
    { label: 'Ortalama İlerleme', value: fmt(avgProgress), unit: '%' },
    { label: 'Gecikmiş Milestone', value: delayedMilestones, unit: 'adet', tone: delayedMilestones > 0 ? 'danger' : 'default' },
    { label: 'Planlanan Marj', value: fmt(plannedMargin), unit: '%' },
    { label: 'Gerçekleşen Marj', value: fmt(actualMargin), unit: '%', tone: actualMargin >= plannedMargin ? 'positive' : 'warning' },
  ];
  const charts: ChartSeries[] = [{
    title: 'Proje Durum Dağılımı',
    type: 'pie',
    data: [
      { name: 'Planlama', value: projects.filter(p => p.status === 'PLANNING').length },
      { name: 'Devam Eden', value: projects.filter(p => p.status === 'IN_PROGRESS').length },
      { name: 'Beklemede', value: projects.filter(p => p.status === 'ON_HOLD').length },
      { name: 'Tamamlanan', value: completed.length },
    ].filter(d => d.value > 0),
  }];
  return { metrics, charts };
}

// ── Dağıtıcı ─────────────────────────────────────────────────────────────────
export async function computeUnitMetrics(
  tenantId: string,
  unitKey: string,
  startStr?: string,
  endStr?: string,
): Promise<UnitMetricsResult | null> {
  const def = getUnitDefinition(unitKey);
  if (!def) return null;
  const period = resolvePeriod(startStr, endStr);

  let result: { metrics: Metric[]; charts: ChartSeries[] };
  switch (unitKey) {
    case 'CRM': result = await crmMetrics(tenantId, period); break;
    case 'PRESALES': result = await presalesMetrics(tenantId, period); break;
    case 'PROCUREMENT': result = await procurementMetrics(tenantId, period); break;
    case 'FINANCE': result = await financeMetrics(tenantId, period); break;
    case 'LEGAL': result = await legalMetrics(tenantId, period); break;
    case 'TENDER': result = await tenderMetrics(tenantId, period); break;
    case 'PROJECT': result = await projectMetrics(tenantId, period); break;
    default: result = { metrics: [], charts: [] };
  }

  return {
    unitKey: def.key,
    label: def.label,
    role: def.role,
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    metrics: result.metrics,
    charts: result.charts,
  };
}

// ── İş akışı darboğazı: açık ApprovalChain'lerin beklediği birim ─────────────
export interface WorkflowBottleneck {
  role: string;
  pendingCount: number;       // bu role'de sırası gelmiş (bekleyen) zincir sayısı
  oldestWaitingDays: number;  // en eski bekleyişin gün sayısı
}

export async function computeWorkflowBottlenecks(tenantId: string): Promise<WorkflowBottleneck[]> {
  const chains = await prisma.approvalChain.findMany({
    where: { tenantId, status: 'PENDING' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });

  const now = Date.now();
  const byRole: Record<string, { count: number; oldest: number }> = {};

  for (const chain of chains) {
    // "Sırası gelmiş" aşama = kendinden önceki tüm aşamalar APPROVED/SKIPPED olan ilk PENDING
    const sorted = [...chain.stages].sort((a, b) => a.order - b.order);
    const firstPending = sorted.find(s => s.status === 'PENDING');
    if (!firstPending) continue;
    const precedingDone = sorted
      .filter(s => s.order < firstPending.order)
      .every(s => s.status === 'APPROVED' || s.status === 'SKIPPED');
    if (!precedingDone) continue;

    const role = firstPending.role;
    const waitingFrom = new Date(firstPending.updatedAt || chain.createdAt).getTime();
    const days = Math.max(0, Math.floor((now - waitingFrom) / 86400000));
    if (!byRole[role]) byRole[role] = { count: 0, oldest: 0 };
    byRole[role].count++;
    if (days > byRole[role].oldest) byRole[role].oldest = days;
  }

  return Object.entries(byRole)
    .map(([role, v]) => ({ role, pendingCount: v.count, oldestWaitingDays: v.oldest }))
    .sort((a, b) => b.pendingCount - a.pendingCount);
}

// ── Konsolide genel bakış ────────────────────────────────────────────────────
export interface OverviewUnit {
  unitKey: string;
  label: string;
  role: string;
  headline: Metric[];   // ilk 2-3 başlık metrik
  charts: ChartSeries[];
}

export interface ReportOverview {
  period: { start: string; end: string };
  units: OverviewUnit[];
  bottlenecks: WorkflowBottleneck[];
}

export async function computeOverview(
  tenantId: string,
  startStr?: string,
  endStr?: string,
): Promise<ReportOverview> {
  const period = resolvePeriod(startStr, endStr);
  const units: OverviewUnit[] = [];

  for (const def of UNIT_DEFINITIONS) {
    const full = await computeUnitMetrics(tenantId, def.key, startStr, endStr);
    if (!full) continue;
    units.push({
      unitKey: def.key,
      label: def.label,
      role: def.role,
      headline: full.metrics.slice(0, 3),
      charts: full.charts,
    });
  }

  const bottlenecks = await computeWorkflowBottlenecks(tenantId);

  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    units,
    bottlenecks,
  };
}

// ── Konsolidasyon (Faz: çok-seviyeli rapor) ──────────────────────────────────
// Birim yöneticisinin raporu: dönemdeki personel günlük raporları +
// ziyaret plan-gerçekleşen mutabakatı. Birim personeli def.role → yönetici
// kullanıcı → unitId → o birimdeki tüm kullanıcılar üzerinden çözülür.
export interface ConsolidationPerson {
  userId: string;
  name: string;
  role: string;
  isManager: boolean;
  reportCount: number;
  knownCount: number;
  newCount: number;
  sharedCount: number;
  // Ziyaret-eşleşme KPI (planlanan ↔ yapılan+raporlanan)
  plannedVisits: number;
  completedVisits: number;
  matchedVisits: number;   // tamamlanan VE o gün raporlanan
  matchRate: number;       // matched/planned × 100 (skor)
}
export interface ConsolidationResult {
  unitKey: string;
  unitId: string | null;
  managerName: string | null;
  staffCount: number;
  period: { start: string; end: string };
  totalReports: number;
  knownToSystem: number;
  newContacts: number;
  people: ConsolidationPerson[];
  matrix: Record<string, Record<string, number>>; // meetingKind × linkType
  reportEntries: { date: string; userName: string; meetingKind: string; linkType: string; linkLabel: string | null; content: string }[];
  visits: { date: string; customerName: string | null; type: string; status: string; note: string | null }[];
  targetRate: number; // birim geneli ziyaret-eşleşme hedefi (%)
  visitReconciliation: {
    applicable: boolean;
    planned: number;
    completed: number;
    cancelled: number;
    pending: number;
    coveragePct: number;
  };
}

const MK = ['INTRO', 'PLANNED', 'FOLLOWUP', 'OTHER'];
const LT = ['NEW_CONTACT', 'VISIT', 'OPPORTUNITY', 'PROJECT'];

export async function computeConsolidation(
  tenantId: string,
  unitKey: string,
  startStr?: string,
  endStr?: string,
): Promise<ConsolidationResult | null> {
  const def = getUnitDefinition(unitKey);
  if (!def) return null;
  const { start, end } = resolvePeriod(startStr, endStr);

  const manager = await prisma.user.findFirst({ where: { tenantId, role: def.role } });
  const unitId = manager?.unitId ?? null;
  const staff = unitId
    ? await prisma.user.findMany({ where: { tenantId, unitId } })
    : (manager ? [manager] : []);
  const userMap = new Map<string, typeof staff[number]>();
  for (const u of staff) userMap.set(u.id, u);
  if (manager) userMap.set(manager.id, manager);
  const users = [...userMap.values()];
  const userIds = users.map((u) => u.id);

  const reports = userIds.length
    ? await prisma.dailyReport.findMany({ where: { tenantId, userId: { in: userIds }, date: { gte: start, lte: end } } })
    : [];

  const matrix: Record<string, Record<string, number>> = {};
  for (const mk of MK) { matrix[mk] = {}; for (const lt of LT) matrix[mk][lt] = 0; }
  let known = 0, neu = 0;
  const per = new Map<string, { reportCount: number; knownCount: number; newCount: number; sharedCount: number }>();
  for (const u of users) per.set(u.id, { reportCount: 0, knownCount: 0, newCount: 0, sharedCount: 0 });
  for (const r of reports) {
    const mk = MK.includes(r.meetingKind) ? r.meetingKind : 'OTHER';
    const lt = LT.includes(r.linkType) ? r.linkType : 'NEW_CONTACT';
    matrix[mk][lt]++;
    if (r.isKnownToSystem) known++; else neu++;
    const p = per.get(r.userId);
    if (p) { p.reportCount++; if (r.isKnownToSystem) p.knownCount++; else p.newCount++; if (r.sharedWithManager) p.sharedCount++; }
  }

  // Ziyaret planları (dönem) — per-personel KPI + genel mutabakat için tek seferde
  const plans = await prisma.visitPlan.findMany({ where: { tenantId, weekOf: { gte: start, lte: end } }, include: { visits: true } });
  // Birim geneli ziyaret-eşleşme hedefi (moduleSettings.visitKpi.targetRate)
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let targetRate = 80;
  try { const ms = JSON.parse(tenant?.moduleSettings || '{}'); if (ms?.visitKpi?.targetRate) targetRate = Number(ms.visitKpi.targetRate); } catch { /* default */ }

  // Personelin rapor girdiği günler (YYYY-MM-DD) — eşleşme için
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const reportDaysByUser = new Map<string, Set<string>>();
  for (const r of reports) {
    if (!reportDaysByUser.has(r.userId)) reportDaysByUser.set(r.userId, new Set());
    reportDaysByUser.get(r.userId)!.add(dayKey(r.date));
  }
  // Personelin ziyaret KPI'ı — plan sahibi (preparedById) = personel
  const visitKpiByUser = new Map<string, { plannedVisits: number; completedVisits: number; matchedVisits: number }>();
  for (const u of users) visitKpiByUser.set(u.id, { plannedVisits: 0, completedVisits: 0, matchedVisits: 0 });
  for (const pl of plans) {
    const k = visitKpiByUser.get(pl.preparedById);
    if (!k) continue; // birim dışı plan sahibi
    const days = reportDaysByUser.get(pl.preparedById) ?? new Set<string>();
    for (const v of pl.visits) {
      k.plannedVisits++;
      if (v.status === 'COMPLETED') {
        k.completedVisits++;
        if (days.has(dayKey(v.actualDate ?? v.plannedDate))) k.matchedVisits++;
      }
    }
  }

  const people: ConsolidationPerson[] = users.map((u) => {
    const base = per.get(u.id) as { reportCount: number; knownCount: number; newCount: number; sharedCount: number };
    const vk = visitKpiByUser.get(u.id) as { plannedVisits: number; completedVisits: number; matchedVisits: number };
    return {
      userId: u.id, name: u.name ?? u.email, role: u.role, isManager: u.id === manager?.id,
      ...base, ...vk,
      matchRate: vk.plannedVisits ? Math.round((vk.matchedVisits / vk.plannedVisits) * 100) : 0,
    };
  });

  // Girilen içerikler — her günlük raporun metni (tarihe göre)
  const reportEntries = [...reports]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({
      date: r.date.toISOString(),
      userName: r.userName ?? (userMap.get(r.userId)?.name ?? userMap.get(r.userId)?.email ?? ''),
      meetingKind: r.meetingKind,
      linkType: r.linkType,
      linkLabel: r.linkLabel,
      content: r.content,
    }));

  // Ziyaret plan-gerçekleşen — ziyaret planı olan birim (Satış/CRM); plans yukarıda çekildi
  const applicable = unitKey === 'CRM' || plans.length > 0;
  const allVisits = plans.flatMap((p) => p.visits);
  const planned = allVisits.length;
  const completed = allVisits.filter((v) => v.status === 'COMPLETED').length;
  const cancelled = allVisits.filter((v) => v.status === 'CANCELLED').length;
  const visitReconciliation = {
    applicable,
    planned, completed, cancelled,
    pending: planned - completed - cancelled,
    coveragePct: planned ? Math.round((completed / planned) * 100) : 0,
  };
  // Ziyaret detayları (girilen içerik: müşteri, tür, not)
  const visits = [...allVisits]
    .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime())
    .map((v) => ({
      date: (v.actualDate ?? v.plannedDate).toISOString(),
      customerName: v.customerName,
      type: v.type,
      status: v.status,
      note: v.needsCaptured,
    }));

  return {
    unitKey, unitId, managerName: manager?.name ?? null, staffCount: users.length,
    period: { start: start.toISOString(), end: end.toISOString() },
    totalReports: reports.length, knownToSystem: known, newContacts: neu,
    people, matrix, reportEntries, visits, targetRate, visitReconciliation,
  };
}

// Raporun yönlendiği üst birim yöneticisi: unit → parentId → parent.manager
export async function resolveEscalationTarget(
  tenantId: string,
  unitKey: string,
): Promise<{ id: string | null; name: string | null }> {
  const def = getUnitDefinition(unitKey);
  if (!def) return { id: null, name: null };
  const manager = await prisma.user.findFirst({ where: { tenantId, role: def.role } });
  if (!manager?.unitId) return { id: null, name: null };
  const unit = await prisma.unit.findUnique({ where: { id: manager.unitId } });
  if (!unit?.parentId) return { id: null, name: null };
  const parent = await prisma.unit.findUnique({ where: { id: unit.parentId }, include: { manager: true } });
  if (!parent?.manager) return { id: null, name: null };
  return { id: parent.manager.id, name: parent.manager.name ?? parent.manager.email };
}
