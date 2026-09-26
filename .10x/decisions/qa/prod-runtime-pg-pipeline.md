# QA — prod-runtime-pg-pipeline
Rapor: `reviews/2026-09-26-qa-report.md` — koşullu onay. RBAC 1027/1027 (izole kopya), e2e 12/12, verify yeşil, PG CI script yeşil, upgrade/rollback uçtan uca, gerçek launchd.
5 hata bulundu+düzeltildi (biri kritik: PG+RLS login). Doğrulanmamış: Windows/WinSW, systemd (gerçek), LaunchDaemon+reboot, CI job'unun GH'daki ilk koşusu.
**Kalite kapıları:** her PR `verify` + `postgres` job'u; MINOR sürüm öncesi `docs/RELEASE_CHECKLIST.md`.
