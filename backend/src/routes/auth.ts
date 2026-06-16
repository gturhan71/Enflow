import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler } from '../middleware';

const router: Router = Router();

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user) return res.status(401).json({ error: 'Geçersiz bilgiler.' });
  // Token: base64(userId) — tenantMiddleware bu token'ı çözerek IDOR kontrolü yapar.
  const token = Buffer.from(user.id).toString('base64');

  // `permissions` DB'de JSON string — currentUser.permissions her zaman dizi
  // olmalı (hasPermission `.includes()` kullanıyor; string üzerinde bu bir
  // substring araması olur, dizi üzerinde tam eşleşme — farklı semantikler).
  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(user.permissions);
    if (Array.isArray(parsed)) permissions = parsed.filter((p): p is string => typeof p === 'string' && p.length > 3);
  } catch { /* boş dizi ile devam */ }

  res.json({ user: { ...user, permissions }, token });
}));

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ message: 'Şifre sıfırlama bağlantısı gönderildi.' });
}));

export default router;
