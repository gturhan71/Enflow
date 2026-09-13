// Enflow — Teslim Süresi Alt Kırılımlı Tahmini Takvim
// ─────────────────────────────────────────────────────────────────────────────
// Sözleşmeye göre teslim süresi (imza gününden itibaren gün sayısı) içine yayılan
// tahmini ara fazlar (Sipariş Onayı/Üretim/Sevkiyat/Teslim). İhale ve Sözleşme
// aşamalarında salt-okunur gösterim içindir — kullanıcı elle düzenlemez.

export interface DeliveryPhaseTemplate {
  title: string;
  pctOfPeriod: number; // 0-1 arası, teslim süresinin ne kadarında bu faz tamamlanmış olmalı
}

export const DEFAULT_DELIVERY_PHASES: DeliveryPhaseTemplate[] = [
  { title: 'Sipariş Onayı', pctOfPeriod: 0.10 },
  { title: 'Üretim/Tedarik', pctOfPeriod: 0.60 },
  { title: 'Sevkiyat', pctOfPeriod: 0.85 },
  { title: 'Teslim/Kabul', pctOfPeriod: 1.00 },
];

export interface DeliveryTimelineStepInput {
  title: string;
  sortOrder: number;
  plannedDate: Date;
}

/**
 * `referenceStart`'tan itibaren `totalDays` süreye yayılan faz tarihlerini üretir.
 * Son fazın tarihi her zaman `referenceStart + totalDays` ile birebir aynıdır
 * (bu değer `ContractWorkflow.deliveryDueDate` ile senkron tutulur).
 */
export function buildDeliveryTimeline(
  referenceStart: Date,
  totalDays: number,
  phases: DeliveryPhaseTemplate[] = DEFAULT_DELIVERY_PHASES,
): DeliveryTimelineStepInput[] {
  const days = Math.max(0, totalDays);
  return phases.map((phase, i) => ({
    title: phase.title,
    sortOrder: i,
    plannedDate: addDays(referenceStart, Math.round(days * phase.pctOfPeriod)),
  }));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function computeDeliveryDueDate(referenceStart: Date, totalDays: number): Date {
  return addDays(referenceStart, Math.max(0, totalDays));
}
