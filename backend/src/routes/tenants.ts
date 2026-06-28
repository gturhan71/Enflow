import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { isAIConfigured } from '../services/aiClient';
import { verifyLicenseToken } from '../services/licenseVerify';

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

// ── Lisans aktivasyonu (Ed25519 imzalı, tenant-bağlı — yalnız DOĞRULA) ───────
// Lisans vendor aracıyla üretilir; burada yalnız PUBLIC key ile doğrulanır.
// Eski imzasız base64-JSON lisansları KABUL EDİLMEZ (sert kesim).
router.post('/activate-license', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body as { licenseKey: string };
  if (!licenseKey) return res.status(400).json({ error: 'Lisans anahtarı zorunludur.' });

  const result = verifyLicenseToken(licenseKey, req.tenantId);
  if (!result.ok) {
    const msg: Record<string, string> = {
      BICIM_HATASI: 'Geçersiz lisans biçimi (imzalı lisans bekleniyor).',
      IMZA_GECERSIZ: 'Lisans imzası doğrulanamadı (geçersiz/kurcalanmış).',
      TENANT_UYUSMAZ: 'Bu lisans şirketiniz için üretilmemiş.',
      SURESI_DOLMUS: 'Lisansın süresi dolmuş.',
      COZUMLEME_HATASI: 'Lisans çözümlenemedi.',
    };
    return res.status(result.reason === 'TENANT_UYUSMAZ' ? 403 : 400).json({ error: msg[result.reason] || 'Lisans doğrulanamadı.' });
  }

  const p = result.payload;
  const planMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    STARTER: 'STARTER', PRO: 'PROFESSIONAL', PROFESSIONAL: 'PROFESSIONAL', ENTERPRISE: 'ENTERPRISE', CUSTOM: 'PROFESSIONAL',
  };
  const plan = planMap[(p.sku || '').toUpperCase()] || 'PROFESSIONAL';

  const data = {
    plan,
    licenseKey,
    licenseModel: p.sku,
    licenseExpiryDate: p.expiresAt ? new Date(p.expiresAt) : null,
    licensedUserLimit: p.limits?.users ?? null,
    licensedStorageLimit: p.limits?.storageGB ?? null,
  };
  const subscription = await prisma.subscription.upsert({
    where: { tenantId: req.tenantId },
    update: data,
    create: { tenantId: req.tenantId, ...data },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'LICENSE_ACTIVATED', entityType: 'SUBSCRIPTION', entityId: subscription.id, details: { sku: p.sku, plan } });
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
