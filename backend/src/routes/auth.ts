import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler } from '../middleware';
import { verifyPassword, signAuthToken, verifyAuthToken } from '../services/auth';
import { runWithRlsBypass } from '../services/tenantContext';
import { getRequestToken, csrfViolation, setSessionCookie, clearSessionCookie, isWebClient } from '../services/session';

const router: Router = Router();

const loadUser = (where: { email: string } | { id: string }) =>
  runWithRlsBypass(() => prisma.user.findUnique({ where, include: { tenant: true } }));
type LoadedUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

// Parola hash'ini ASLA yanıta koyma. `tenant.moduleSettings` da YZ/entegrasyon
// API anahtarları/şifreleri içerir (bkz. tenants.ts ai-settings maskeleme kuralı) —
// frontend bu alanı hiç kullanmıyor, yanıtta sızdırılmasına gerek yok.
// `dekWrapped` tenant'ın sarılı veri şifreleme anahtarı — Tenant döndüren her
// route'ta omit edilmeli (bkz. tenantEncryption.ts / CLAUDE.md Faz 12).
function toSafeUser(user: LoadedUser) {
  // `permissions` DB'de JSON string — currentUser.permissions her zaman dizi olmalı.
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(user.permissions);
    if (Array.isArray(parsed)) permissions = parsed.filter((p): p is string => typeof p === 'string' && p.length > 3);
  } catch { /* boş dizi ile devam */ }
  const { password: _pw, tenant, ...safeUser } = user;
  const { moduleSettings: _ms, dekWrapped: _dek, ...safeTenant } = tenant;
  return { ...safeUser, tenant: safeTenant, permissions };
}

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  }

  // Girişte tenant henüz bilinmiyor (e-posta ile aranıyor) — Postgres RLS'in (Faz 3)
  // bu sorguyu 0 satıra düşürmemesi için kasıtlı bypass gerekir (loadUser).
  const user = await loadUser({ email });
  // Kullanıcı sayımı sızıntısını önle: yok/yanlış-şifre/pasif hepsi AYNI genel yanıtı döner.
  const ok = user && user.status === 'ACTIVE' && (await verifyPassword(password, user.password));
  if (!ok || !user) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }

  // İmzalı JWT — payload'da parola/hassas veri YOK.
  const token = signAuthToken({ sub: user.id, tid: user.tenantId, role: user.role });

  // Tarayıcı: httpOnly çerez (JS okuyamaz → XSS token'ı çalamaz). API istemcisi/test: gövdede token
  // (eski davranış, geriye uyumlu). Arayüz `X-Enflow-Client: web` gönderir → gövdede token DÖNMEZ.
  setSessionCookie(req, res, token);
  res.json(isWebClient(req) ? { user: toSafeUser(user) } : { user: toSafeUser(user), token });
}));

// Mevcut oturumu doğrular (çerez ya da Bearer) → kullanıcı; yoksa/geçersizse 401. Arayüz açılışta bunu çağırır
// (token artık JS'de olmadığından "girişli miyim?" sorusunun tek cevabı budur).
router.get('/session', asyncHandler(async (req: Request, res: Response) => {
  const supplied = getRequestToken(req);
  const payload = supplied && verifyAuthToken(supplied.token);
  if (!payload) return res.status(401).json({ error: 'Oturum yok.' });
  const user = await loadUser({ id: payload.sub });
  if (!user || user.status !== 'ACTIVE' || user.tenantId !== payload.tid) return res.status(401).json({ error: 'Oturum geçersiz.' });
  res.json({ user: toSafeUser(user) });
}));

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const supplied = getRequestToken(req);
  const csrf = supplied ? csrfViolation(req, supplied.via) : null;
  if (csrf) return res.status(403).json({ error: csrf });
  clearSessionCookie(req, res);
  res.json({ ok: true });
}));

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  // Kullanıcı sayımı sızıntısını önle: e-posta var/yok fark etmeksizin aynı yanıt.
  res.json({ message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' });
}));

export default router;
