// Enflow — Teminat mektubu sona erme hatırlatma sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// B-07: GuaranteeLetter.expiryDate için tenderReminders.ts ile aynı desende
// 30/15/7 gün eşiklerinde idempotent bildirim üretir. GET /finance/guarantees
// çağrısında tetiklenir; kaçırılan eşikler bir sonraki sweep'te yakalanır.

import { prisma } from '../prismaClient';

interface Threshold { key: string; days: number; label: string; }
const THRESHOLDS: Threshold[] = [
  { key: '30d', days: 30, label: '30 gün' },
  { key: '15d', days: 15, label: '15 gün' },
  { key: '7d', days: 7, label: '7 gün' },
];

// Tenant başına en fazla 60sn'de bir sweep (gereksiz DB yükünü önler)
const lastSweepByTenant = new Map<string, number>();

export async function sweepGuaranteeReminders(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const guarantees = await prisma.guaranteeLetter.findMany({
      where: { tenantId, status: 'ACTIVE', isIndefinite: false, expiryDate: { not: null } },
    });
    if (guarantees.length === 0) return;
    const financeUsers = await prisma.user.findMany({ where: { tenantId, role: 'FINANCE_MGR', status: 'ACTIVE' } });

    for (const g of guarantees) {
      const expiry = g.expiryDate!.getTime();
      if (expiry <= now) continue; // süresi zaten dolmuş — ayrı bir statü kaygısı (EXPIRED), hatırlatma değil
      const daysLeft = (expiry - now) / 86_400_000;
      const sent: string[] = g.remindersSent ? safeParse(g.remindersSent) : [];
      const due = THRESHOLDS.filter(th => daysLeft <= th.days && !sent.includes(th.key));
      if (due.length === 0) continue;

      // Sadece en yakın (en küçük günlü) eşiği bildir; kaçırılanları da işaretle (spam önleme)
      const closest = due.reduce((a, b) => (a.days < b.days ? a : b));
      const recipients = [...new Set([g.requestedById, ...financeUsers.map(u => u.id)].filter(Boolean) as string[])];
      for (const userId of recipients) {
        await prisma.notification.create({
          data: {
            tenantId, userId, type: 'WARNING',
            title: 'Teminat mektubu süresi yaklaşıyor',
            message: `${g.refNo || g.type} teminat mektubunun süresine ${closest.label} kaldı (${g.bankName || 'banka belirtilmemiş'}, ${g.amount.toLocaleString('tr-TR')} ${g.currency}). Yenileme/serbest bırakma işlemini planlayın.`,
            relatedModule: 'finance', relatedItemId: g.id,
          },
        }).catch(() => {});
      }
      const merged = [...new Set([...sent, ...due.map(d => d.key)])];
      await prisma.guaranteeLetter.update({ where: { id: g.id }, data: { remindersSent: JSON.stringify(merged) } }).catch(() => {});
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}

function safeParse(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
