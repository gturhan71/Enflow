// Graceful shutdown (ADR-001). Servis yöneticisi (systemd/launchd/WinSW) ve
// upgrade-tool süreci SIGTERM ile durdurur; bu modül sırayla:
//   1) yeni bağlantı kabulünü keser (server.close)
//   2) açık bağlantıları kapatır (closeAllConnections — SSE /reports/stream gibi
//      uzun ömürlü bağlantılar aksi hâlde server.close'u sonsuza dek bekletir)
//   3) zamanlayıcıları durdurur, 4) DB bağlantısını kapatır, 5) çıkar (0).
// Süre aşımında (varsayılan 10 sn) çıkış kodu 1; ikinci sinyal anında zorla çıkar.
// process/exit/logger enjekte edilir → birim testinde gerçek süreç sonlanmaz.
import type { Server } from 'http';
import type { StopFn } from './services/periodic';

export interface ShutdownDeps {
  server: Pick<Server, 'close' | 'closeAllConnections'>;
  stops: StopFn[];
  disconnect: () => Promise<void>;
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
}

export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const log = deps.log ?? { info: () => {}, error: () => {} };
  const timeoutMs = deps.timeoutMs ?? 10_000;
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

    try {
      const closed = new Promise<void>((resolve) => deps.server.close(() => resolve()));
      deps.server.closeAllConnections();
      for (const stop of deps.stops) stop();
      await closed;
      await deps.disconnect();
      clearTimeout(timer);
      log.info('[Enflow Backend] Kapanış tamamlandı.');
      exit(0);
    } catch (e: unknown) {
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
