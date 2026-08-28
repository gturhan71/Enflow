// Enflow — Kârlılık Servisi (DB erişimi + defter + rollup birleştirme)
// ─────────────────────────────────────────────────────────────────────────────
// `profitabilityLedger` (saf üreticiler) + `profitabilityRollup` (saf kovalama)
// ile Prisma sorgularını birleştirir. Route katmanı ince kalır.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §3 · §5

import { prisma } from '../prismaClient';
import {
  buildPlanEvents, buildActualEvents, type ProfitEvent, type LedgerProject,
} from './profitabilityLedger';
import { bucketBy, type Grain, type PeriodRow } from './profitabilityRollup';
import { DEFAULT_INTEREST_RATES } from './financingEffect';
import {
  buildCashflow, buildTreasury, type CashflowResult, type TreasuryResult,
} from './profitabilityCashflow';

export interface ProfitScope { kind: 'ALL' | 'PROJECT'; projectId?: string }

const PROJECT_STATUSES_EXCLUDED = ['CANCELLED'];

/** moduleSettings.finance.fxRates → { currency: TRY-çarpanı }. Yoksa { TRY: 1 }. */
async function resolveFxRates(tenantId: string, override?: Record<string, number>): Promise<Record<string, number>> {
  if (override && Object.keys(override).length) return { TRY: 1, ...override };
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { moduleSettings: true } });
  try {
    const ms = JSON.parse(tenant?.moduleSettings || '{}') as { finance?: { fxRates?: Record<string, number> } };
    return { TRY: 1, ...(ms.finance?.fxRates || {}) };
  } catch {
    return { TRY: 1 };
  }
}

/** moduleSettings.finance.interestRates → yıllık faiz %. Yoksa DEFAULT_INTEREST_RATES. */
async function resolveInterestRates(tenantId: string): Promise<Record<string, number>> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { moduleSettings: true } });
  try {
    const ms = JSON.parse(tenant?.moduleSettings || '{}') as { finance?: { interestRates?: Record<string, number> } };
    return { ...DEFAULT_INTEREST_RATES, ...(ms.finance?.interestRates || {}) };
  } catch {
    return { ...DEFAULT_INTEREST_RATES };
  }
}

interface AssembledProject {
  ledger: LedgerProject;
  planEvents: ProfitEvent[];
  actualEvents: ProfitEvent[];
}

async function assembleProject(tenantId: string, projectId: string): Promise<AssembledProject | null> {
  const p = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: { milestones: true, projectCostItems: true },
  });
  if (!p) return null;

  const opp = p.opportunityId
    ? await prisma.opportunity.findFirst({ where: { id: p.opportunityId, tenantId } })
    : null;

  const [boms, costItems, installments, invoices] = await Promise.all([
    p.opportunityId ? prisma.boMItem.findMany({ where: { opportunityId: p.opportunityId } }) : Promise.resolve([]),
    p.opportunityId ? prisma.costItem.findMany({ where: { opportunityId: p.opportunityId, tenantId } }) : Promise.resolve([]),
    p.opportunityId ? prisma.collectionInstallment.findMany({ where: { opportunityId: p.opportunityId, tenantId } }) : Promise.resolve([]),
    prisma.invoice.findMany({ where: { tenantId, projectId }, include: { payments: true } }),
  ]);

  const ledger: LedgerProject = {
    id: p.id, name: p.name, totalValue: p.totalValue, contractCurrency: p.contractCurrency,
    progress: p.progress, startDate: p.startDate, plannedEndDate: p.plannedEndDate, createdAt: p.createdAt,
    opportunityId: p.opportunityId, applyOverhead: p.applyOverhead, overheadAmount: p.overheadAmount,
  };

  const opportunityWonAt = opp && opp.status === 'WON' ? opp.updatedAt : null;

  const planEvents = buildPlanEvents({
    project: ledger,
    installments: installments.map((i) => ({ id: i.id, dueDate: i.dueDate, amount: i.amount, currency: i.currency, note: i.note })),
    milestones: p.milestones.map((m) => ({ plannedEnd: m.plannedEnd, budgetAmount: m.budgetAmount, status: m.status, title: m.title })),
    boms: boms.map((b) => ({ id: b.id, partNumber: b.partNumber, purchaseCost: b.purchaseCost, quantity: b.quantity, currency: b.currency, paymentTermDays: b.paymentTermDays })),
    costItems: costItems.map((c) => ({ id: c.id, description: c.description, amount: c.amount, currency: c.currency, paymentTermDays: c.paymentTermDays, category: c.category })),
    projectCostItems: p.projectCostItems.map((pc) => ({
      id: pc.id, description: pc.description, category: pc.category,
      plannedAmount: pc.plannedAmount, actualAmount: pc.actualAmount, amountTRY: pc.amountTRY,
      currency: pc.currency, date: pc.date, createdAt: pc.createdAt,
    })),
    opportunityWonAt,
  });

  const payments = invoices.flatMap((inv) =>
    inv.payments.map((pay) => ({ id: pay.id, amount: pay.amount, currency: pay.currency, paidAt: pay.paidAt, invoiceType: inv.type as 'SALES' | 'PURCHASE' })),
  );

  const actualEvents = buildActualEvents({
    project: ledger,
    invoices: invoices.map((inv) => ({
      id: inv.id, type: inv.type as 'SALES' | 'PURCHASE', amount: inv.amount, currency: inv.currency,
      issueDate: inv.issueDate, dueDate: inv.dueDate, paidAmount: inv.paidAmount, paidAt: inv.paidAt,
    })),
    payments,
    projectCostItems: p.projectCostItems.map((pc) => ({
      id: pc.id, description: pc.description, category: pc.category,
      plannedAmount: pc.plannedAmount, actualAmount: pc.actualAmount, amountTRY: pc.amountTRY,
      currency: pc.currency, date: pc.date, createdAt: pc.createdAt,
    })),
  });

  return { ledger, planEvents, actualEvents };
}

