// Enflow — Kimlik doğrulama çekirdeği (parola hash + imzalı JWT).
// ─────────────────────────────────────────────────────────────────────────────
// - Parolalar bcrypt ile hash'lenir (asla düz metin saklanmaz/loglanmaz).
// - Oturum token'ı imzalı JWT'dir (eski imzasız base64(userId) KALDIRILDI).
//   Payload: { sub: userId, tid: tenantId, role }. Süre: AUTH_TOKEN_TTL.
// - JWT gizli anahtarı AUTH_JWT_SECRET env'inden okunur. Üretimde ZORUNLU;
//   yoksa süreç açılışta uyarır ve dev-only sabit anahtara düşer.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '12h';

// Dev fallback: üretimde AUTH_JWT_SECRET set edilmezse süreç uyarır.
const DEV_FALLBACK_SECRET = 'enflow-dev-only-insecure-secret-change-me';
function jwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET üretimde zorunludur (>=16 karakter).');
  }
  return DEV_FALLBACK_SECRET;
}

export interface AuthTokenPayload {
  sub: string;   // userId
  tid: string;   // tenantId
  role: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: TOKEN_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, jwtSecret(), options);
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret()) as Partial<AuthTokenPayload>;
    if (decoded && typeof decoded.sub === 'string' && typeof decoded.tid === 'string' && typeof decoded.role === 'string') {
      return { sub: decoded.sub, tid: decoded.tid, role: decoded.role };
    }
    return null;
  } catch {
    return null;
  }
}
