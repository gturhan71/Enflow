import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveRequestId, runWithRequestId, getRequestId } from '../requestContext';
import { observeHttp, recordSchedulerRun, recordSchedulerError, renderPrometheus, resetMetricsForTest } from '../metrics';
import { schedulePeriodic, reportSchedulerError } from '../periodic';

describe('request-id', () => {
  it('güvenli gelen kimliği korur', () => {
    expect(resolveRequestId('abc-12345678')).toBe('abc-12345678');
  });
  it('güvensiz/eksik kimlik yerine UUID üretir (log enjeksiyonu önlemi)', () => {
    for (const bad of ['a b', 'x\ny12345678', '', undefined, 'kısa', 'a'.repeat(65)]) {
      expect(resolveRequestId(bad)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
  it('bağlam içinde okunur, dışında undefined', () => {
    expect(getRequestId()).toBeUndefined();
    runWithRequestId('req-12345678', () => expect(getRequestId()).toBe('req-12345678'));
  });
});

describe('metrics', () => {
  beforeEach(() => resetMetricsForTest());

  it('HTTP sayaç + histogram (kümülatif kovalar) üretir', () => {
    observeHttp('GET', '/api/customers/:id', 200, 0.03);
    observeHttp('GET', '/api/customers/:id', 500, 3);
    const t = renderPrometheus();
    expect(t).toContain('enflow_http_requests_total{method="GET",route="/api/customers/:id",status="200"} 1');
    expect(t).toContain('enflow_http_requests_total{method="GET",route="/api/customers/:id",status="500"} 1');
    expect(t).toContain('enflow_http_request_duration_seconds_bucket{method="GET",route="/api/customers/:id",le="0.025"} 0');
    expect(t).toContain('enflow_http_request_duration_seconds_bucket{method="GET",route="/api/customers/:id",le="0.1"} 1');
    expect(t).toContain('enflow_http_request_duration_seconds_bucket{method="GET",route="/api/customers/:id",le="+Inf"} 2');
    expect(t).toContain('enflow_http_request_duration_seconds_count{method="GET",route="/api/customers/:id"} 2');
  });

  it('zamanlayıcı: başarı zaman damgası yalnız ok tick\'te, hata ayrı sayılır', () => {
    recordSchedulerRun('x', false, 1);
    expect(renderPrometheus()).not.toContain('last_success_timestamp_seconds{scheduler="x"}');
    recordSchedulerRun('x', true, 2);
    recordSchedulerError('x');
    const t = renderPrometheus();
    expect(t).toContain('enflow_scheduler_runs_total{scheduler="x",result="error"} 1');
    expect(t).toContain('enflow_scheduler_runs_total{scheduler="x",result="ok"} 1');
    expect(t).toContain('enflow_scheduler_errors_total{scheduler="x"} 1');
    expect(t).toMatch(/last_success_timestamp_seconds\{scheduler="x"\} \d+/);
  });

  it('etiket değerlerini kaçırır', () => {
    observeHttp('GET', '/a"b', 200, 0.001);
    expect(renderPrometheus()).toContain('route="/a\\"b"');
  });
});

describe('schedulePeriodic — hata görünürlüğü', () => {
  beforeEach(() => { resetMetricsForTest(); vi.useFakeTimers(); });

  it('reddedilen tick yutulmaz: error sayılır, sonraki tick yine çalışır', async () => {
    const tick = vi.fn().mockRejectedValueOnce(new Error('patladı')).mockResolvedValue(undefined);
    const stop = schedulePeriodic(10, 10, tick, 'demo');
    await vi.advanceTimersByTimeAsync(10);
    let t = renderPrometheus();
    expect(t).toContain('enflow_scheduler_runs_total{scheduler="demo",result="error"} 1');
    expect(t).toContain('enflow_scheduler_errors_total{scheduler="demo"} 1');
    await vi.advanceTimersByTimeAsync(10);
    t = renderPrometheus();
    expect(t).toContain('enflow_scheduler_runs_total{scheduler="demo",result="ok"} 1');
    stop();
  });

  it('eşzamanlı fırlatan tick de yakalanır', async () => {
    const stop = schedulePeriodic(5, 1000, () => { throw new Error('sync'); }, 'sync-demo');
    await vi.advanceTimersByTimeAsync(5);
    expect(renderPrometheus()).toContain('enflow_scheduler_errors_total{scheduler="sync-demo"} 1');
    stop();
  });

  it('reportSchedulerError sayacı artırır', () => {
    reportSchedulerError('per-tenant', new Error('x'), { scope: 'tenant' });
    expect(renderPrometheus()).toContain('enflow_scheduler_errors_total{scheduler="per-tenant"} 1');
  });
});