async function scopedProjectIds(tenantId: string, scope: ProfitScope): Promise<string[]> {
  if (scope.kind === 'PROJECT' && scope.projectId) return [scope.projectId];
  const rows = await prisma.project.findMany({
    where: { tenantId, status: { notIn: PROJECT_STATUSES_EXCLUDED } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export interface LedgerResult {
  scope: ProfitScope;
  asOf: string;
  fxRates: Record<string, number>;
  plan: ProfitEvent[];
  actual: ProfitEvent[];
}

export async function getLedger(
  tenantId: string, scope: ProfitScope, opts: { asOf?: Date; from?: Date; to?: Date; fxRates?: Record<string, number> } = {},
): Promise<LedgerResult> {
  const asOf = opts.asOf ?? new Date();
  const fxRates = await resolveFxRates(tenantId, opts.fxRates);
  const ids = await scopedProjectIds(tenantId, scope);

  const assembled = (await Promise.all(ids.map((id) => assembleProject(tenantId, id)))).filter(Boolean) as AssembledProject[];
  const inRange = (e: ProfitEvent) =>
    (!opts.from || e.date.getTime() >= opts.from.getTime()) &&
    (!opts.to || e.date.getTime() <= opts.to.getTime());

  const plan = assembled.flatMap((a) => a.planEvents).filter(inRange);
  const actual = assembled.flatMap((a) => a.actualEvents).filter(inRange);

  return { scope, asOf: asOf.toISOString(), fxRates, plan, actual };
}

export interface SummaryResult {
  scope: ProfitScope;
  grain: Grain;
  asOf: string;
  reportCurrency: string;
  fxRates: Record<string, number>;
  rows: PeriodRow[];
}

export async function getSummary(
  tenantId: string, scope: ProfitScope, grain: Grain,
  opts: { asOf?: Date; year?: number; fxRates?: Record<string, number>; reportCurrency?: string } = {},
): Promise<SummaryResult> {
  const asOf = opts.asOf ?? new Date();
  const fxRates = await resolveFxRates(tenantId, opts.fxRates);
  const ids = await scopedProjectIds(tenantId, scope);
  const assembled = (await Promise.all(ids.map((id) => assembleProject(tenantId, id)))).filter(Boolean) as AssembledProject[];

  const projectNames: Record<string, string> = {};
  for (const a of assembled) projectNames[a.ledger.id] = a.ledger.name;

  let events = [...assembled.flatMap((a) => a.planEvents), ...assembled.flatMap((a) => a.actualEvents)];
  if (opts.year) {
    events = events.filter((e) => e.date.getUTCFullYear() === opts.year);
  }

  const rows = bucketBy(events, { grain, asOf, fxRates, reportCurrency: opts.reportCurrency, projectNames });
  return { scope, grain, asOf: asOf.toISOString(), reportCurrency: opts.reportCurrency || 'TRY', fxRates, rows };
}

// ── Faz B: Nakit pozisyonu + Hazine etkisi ─────────────────────────────────

async function gatherAllEvents(tenantId: string, scope: ProfitScope): Promise<ProfitEvent[]> {
  const ids = await scopedProjectIds(tenantId, scope);
  const assembled = (await Promise.all(ids.map((id) => assembleProject(tenantId, id)))).filter(Boolean) as AssembledProject[];
  return [...assembled.flatMap((a) => a.planEvents), ...assembled.flatMap((a) => a.actualEvents)];
}

export interface CashflowApiResult extends CashflowResult { scope: ProfitScope }
export interface TreasuryApiResult extends TreasuryResult { scope: ProfitScope }

export async function getCashflow(
  tenantId: string, scope: ProfitScope,
  opts: { asOf?: Date; from?: Date; to?: Date; fxRates?: Record<string, number> } = {},
): Promise<CashflowApiResult> {
  const asOf = opts.asOf ?? new Date();
  const fxRates = await resolveFxRates(tenantId, opts.fxRates);
  const events = await gatherAllEvents(tenantId, scope);
  const cf = buildCashflow(events, { asOf, from: opts.from, to: opts.to, fxRates });
  return { ...cf, scope };
}

export async function getTreasury(
  tenantId: string, scope: ProfitScope,
  opts: { asOf?: Date; from?: Date; to?: Date; fxRates?: Record<string, number> } = {},
): Promise<TreasuryApiResult> {
  const asOf = opts.asOf ?? new Date();
  const fxRates = await resolveFxRates(tenantId, opts.fxRates);
  const interestRates = await resolveInterestRates(tenantId);
  const events = await gatherAllEvents(tenantId, scope);
  const cfOpts = { asOf, from: opts.from, to: opts.to, fxRates };
  const cf = buildCashflow(events, cfOpts);
  const tr = buildTreasury(cf, interestRates, cfOpts);
  return { ...tr, scope };
}

/** "USD:40,EUR:44" → { USD: 40, EUR: 44 } */
export function parseFxParam(raw?: string): Record<string, number> | undefined {
  if (!raw) return undefined;
  const out: Record<string, number> = {};
  for (const pair of raw.split(',')) {
    const [cur, val] = pair.split(':');
    const n = Number(val);
    if (cur && Number.isFinite(n)) out[cur.trim().toUpperCase()] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

/** "project:<id>" | "all" → ProfitScope */
export function parseScopeParam(raw?: string): ProfitScope {
  if (raw && raw.startsWith('project:')) return { kind: 'PROJECT', projectId: raw.slice('project:'.length) };
  return { kind: 'ALL' };
}
