// Enflow — Cezai Şart / Gecikme Cezası Hesabı
// ─────────────────────────────────────────────────────────────────────────────
// Sözleşmeye göre teslim tarihi aşıldığında tahmini gecikme cezasını hesaplar.
// Yalnız bilgilendirici bir hesaplamadır — Finans/Invoice'a otomatik yansımaz.

export interface PenaltyExposureInput {
  contractValue: number;
  dailyRatePct: number | null | undefined; // günlük gecikme cezası oranı (%)
  capPct: number | null | undefined;       // ceza tavanı (%, opsiyonel)
  dueDate: Date;
  asOf: Date;
}

export interface PenaltyExposureResult {
  overdueDays: number;
  rawPenalty: number;
  cappedPenalty: number;
  isCapped: boolean;
}

/**
 * Gecikme yoksa veya günlük oran tanımlı değilse `null` döner (henüz risk yok / hesaplanamaz).
 */
export function computePenaltyExposure(opts: PenaltyExposureInput): PenaltyExposureResult | null {
  const { contractValue, dailyRatePct, capPct, dueDate, asOf } = opts;
  if (dailyRatePct == null || dailyRatePct <= 0) return null;
  const overdueMs = asOf.getTime() - dueDate.getTime();
  if (overdueMs <= 0) return null;

  const overdueDays = Math.floor(overdueMs / 86400000);
  const rawPenalty = contractValue * (dailyRatePct / 100) * overdueDays;
  const cap = capPct != null && capPct > 0 ? contractValue * (capPct / 100) : null;
  const cappedPenalty = cap != null ? Math.min(rawPenalty, cap) : rawPenalty;

  return { overdueDays, rawPenalty, cappedPenalty, isCapped: cap != null && rawPenalty > cap };
}
