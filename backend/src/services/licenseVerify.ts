// Enflow — Lisans DOĞRULAMA (tenant tarafı, yalnız public key, sır YOK)
// ─────────────────────────────────────────────────────────────────────────────
// Lisansı vendor aracı (ayrı özel repo) Ed25519 private key ile imzalar; tenant
// burada yalnız PUBLIC key ile doğrular → forge edilemez. Lisans tenant-bağlıdır.
// Token: ENF1.<base64url(payload-json)>.<base64url(ed25519-sig)>
// (Üreteç çekirdeğiyle birebir aynı biçim — bkz. license-tool/core.mjs, license-poc.)

import { verify as edVerify, createPublicKey } from 'crypto';
import { LICENSE_PUBLIC_KEY } from '../config/licensePublicKey';

export interface LicensePayload {
  v: number;
  tenantId: string;
  sku: string;
  plugins: string[];
  limits: { users?: number; storageGB?: number };
  issuedAt: number;
  expiresAt: number | null;
  nonce: string;
}

export type VerifyResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: 'BICIM_HATASI' | 'IMZA_GECERSIZ' | 'TENANT_UYUSMAZ' | 'SURESI_DOLMUS' | 'COZUMLEME_HATASI'; payload?: LicensePayload };

const fromB64url = (s: string) => Buffer.from(s, 'base64url');

/**
 * Lisans token'ını doğrular: Ed25519 imza + tenant binding + süre.
 * expectedTenantId verilirse binding zorunlu (başka tenant'ın lisansı reddedilir).
 */
export function verifyLicenseToken(token: string, expectedTenantId?: string): VerifyResult {
  try {
    const [prefix, bodyB64, sigB64] = String(token || '').trim().split('.');
    if (prefix !== 'ENF1' || !bodyB64 || !sigB64) return { ok: false, reason: 'BICIM_HATASI' };
    const body = fromB64url(bodyB64);
    const sig = fromB64url(sigB64);
    const key = createPublicKey(LICENSE_PUBLIC_KEY);
    if (!edVerify(null, body, key, sig)) return { ok: false, reason: 'IMZA_GECERSIZ' };
    const payload = JSON.parse(body.toString('utf-8')) as LicensePayload;
    if (expectedTenantId && payload.tenantId !== expectedTenantId) return { ok: false, reason: 'TENANT_UYUSMAZ', payload };
    if (payload.expiresAt && Date.now() > payload.expiresAt) return { ok: false, reason: 'SURESI_DOLMUS', payload };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'COZUMLEME_HATASI' };
  }
}
