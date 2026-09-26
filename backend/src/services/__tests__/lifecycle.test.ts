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
    expect(calls).toEqual(['close', 'closeAll', 'stop', 'stop', 'disconnect']);
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
