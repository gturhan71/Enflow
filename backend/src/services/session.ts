// Oturum taşıyıcısı: httpOnly çerez (tarayıcı) + Authorization: Bearer (API istemcileri/testler).
// ─────────────────────────────────────────────────────────────────────────────
// Neden çerez (P0-3): JWT localStorage'da durunca bulunan herhangi bir XSS token'ı okuyup dışarı
// çıkarabilir. httpOnly çerezi JavaScript okuyamaz → XSS token'ı ÇALAMAZ (istek atabilir ama
// hesabı/oturumu devralamaz). Bedeli CSRF: çerez tarayıcı tarafından otomatik eklenir → aşağıda
// (1) SameSite=Lax, (2) durum değiştiren isteklerde özel `X-Enflow-CSRF` başlığı (çapraz-site bir
// sayfa CORS onayı olmadan özel başlık gönderemez), (3) Origin denetimi ile kapatılır.
// Bearer ile gelen istekler CSRF'e açık DEĞİLDİR (tarayıcı otomatik eklemez) → denetlenmez.
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'enflow_session';
export const CSRF_HEADER = 'x-enflow-csrf';
/** Tarayıcı arayüzü bu başlıkla gelir → yanıt gövdesinde token DÖNMEZ (yalnız çerez). */
export const WEB_CLIENT_HEADER = 'x-enflow-client';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** `Cookie:` başlığını ayrıştırır (bağımlılık yok). Bozuk/çift kodlu değerler atlanır. */
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue; // ilk değer kazanır
    let v = part.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    try { out[k] = decodeURIComponent(v); } catch { /* bozuk kodlama → atla */ }
  }
  return out;
}

export type TokenSource = 'bearer' | 'cookie';
export interface RequestToken { token: string; via: TokenSource }

/** İstekteki oturum token'ı: Bearer önceliklidir (API istemcileri), yoksa çerez. */
export function getRequestToken(req: Pick<Request, 'headers'>): RequestToken | undefined {
  const h = req.headers['authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    const t = h.slice(7).trim();
    if (t) return { token: t, via: 'bearer' };
  }
  const c = parseCookies(req.headers['cookie'])[SESSION_COOKIE];
  return c ? { token: c, via: 'cookie' } : undefined;
}

/** CORS izinli origin'ler — index.ts'teki cors() ile AYNI kaynak (CORS_ORIGINS). */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174')
    .split(',').map((s) => s.trim()).filter(Boolean);
}

function originHost(origin: string): string | null {
  try { return new URL(origin).host.toLowerCase(); } catch { return null; }
}

/**
 * Çerezle doğrulanmış, durum değiştiren bir istek CSRF şüpheli mi? → hata metni | null.
 * Kurallar (hepsi sağlanmalı): özel başlık var · Origin varsa aynı-host ya da izinli listede ·
 * Sec-Fetch-Site 'cross-site' değil.
 */
export function csrfViolation(
  req: Pick<Request, 'method' | 'headers'>,
  via: TokenSource,
  allowed: string[] = allowedOrigins(),
): string | null {
  if (via !== 'cookie' || SAFE_METHODS.has(req.method)) return null;
  if (!req.headers[CSRF_HEADER]) return 'CSRF koruması: X-Enflow-CSRF başlığı zorunlu.';
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite === 'cross-site') return 'CSRF koruması: çapraz-site istek reddedildi.';
  const origin = req.headers['origin'];
  if (typeof origin === 'string' && origin && origin !== 'null') {
    const host = originHost(origin);
    const sameHost = host !== null && host === String(req.headers['host'] ?? '').toLowerCase();
    const listed = allowed.some((o) => o === origin || originHost(o) === host);
    if (!sameHost && !listed) return 'CSRF koruması: Origin izinli değil.';
  } else if (origin === 'null') {
    return 'CSRF koruması: opak Origin reddedildi.';
  }
  return null;
}

/** Secure çerez: COOKIE_SECURE=true|false zorlar; auto (varsayılan) → HTTPS isteğinde (trust proxy ile). */
export function cookieSecure(req: Pick<Request, 'secure'>): boolean {
  const v = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return Boolean(req.secure);
}

/** Token'ın kalan ömrü (sn) — çerez Max-Age'i JWT'nin kendi exp'iyle aynı olur. */
export function tokenRemainingSeconds(token: string): number {
  const d = jwt.decode(token) as { exp?: number } | null;
  return d?.exp ? Math.max(1, d.exp - Math.floor(Date.now() / 1000)) : 12 * 3600;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: tokenRemainingSeconds(token) * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: cookieSecure(req), path: '/' });
}

/** Tarayıcı arayüzü mü? (yanıtta token dönmesin) */
export const isWebClient = (req: Pick<Request, 'headers'>): boolean => req.headers[WEB_CLIENT_HEADER] === 'web';
