// Dashboard'ın "anlık" güncellenmesi için DB-native sinyal. SSE mesajı tam veri
// taşımaz, sadece "bir şey değişti" sinyali verir; frontend bunu alınca mevcut
// REST çağrısıyla (GET /reports/dashboard) yeniden çeker — tek doğruluk kaynağı
// REST'te kalır.
//
// Önceden bellek-içi EventEmitter'dı (tek-süreç varsayımı) — çoklu replikada bir
// yazma isteğini karşılayan replika, başka bir replikaya bağlı SSE dinleyicisini
// hiç tetikleyemiyordu. Artık Tenant.dashboardPingAt üzerinden DB-native: pingDashboard
// bir zaman damgası yazar, /dashboard/stream route'u (reports.ts) bunu kısa aralıklarla
// poll eder — her replika kendi bağlantısı için DB'yi doğrudan okur, aralarında
// koordinasyona gerek yok. bkz. docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz C / S-02.

import { prisma } from '../prismaClient';

export function pingDashboard(tenantId: string): void {
  prisma.tenant.update({ where: { id: tenantId }, data: { dashboardPingAt: new Date() } }).catch(() => undefined);
}

/** Son sinyal zamanını epoch-ms olarak döner; hiç ping atılmamışsa null. */
export async function getDashboardPingAt(tenantId: string): Promise<number | null> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { dashboardPingAt: true } }).catch(() => null);
  return t?.dashboardPingAt ? t.dashboardPingAt.getTime() : null;
}
