import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { PLUGIN_CATALOG } from '../services/pluginCatalog';
import {
  listEntitlementsWithCatalog,
  activatePluginLicense,
  updateEntitlement,
  generateLicenseKey,
} from '../services/entitlementService';
import { runAgent, ratifyAgentRun, hasHandler } from '../services/virtualAgentService';

const router: Router = Router();

// Katalog — satılabilir eklentiler (global, tenant-bağımsız)
router.get('/catalog', tenantMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  res.json(PLUGIN_CATALOG.map((p) => ({ ...p, hasHandler: hasHandler(p.key) })));
}));

// Tenant'ın eklenti yetkileri (katalogla birleşik)
router.get('/entitlements', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const data = await listEntitlementsWithCatalog(req.tenantId);
  res.json(data);
}));

// Lisans anahtarı ÜRET — yalnızca GM (satıcı/yönetici konsolu). İmzalı anahtar döner.
router.post('/generate-key', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  const { pluginKey, days } = req.body as { pluginKey?: string; days?: number };
  if (!pluginKey) {
    res.status(400).json({ error: 'pluginKey gerekli' });
    return;
  }
  const parsedDays = days != null && days !== 0 ? Number(days) : undefined;
  if (parsedDays != null && (!Number.isFinite(parsedDays) || parsedDays < 0)) {
    res.status(400).json({ error: 'Geçersiz gün değeri' });
    return;
  }
  const result = generateLicenseKey(pluginKey, parsedDays);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, licenseKey: result.licenseKey, pluginKey, days: parsedDays ?? null });
}));

// Lisans aktivasyonu (anahtar ile)
router.post('/activate', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, activatedById } = req.body as { licenseKey?: string; activatedById?: string };
  if (!licenseKey) {
    res.status(400).json({ error: 'licenseKey gerekli' });
    return;
  }
  const result = await activatePluginLicense(req.tenantId, licenseKey, activatedById);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
}));

// Eklenti modu/durum/yapılandırma güncelle
router.put('/entitlements/:pluginKey', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { mode, status, config } = req.body as { mode?: 'ADVISORY' | 'AUTONOMOUS'; status?: string; config?: string };
  const result = await updateEntitlement(req.tenantId, String(req.params.pluginKey), { mode, status, config });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
}));

// Lisansı iptal et (eklentiyi devre dışı bırak)
router.delete('/entitlements/:pluginKey', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const pluginKey = String(req.params.pluginKey);
  const existing = await prisma.pluginEntitlement.findUnique({
    where: { tenantId_pluginKey: { tenantId: req.tenantId, pluginKey } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Eklenti lisansı yok' });
    return;
  }
  await prisma.pluginEntitlement.update({
    where: { tenantId_pluginKey: { tenantId: req.tenantId, pluginKey } },
    data: { status: 'DISABLED' },
  });
  res.json({ ok: true });
}));

// ── Sanal Agent Çalıştırma / Ratifikasyon ────────────────────────────────────

// Agent'ı manuel çalıştır
router.post('/agents/:pluginKey/run', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { entityId, triggeredById } = req.body as { entityId?: string; triggeredById?: string };
  if (!entityId) {
    res.status(400).json({ error: 'entityId gerekli' });
    return;
  }
  const result = await runAgent({
    tenantId: req.tenantId,
    pluginKey: String(req.params.pluginKey),
    entityId,
    triggeredById,
  });
  if (!result.ok) {
    // 402 Payment Required — lisans yoksa upsell sinyali
    const code = result.error?.includes('lisans') ? 402 : 400;
    res.status(code).json({ error: result.error });
    return;
  }
  res.status(201).json(result.run);
}));

// Agent çalıştırmaları (filtre ?status=&pluginKey=)
router.get('/runs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.pluginKey) where.pluginKey = String(req.query.pluginKey);
  const runs = await prisma.agentRun.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(runs);
}));

// Tek agent çalıştırması — köken etiketi drill-down (badge → detay)
router.get('/runs/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const run = await prisma.agentRun.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!run) {
    res.status(404).json({ error: 'Çalıştırma bulunamadı' });
    return;
  }
  res.json(run);
}));

// Çıktıyı ratifiye et / reddet
router.post('/runs/:id/ratify', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { decision, ratifiedById, ratifyNote } = req.body as {
    decision?: 'RATIFY' | 'REJECT'; ratifiedById?: string; ratifyNote?: string;
  };
  if (decision !== 'RATIFY' && decision !== 'REJECT') {
    res.status(400).json({ error: 'decision RATIFY veya REJECT olmalı' });
    return;
  }
  const result = await ratifyAgentRun({
    tenantId: req.tenantId,
    runId: String(req.params.id),
    decision,
    ratifiedById,
    ratifyNote,
  });
  if (!result.ok) {
    res.status(409).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
}));

export default router;
