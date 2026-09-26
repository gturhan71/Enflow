# Gözlemlenebilirlik (P1-7)

## Request-id
Her yanıtta `X-Request-Id`. İstemci güvenli biçimde (`[A-Za-z0-9._-]{8,64}`) gönderirse aynısı taşınır, yoksa UUID üretilir.
Üretimde JSON loglarda `reqId` alanı; geliştirmede satır başında `[<ilk 8>]`. 500 yanıtlarının gövdesinde `requestId` döner —
kullanıcı bunu destek ekibine iletir, log'da tek aramayla bulunur.

## Metrikler — `GET /api/metrics`
Yalnız `METRICS_TOKEN` env'i tanımlıysa ve `Authorization: Bearer <token>` eşleşirse yanıt verir; aksi halde **404** (uç yokmuş gibi).
Prometheus text biçimi, bağımlılıksız (`services/metrics.ts`). Çoklu replikada her süreç kendi metriğini sunar.

| Metrik | Açıklama |
|---|---|
| `enflow_http_requests_total{method,route,status}` | `route` Express kalıbı (`/api/customers/:id`), ham URL değil |
| `enflow_http_request_duration_seconds` | histogram (5 ms – 10 sn) |
| `enflow_scheduler_runs_total{scheduler,result}` | tick sayısı (ok/error) |
| `enflow_scheduler_errors_total{scheduler}` | zamanlayıcı içinde **yakalanan** hatalar (tek-tenant hataları dahil) |
| `enflow_scheduler_last_success_timestamp_seconds{scheduler}` | son başarılı tick |
| `enflow_process_{resident_memory,heap_used}_bytes`, `_uptime_seconds` | süreç |

Zamanlayıcılar: `backup-scheduler`, `activity-log-archive`, `profitability-snapshot`, `update-notifier`.
Önceden bu hatalar boş `catch {}` ile yutuluyordu; artık `logger.error` + sayaç.

## Örnek Prometheus alarmları
```yaml
- alert: EnflowSchedulerStale          # yedekleme dakikada bir koşar
  expr: time() - enflow_scheduler_last_success_timestamp_seconds{scheduler="backup-scheduler"} > 600
- alert: EnflowSchedulerErrors
  expr: increase(enflow_scheduler_errors_total[15m]) > 0
- alert: EnflowHigh5xx
  expr: sum(rate(enflow_http_requests_total{status=~"5.."}[5m])) / sum(rate(enflow_http_requests_total[5m])) > 0.02
- alert: EnflowSlowP95
  expr: histogram_quantile(0.95, sum by (le) (rate(enflow_http_request_duration_seconds_bucket[5m]))) > 1
```
Not: `last_success` serisi süreç başladıktan sonraki ilk başarılı tick'e kadar yoktur; `absent()` ile birlikte kullanın.
Zamanlayıcı aralıkları: backup 60 sn, update-notifier 10 dk, activity-log-archive 1 sa, profitability-snapshot 6 sa.
