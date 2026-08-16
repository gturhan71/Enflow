import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { isAIConfigured, assertSafeAiUrl } from '../services/aiClient';
import { verifyLicenseToken } from '../services/licenseVerify';
import { encryptForTenant } from '../services/tenantEncryption';
import { PLAN_MAP } from '../planCatalog';

const router: Router = Router();

// Tenant izolasyonu: yalnız çağıranın KENDİ tenant'ını döndür (tüm şirketleri
// listelemek sızıntıydı). tenantMiddleware token↔tenant eşleşmesini doğrular.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  // dekWrapped ASLA client'a çıkmaz — şifreleme anahtarı sarmalı, sunucu-içi sır.
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, omit: { dekWrapped: true } });
  res.json(tenant ? [tenant] : []);
}));

// Yeni tenant oluşturma — yalnız kimliği doğrulanmış GM. (Eskiden auth'suz AÇIKtı.)
router.post('/', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Şirket adı zorunludur.' });

  const tenant = await prisma.$transaction(async (tx) => {
    // dekWrapped ASLA client'a çıkmaz — şifreleme anahtarı sarmalı, sunucu-içi sır.
    const newTenant = await tx.tenant.create({ data: { name }, omit: { dekWrapped: true } });
    await tx.subscription.create({ data: { tenantId: newTenant.id, plan: 'STARTER' } });
    return newTenant;
  });

  res.json(tenant);
}));

// NOT: Bare `/:id` rotaları, `/module-settings` ve `/ai-settings` gibi sabit
// segmentleri gölgelememesi için DOSYA SONUNA taşındı (specific-before-param).

router.put('/:id/subscription', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  // IDOR koruması: yalnız çağıranın KENDİ tenant'ı üzerinde işlem yapılır.
  // URL parametresi yetkili kaynak DEĞİL — req.tenantId (imzalı token) kullanılır.
  if (req.params.id && req.params.id !== req.tenantId) {
    return res.status(403).json({ error: 'Yalnız kendi şirketinizin aboneliğini değiştirebilirsiniz.' });
  }
  const tenantId = req.tenantId;
  const { plan } = req.body;

  if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ error: 'Geçersiz plan tipi.' });
  }

  const subscription = await prisma.subscription.upsert({
    where: { tenantId },
    update: { plan },
    create: { tenantId, plan }
  });

  res.json(subscription);
}));

// ── Lisans aktivasyonu (Ed25519 imzalı, tenant-bağlı — yalnız DOĞRULA) ───────
// Lisans vendor aracıyla üretilir; burada yalnız PUBLIC key ile doğrulanır.
// Eski imzasız base64-JSON lisansları KABUL EDİLMEZ (sert kesim).
// GM-only: plan/limit değiştiren bir işlem — önceden rol kapısı yoktu, herhangi
// bir kimliği doğrulanmış kullanıcı tenant'ın planını değiştirebiliyordu.
router.post('/activate-license', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
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
  const plan = PLAN_MAP[(p.sku || '').toUpperCase()] || 'PROFESSIONAL';

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
    // SSRF azaltımı: kaydetmeden önce baseUrl'i doğrula.
    try { assertSafeAiUrl(baseUrl!.trim()); }
    catch (e) { return res.status(400).json({ error: (e as Error).message }); }
    // apiKey boş gelirse mevcut (zaten şifreli) korunur — gereksiz decrypt/re-encrypt yok.
    // Yeni değer geldiyse tenant'ın DEK'i ile şifrelenip saklanır (bkz. tenantEncryption.ts).
    const encryptedApiKey = apiKey && apiKey.trim()
      ? await encryptForTenant(req.tenantId, apiKey.trim())
      : (prev.apiKey || '');
    ms.ai = {
      baseUrl: baseUrl!.trim(),
      model: (model || '').trim(),
      label: (label || '').trim(),
      apiKey: encryptedApiKey,
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

// ── Fırsat ilerleme teyidi — periyodik zorunlu check-in ayarları (GM only) ───
// intervalDays: kaç günde bir teyit istenir; graceBusinessDays: teyit istenip
// yönetime eskale edilene kadarki iş günü toleransı. bkz. opportunityProgressService.ts.
router.get('/opportunity-progress-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const cfg = (ms.opportunityProgress as { intervalDays?: number; graceBusinessDays?: number } | undefined) || {};
  res.json({
    intervalDays: cfg.intervalDays && cfg.intervalDays > 0 ? cfg.intervalDays : 14,
    graceBusinessDays: cfg.graceBusinessDays && cfg.graceBusinessDays > 0 ? cfg.graceBusinessDays : 3,
  });
}));

