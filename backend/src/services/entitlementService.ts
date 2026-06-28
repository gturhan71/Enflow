import { prisma } from '../prismaClient';
import { getPlugin, PLUGIN_CATALOG, type AgentMode } from './pluginCatalog';
import { verifyLicenseToken } from './licenseVerify';

// NOT: Lisans ÜRETİMİ (imzalama) bu yazılımdan KALDIRILDI. Lisanslar vendor'un
// ayrı aracı (Ed25519 private key) tarafından üretilir; burada yalnız PUBLIC key
// ile DOĞRULANIR (licenseVerify.ts). Eski simetrik HMAC üretimi + PLUGIN_LICENSE_SECRET
// güvenlik gereği silindi (tenant kendine lisans basamaz). Bkz. docs/LICENSING_ARCHITECTURE.md.

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
 * Lisans aktivasyonu — yalnız DOĞRULAMA (Ed25519 imzalı, tenant-bağlı bundle token).
 * Token: ENF1.<payload>.<sig>; payload.plugins[] içindeki tüm eklentileri tenant'a
 * AKTİF yetkilendirir (PluginEntitlement upsert). İmza/binding/süre geçmezse reddeder.
 * (Eski imzasız/HMAC ENF-PLUGIN-* anahtarları artık KABUL EDİLMEZ — sert kesim.)
 */
export async function activatePluginLicense(
  tenantId: string,
  licenseKey: string,
  activatedById?: string,
): Promise<{ ok: boolean; error?: string; pluginKeys?: string[] }> {
  const res = verifyLicenseToken(licenseKey, tenantId);
  if (!res.ok) {
    const msg: Record<string, string> = {
      BICIM_HATASI: 'Geçersiz lisans biçimi (ENF1 imzalı token bekleniyor).',
      IMZA_GECERSIZ: 'Lisans imzası doğrulanamadı (geçersiz/kurcalanmış).',
      TENANT_UYUSMAZ: 'Bu lisans başka bir kiracı için üretilmiş.',
      SURESI_DOLMUS: 'Lisansın süresi dolmuş.',
      COZUMLEME_HATASI: 'Lisans çözümlenemedi.',
    };
    return { ok: false, error: msg[res.reason] || 'Lisans doğrulanamadı.' };
  }

  const payload = res.payload;
  const valid = (payload.plugins || []).map(getPlugin).filter((p): p is NonNullable<typeof p> => !!p);
  if (valid.length === 0) return { ok: false, error: 'Lisansta tanınan eklenti yok.' };

  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  for (const plugin of valid) {
    await prisma.pluginEntitlement.upsert({
      where: { tenantId_pluginKey: { tenantId, pluginKey: plugin.key } },
      create: {
        tenantId, pluginKey: plugin.key, status: 'ACTIVE', licenseKey,
        mode: plugin.defaultMode ?? 'ADVISORY',
        activatedById: activatedById ?? null, activatedAt: new Date(), expiresAt,
      },
      update: {
        status: 'ACTIVE', licenseKey,
        activatedById: activatedById ?? null, activatedAt: new Date(), expiresAt,
      },
    });
  }
  return { ok: true, pluginKeys: valid.map(p => p.key) };
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

