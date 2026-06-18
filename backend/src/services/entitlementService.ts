import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { getPlugin, PLUGIN_CATALOG, type AgentMode } from './pluginCatalog';

// Lisans imzalama sırrı. Üretimde ortam değişkeninden gelir; aksi halde sabit
// bir geliştirme sırrı kullanılır. İmza, anahtarın müşteri tarafından kolayca
// taklit edilmesini engeller (upsell SKU'su olduğu için).
const LICENSE_SECRET = process.env.PLUGIN_LICENSE_SECRET || 'enflow-plugin-license-secret-v1';

/** pluginKey + gün için deterministik kısa imza (HMAC-SHA256 → 10 hex). */
function signaturePart(pluginKey: string, days?: number): string {
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(`${pluginKey}:${days ?? 0}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
}

/**
 * İmzalı lisans anahtarı üretir (parseLicenseKey'in tersi).
 * Format: ENF-PLUGIN-<PLUGINKEY>[-D<gün>]-<İMZA>
 *   örn. ENF-PLUGIN-AGENT_TENDER-D365-3F9A2C7B10
 * Süresiz (perpetual) için gün atlanır: ENF-PLUGIN-AGENT_TENDER-<İMZA>
 */
export function generateLicenseKey(pluginKey: string, days?: number): { ok: boolean; error?: string; licenseKey?: string } {
  const plugin = getPlugin(pluginKey);
  if (!plugin) return { ok: false, error: 'Bilinmeyen eklenti' };
  const validDays = days && days > 0 ? Math.floor(days) : undefined;
  const sig = signaturePart(plugin.key, validDays);
  const daysPart = validDays ? `-D${validDays}` : '';
  return { ok: true, licenseKey: `ENF-PLUGIN-${plugin.key}${daysPart}-${sig}` };
}

// ── Eklenti Yetkilendirme Servisi (Entitlement) ──────────────────────────────
// Çekirdek abonelikten bağımsız, eklenti-bazlı lisans kapısı.
// "isPluginEntitled" tek doğruluk kaynağı: bir eklenti akışa katılabilir mi?

/**
 * Tenant'ın bir eklentiye AKTİF erişimi var mı?
 * ACTIVE veya TRIAL + (expiresAt yoksa ya da gelecekte) → true.
 */
export async function isPluginEntitled(tenantId: string, pluginKey: string): Promise<boolean> {
  const ent = await prisma.pluginEntitlement.findUnique({
    where: { tenantId_pluginKey: { tenantId, pluginKey } },
  });
  if (!ent) return false;
  if (ent.status !== 'ACTIVE' && ent.status !== 'TRIAL') return false;
  if (ent.expiresAt && ent.expiresAt.getTime() < Date.now()) return false;
  return true;
}

/** Tenant'ın tüm eklenti yetkilerini katalogla birleştirip döner (UI için). */
export async function listEntitlementsWithCatalog(tenantId: string) {
  const ents = await prisma.pluginEntitlement.findMany({ where: { tenantId } });
  const byKey = new Map(ents.map((e) => [e.pluginKey, e]));
  const now = Date.now();
  return PLUGIN_CATALOG.map((plugin) => {
    const ent = byKey.get(plugin.key) ?? null;
    const active =
      !!ent &&
      (ent.status === 'ACTIVE' || ent.status === 'TRIAL') &&
      (!ent.expiresAt || ent.expiresAt.getTime() >= now);
    return {
      plugin,
      entitlement: ent,
      active,
    };
  });
}

/**
 * Lisans anahtarı aktivasyonu. Bu pilot sürümde anahtar formatı:
 *   ENF-PLUGIN-<PLUGINKEY>[-<gün>]   örn. ENF-PLUGIN-AGENT_TENDER-365
 * Gerçek dağıtımda imzalı anahtar/JWT ile değiştirilebilir; arayüz korunur.
 * Geçerliyse PluginEntitlement upsert eder (ACTIVE).
 */
export async function activatePluginLicense(
  tenantId: string,
  licenseKey: string,
  activatedById?: string,
): Promise<{ ok: boolean; error?: string; pluginKey?: string }> {
  const parsed = parseLicenseKey(licenseKey);
  if (!parsed) return { ok: false, error: 'Geçersiz lisans anahtarı formatı' };
  if (parsed.signed && !parsed.valid) return { ok: false, error: 'Lisans imzası doğrulanamadı' };
  const plugin = getPlugin(parsed.pluginKey);
  if (!plugin) return { ok: false, error: 'Bilinmeyen eklenti' };

  const expiresAt =
    parsed.days && parsed.days > 0
      ? new Date(Date.now() + parsed.days * 24 * 60 * 60 * 1000)
      : null;

  await prisma.pluginEntitlement.upsert({
    where: { tenantId_pluginKey: { tenantId, pluginKey: plugin.key } },
    create: {
      tenantId,
      pluginKey: plugin.key,
      status: 'ACTIVE',
      licenseKey,
      mode: plugin.defaultMode ?? 'ADVISORY',
      activatedById: activatedById ?? null,
      activatedAt: new Date(),
      expiresAt,
    },
    update: {
      status: 'ACTIVE',
      licenseKey,
      activatedById: activatedById ?? null,
      activatedAt: new Date(),
      expiresAt,
    },
  });
  return { ok: true, pluginKey: plugin.key };
}

/** Eklenti modunu/yapılandırmasını güncelle (yalnız izinli modlar). */
export async function updateEntitlement(
  tenantId: string,
  pluginKey: string,
  patch: { mode?: AgentMode; status?: string; config?: string },
): Promise<{ ok: boolean; error?: string }> {
  const plugin = getPlugin(pluginKey);
  if (!plugin) return { ok: false, error: 'Bilinmeyen eklenti' };
  const existing = await prisma.pluginEntitlement.findUnique({
    where: { tenantId_pluginKey: { tenantId, pluginKey } },
  });
  if (!existing) return { ok: false, error: 'Eklenti lisansı yok' };

  if (patch.mode && plugin.allowedModes && !plugin.allowedModes.includes(patch.mode)) {
    return { ok: false, error: `Bu eklenti için izin verilmeyen mod: ${patch.mode}` };
  }

  await prisma.pluginEntitlement.update({
    where: { tenantId_pluginKey: { tenantId, pluginKey } },
    data: {
      ...(patch.mode ? { mode: patch.mode } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.config !== undefined ? { config: patch.config } : {}),
    },
  });
  return { ok: true };
}

/**
 * Lisans anahtarını ayrıştırır. Hem yeni imzalı hem eski imzasız formatı destekler:
 *   ENF-PLUGIN-<PLUGINKEY>[-D<gün>]-<İMZA>   (yeni, imzalı)
 *   ENF-PLUGIN-<PLUGINKEY>[-<gün>]            (eski, imzasız — geriye uyumlu)
 * `signed` imzanın var olup olmadığını, `valid` imzanın doğrulanıp doğrulanmadığını belirtir.
 */
function parseLicenseKey(
  key: string,
): { pluginKey: string; days?: number; signed: boolean; valid: boolean } | null {
  const trimmed = (key || '').trim().toUpperCase();
  const prefix = 'ENF-PLUGIN-';
  if (!trimmed.startsWith(prefix)) return null;
  const tokens = trimmed.slice(prefix.length).split('-');
  const pluginKey = tokens[0];
  if (!pluginKey || !/^[A-Z_]+$/.test(pluginKey)) return null;

  let days: number | undefined;
  let signature: string | undefined;
  for (const t of tokens.slice(1)) {
    if (/^D\d+$/.test(t)) days = parseInt(t.slice(1), 10);       // yeni gün gösterimi
    else if (/^\d+$/.test(t)) days = parseInt(t, 10);            // eski (imzasız) gün
    else signature = t;                                          // imza
  }

  const signed = !!signature;
  const valid = signed ? signature === signaturePart(pluginKey, days) : true;
  return { pluginKey, days, signed, valid };
}
