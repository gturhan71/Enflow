import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, platformApiKeyMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

// Dış (bu repo dışında) triage aracı için — Enflow'un normal tenant JWT auth'undan
// tamamen bağımsız, paylaşılan-secret (platformApiKeyMiddleware) korumalı, KASITLI
// olarak tenant-çapraz (cross-tenant). Not: enforceReadOnlyRoles (index.ts'te bu
// router'dan ÖNCE mount edilir) bir Bearer JWT arar; dış araç bunu göndermeyeceği
// için token undefined kalır ve guard hemen next() çağırır — çakışma yok.
const router: Router = Router();

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

router.get('/', platformApiKeyMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const sort = req.query.sort as string | undefined;

  const tickets = await prisma.platformTicket.findMany({
    where: { ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  if (sort === 'priority') {
    tickets.sort((a, b) => {
      const ra = a.priority ? (PRIORITY_RANK[a.priority] ?? 99) : 99;
      const rb = b.priority ? (PRIORITY_RANK[b.priority] ?? 99) : 99;
      return ra - rb;
    });
  }

  res.json(tickets);
}));

router.put('/:id', platformApiKeyMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.platformTicket.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Talep bulunamadı.' });

  const { category, priority, scope, status, targetTimeline, resolutionNote, metadata } = req.body as {
    category?: string; priority?: string; scope?: string; status?: string;
    targetTimeline?: string; resolutionNote?: string; metadata?: string;
  };

  const data: Record<string, unknown> = {};
  if (category !== undefined) data.category = category;
  if (priority !== undefined) data.priority = priority;
  if (scope !== undefined) data.scope = scope;
  if (status !== undefined) data.status = status;
  if (targetTimeline !== undefined) data.targetTimeline = targetTimeline;
  if (resolutionNote !== undefined) data.resolutionNote = resolutionNote;
  if (metadata !== undefined) data.metadata = metadata;

  const ticket = await prisma.platformTicket.update({ where: { id }, data });

  if (status !== undefined && status !== existing.status) {
    await prisma.notification.create({
      data: {
        tenantId: ticket.tenantId,
        userId: ticket.userId,
        type: 'PLATFORM_TICKET',
        title: 'Talebinizin durumu güncellendi',
        message: `"${ticket.title}" — yeni durum: ${ticket.status}`,
        relatedModule: 'platform-tickets',
        relatedItemId: ticket.id,
      },
    }).catch(() => {});
  }

  // userId verilmiyor (varsayılan 'system'/'Sistem' çözülür) — bu, tenant kullanıcısı
  // değil dış vendor aracı tarafından yapılan bir işlem. actorType AGENT KULLANILMAZ:
  // o, Enflow'un kendi sanal agent'larına ayrılmış (bkz. virtualAgentService.ts).
  await logActivity({
    tenantId: ticket.tenantId, action: 'UPDATE', entityType: 'PLATFORM_TICKET', entityId: ticket.id,
    details: { source: 'EXTERNAL_TRIAGE', status: ticket.status, category: ticket.category, priority: ticket.priority, scope: ticket.scope },
  });

  res.json(ticket);
}));

export default router;
