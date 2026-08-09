// Enflow — Tenant verisi alan-bazlı şifreleme (envelope encryption, tenant-başına DEK).
// ─────────────────────────────────────────────────────────────────────────────
// Master key DATA_ENCRYPTION_MASTER_KEY env'inden okunur (AUTH_JWT_SECRET ile aynı desen:
// üretimde ZORUNLU, dev'de sabit-ama-güvensiz anahtara düşer). Her tenant'ın kendi 32-byte'lık
// Data Encryption Key'i (DEK) bu master key ile AES-256-GCM sarmalanıp Tenant.dekWrapped'te
// saklanır — bir tenant'ın anahtarı sızsa diğer tenant'ları etkilemez.
//
// Şifreli alan formatı: "enc:v1:" + base64(iv[12] + authTag[16] + ciphertext). Önek yoksa değer
// düz metin kabul edilir (backfill öncesi/kademeli geçiş — decrypt kırılmaz).
//
// Kapsam (Faz 1): Tenant YZ apiKey, Vendor.iban/bankName, Customer.taxNumber/taxOffice.
// bkz. docs/TENANT_DATA_ENCRYPTION_PLAN.md
import crypto from 'crypto';
import { prisma } from '../prismaClient';

const ALGO = 'aes-256-gcm';
const ENVELOPE_PREFIX = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

const DEV_FALLBACK_MASTER_KEY = crypto
  .createHash('sha256')
  .update('enflow-dev-only-insecure-master-key-change-me')
  .digest();

function loadMasterKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_MASTER_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATA_ENCRYPTION_MASTER_KEY 32 byte (base64) olmalı.');
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('DATA_ENCRYPTION_MASTER_KEY üretimde zorunludur (32 byte, base64).');
  }
  return DEV_FALLBACK_MASTER_KEY;
}

function aesEncrypt(plaintext: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function aesDecrypt(payload: string, key: Buffer): Buffer {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// Tenant DEK'leri process-memory'de cache'lenir (JWT secret'ın da process ömrü boyunca bellekte
// tutulmasıyla aynı güven sınırı) — her alan şifreleme/çözmede DB unwrap tekrarı önlenir.
const dekCache = new Map<string, Buffer>();

async function getTenantDek(tenantId: string): Promise<Buffer> {
  const cached = dekCache.get(tenantId);
  if (cached) return cached;

  const masterKey = loadMasterKey();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { dekWrapped: true } });
  if (!tenant) throw new Error(`Tenant bulunamadı: ${tenantId}`);

  if (tenant.dekWrapped) {
    const dek = aesDecrypt(tenant.dekWrapped, masterKey);
    dekCache.set(tenantId, dek);
    return dek;
  }

  // Lazy provision — eski tenant'larda DEK yoksa burada üretilir (backfill script de aynısını
  // yapar; ikisi de idempotent, hangisi önce çalışırsa DEK o an oluşur).
  const dek = crypto.randomBytes(32);
  const wrapped = aesEncrypt(dek, masterKey);
  await prisma.tenant.update({ where: { id: tenantId }, data: { dekWrapped: wrapped } });
  dekCache.set(tenantId, dek);
  return dek;
}

export async function encryptForTenant(tenantId: string, plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;
  const dek = await getTenantDek(tenantId);
  return ENVELOPE_PREFIX + aesEncrypt(Buffer.from(plaintext, 'utf8'), dek);
}

export async function decryptForTenant(tenantId: string, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(ENVELOPE_PREFIX)) return value; // düz metin (backfill öncesi) — olduğu gibi dön
  const dek = await getTenantDek(tenantId);
  return aesDecrypt(value.slice(ENVELOPE_PREFIX.length), dek).toString('utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ENVELOPE_PREFIX));
}
