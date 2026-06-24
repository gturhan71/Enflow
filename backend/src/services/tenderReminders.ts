// Enflow — İhale teklif hatırlatma sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// Aktif ihalelerin son teklif tarihine kalan süreye göre 3gün/2gün/12saat/6saat
// eşiklerinde idempotent bildirim üretir. GET /tenders ve GET /notifications
// çağrılarında tetiklenir; kaçırılan eşikler bir sonraki sweep'te yakalanır.

import { prisma } from '../prismaClient';

interface Threshold { key: string; hours: number; label: string; }
const THRESHOLDS: Threshold[] = [
  { key: '72h', hours: 72, label: '3 gün' },
  { key: '48h', hours: 48, label: '2 gün' },
  { key: '12h', hours: 12, label: '12 saat' },
  { key: '6h', hours: 6, label: '6 saat' },
];

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

export async function sweepTenderReminders(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const tenders = await prisma.tender.findMany({
      where: { tenantId, status: { in: ['DRAFT', 'PREPARING'] }, submissionDeadline: { not: null } },
    });
    if (tenders.length === 0) return;
    const salesSupport = await prisma.user.findFirst({ where: { tenantId, role: 'SALES_SUPPORT' } });

    for (const t of tenders) {
      const deadline = t.submissionDeadline!.getTime();
      if (deadline <= now) continue; // geçmiş son teklif tarihi — hatırlatma yok
      const hoursLeft = (deadline - now) / 3_600_000;
      const sent: string[] = t.remindersSent ? safeParse(t.remindersSent) : [];
      const due = THRESHOLDS.filter(th => hoursLeft <= th.hours && !sent.includes(th.key));
      if (due.length === 0) continue;

      // Sadece en yakın (en küçük saatli) eşiği bildir; kaçırılanları da işaretle (spam önleme)
      const closest = due.reduce((a, b) => (a.hours < b.hours ? a : b));
      const recipients = [...new Set([salesSupport?.id, t.ownerId].filter(Boolean) as string[])];
      for (const userId of recipients) {
        await prisma.notification.create({
          data: {
            tenantId, userId, type: 'WARNING',
            title: 'İhale teklif hatırlatması',
            message: `"${t.name}" son teklife ${closest.label} kaldı. İhale dosyası hazırlığını tamamlayın.`,
          },
        }).catch(() => {});
      }
      const merged = [...new Set([...sent, ...due.map(d => d.key)])];
      await prisma.tender.update({ where: { id: t.id }, data: { remindersSent: JSON.stringify(merged) } }).catch(() => {});
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}

function safeParse(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
