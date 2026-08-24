import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler } from '../middleware';
import { verifyPassword, signAuthToken } from '../services/auth';

const router: Router = Router();

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  // Kullanıcı sayımı sızıntısını önle: yok/yanlış-şifre/pasif hepsi AYNI genel yanıtı döner.
  const ok = user && user.status === 'ACTIVE' && (await verifyPassword(password, user.password));
  if (!ok || !user) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }

  // İmzalı JWT — payload'da parola/hassas veri YOK.
  const token = signAuthToken({ sub: user.id, tid: user.tenantId, role: user.role });

  // `permissions` DB'de JSON string — currentUser.permissions her zaman dizi olmalı.
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(user.permissions);
    if (Array.isArray(parsed)) permissions = parsed.filter((p): p is string => typeof p === 'string' && p.length > 3);
  } catch { /* boş dizi ile devam */ }

  // Parola hash'ini ASLA yanıta koyma. `tenant.moduleSettings` da YZ/entegrasyon
  // API anahtarları/şifreleri içerir (bkz. tenants.ts ai-settings maskeleme kuralı) —
  // frontend bu alanı hiç kullanmıyor, login yanıtında sızdırılmasına gerek yok.
  // `dekWrapped` tenant'ın sarılı veri şifreleme anahtarı — Tenant döndüren her
  // route'ta omit edilmeli (bkz. tenantEncryption.ts / CLAUDE.md Faz 12).
  const { password: _pw, tenant, ...safeUser } = user;
  const { moduleSettings: _ms, dekWrapped: _dek, ...safeTenant } = tenant;
  res.json({ user: { ...safeUser, tenant: safeTenant, permissions }, token });
}));

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  // Kullanıcı sayımı sızıntısını önle: e-posta var/yok fark etmeksizin aynı yanıt.
  res.json({ message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' });
}));

export default router;
