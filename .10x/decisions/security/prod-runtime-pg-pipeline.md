# Security — prod-runtime-pg-pipeline
Rapor: `reviews/2026-09-26-security-review.md` — ONAY. Düzeltilen: S1 (pg parolası argv), S2 (config 0600+maske), S3/S4 (RLS PG doğrulama, setup/init 403 testi).
Açık/kabul: S5 WinSW TOFU, S6 minimal systemd sertleştirme, S8 izlenen test token'ları (ayrı iş), migratorUrl diskte düz metin (env tercih).
