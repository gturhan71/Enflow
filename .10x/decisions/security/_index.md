# Security — indeks
## Genel [DISCOVERED]
İyi: JWT, helmet, rate-limit, CORS allowlist, AES-GCM tenant DEK, Ed25519 lisans, SSRF guard, IDOR guard. Risk: CSP kapalı + localStorage JWT (P0-3, bekliyor).
## Aktif işler
- [prod-runtime-pg-pipeline](prod-runtime-pg-pipeline.md) — onay; RLS PG'de doğrulandı
