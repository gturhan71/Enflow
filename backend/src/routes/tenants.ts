import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { isAIConfigured } from '../services/aiClient';

const router: Router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Şirket adı zorunludur.' });

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({ data: { name } });
    await tx.subscription.create({ data: { tenantId: newTenant.id, plan: 'STARTER' } });
    return newTenant;
  });

  res.json(tenant);
}));

// NOT: Bare `/:id` rotaları, `/module-settings` ve `/ai-settings` gibi sabit
// segmentleri gölgelememesi için DOSYA SONUNA taşındı (specific-before-param).

router.put('/:id/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const { plan } = req.body;

  if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ error: 'Geçersiz plan tipi.' });
  }

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: tenantId as string },
    update: { plan },
    create: { tenantId: tenantId as string, plan }
  });

  res.json(subscription);
}));

// ── Lisans aktivasyonu ─────────────────────────────────────────────────────
router.post('/activate-license', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body as { licenseKey: string };
  if (!licenseKey) return res.status(400).json({ error: 'Lisans anahtarı zorunludur.' });

  let payload: {
    tenantId: string;
    companyName: string;
    model: string;
    expiryDate: string;
    isTrial?: boolean;
    limits: { users: number; storage: number };
    signature: string;
  };

  try {
    payload = JSON.parse(Buffer.from(licenseKey, 'base64').toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Geçersiz lisans anahtarı formatı.' });
  }

  // Tenant uniqueness check — anahtar başka bir tenant için üretilmiş
  if (payload.tenantId !== req.tenantId) {
    return res.status(403).json({ error: 'Bu lisans anahtarı şirketiniz için üretilmemiş.' });
  }

  // Expiry check
  if (new Date(payload.expiryDate) < new Date()) {
    return res.status(400).json({ error: 'Bu lisans anahtarının süresi dolmuştur.' });
  }

  // Model → Plan mapping
  const planMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    KOBI: 'STARTER',
    PAY_AS_YOU_GO: 'PROFESSIONAL',
    ON_PREMISE: 'ENTERPRISE',
  };
  const plan = planMap[payload.model];
  if (!plan) return res.status(400).json({ error: 'Bilinmeyen lisans modeli.' });

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: req.tenantId },
    update: {
      plan,
      licenseKey,
      licenseModel: payload.model,
      licenseExpiryDate: new Date(payload.expiryDate),
      licensedUserLimit: payload.limits.users,
      licensedStorageLimit: payload.limits.storage,
    },
    create: {
      tenantId: req.tenantId,
      plan,
      licenseKey,
      licenseModel: payload.model,
      licenseExpiryDate: new Date(payload.expiryDate),
      licensedUserLimit: payload.limits.users,
      licensedStorageLimit: payload.limits.storage,
    },
  });

  res.json(subscription);
}));

// ── Modül ayarları (GM only) ────────────────────────────────────────────────
const GM = requireRole(['GENERAL_MANAGER']);

// YZ yapılandırılmış mı? — sır içermez, tüm tenant kullanıcıları okuyabilir
// (modül-bazlı YZ kapısı bunu kullanır; GM-only /ai-settings'ten ayrıdır).
router.get('/ai-status', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.json({ configured: await isAIConfigured(req.tenantId) });
}));

router.get('/module-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadı.' });
  try {
    const ms = JSON.parse(tenant.moduleSettings || '{}') as Record<string, unknown>;
    // YZ API anahtarını ASLA bu uçtan sızdırma (hasKey yeterli — bkz. /ai-settings).
    if (ms.ai && typeof ms.ai === 'object') {
      const ai = ms.ai as Record<string, unknown>;
      ms.ai = { baseUrl: ai.baseUrl, model: ai.model, label: ai.label, hasKey: Boolean(ai.apiKey) };
    }
    res.json(ms);
  } catch {
    res.json({});
  }
}));

router.put('/module-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { promotedModules } = req.body as { promotedModules: string[] };
  if (!Array.isArray(promotedModules)) return res.status(400).json({ error: 'promotedModules array zorunlu.' });
  // Diğer ayar bölümlerini (finance, ai…) korumak için MERGE et — ezme.
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.promotedModules = promotedModules;
  const updated = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { moduleSettings: JSON.stringify(ms) },
  });
  res.json(JSON.parse(updated.moduleSettings));
}));

