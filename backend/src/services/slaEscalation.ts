// Enflow — TodoTask SLA aşımı eskalasyon sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// B-16: dueDate'i geçmiş PENDING/IN_PROGRESS görevler için tenderReminders.ts
// ile aynı desende, bir kez (idempotent — TodoTask.escalatedAt) bir üst role
// (birimin ebeveyn biriminin yöneticisi; yoksa GENERAL_MANAGER) bildirim üretir.
// GET /tasks çağrısında tetiklenir.

import { prisma } from '../prismaClient';

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

export async function sweepSlaEscalations(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const overdue = await prisma.todoTask.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
        escalatedAt: null,
      },
    });
    if (overdue.length === 0) return;

    const gms = await prisma.user.findMany({ where: { tenantId, role: 'GENERAL_MANAGER', status: 'ACTIVE' } });
    const unitCache = new Map<string, { parentManagerId: string | null }>();

    async function resolveEscalationTarget(unitId: string | null): Promise<string[]> {
      if (unitId) {
        if (!unitCache.has(unitId)) {
          const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { parent: true } });
          unitCache.set(unitId, { parentManagerId: unit?.parent?.managerId ?? null });
        }
        const parentManagerId = unitCache.get(unitId)!.parentManagerId;
        if (parentManagerId) return [parentManagerId];
      }
      // Üst birim/yönetici yoksa (kök birim ya da birimsiz görev) — GM'e düşer.
      return gms.map(g => g.id);
    }

    for (const task of overdue) {
      const daysOverdue = Math.floor((now - task.dueDate!.getTime()) / 86_400_000);
      const recipients = await resolveEscalationTarget(task.unitId || null);
      for (const userId of [...new Set(recipients)]) {
        await prisma.notification.create({
          data: {
            tenantId, userId, type: 'WARNING',
            title: 'SLA aşıldı — eskalasyon',
            message: `"${task.title}" görevi ${daysOverdue > 0 ? `${daysOverdue} gün` : 'süresi'} önce son tarihi geçti ve hâlâ ${task.status === 'IN_PROGRESS' ? 'devam ediyor' : 'başlanmadı'}.`,
            relatedModule: task.relatedModule || 'GENERAL', relatedItemId: task.relatedItemId || task.id,
          },
        }).catch(() => {});
      }
      await prisma.todoTask.update({ where: { id: task.id }, data: { escalatedAt: new Date() } }).catch(() => {});
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}
