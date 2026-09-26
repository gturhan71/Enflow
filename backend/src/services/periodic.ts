// Zamanlayıcı yardımcısı — "ilk tarama gecikmeli, sonra periyodik" deseni.
// Durdurma fonksiyonu döndürür; graceful shutdown (lifecycle.ts) yeni tick'leri
// bununla keser. Sürmekte olan bir tick kesilmez (schedulerLock TTL'i kilidi zaten
// serbest bırakır) — kapanış süre aşımı bu yüzden sınırlı tutulur.
//
// `name` verilirse her tick süre/başarı olarak metriklere işlenir ve tick'ten kaçan
// (unhandled) hata loglanır + sayılır (P1-7: zamanlayıcı başarısızlığı sessiz kalmasın).
import { logger } from '../utils/logger';
import { recordSchedulerRun, recordSchedulerError } from './metrics';

export type StopFn = () => void;

/** Zamanlayıcı içinde YUTULAN bir hatayı görünür kılar (log + sayaç). Akışı kesmez. */
export function reportSchedulerError(name: string, err: unknown, ctx?: Record<string, unknown>): void {
  recordSchedulerError(name);
  logger.error(`[scheduler:${name}] hata`, err, ctx);
}

export function schedulePeriodic(
  firstDelayMs: number,
  intervalMs: number,
  tick: () => void | Promise<void>,
  name?: string,
): StopFn {
  const run = () => {
    const t0 = Date.now();
    let p: Promise<void>;
    try { p = Promise.resolve(tick()); } catch (e) { p = Promise.reject(e); }  // tick eşzamanlı çağrılır
    p.then(
        () => { if (name) recordSchedulerRun(name, true, (Date.now() - t0) / 1000); },
        (e: unknown) => {
          if (name) { recordSchedulerRun(name, false, (Date.now() - t0) / 1000); reportSchedulerError(name, e); }
          else logger.error('[scheduler] tick hatası', e);
        },
      );
  };
  let interval: NodeJS.Timeout | null = null;
  const first = setTimeout(() => {
    run();
    interval = setInterval(run, intervalMs);
  }, firstDelayMs);
  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}
