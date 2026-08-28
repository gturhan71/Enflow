// Enflow — Kârlılık API (Faz A: /ledger + /summary)
// ─────────────────────────────────────────────────────────────────────────────
// Zamana duyarlı kârlılık: proje/aylık/çeyreklik/yıllık, planlanan + gerçekleşen
// paralel, as-of tarihli. Salt-okuma — logActivity çağrılmaz.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §5

import { Router, Request, Response } from 'express';
import { asyncHandler, tenantMiddleware, requireRole, requireEntitlement } from '../middleware';
import {
  getLedger, getSummary, getCashflow, getTreasury, getInstruments, parseFxParam, parseScopeParam,
} from '../services/profitabilityService';
import { getDmoProfitability, type DmoGrain } from '../services/profitabilityDmo';
import { takeSnapshot, listSnapshots, getPlanDrift } from '../services/profitabilitySnapshot';
import { logActivity } from '../services/activityLog';
import type { Grain } from '../services/profitabilityRollup';

const router: Router = Router();
router.use(tenantMiddleware);

// Backend rol kapısı — frontend ayrıca PROFITABILITY_VIEW izniyle gizler.
const VIEW_ROLES = ['GENERAL_MANAGER', 'FINANCE_MGR', 'PROJECT_MGR', 'SALES_MGR'];
const SNAPSHOT_ROLES = ['GENERAL_MANAGER', 'FINANCE_MGR'];

const VALID_GRAINS: Grain[] = ['PROJECT', 'MONTH', 'QUARTER', 'YEAR'];

function parseDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ?overhead=0|false → işletme maliyetini hesaba KATMA (doğrudan/katkı marjı). Varsayılan: dahil.
function parseOverhead(raw?: string): boolean {
  return !(raw === '0' || raw === 'false' || raw === 'no');
}

// ── GET /api/profitability/ledger ───────────────────────────────────────────
router.get('/ledger', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const scope = parseScopeParam(req.query.scope ? String(req.query.scope) : undefined);
  const result = await getLedger(req.tenantId, scope, {
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
    from: parseDate(req.query.from ? String(req.query.from) : undefined),
    to: parseDate(req.query.to ? String(req.query.to) : undefined),
    fxRates: parseFxParam(req.query.fx ? String(req.query.fx) : undefined),
    includeOverhead: parseOverhead(req.query.overhead ? String(req.query.overhead) : undefined),
  });
  res.json(result);
}));

// ── GET /api/profitability/summary ──────────────────────────────────────────
router.get('/summary', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const grainRaw = String(req.query.grain || 'MONTH').toUpperCase() as Grain;
  const grain: Grain = VALID_GRAINS.includes(grainRaw) ? grainRaw : 'MONTH';
  const scope = parseScopeParam(req.query.scope ? String(req.query.scope) : undefined);
  const yearRaw = req.query.year ? parseInt(String(req.query.year), 10) : undefined;

  const result = await getSummary(req.tenantId, scope, grain, {
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
    year: yearRaw && Number.isFinite(yearRaw) ? yearRaw : undefined,
    fxRates: parseFxParam(req.query.fx ? String(req.query.fx) : undefined),
    reportCurrency: req.query.currency ? String(req.query.currency).toUpperCase() : undefined,
    includeOverhead: parseOverhead(req.query.overhead ? String(req.query.overhead) : undefined),
  });
  res.json(result);
}));

// ── GET /api/profitability/cashflow (Faz B) ─────────────────────────────────
// Konsolide nakit pozisyonu serisi + açık pencereleri. As-of birleştirme:
// geçmiş = gerçekleşen, gelecek = plan.
router.get('/cashflow', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const scope = parseScopeParam(req.query.scope ? String(req.query.scope) : undefined);
  const result = await getCashflow(req.tenantId, scope, {
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
    from: parseDate(req.query.from ? String(req.query.from) : undefined),
    to: parseDate(req.query.to ? String(req.query.to) : undefined),
    fxRates: parseFxParam(req.query.fx ? String(req.query.fx) : undefined),
    includeOverhead: parseOverhead(req.query.overhead ? String(req.query.overhead) : undefined),
  });
  res.json(result);
}));

