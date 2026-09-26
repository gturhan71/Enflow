// Zamanlayıcı yardımcısı — "ilk tarama gecikmeli, sonra periyodik" deseni.
// Durdurma fonksiyonu döndürür; graceful shutdown (lifecycle.ts) yeni tick'leri
// bununla keser. Sürmekte olan bir tick kesilmez (schedulerLock TTL'i kilidi zaten
// serbest bırakır) — kapanış süre aşımı bu yüzden sınırlı tutulur.
export type StopFn = () => void;

export function schedulePeriodic(firstDelayMs: number, intervalMs: number, tick: () => void): StopFn {
  let interval: NodeJS.Timeout | null = null;
  const first = setTimeout(() => {
    tick();
    interval = setInterval(tick, intervalMs);
  }, firstDelayMs);
  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}
