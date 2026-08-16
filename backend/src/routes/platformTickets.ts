import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();

const REPORTED_TYPES = new Set(['BUG', 'IMPROVEMENT', 'COMMENT']);

// Serbest-metin talep girişi tüm rollere açık (requireRole yok) — bu, kod
// tabanındaki diğer rol-serbest mutasyon uçlarından farklı olarak gerçek bir
// spam vektörü. Kullanıcı bazlı (IP değil — paylaşımlı ofis IP'si meşru
// kullanıcıları engellemesin) saatlik limit.
const createTicketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PLATFORM_TICKET_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId || ipKeyGenerator(req.ip || 'unknown'),
  message: { error: 'Çok fazla talep gönderdiniz. Lütfen bir süre sonra tekrar deneyin.' },
});

// Tenant-taraflı uç — herhangi bir rol kullanabilir (requireRole yok, tasks.ts
// emsali). category/priority/scope YALNIZ platform-tickets-admin (dış triage
// aracı) tarafından doldurulur — burada istemciden gelse bile yok sayılır.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const tickets = await prisma.platformTicket.findMany({
    where: { tenantId: req.tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tickets);
}));

router.post('/', tenantMiddleware, createTicketLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { title, description, reportedType } = req.body as { title?: string; description?: string; reportedType?: string };
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Başlık zorunludur.' });
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Açıklama zorunludur.' });
  }
  // Kullanıcının kendi ilk izlenimi — nihai sınıflandırma (category) bundan
  // bağımsız, yalnız dış triage aracı tarafından belirlenir (bkz. schema.prisma).
  const type = reportedType && REPORTED_TYPES.has(reportedType) ? reportedType : 'BUG';

  const submitter = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

  const ticket = await prisma.platformTicket.create({
    data: {
      tenantId: req.tenantId,
      userId: req.userId,
      userName: submitter?.name || 'Bilinmeyen Kullanıcı',
      title: title.trim(),
      description: description.trim(),
      reportedType: type,
    },
  });

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PLATFORM_TICKET', entityId: ticket.id, details: { title: ticket.title } });
  res.json(ticket);
}));

export default router;