// ── YZ (Yapay Zeka) entegrasyonu — sağlayıcıdan bağımsız (GM only) ───────────
// Tenant kendi API key'ini girer; hangi YZ olduğu önemsiz (OpenAI-uyumlu uç).
// Anahtar ASLA echo edilmez; GET yalnız hasKey döner.
router.get('/ai-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const ai = (ms.ai as { baseUrl?: string; model?: string; label?: string; apiKey?: string } | undefined) || {};
  res.json({
    baseUrl: ai.baseUrl || '',
    model: ai.model || '',
    label: ai.label || '',
    hasKey: Boolean(ai.apiKey),
  });
}));

router.put('/ai-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { baseUrl, model, label, apiKey } = req.body as {
    baseUrl?: string; model?: string; label?: string; apiKey?: string;
  };
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const prev = (ms.ai as { apiKey?: string } | undefined) || {};
  if (!(baseUrl || '').trim()) {
    // baseUrl boş → entegrasyonu tamamen kaldır (bağlantıyı kes; anahtar dahil sıfırla)
    ms.ai = { baseUrl: '', model: '', label: '', apiKey: '' };
  } else {
    ms.ai = {
      baseUrl: baseUrl!.trim(),
      model: (model || '').trim(),
      label: (label || '').trim(),
      // apiKey boş gelirse mevcut korunur (UI maskeli gösterir, her kayıtta tekrar istemez)
      apiKey: apiKey && apiKey.trim() ? apiKey.trim() : (prev.apiKey || ''),
    };
  }
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  // Denetim izi — anahtar İÇERMEZ.
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'AI_SETTINGS_UPDATED',
    entityType: 'TENANT', entityId: req.tenantId,
    details: { baseUrl: (ms.ai as { baseUrl: string }).baseUrl, model: (ms.ai as { model: string }).model, hasKey: Boolean((ms.ai as { apiKey: string }).apiKey) },
  });
  const ai = ms.ai as { baseUrl: string; model: string; label: string; apiKey: string };
  res.json({ baseUrl: ai.baseUrl, model: ai.model, label: ai.label, hasKey: Boolean(ai.apiKey) });
}));

// ── Yönetişim ayarları — Görev Ayrılığı (SoD) toggle (GM only) ──────────────
interface ApprovalTierBody { maxAmount: number; roles: string[] }
router.get('/governance-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const g = (ms.governance as { enforceSoD?: boolean; approvalMatrix?: ApprovalTierBody[] }) || {};
  res.json({
    enforceSoD: g.enforceSoD !== false,
    approvalMatrix: Array.isArray(g.approvalMatrix) ? g.approvalMatrix : null, // null = sabit swimlane şablonu
  });
}));

router.put('/governance-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { enforceSoD, approvalMatrix } = req.body as { enforceSoD?: boolean; approvalMatrix?: ApprovalTierBody[] | null };
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const prev = (ms.governance as Record<string, unknown>) || {};
  const next: Record<string, unknown> = { ...prev, enforceSoD: enforceSoD !== false };
  if (approvalMatrix !== undefined) {
    // Geçerli matris: tutar+rol dizisi; boş/null → matrisi kaldır (şablona dön).
    const valid = Array.isArray(approvalMatrix)
      && approvalMatrix.length > 0
      && approvalMatrix.every(t => typeof t?.maxAmount === 'number' && Array.isArray(t?.roles) && t.roles.length > 0);
    if (valid) next.approvalMatrix = approvalMatrix;
    else delete next.approvalMatrix;
  }
  ms.governance = next;
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'GOVERNANCE_SETTINGS_UPDATED', entityType: 'TENANT', entityId: req.tenantId, details: { enforceSoD: next.enforceSoD, hasMatrix: Boolean(next.approvalMatrix) } });
  res.json({ enforceSoD: next.enforceSoD, approvalMatrix: next.approvalMatrix ?? null });
}));

// ── Tenant adı güncelle (bare `/:id` — sabit segment rotalarından SONRA) ─────
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const tenant = await prisma.tenant.update({
    where: { id: req.params.id as string },
    data: { name }
  });
  res.json(tenant);
}));

export default router;