// ── GET /api/profitability/treasury (Faz B — Faz 1: faiz) ───────────────────
// Nakit açığı finansman maliyeti + fazla değerlendirme getirisi → hazine katkısı.
router.get('/treasury', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const scope = parseScopeParam(req.query.scope ? String(req.query.scope) : undefined);
  const result = await getTreasury(req.tenantId, scope, {
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
    from: parseDate(req.query.from ? String(req.query.from) : undefined),
    to: parseDate(req.query.to ? String(req.query.to) : undefined),
    fxRates: parseFxParam(req.query.fx ? String(req.query.fx) : undefined),
    includeOverhead: parseOverhead(req.query.overhead ? String(req.query.overhead) : undefined),
  });
  res.json(result);
}));

// ── GET /api/profitability/instruments (Faz D) ──────────────────────────────
// Finansal enstrüman senaryoları (faktoring / mevduat / forward FX) — baz duruma
// karşı deterministik değer deltaları. Ayarlanabilir: factoringDiscountPct,
// factoringHorizonDays, depositRatePct, depositTermDays, forwardHorizonDays.
router.get('/instruments', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const scope = parseScopeParam(req.query.scope ? String(req.query.scope) : undefined);
  const num = (k: string): number | undefined => {
    const v = req.query[k];
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const params = {
    factoringAnnualDiscountPct: num('factoringDiscountPct'),
    factoringHorizonDays: num('factoringHorizonDays'),
    depositRatePct: num('depositRatePct'),
    depositTermDays: num('depositTermDays'),
    forwardHorizonDays: num('forwardHorizonDays'),
  };
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const result = await getInstruments(req.tenantId, scope, {
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
    from: parseDate(req.query.from ? String(req.query.from) : undefined),
    to: parseDate(req.query.to ? String(req.query.to) : undefined),
    fxRates: parseFxParam(req.query.fx ? String(req.query.fx) : undefined),
    includeOverhead: parseOverhead(req.query.overhead ? String(req.query.overhead) : undefined),
    params: cleaned,
  });
  res.json(result);
}));

// ── GET /api/profitability/dmo (Faz E) — DMO kanalı, lisanslı, kümülatif DIŞI
// DMO ekonomisi (risturn + komisyon + kur açığı) proje marjından farklı → ayrı.
// requireEntitlement: DMO_MODULE lisansı yoksa 402.
const DMO_GRAINS: DmoGrain[] = ['MONTH', 'QUARTER', 'YEAR', 'INSTITUTION'];
router.get('/dmo', requireRole(VIEW_ROLES), requireEntitlement('DMO_MODULE'), asyncHandler(async (req: Request, res: Response) => {
  const gRaw = String(req.query.grain || 'QUARTER').toUpperCase() as DmoGrain;
  const grain: DmoGrain = DMO_GRAINS.includes(gRaw) ? gRaw : 'QUARTER';
  const yearRaw = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const result = await getDmoProfitability(req.tenantId, {
    grain,
    year: yearRaw && Number.isFinite(yearRaw) ? yearRaw : undefined,
    asOf: parseDate(req.query.asOf ? String(req.query.asOf) : undefined),
  });
  res.json(result);
}));

// ── Faz C: planlı-defter anlık görüntüsü (plan-drift) ───────────────────────

// GET /api/profitability/snapshots?periodKey=&scope=
router.get('/snapshots', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const rows = await listSnapshots(req.tenantId, {
    periodKey: req.query.periodKey ? String(req.query.periodKey) : undefined,
    scope: req.query.scope ? String(req.query.scope) : undefined,
    limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
  });
  res.json({ rows });
}));

// GET /api/profitability/plan-drift?periodKey=  — planın dönem tahmini asOf ekseninde nasıl kaydı
router.get('/plan-drift', requireRole(VIEW_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const series = await getPlanDrift(req.tenantId, {
    periodKey: req.query.periodKey ? String(req.query.periodKey) : undefined,
  });
  res.json({ series });
}));

// POST /api/profitability/snapshot  — anlık snapshot al (GM/FINANCE_MGR)
router.post('/snapshot', requireRole(SNAPSHOT_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const result = await takeSnapshot(req.tenantId, {});
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'PROFITABILITY_SNAPSHOT',
    entityType: 'PROFITABILITY', entityId: result.asOfKey,
    details: { written: result.written, periodKeys: result.periodKeys },
  });
  res.status(201).json(result);
}));

export default router;
