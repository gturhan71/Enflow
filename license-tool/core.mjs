// Enflow Lisans Üreteci — çekirdek (Ed25519 imzalama). KENDİ İÇİNDE TAM.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ Bu araç VENDOR tarafıdır ve AYRI ÖZEL REPOYA taşınacaktır. Tenant
// dağıtımına ASLA girmez. private key yalnız operatörün makinesinde durur.
// Token biçimi tenant doğrulayıcısıyla birebir aynı: ENF1.<payload>.<sig>

import { sign as edSign, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';

export const PREFIX = 'ENF1';
const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Yeni Ed25519 anahtar çifti (PEM). private OFFLINE saklanır; public tenant'a gömülür. */
export function keygen() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** Lisans payload'u (tenant doğrulayıcı ile aynı şema). */
export function makePayload({ tenantId, sku, plugins = [], limits = {}, days }) {
  if (!tenantId) throw new Error('tenantId zorunlu (lisans tenant-bağlı).');
  const now = Date.now();
  return {
    v: 1,
    tenantId,
    sku: sku || 'CUSTOM',
    plugins: Array.isArray(plugins) ? plugins : [],
    limits: limits || {},
    issuedAt: now,
    expiresAt: days ? now + Number(days) * 86400000 : null,
    nonce: b64url(randomBytes(9)),
  };
}

/** payload + private PEM → imzalı token (yalnız üreteçte). */
export function issue(payload, privatePem) {
  const body = Buffer.from(JSON.stringify(payload));
  const sig = edSign(null, body, createPrivateKey(privatePem));   // Ed25519
  return `${PREFIX}.${b64url(body)}.${b64url(sig)}`;
}

/** Doğrulama önizlemesi (üreteçte kontrol amaçlı; tenant da aynısını yapar). */
export function publicFromPrivate(privatePem) {
  return createPublicKey(createPrivateKey(privatePem)).export({ type: 'spki', format: 'pem' }).toString();
}
