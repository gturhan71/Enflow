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