router.put('/opportunity-progress-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { intervalDays, graceBusinessDays } = req.body as { intervalDays?: number; graceBusinessDays?: number };
  if (!Number.isFinite(intervalDays) || (intervalDays as number) <= 0) {
    return res.status(400).json({ error: 'intervalDays pozitif bir sayı olmalı.' });
  }
  if (!Number.isFinite(graceBusinessDays) || (graceBusinessDays as number) <= 0) {
    return res.status(400).json({ error: 'graceBusinessDays pozitif bir sayı olmalı.' });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.opportunityProgress = { intervalDays: Math.round(intervalDays as number), graceBusinessDays: Math.round(graceBusinessDays as number) };
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'OPPORTUNITY_PROGRESS_SETTINGS_UPDATED',
    entityType: 'TENANT', entityId: req.tenantId, details: ms.opportunityProgress as Record<string, unknown>,
  });
  res.json(ms.opportunityProgress);
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

// ── Dashboard kokpit şablonları — rol bazlı varsayılan widget seçimi (GM düzenler,
// herkes okur) ────────────────────────────────────────────────────────────
// Hardcode edilmiş ROLE_DASHBOARD (frontend widgetCatalog.ts) her tenant için
// aynıydı; artık tenant GM'i kendi organizasyonuna göre override edebilir.
// Override edilmemiş roller frontend'de hardcode varsayılana düşer.
router.get('/dashboard-role-templates', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  res.json((ms.dashboardRoleTemplates as Record<string, string[]>) || {});
}));

router.put('/dashboard-role-templates', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { role, widgets } = req.body as { role?: string; widgets?: string[] };
  if (!role || typeof role !== 'string') return res.status(400).json({ error: 'role zorunludur.' });
  if (!Array.isArray(widgets) || widgets.some(w => typeof w !== 'string')) {
    return res.status(400).json({ error: 'widgets dizisi zorunludur.' });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const templates = { ...(ms.dashboardRoleTemplates as Record<string, string[]> || {}) };
  if (widgets.length === 0) delete templates[role];
  else templates[role] = widgets;
  ms.dashboardRoleTemplates = templates;
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'DASHBOARD_ROLE_TEMPLATE_UPDATED',
    entityType: 'TENANT', entityId: req.tenantId, details: { role, widgetCount: widgets.length },
  });
  res.json(templates);
}));

// ── Tenant adı güncelle (bare `/:id` — sabit segment rotalarından SONRA) ─────
// Yalnız kimliği doğrulanmış GM ve YALNIZ kendi tenant'ı. (Eskiden auth'suz AÇIKtı.)
router.put('/:id', tenantMiddleware, requireRole(['GENERAL_MANAGER']), asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id && req.params.id !== req.tenantId) {
    return res.status(403).json({ error: 'Yalnız kendi şirketinizi düzenleyebilirsiniz.' });
  }
  const { name } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Şirket adı zorunludur.' });
  // dekWrapped ASLA client'a çıkmaz — şifreleme anahtarı sarmalı, sunucu-içi sır.
  const tenant = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { name },
    omit: { dekWrapped: true },
  });
  res.json(tenant);
}));

export default router;
