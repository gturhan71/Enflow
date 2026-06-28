// Enflow Lisans PoC — ortak: Ed25519 imzala/doğrula + tenant-bağlı token
// ─────────────────────────────────────────────────────────────────────────────
// Token biçimi:  ENF1.<base64url(payload-json)>.<base64url(ed25519-sig)>
// İMZALAMA yalnız üreteçte (private key, vendor-offline). DOĞRULAMA tenant'ta
// (public key, sır yok → forge edilemez). Lisans tenantId'ye bağlıdır.

import { sign as edSign, verify as edVerify, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';

export const PREFIX = 'ENF1';
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url');

/** Lisans payload'u üret (üreteç tarafı veri modeli). */
export function makePayload({ tenantId, sku, plugins = [], limits = {}, days }) {
  if (!tenantId) throw new Error('tenantId zorunlu (lisans tenant-bağlı).');
  const now = Date.now();
  return {
    v: 1,
    tenantId,                      // BINDING — başka tenant'ta geçersiz
    sku: sku || 'CUSTOM',
    plugins,                       // ['AGENT_TENDER', ...] veya []
    limits,                        // { users, storageGB }
    issuedAt: now,
    expiresAt: days ? now + days * 86400000 : null,  // null = süresiz
    nonce: b64url(randomBytes(9)),
  };
}

/** payload + private key → imzalı token (yalnız üreteçte çağrılır). */
export function issue(payload, privateKeyPem) {
  const body = Buffer.from(JSON.stringify(payload));
  const key = createPrivateKey(privateKeyPem);
  const sig = edSign(null, body, key);            // Ed25519
  return `${PREFIX}.${b64url(body)}.${b64url(sig)}`;
}

/**
 * Token + public key (+ beklenen tenantId) → doğrulama sonucu (tenant tarafı).
 * Sır YOK; yalnız public key ile imza + binding + süre kontrolü.
 */
export function verifyToken(token, publicKeyPem, expectedTenantId) {
  try {
    const [prefix, bodyB64, sigB64] = String(token).trim().split('.');
    if (prefix !== PREFIX || !bodyB64 || !sigB64) return { ok: false, reason: 'BICIM_HATASI' };
    const body = fromB64url(bodyB64);
    const sig = fromB64url(sigB64);
    const key = createPublicKey(publicKeyPem);
    if (!edVerify(null, body, key, sig)) return { ok: false, reason: 'IMZA_GECERSIZ' };  // forge/tamper
    const p = JSON.parse(body.toString('utf-8'));
    if (expectedTenantId && p.tenantId !== expectedTenantId) return { ok: false, reason: 'TENANT_UYUSMAZ', payload: p };
    if (p.expiresAt && Date.now() > p.expiresAt) return { ok: false, reason: 'SURESI_DOLMUS', payload: p };
    return { ok: true, payload: p };
  } catch (e) {
    return { ok: false, reason: 'COZUMLEME_HATASI', detail: e.message };
  }
}
