import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler } from '../middleware';

const router: Router = Router();

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user) return res.status(401).json({ error: 'Geçersiz bilgiler.' });
  res.json({ user, token: 'mock-jwt-token' });
}));

router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ message: 'Şifre sıfırlama bağlantısı gönderildi.' });
}));

export default router;
