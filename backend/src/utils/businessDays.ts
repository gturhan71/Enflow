// İş günü (SLA) hesaplama yardımcısı. Harici bağımlılık eklemeden (date-fns
// backend'in node_modules'unda yok — sadece frontend'de) saf Date aritmetiği.

/** Cumartesi(6) / Pazar(0) hariç — opsiyonel resmi tatil listesiyle (ISO "YYYY-MM-DD") birlikte. */
export function addBusinessDays(start: Date, days: number, holidays: string[] = []): Date {
  const holidaySet = new Set(holidays);
  const result = new Date(start);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    const isoDate = result.toISOString().slice(0, 10);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(isoDate);
    if (!isWeekend && !isHoliday) {
      remaining -= 1;
    }
  }

  return result;
}

/** TodoTask oluştururken slaBusinessDays verilmişse dueDate'i otomatik hesaplar. */
export function computeSlaDueDate(slaBusinessDays?: number | null, from: Date = new Date()): Date | null {
  if (!slaBusinessDays || slaBusinessDays <= 0) return null;
  return addBusinessDays(from, slaBusinessDays);
}

/** [start,end] (ikisi de dahil) aralığındaki hafta sonu olmayan gün sayısı — Faz 5
 * Ekip Utilizasyonu kapasite hesabı için (resmi tatil listesi yok, bilinçli basitleştirme). */
export function countBusinessDaysInRange(start: Date, end: Date, holidays: string[] = []): number {
  const holidaySet = new Set(holidays);
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= last.getTime()) {
    const dayOfWeek = cursor.getDay();
    const isoDate = cursor.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(isoDate)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
