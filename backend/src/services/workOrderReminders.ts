// Enflow — WorkOrder (Profesyonel Hizmetler) SLA aşımı eskalasyon sweep'i
// (poll-bazlı, cron yok). serviceTicketReminders.ts/slaEscalation.ts ile aynı
// desen: dueAt'i geçmiş ve hâlâ açık iş emirleri için, bir kez (idempotent —
// WorkOrder.escalatedAt) atanan teknisyene + aktif Profesyonel Hizmetler
// Müdürlerine (OPERATIONS_MGR) bildirim üretir. GET /work-orders çağrısında tetiklenir.

import { prisma } from '../prismaClient';

const lastSweepByTenant = new Map<string, number>();
const OPEN_STATUSES = ['DRAFT', 'PENDING_SCHEDULE', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PART'];

export async function sweepWorkOrderSla(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const overdue = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: OPEN_STATUSES },
        dueAt: { lt: new Date() },
        escalatedAt: null,
      },
    });
    if (overdue.length === 0) return;

    const managers = await prisma.user.findMany({ where: { tenantId, role: 'OPERATIONS_MGR', status: 'ACTIVE' } });

    for (const order of overdue) {
      const hoursOverdue = Math.floor((now - order.dueAt!.getTime()) / 3_600_000);
      const recipients = [
        ...(order.assignedTechnicianId ? [order.assignedTechnicianId] : []),
        ...managers.map(m => m.id),
      ];
      for (const userId of [...new Set(recipients)]) {
        await prisma.notification.create({
          data: {
            tenantId, userId, type: 'WARNING',
            title: 'İş emri SLA aşıldı',
            message: `"${order.title}" iş emrinin tamamlanma hedefi ${hoursOverdue > 0 ? `${hoursOverdue} saat` : ''} önce doldu ve hâlâ ${order.status === 'IN_PROGRESS' ? 'sahada devam ediyor' : 'tamamlanmadı'}.`,
            relatedModule: 'professional-services', relatedItemId: order.id,
          },
        }).catch(() => {});
      }
      await prisma.workOrder.update({ where: { id: order.id }, data: { escalatedAt: new Date() } }).catch(() => {});
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}
