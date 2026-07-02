import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { nextDocumentNumber } from '../services/documentNumberService';
import {
  UNIT_DEFINITIONS,
  getUnitDefinition,
  computeUnitMetrics,
  computeOverview,
  computeWorkflowBottlenecks,
  computeConsolidation,
  resolveEscalationTarget,
} from '../services/unitReportingService';
import { computeDashboard } from '../services/dashboardService';
import { computeFunnel, computeTenderAnalytics, computeBomVariance, computeConcentration, computeForecast, computeBidScorecard, computeDocumentPortfolio, computeBusinessHealth, computeProjectHealth, computeCustomerHealth, computeDmoAnalytics } from '../services/analyticsService';

const router: Router = Router();

// ── Büyüme Analitiği Faz 1 — salt-okunur, tenant-scoped ──────────────────────
router.get('/funnel', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeFunnel(req.tenantId));
}));

// Tender kazanma kırılımı (#4)
router.get('/tender-analytics', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeTenderAnalytics(req.tenantId));
}));

// BoM maliyet varyansı (#7)
router.get('/bom-variance', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeBomVariance(req.tenantId));
}));

// Müşteri & kamu konsantrasyonu (#12)
router.get('/concentration', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeConcentration(req.tenantId));
}));

// Olasılık-ağırlıklı forecast + hedefe kapsama (#1)
router.get('/forecast', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeForecast(req.tenantId));
}));

// Satış hedefi (kota) — moduleSettings.salesTarget; PUT yalnız GM.
router.put('/sales-target', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  const target = Number((req.body as { target?: unknown }).target);
  if (!Number.isFinite(target) || target < 0) return res.status(400).json({ error: 'Geçerli bir hedef girin.' });
  const t = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { moduleSettings: true } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.salesTarget = target;
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  res.json({ target });
}));

// Bid / No-Bid skorkartı (#3) — karar-öncesi ihaleler
router.get('/bid-scorecard', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeBidScorecard(req.tenantId));
}));

// Belge portföyü (#11) — Şirket Evrakları envanteri + geçerlilik + yeniden-kullanım
router.get('/document-portfolio', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeDocumentPortfolio(req.tenantId));
}));

// Kurumsal kompozit sağlık skoru (#14a) — 5 sütun tek skor
router.get('/business-health', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeBusinessHealth(req.tenantId));
}));

// Proje sağlık skoru (#14b) — aktif projeler marj/takvim/bütçe
router.get('/project-health', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeProjectHealth(req.tenantId));
}));

// Müşteri sağlık skoru (#14c) — ödeme/kazanma/aktivite/sadakat
router.get('/customer-health', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeCustomerHealth(req.tenantId));
}));

// DMO kanalı analitiği — büyüme analizine DMO operasyonu
router.get('/dmo-analytics', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json(await computeDmoAnalytics(req.tenantId));
}));

// Opsiyonel docNumber üretimi (diğer route'larla aynı pattern)
async function maybeDocNumber(tenantId: string, categoryCode?: string): Promise<string | null> {
  if (!categoryCode) return null;
  return nextDocumentNumber(tenantId, categoryCode);
}

// Birim sözlüğü (UI'da seçici doldurmak için)
router.get('/units', tenantMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  res.json(UNIT_DEFINITIONS);
}));

// Tek birimin canlı metrikleri — ?unitKey=&start=&end=
router.get('/unit-metrics', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const unitKey = String(req.query.unitKey || '');
  const start = req.query.start ? String(req.query.start) : undefined;
  const end = req.query.end ? String(req.query.end) : undefined;
  if (!unitKey) {
    res.status(400).json({ error: 'unitKey gerekli' });
    return;
  }
  const result = await computeUnitMetrics(req.tenantId, unitKey, start, end);
  if (!result) {
    res.status(404).json({ error: 'Bilinmeyen birim' });
    return;
  }
  res.json(result);
}));

// İş akışı darboğazı (açık ApprovalChain'lerin beklediği birim)
router.get('/bottlenecks', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const result = await computeWorkflowBottlenecks(req.tenantId);
  res.json(result);
}));

// Konsolide genel bakış — ?start=&end=
router.get('/overview', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const start = req.query.start ? String(req.query.start) : undefined;
  const end = req.query.end ? String(req.query.end) : undefined;
  const result = await computeOverview(req.tenantId, start, end);
  res.json(result);
}));

// Role-bazlı Dashboard aggregator (zamana-duyarlı + KPI + kişisel)
router.get('/dashboard', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const result = await computeDashboard(req.tenantId, req.userId);
  res.json(result);
}));

// Presales → Satışa devredilen BoM'lar (yönetici liste/detay) — ?start=&end=
router.get('/bom-handoffs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (req.query.start && req.query.end) {
    where.lastHandoffAt = { gte: new Date(String(req.query.start)), lte: new Date(String(req.query.end)) };
  }
  const handoffs = await prisma.bomHandoff.findMany({ where, orderBy: { lastHandoffAt: 'desc' } });
  res.json(handoffs);
}));

// ── Birim Raporu (UnitReport): yönetici-yazımı + gönderim/inceleme ───────────

// Liste — ?unitKey=&status=
router.get('/unit-reports', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (req.query.unitKey) where.unitKey = String(req.query.unitKey);
  if (req.query.status) where.status = String(req.query.status);
  // Bir üst yöneticiye yönlenmiş (escalate) bekleyen raporlar
  if (req.query.pendingForReviewer) {
    where.escalatedToId = String(req.query.pendingForReviewer);
    where.status = 'SUBMITTED';
  }
  // Geriye dönük dönem filtresi (periyot başlangıcına göre)
  if (req.query.start && req.query.end) {
    where.periodStart = { gte: new Date(String(req.query.start)) };
    where.periodEnd = { lte: new Date(String(req.query.end)) };
  }
  const reports = await prisma.unitReport.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(reports);
}));

