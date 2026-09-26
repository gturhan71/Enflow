// Bağımlılıksız süreç-içi metrik kaydı + Prometheus metin biçimi (text exposition 0.0.4).
// Çoklu replikada her süreç kendi metriklerini sunar; toplama Prometheus'un işidir.
// Etiket kardinalitesi bilinçli sınırlı: HTTP `route` Express route kalıbıdır (ham URL DEĞİL).

const BUCKETS = [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]; // saniye

interface Hist { buckets: number[]; sum: number; count: number }

const httpCount = new Map<string, number>();       // key: method|route|status
const httpHist = new Map<string, Hist>();          // key: method|route
const schedRuns = new Map<string, number>();       // key: name|result
const schedErrors = new Map<string, number>();     // key: name
const schedLastSuccess = new Map<string, number>();// unix sn
const schedLastDuration = new Map<string, number>();
const startedAt = Date.now();

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const inc = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function observeHttp(method: string, route: string, status: number, seconds: number): void {
  inc(httpCount, `${method}|${route}|${status}`);
  const k = `${method}|${route}`;
  let h = httpHist.get(k);
  if (!h) { h = { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 }; httpHist.set(k, h); }
  BUCKETS.forEach((b, i) => { if (seconds <= b) h.buckets[i]++; });
  h.sum += seconds;
  h.count++;
}

export function recordSchedulerRun(name: string, ok: boolean, seconds: number): void {
  inc(schedRuns, `${name}|${ok ? 'ok' : 'error'}`);
  schedLastDuration.set(name, seconds);
  if (ok) schedLastSuccess.set(name, Date.now() / 1000);
}

export function recordSchedulerError(name: string): void {
  inc(schedErrors, name);
}

export function renderPrometheus(): string {
  const out: string[] = [];
  const line = (s: string) => out.push(s);

  line('# HELP enflow_http_requests_total HTTP istek sayısı');
  line('# TYPE enflow_http_requests_total counter');
  for (const [k, v] of httpCount) {
    const [m, r, s] = k.split('|');
    line(`enflow_http_requests_total{method="${m}",route="${esc(r)}",status="${s}"} ${v}`);
  }

  line('# HELP enflow_http_request_duration_seconds HTTP istek süresi');
  line('# TYPE enflow_http_request_duration_seconds histogram');
  for (const [k, h] of httpHist) {
    const [m, r] = k.split('|');
    const base = `method="${m}",route="${esc(r)}"`;
    BUCKETS.forEach((b, i) => line(`enflow_http_request_duration_seconds_bucket{${base},le="${b}"} ${h.buckets[i]}`));
    line(`enflow_http_request_duration_seconds_bucket{${base},le="+Inf"} ${h.count}`);
    line(`enflow_http_request_duration_seconds_sum{${base}} ${h.sum}`);
    line(`enflow_http_request_duration_seconds_count{${base}} ${h.count}`);
  }

  line('# HELP enflow_scheduler_runs_total Zamanlayıcı tick sayısı (result=ok|error)');
  line('# TYPE enflow_scheduler_runs_total counter');
  for (const [k, v] of schedRuns) {
    const [n, r] = k.split('|');
    line(`enflow_scheduler_runs_total{scheduler="${esc(n)}",result="${r}"} ${v}`);
  }
  line('# HELP enflow_scheduler_errors_total Zamanlayıcı içinde yakalanan hatalar (tek-tenant hataları dahil)');
  line('# TYPE enflow_scheduler_errors_total counter');
  for (const [n, v] of schedErrors) line(`enflow_scheduler_errors_total{scheduler="${esc(n)}"} ${v}`);
  line('# HELP enflow_scheduler_last_success_timestamp_seconds Son başarılı tick (alarm: time() - bu > 2*aralık)');
  line('# TYPE enflow_scheduler_last_success_timestamp_seconds gauge');
  for (const [n, v] of schedLastSuccess) line(`enflow_scheduler_last_success_timestamp_seconds{scheduler="${esc(n)}"} ${v}`);
  line('# HELP enflow_scheduler_last_duration_seconds Son tick süresi');
  line('# TYPE enflow_scheduler_last_duration_seconds gauge');
  for (const [n, v] of schedLastDuration) line(`enflow_scheduler_last_duration_seconds{scheduler="${esc(n)}"} ${v}`);

  const mem = process.memoryUsage();
  line('# TYPE enflow_process_resident_memory_bytes gauge');
  line(`enflow_process_resident_memory_bytes ${mem.rss}`);
  line('# TYPE enflow_process_heap_used_bytes gauge');
  line(`enflow_process_heap_used_bytes ${mem.heapUsed}`);
  line('# TYPE enflow_process_uptime_seconds gauge');
  line(`enflow_process_uptime_seconds ${(Date.now() - startedAt) / 1000}`);
  return out.join('\n') + '\n';
}

export function resetMetricsForTest(): void {
  for (const m of [httpCount, schedRuns, schedErrors, schedLastSuccess, schedLastDuration] as Map<string, number>[]) m.clear();
  httpHist.clear();
}
