# QA — indeks
## Genel [DISCOVERED]
Backend unit ~176→200+; E2E oracle 12 test (3 gerçek bug); RBAC ~1027 (CI dışı); FE unit testi yok; route/entegrasyon katmanı zayıf.
## Aktif işler
- [prod-runtime-pg-pipeline](prod-runtime-pg-pipeline.md) — koşullu onay

## 2026-09-26 hata avı
[hunt-report](../../reviews/2026-09-26-hunt-report.md) — 5 kanıtlı hata (1 kritik: PLATFORM yedeği kiracılar arası sızıntı) düzeltildi, hepsi regresyon testli.
İlke: içerik-tabanlı (veri sızıntısı) testler; testler eski kodda kırmızı olduğu doğrulanarak yazılır.
