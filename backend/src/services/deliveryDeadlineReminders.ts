// Enflow — Sözleşmeye bağlı teslim tarihi hatırlatma sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// `tenderReminders.ts`/`guaranteeReminders.ts` ile aynı iskelet: 30/15/7/1 gün
// eşiklerinde idempotent bildirim üretir. Teminat/ihale hatırlatmalarından farklı
// olarak, tarih AŞILDIĞINDA da (bir kez, spam olmadan) "overdue" bildirimi
// üretir — çünkü bu tarihin geçilmesi cezai şart riski doğurur ve görmezden
// gelinemez. Kalıcı görünürlük Kanban/ContextTab'daki rozetlerle sağlanır;
// bildirim yalnız eşik başına bir kez gider. GET /notifications çağrısında
// tetiklenir; kaçırılan eşikler bir sonraki sweep'te yakalanır.

import { prisma } from '../prismaClient';
import { pingDashboard } from './dashboardStream';
import { entityTypeToTab } from '../utils/entityTypeTab';

interface Threshold { key: string; days: number; label: string; }
const THRESHOLDS: Threshold[] = [
  { key: '30d', days: 30, label: '30 gün' },
  { key: '15d', days: 15, label: '15 gün' },
  { key: '7d', days: 7, label: '7 gün' },
  { key: '1d', days: 1, label: '1 gün' },
];
const OVERDUE_KEY = 'overdue';
const NOTIFY_ROLES = ['PROJECT_MGR', 'PROCUREMENT_MGR', 'SALES_MGR', 'LEGAL_MGR'];

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

/** Hangi eşiklerin bu turda bildirilmesi gerektiğini + bildirim etiketini döner. `null` = hiçbir yeni eşik yok. */
function resolveDue(dueDate: Date, now: number, sent: string[]): { keys: string[]; label: string } | null {
  const daysLeft = (dueDate.getTime() - now) / 86_400_000;
  if (daysLeft <= 0) {
    if (sent.includes(OVERDUE_KEY)) return null;
    return { keys: [OVERDUE_KEY], label: 'Teslim süresi AŞILDI (cezai şart riski)' };
  }
  const crossed = THRESHOLDS.filter((th) => daysLeft <= th.days && !sent.includes(th.key));
  if (crossed.length === 0) return null;
  const closest = crossed.reduce((a, b) => (a.days < b.days ? a : b));
  return { keys: crossed.map((c) => c.key), label: `Teslim süresine ${closest.label} kaldı` };
}

async function notifyAll(tenantId: string, userIds: Set<string>, title: string, message: string, relatedModule?: string, relatedItemId?: string) {
  for (const userId of userIds) {
    await prisma.notification.create({
      data: { tenantId, userId, type: 'WARNING', title, message, relatedModule, relatedItemId },
    }).catch(() => {});
  }
}

export async function sweepDeliveryDeadlineReminders(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const roleUsers = await prisma.user.findMany({ where: { tenantId, status: 'ACTIVE', role: { in: NOTIFY_ROLES } } });
    const roleUserIds = roleUsers.map((u) => u.id);
    let sentAny = false;

    // ── Sözleşme aşaması (henüz Proje'ye aktarılmamış) ──────────────────────
    const workflows = await prisma.contractWorkflow.findMany({
      where: { tenantId, deliveryDueDate: { not: null }, status: { notIn: ['TRANSFERRED', 'CANCELLED', 'TERMINATED'] } },
    });
    for (const wf of workflows) {
      const sent = safeParse(wf.remindersSent);
      const due = resolveDue(wf.deliveryDueDate!, now, sent);
      if (!due) continue;
      sentAny = true;
      await notifyAll(
        tenantId, new Set(roleUserIds),
        'Sözleşme teslim tarihi',
        `${wf.title} — ${due.label}.`,
        entityTypeToTab('CONTRACT'), wf.id,
      );
      await prisma.contractWorkflow.update({
        where: { id: wf.id },
        data: { remindersSent: JSON.stringify([...new Set([...sent, ...due.keys])]) },
      }).catch(() => {});
    }

    // ── Proje aşaması (T4 sonrası, gerçek DELIVERY milestone'u) ─────────────
    const milestones = await prisma.projectMilestone.findMany({
      where: { milestoneType: 'DELIVERY', plannedEnd: { not: null }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, project: { tenantId } },
      include: { project: true },
    });
    for (const ms of milestones) {
      const sent = safeParse(ms.remindersSent);
      const due = resolveDue(ms.plannedEnd!, now, sent);
      if (!due) continue;
      sentAny = true;
      const targets = new Set<string>(roleUserIds);
      if (ms.project.pmId) targets.add(ms.project.pmId);
      await notifyAll(
        tenantId, targets,
        'Proje teslim tarihi',
        `${ms.project.name} — ${ms.title}: ${due.label}.`,
        entityTypeToTab('PROJECT'), ms.projectId,
      );
      await prisma.projectMilestone.update({
        where: { id: ms.id },
        data: { remindersSent: JSON.stringify([...new Set([...sent, ...due.keys])]) },
      }).catch(() => {});
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
