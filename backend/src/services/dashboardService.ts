// Enflow — Role-bazlı Dashboard aggregator
// ─────────────────────────────────────────────────────────────────────────────
// Zamana-duyarlı işler + yönetim KPI'ları + kişisel veriyi tek payload'da toplar.
// Frontend role'e göre widget seçer. Tenant-scoped; kişisel alanlar userId ile.

import { prisma } from '../prismaClient';
import { computeWorkflowBottlenecks, computeVisitPerformance } from './unitReportingService';

const DAY = 86400000;
const daysLeft = (d: Date | null) => (d ? Math.ceil((d.getTime() - Date.now()) / DAY) : null);

const CONTRACT_ACTIVE_STATUSES = ['DRAFT', 'ANALYSIS_DONE', 'PREPARATION', 'READY_TO_SIGN', 'PENDING_SIGNATURE_APPROVAL'];
const LEGAL_OPEN_STATUSES = ['OPEN', 'IN_REVIEW', 'RESPONDED', 'ESCALATED'];

export async function computeDashboard(tenantId: string, userId?: string) {
  const now = Date.now();
  const soon30 = new Date(now + 30 * DAY);
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [opps, tenders, guarantees, invoices, milestones, prs, projects, bottlenecks, myTasks, unread, contracts, legalCases, risks, agentRunsToday, visitPerformance] = await Promise.all([
    prisma.opportunity.findMany({ where: { tenantId }, select: { id: true, title: true, value: true, status: true, technicalStatus: true, assignedToId: true, updatedAt: true } }),
    prisma.tender.findMany({ where: { tenantId } }),
    prisma.guaranteeLetter.findMany({ where: { tenantId } }),
    prisma.invoice.findMany({ where: { tenantId, type: 'SALES' } }),
    prisma.projectMilestone.findMany({ where: { project: { tenantId }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, plannedEnd: { not: null, lte: soon30 } }, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.purchaseRequest.findMany({ where: { tenantId }, select: { status: true } }),
    prisma.project.findMany({ where: { tenantId }, select: { status: true, avgMargin: true } }),
    computeWorkflowBottlenecks(tenantId).catch(() => []),
    userId ? prisma.todoTask.count({ where: { tenantId, status: 'PENDING' } }) : Promise.resolve(0),
    userId ? prisma.notification.count({ where: { tenantId, userId, isRead: false } }) : Promise.resolve(0),
    prisma.contractWorkflow.findMany({ where: { tenantId, status: { in: CONTRACT_ACTIVE_STATUSES }, deadline: { not: null } }, select: { id: true, title: true, deadline: true } }).catch(() => []),
    prisma.legalCase.findMany({ where: { tenantId, status: { in: LEGAL_OPEN_STATUSES }, dueDate: { not: null } }, select: { id: true, title: true, dueDate: true, priority: true } }).catch(() => []),
    prisma.riskOpportunity.findMany({ where: { tenantId, status: 'OPEN' }, orderBy: { score: 'desc' }, take: 5, select: { id: true, title: true, score: true, type: true } }).catch(() => []),
    prisma.agentRun.findMany({ where: { tenantId, createdAt: { gte: startOfToday } }, select: { status: true, actionTaken: true } }).catch(() => []),
    computeVisitPerformance(tenantId).catch(() => ({
      period: { start: startOfToday.toISOString(), end: startOfToday.toISOString() },
      planned: 0, completed: 0, cancelled: 0, coveragePct: 0, targetRate: 80,
      conversion: { windowDays: 60, lookbackDays: 180, maturedVisits: 0, convertedVisits: 0, conversionRatePct: 0 },
      topPerformers: [],
      totalKpiBonusPoints: 0,
    })),
  ]);

  // KPI — WITHDRAWN nötr
  const won = opps.filter(o => o.status === 'WON');
  const lost = opps.filter(o => o.status === 'LOST');
  const withdrawn = opps.filter(o => o.status === 'WITHDRAWN');
  const active = opps.filter(o => !['WON', 'LOST', 'WITHDRAWN'].includes(o.status));
  const decided = won.length + lost.length;

  // Zamana-duyarlı: ihale vadeleri (aktif)
  const tenderDeadlines = tenders
    .filter(t => ['DRAFT', 'PREPARING'].includes(t.status) && t.submissionDeadline)
    .map(t => ({ id: t.id, name: t.name, ikn: t.ikn, submissionDeadline: t.submissionDeadline, daysLeft: daysLeft(t.submissionDeadline) }))
    .sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));

  const guaranteeExpiries = guarantees
    .filter(g => g.status === 'ACTIVE' && !g.isIndefinite && g.expiryDate && g.expiryDate.getTime() <= soon30.getTime())
    .map(g => ({ id: g.id, type: g.type, amount: g.amount, currency: g.currency, expiryDate: g.expiryDate, daysLeft: daysLeft(g.expiryDate) }))
    .sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));

  const guaranteeRequests = guarantees
    .filter(g => g.status === 'REQUESTED')
    .map(g => ({ id: g.id, type: g.type, amount: g.amount, currency: g.currency, isIndefinite: g.isIndefinite, tenderId: g.tenderId, expiryDate: g.expiryDate }));

  const costApprovalsPending = opps
    .filter(o => o.technicalStatus === 'PENDING_APPROVAL')
    .map(o => ({ id: o.id, title: o.title, value: o.value }));

  const invoicesDue = invoices
    .filter(i => i.dueDate && i.status !== 'CANCELLED' && i.status !== 'PAID' && i.paidAmount < i.amount)
    .map(i => ({ id: i.id, invoiceNo: i.invoiceNo, amount: i.amount - i.paidAmount, currency: i.currency, dueDate: i.dueDate, overdue: !!(i.dueDate && i.dueDate.getTime() < now) }))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  const milestonesDue = milestones.map(m => ({ id: m.id, title: m.title, projectName: m.project?.name ?? null, plannedEnd: m.plannedEnd, daysLeft: daysLeft(m.plannedEnd) }));

  const contractDeadlines = contracts
    .map(c => ({ id: c.id, title: c.title, deadline: c.deadline, daysLeft: daysLeft(c.deadline) }))
    .sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));

  const legalDeadlines = legalCases
    .map(l => ({ id: l.id, title: l.title, priority: l.priority, dueDate: l.dueDate, daysLeft: daysLeft(l.dueDate) }))
    .sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));

  const topRisks = risks.map(r => ({ id: r.id, title: r.title, type: r.type, score: r.score }));

  const agentActivityToday = {
    pendingRatification: agentRunsToday.filter(a => a.status === 'PENDING_RATIFICATION').length,
    actionsTaken: agentRunsToday.filter(a => a.actionTaken != null).length,
    total: agentRunsToday.length,
  };

  // Yönetim: tender pipeline, bom handoffs, finansman (döviz-bazlı), purchase, projeler
  const tenderPipeline = {
    active: tenders.filter(t => ['DRAFT', 'PREPARING'].includes(t.status)).length,
    submitted: tenders.filter(t => t.status === 'SUBMITTED').length,
    won: tenders.filter(t => t.status === 'WON').length,
    lost: tenders.filter(t => t.status === 'LOST').length,
    withdrawn: tenders.filter(t => t.status === 'WITHDRAWN').length,
  };

  const [bomHandoffCount, recentHandoffs] = await Promise.all([
    prisma.bomHandoff.count({ where: { tenantId } }),
    prisma.bomHandoff.findMany({ where: { tenantId }, orderBy: { lastHandoffAt: 'desc' }, take: 5, select: { id: true, oppTitle: true, itemCount: true, handoffCount: true, lastHandoffAt: true } }),
  ]);

  const receivableByCurrency: Record<string, number> = {};
  const overdueByCurrency: Record<string, number> = {};
  for (const i of invoices) {
    if (i.status === 'CANCELLED' || i.status === 'DRAFT') continue;
    const rem = i.amount - i.paidAmount;
    if (rem <= 0) continue;
    receivableByCurrency[i.currency] = (receivableByCurrency[i.currency] || 0) + rem;
    if (i.dueDate && i.dueDate.getTime() < now) overdueByCurrency[i.currency] = (overdueByCurrency[i.currency] || 0) + rem;
  }

  const prByStatus: Record<string, number> = {};
  for (const p of prs) prByStatus[p.status] = (prByStatus[p.status] || 0) + 1;

  const activeProjects = projects.filter(p => ['PLANNING', 'IN_PROGRESS', 'NOT_STARTED'].includes(p.status));
  const avgMargin = activeProjects.length ? activeProjects.reduce((s, p) => s + (p.avgMargin || 0), 0) / activeProjects.length : 0;

  const myOpportunities = userId
    ? opps.filter(o => o.assignedToId === userId && !['WON', 'LOST', 'WITHDRAWN'].includes(o.status)).map(o => ({ id: o.id, title: o.title, value: o.value, status: o.status, technicalStatus: o.technicalStatus }))
    : [];

  return {
    kpis: {
      winRate: decided > 0 ? Math.round((won.length / decided) * 1000) / 10 : 0,
      pipelineValue: active.reduce((s, o) => s + (o.value || 0), 0),
      won: { count: won.length, value: won.reduce((s, o) => s + (o.value || 0), 0) },
      lost: { count: lost.length, value: lost.reduce((s, o) => s + (o.value || 0), 0) },
      withdrawnCount: withdrawn.length,
      activeOpps: active.length,
    },
    timeSensitive: { tenderDeadlines, guaranteeExpiries, guaranteeRequests, costApprovalsPending, invoicesDue, milestonesDue, contractDeadlines, legalDeadlines },
    management: {
      bottlenecks,
      tenderPipeline,
      bomHandoffs: { count: bomHandoffCount, recent: recentHandoffs },
      financing: { receivableByCurrency, overdueByCurrency },
      purchaseRequests: prByStatus,
      projects: { active: activeProjects.length, avgMargin: Math.round(avgMargin * 10) / 10 },
      topRisks,
      agentActivityToday,
      visitPerformance,
    },
    personal: { myOpportunities, myTasksPending: myTasks, unreadNotifications: unread },
  };
}
