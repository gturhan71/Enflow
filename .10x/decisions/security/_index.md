# Security — indeks
## Genel [DISCOVERED]
İyi: JWT, helmet, rate-limit, CORS allowlist, AES-GCM tenant DEK, Ed25519 lisans, SSRF guard, IDOR guard. Risk: CSP kapalı + localStorage JWT (P0-3, bekliyor).
## Aktif işler
- [prod-runtime-pg-pipeline](prod-runtime-pg-pipeline.md) — onay; RLS PG'de doğrulandı

## 2026-09-26 hata avı
[hunt-report](../../reviews/2026-09-26-hunt-report.md): **KRİTİK** kiracılar arası yedek sızıntısı (H1) + izin/sır (H4) + upgrade-tool arayüz auth (H5) düzeltildi.
Açık: LOCAL yedek `location` yolu (düşük), stale RUNNING yedek (kanıtlanmadı).
