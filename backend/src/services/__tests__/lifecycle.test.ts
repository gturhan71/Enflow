import http from 'http';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createShutdown, type ShutdownDeps } from '../../lifecycle';
import { schedulePeriodic } from '../periodic';

function fakeServer(closeDelayMs = 0) {
  const calls: string[] = [];
  return {
    calls,
    server: {
      close: (cb?: (err?: Error) => void) => { calls.push('close'); setTimeout(() => cb?.(), closeDelayMs); return undefined as never; },
      closeAllConnections: () => { calls.push('closeAll'); },
      closeIdleConnections: () => { if (calls[calls.length - 1] !== 'closeIdle') calls.push('closeIdle'); },
    } as ShutdownDeps['server'],
  };
}

afterEach(() => { vi.useRealTimers(); });

describe('createShutdown', () => {
  it('sırayla kapatır ve 0 ile çıkar', async () => {
    const { server, calls } = fakeServer();
    const exit = vi.fn();
    const stop = vi.fn(() => calls.push('stop'));
    const disconnect = vi.fn(async () => { calls.push('disconnect'); });
    await createShutdown({ server, stops: [stop, stop], disconnect, exit })('SIGTERM');
    expect(calls).toEqual(['close', 'stop', 'stop', 'closeIdle', 'disconnect']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('süre aşımında 1 ile çıkar', async () => {
    vi.useFakeTimers();
    const { server } = fakeServer(60_000);
    const exit = vi.fn();
    void createShutdown({ server, stops: [], disconnect: async () => {}, exit, timeoutMs: 100 })('SIGTERM');
    await vi.advanceTimersByTimeAsync(150);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ikinci sinyalde zorla çıkar', async () => {
    const { server } = fakeServer(50);
    const exit = vi.fn();
    const shutdown = createShutdown({ server, stops: [], disconnect: async () => {}, exit });
    const first = shutdown('SIGTERM');
    await shutdown('SIGINT');
    expect(exit).toHaveBeenCalledWith(1);
    await first;
  });

  it('disconnect hatasında 1 ile çıkar', async () => {
    const { server } = fakeServer();
    const exit = vi.fn();
    await createShutdown({ server, stops: [], disconnect: async () => { throw new Error('db'); }, exit })('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
  });
});

// Gerçek HTTP sunucusuyla: açık istekler kapanışta yarım KESİLMEMELİ (graceMs), süresi aşanlar kesilmeli
describe('createShutdown — aktif istekler (gerçek http sunucusu)', () => {
  function start(handlerDelayMs: number) {
    const server = http.createServer((_req, res) => { setTimeout(() => res.end('tamam'), handlerDelayMs); });
    return new Promise<{ server: http.Server; port: number }>((resolve) => server.listen(0, () => resolve({ server, port: (server.address() as { port: number }).port })));
  }
  const get = (port: number) => new Promise<string>((resolve, reject) => {
    http.get({ port, path: '/', agent: false }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => resolve(d)); }).on('error', (e: NodeJS.ErrnoException) => reject(e));
  });

  it('grace süresi içinde biten istek TAMAMLANIR, sonra exit(0)', async () => {
    const { server, port } = await start(300);
    const exit = vi.fn();
    const pending = get(port);
    await new Promise((r) => setTimeout(r, 50));
    await createShutdown({ server, stops: [], disconnect: async () => {}, exit, graceMs: 2_000 })('SIGTERM');
    expect(await pending).toBe('tamam');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('grace süresini aşan istek zorla kesilir; kapanış yine de biter', async () => {
    const { server, port } = await start(5_000);
    const exit = vi.fn();
    const pending = get(port).then(() => 'bitti', (e) => e.code);
    await new Promise((r) => setTimeout(r, 50));
    const t0 = Date.now();
    await createShutdown({ server, stops: [], disconnect: async () => {}, exit, graceMs: 300, timeoutMs: 4_000 })('SIGTERM');
    expect(await pending).toBe('ECONNRESET');
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('boşta bekleyen keep-alive bağlantısı kapanışı geciktirmez', async () => {
    const { server, port } = await start(0);
    const agent = new http.Agent({ keepAlive: true });
    await new Promise<void>((resolve) => http.get({ port, agent }, (r) => { r.resume(); r.on('end', () => resolve()); }));
    const exit = vi.fn();
    const t0 = Date.now();
    await createShutdown({ server, stops: [], disconnect: async () => {}, exit, graceMs: 3_000 })('SIGTERM');
    agent.destroy();
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('schedulePeriodic', () => {
  it('gecikmeyle başlar, periyodik tekrarlar, stop sonrası durur', () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const stop = schedulePeriodic(100, 50, tick);
    vi.advanceTimersByTime(99); expect(tick).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1); expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); expect(tick).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(500); expect(tick).toHaveBeenCalledTimes(3);
  });

  it('ilk tick öncesi stop hiç çalıştırmaz', () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    schedulePeriodic(100, 50, tick)();
    vi.advanceTimersByTime(1000);
    expect(tick).not.toHaveBeenCalled();
  });
});