// Konsolidasyon önizleme (submit öncesi canlı) — ?unitKey=&start=&end=
router.get('/report-consolidation', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const unitKey = String(req.query.unitKey || '');
  if (!getUnitDefinition(unitKey)) return res.status(400).json({ error: 'Geçersiz unitKey' });
  const data = await computeConsolidation(
    req.tenantId, unitKey,
    req.query.start ? String(req.query.start) : undefined,
    req.query.end ? String(req.query.end) : undefined,
  );
  res.json(data);
}));

// Tek rapor
router.get('/unit-reports/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const report = await prisma.unitReport.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!report) {
    res.status(404).json({ error: 'Rapor bulunamadı' });
    return;
  }
  res.json(report);
}));

// Oluştur (taslak)
router.post('/unit-reports', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    unitKey?: string; periodStart?: string; periodEnd?: string; periodLabel?: string;
    authorId?: string; authorName?: string;
    highlights?: string; issues?: string; plannedActions?: string; risks?: string; summary?: string;
    categoryCode?: string;
  };
  const def = getUnitDefinition(body.unitKey || '');
  if (!def) {
    res.status(400).json({ error: 'Geçersiz unitKey' });
    return;
  }
  if (!body.periodStart || !body.periodEnd) {
    res.status(400).json({ error: 'periodStart ve periodEnd zorunlu' });
    return;
  }
  const docNumber = await maybeDocNumber(req.tenantId, body.categoryCode);
  const report = await prisma.unitReport.create({
    data: {
      tenantId: req.tenantId,
      unitKey: def.key,
      unitLabel: def.label,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      periodLabel: body.periodLabel ?? null,
      authorId: body.authorId ?? null,
      authorName: body.authorName ?? null,
      highlights: body.highlights ?? null,
      issues: body.issues ?? null,
      plannedActions: body.plannedActions ?? null,
      risks: body.risks ?? null,
      summary: body.summary ?? null,
      docNumber,
    },
  });
  res.status(201).json(report);
}));

// Güncelle — yalnızca DRAFT veya RETURNED düzenlenebilir
router.put('/unit-reports/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitReport.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Rapor bulunamadı' });
    return;
  }
  if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
    res.status(409).json({ error: 'Yalnızca taslak veya iade edilmiş raporlar düzenlenebilir' });
    return;
  }
  const body = req.body as Partial<{
    periodStart: string; periodEnd: string; periodLabel: string;
    highlights: string; issues: string; plannedActions: string; risks: string; summary: string;
  }>;
  const data: Record<string, unknown> = {};
  for (const f of ['periodLabel', 'highlights', 'issues', 'plannedActions', 'risks', 'summary'] as const) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.periodStart) data.periodStart = new Date(body.periodStart);
  if (body.periodEnd) data.periodEnd = new Date(body.periodEnd);
  const report = await prisma.unitReport.update({ where: { id: existing.id }, data });
  res.json(report);
}));

// Sil
router.delete('/unit-reports/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitReport.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Rapor bulunamadı' });
    return;
  }
  await prisma.unitReport.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}));

// Yönetime Sun — gönderim anında metrik snapshot'ı yakalanır
router.post('/unit-reports/:id/submit', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitReport.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Rapor bulunamadı' });
    return;
  }
  if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
    res.status(409).json({ error: 'Yalnızca taslak veya iade edilmiş raporlar sunulabilir' });
    return;
  }
  const [metrics, consolidation, escalation] = await Promise.all([
    computeUnitMetrics(req.tenantId, existing.unitKey, existing.periodStart.toISOString(), existing.periodEnd.toISOString()),
    computeConsolidation(req.tenantId, existing.unitKey, existing.periodStart.toISOString(), existing.periodEnd.toISOString()),
    resolveEscalationTarget(req.tenantId, existing.unitKey),
  ]);
  const report = await prisma.unitReport.update({
    where: { id: existing.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      metricsSnapshot: metrics ? JSON.stringify(metrics) : null,
      consolidationSnapshot: consolidation ? JSON.stringify(consolidation) : null,
      escalatedToId: escalation.id,
      escalatedToName: escalation.name,
    },
  });
  res.json(report);
}));

// İnceleme — { decision: APPROVE|RETURN, reviewedById, reviewedByName, reviewNote }
router.post('/unit-reports/:id/review', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unitReport.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Rapor bulunamadı' });
    return;
  }
  if (existing.status !== 'SUBMITTED') {
    res.status(409).json({ error: 'Yalnızca sunulmuş raporlar incelenebilir' });
    return;
  }
  const { decision, reviewedById, reviewedByName, reviewNote } = req.body as {
    decision?: string; reviewedById?: string; reviewedByName?: string; reviewNote?: string;
  };
  if (decision !== 'APPROVE' && decision !== 'RETURN') {
    res.status(400).json({ error: 'decision APPROVE veya RETURN olmalı' });
    return;
  }
  const report = await prisma.unitReport.update({
    where: { id: existing.id },
    data: {
      status: decision === 'APPROVE' ? 'REVIEWED' : 'RETURNED',
      reviewedById: reviewedById ?? null,
      reviewedByName: reviewedByName ?? null,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });
  res.json(report);
}));

export default router;
