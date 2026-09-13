// Enflow — Şirket Evrakı (CorporateDocument) geçerlilik hatırlatma sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// `guaranteeReminders.ts`/`tenderReminders.ts` ile aynı desende, 30/15/7 gün
// eşiklerinde idempotent bildirim üretir. Bunlara ek olarak süre DOLDUĞUNDA da
// (bir kez, spam yok) ayrı bir "expired" bildirimi düşer — ISO/yasal/iş
// bitirme belgesi gibi evrakların süresi geçmesi görmezden gelinemeyecek bir
// uyum riski olduğundan, guarantee/tender'ın aksine burada atlanmaz. GET
// /documents ve GET /notifications çağrılarında tetiklenir; kaçırılan eşikler
// bir sonraki sweep'te yakalanır.

import { prisma } from '../prismaClient';
import { pingDashboard } from './dashboardStream';

interface Threshold { key: string; days: number; label: string; }
const THRESHOLDS: Threshold[] = [
  { key: '30d', days: 30, label: '30 gün' },
  { key: '15d', days: 15, label: '15 gün' },
  { key: '7d', days: 7, label: '7 gün' },
];
const EXPIRED_KEY = 'expired';
const NOTIFY_ROLES = ['GENERAL_MANAGER', 'SALES_SUPPORT', 'SALES_MGR'];

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

export async function sweepCorporateDocumentReminders(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const docs = await prisma.corporateDocument.findMany({
      where: { tenantId, expiryDate: { not: null } },
    });
    if (docs.length === 0) return;
    const recipients = await prisma.user.findMany({ where: { tenantId, status: 'ACTIVE', role: { in: NOTIFY_ROLES } } });
    if (recipients.length === 0) return;
    let sentAny = false;

    for (const d of docs) {
      const expiry = d.expiryDate!.getTime();
      const sent: string[] = d.remindersSent ? safeParse(d.remindersSent) : [];
      let title: string; let message: string; let newKeys: string[];

      if (expiry <= now) {
        if (sent.includes(EXPIRED_KEY)) continue;
        newKeys = [EXPIRED_KEY];
        title = 'Şirket evrakı süresi doldu';
        message = `"${d.name}" (${d.category}) belgesinin geçerlilik süresi doldu. Yenileme işlemini planlayın.`;
      } else {
        const daysLeft = (expiry - now) / 86_400_000;
        const due = THRESHOLDS.filter(th => daysLeft <= th.days && !sent.includes(th.key));
        if (due.length === 0) continue;
        const closest = due.reduce((a, b) => (a.days < b.days ? a : b));
        newKeys = due.map(d2 => d2.key);
        title = 'Şirket evrakı süresi yaklaşıyor';
        message = `"${d.name}" (${d.category}) belgesinin süresine ${closest.label} kaldı. Yenileme işlemini planlayın.`;
      }

      sentAny = true;
      for (const u of recipients) {
        await prisma.notification.create({
          data: { tenantId, userId: u.id, type: 'WARNING', title, message, relatedModule: 'documents', relatedItemId: d.id },
        }).catch(() => {});
      }
      const merged = [...new Set([...sent, ...newKeys])];
      await prisma.corporateDocument.update({ where: { id: d.id }, data: { remindersSent: JSON.stringify(merged) } }).catch(() => {});
    }
    if (sentAny) pingDashboard(tenantId);
  } catch {
    // sweep ana akışı bozmaz
  }
}

function safeParse(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
