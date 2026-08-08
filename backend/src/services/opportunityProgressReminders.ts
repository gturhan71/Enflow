// Enflow — Fırsat ilerleme teyidi hatırlatma sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// Açık (WON/LOST/WITHDRAWN dışı) fırsatlarda lastProgressCheckAt (yoksa createdAt)
// üzerinden geçen süre tenant'ın intervalDays ayarını aştıysa, fırsat sahibine
// (assignedToId) bir PROGRESS_CHECKIN TodoTask açar — idempotent (progressRemindersSent).
// Bu görevin dueDate'i (graceBusinessDays sonrası) geçtiğinde AYRI bir eskalasyon
// kodu yazmıyoruz: zaten var olan sweepSlaEscalations (backend/src/services/slaEscalation.ts,
// GET /tasks içinde tetikleniyor) her overdue TodoTask için birim-hiyerarşisi üzerinden
// yöneticiye otomatik bildirim üretiyor — bu görevi de aynı yoldan yakalar.
// GET /opportunities çağrısında tetiklenir (tenderReminders.ts ile aynı desen).

import { prisma } from '../prismaClient';
import { pingDashboard } from './dashboardStream';
import { computeSlaDueDate } from '../utils/businessDays';
import { getOpportunityProgressSettings } from './opportunityProgressService';

const OPEN_STATUS_EXCLUDE = ['WON', 'LOST', 'WITHDRAWN'];

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

export async function sweepOpportunityProgressReminders(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const opps = await prisma.opportunity.findMany({
      where: { tenantId, status: { notIn: OPEN_STATUS_EXCLUDE } },
      include: { assignedTo: true },
    });
    if (opps.length === 0) return;

    const { intervalDays, graceBusinessDays } = await getOpportunityProgressSettings(tenantId);
    let sentAny = false;

    for (const opp of opps) {
      const sent: string[] = safeParse(opp.progressRemindersSent);
      if (sent.includes('DUE')) continue;

      const baseline = (opp.lastProgressCheckAt ?? opp.createdAt).getTime();
      const daysSince = (now - baseline) / 86_400_000;
      if (daysSince < intervalDays) continue;

      const existingTask = await prisma.todoTask.findFirst({
        where: { tenantId, relatedModule: 'OPPORTUNITY', relatedItemId: opp.id, actionKey: 'PROGRESS_CHECKIN', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      if (!existingTask) {
        await prisma.todoTask.create({
          data: {
            title: `İlerleme teyidi gerekli: ${opp.title}`,
            description: `Bu fırsat ${intervalDays} gündür güncellenmedi. Olasılık/aşamayı güncelleyin ya da değişmediyse nedenini not düşün.`,
            unitId: opp.assignedTo?.unitId || 'system',
            assignedBy: opp.assignedToId,
            assignedToUserId: opp.assignedToId,
            actionKey: 'PROGRESS_CHECKIN',
            relatedModule: 'OPPORTUNITY', relatedItemId: opp.id,
            priority: 'MEDIUM', status: 'PENDING',
            dueDate: computeSlaDueDate(graceBusinessDays, new Date(now)),
            tenantId,
          },
        }).catch(() => {});
        sentAny = true;
      }

      await prisma.opportunity.update({ where: { id: opp.id }, data: { progressRemindersSent: JSON.stringify([...sent, 'DUE']) } }).catch(() => {});
    }
    if (sentAny) pingDashboard(tenantId);
  } catch {
    // sweep ana akışı bozmaz
  }
}

function safeParse(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
