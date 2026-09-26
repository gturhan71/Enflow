// Graceful shutdown (ADR-001). Servis yöneticisi (systemd/launchd/WinSW) ve
// upgrade-tool süreci SIGTERM ile durdurur; bu modül sırayla:
//   1) yeni bağlantı kabulünü keser (server.close) + zamanlayıcıları durdurur
//   2) BOŞTAKİ keep-alive bağlantıları kapatır; sürmekte olan (aktif) istekler graceMs
//      (varsayılan 3 sn) boyunca BİTMEYE bırakılır — yazma/yükleme yarım kalmasın.
//      Bu sürede boşa çıkan bağlantılar da 100 ms'de bir kapatılır.
//   3) graceMs dolunca kalanlar (SSE /reports/stream gibi uzun ömürlü bağlantılar) zorla
//      kapatılır — aksi hâlde server.close sonsuza dek beklerdi
//   4) DB bağlantısını kapatır, 5) çıkar (0).
// Süre aşımında (varsayılan 10 sn) çıkış kodu 1; ikinci sinyal anında zorla çıkar.
// process/exit/logger enjekte edilir → birim testinde gerçek süreç sonlanmaz.
import type { Server } from 'http';
import type { StopFn } from './services/periodic';

export interface ShutdownDeps {
  server: Pick<Server, 'close' | 'closeAllConnections' | 'closeIdleConnections'>;
  stops: StopFn[];
  disconnect: () => Promise<void>;
  timeoutMs?: number;
  /** Aktif isteklere tanınan süre (ms); dolunca kalan bağlantılar zorla kapatılır. Varsayılan 3000. */
  graceMs?: number;
  exit?: (code: number) => void;
  log?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
}

export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const log = deps.log ?? { info: () => {}, error: () => {} };
  const timeoutMs = deps.timeoutMs ?? 10_000;
  // Toplam süre aşımının en fazla yarısı — DB kapatma + çıkışa da zaman kalsın
  const graceMs = Math.min(deps.graceMs ?? 3_000, Math.floor(timeoutMs / 2));
  let started = false;

  return async (signal: string) => {
    if (started) {
      log.error(`[Enflow Backend] ${signal} tekrar alındı — zorla çıkılıyor.`);
      exit(1);
      return;
    }
    started = true;
    log.info(`[Enflow Backend] ${signal} alındı — kapanış başlıyor.`);

    const timer = setTimeout(() => {
      log.error(`[Enflow Backend] Kapanış ${timeoutMs} ms içinde bitmedi — zorla çıkılıyor.`);
      exit(1);
    }, timeoutMs);
    timer.unref();

    let idleSweep: NodeJS.Timeout | undefined;
    let forceClose: NodeJS.Timeout | undefined;
    try {
      const closed = new Promise<void>((resolve) => deps.server.close(() => resolve()));
      for (const stop of deps.stops) stop();
      deps.server.closeIdleConnections();
      idleSweep = setInterval(() => deps.server.closeIdleConnections(), 100);
      idleSweep.unref();
      forceClose = setTimeout(() => {
        log.info(`[Enflow Backend] ${graceMs} ms içinde bitmeyen bağlantılar kapatılıyor.`);
        deps.server.closeAllConnections();
      }, graceMs);
      forceClose.unref();
      await closed;
      clearInterval(idleSweep);
      clearTimeout(forceClose);
      await deps.disconnect();
      clearTimeout(timer);
      log.info('[Enflow Backend] Kapanış tamamlandı.');
      exit(0);
    } catch (e: unknown) {
      if (idleSweep) clearInterval(idleSweep);
      if (forceClose) clearTimeout(forceClose);
      clearTimeout(timer);
      log.error('[Enflow Backend] Kapanış hatası:', e);
      exit(1);
    }
  };
}

export function installShutdown(deps: ShutdownDeps): void {
  const shutdown = createShutdown(deps);
  const on = deps.onSignal ?? ((sig, h) => { process.on(sig, h); });
  for (const sig of ['SIGTERM', 'SIGINT'] as const) on(sig, () => { void shutdown(sig); });
}
