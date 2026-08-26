// Enflow — ServiceTicket SLA aşımı eskalasyon sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// B-22: dueAt'i geçmiş ve hâlâ açık (OPEN/IN_PROGRESS/WAITING_PART) garanti/servis
// talepleri için slaEscalation.ts ile aynı desende, bir kez (idempotent —
// ServiceTicket.escalatedAt) atanan kişiye (yoksa proje PM'ine, o da yoksa GM'e)
// bildirim üretir. GET /service-tickets çağrısında tetiklenir.

import { prisma } from '../prismaClient';
import { ENTITY_TYPE_TAB } from '../utils/entityTypeTab';

const lastSweepByTenant = new Map<string, number>();

export async function sweepServiceTicketSla(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const overdue = await prisma.serviceTicket.findMany({
      where: {
        tenantId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PART'] },
        dueAt: { lt: new Date() },
        escalatedAt: null,
      },
      include: { project: true },
    });
    if (overdue.length === 0) return;

    const gms = await prisma.user.findMany({ where: { tenantId, role: 'GENERAL_MANAGER', status: 'ACTIVE' } });

    for (const ticket of overdue) {
      const hoursOverdue = Math.floor((now - ticket.dueAt!.getTime()) / 3_600_000);
      const recipients = [
        ...(ticket.assignedToUserId ? [ticket.assignedToUserId] : []),
        ...(!ticket.assignedToUserId && ticket.project.pmId ? [ticket.project.pmId] : []),
        ...(!ticket.assignedToUserId && !ticket.project.pmId ? gms.map(g => g.id) : []),
      ];
      for (const userId of [...new Set(recipients)]) {
        await prisma.notification.create({
          data: {
            tenantId, userId, type: 'WARNING',
            title: 'Servis talebi SLA aşıldı',
            message: `"${ticket.title}" (${ticket.project.name}) talebinin SLA süresi ${hoursOverdue > 0 ? `${hoursOverdue} saat` : ''} önce doldu ve hâlâ ${ticket.status === 'IN_PROGRESS' ? 'işlemde' : 'çözülmedi'}.`,
            relatedModule: ENTITY_TYPE_TAB.PROJECT, relatedItemId: ticket.projectId,
          },
        }).catch(() => {});
      }
      await prisma.serviceTicket.update({ where: { id: ticket.id }, data: { escalatedAt: new Date() } }).catch(() => {});
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}
