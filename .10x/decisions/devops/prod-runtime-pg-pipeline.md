# DevOps — prod-runtime-pg-pipeline
- **CI:** `verify` (tsc, guard'lar, vitest, node:test, sync-postgres-schema --check, build) + yeni `postgres` job'u (`scripts/ci-postgres.sh`, postgres:16 servisi).
- **Dağıtım:** derlenmiş backend (`node backend/dist/index.js`) + OS servisi (systemd/launchd/WinSW, wizard 8/8 opt-in). Servis dosyaları `service/` (gitignore).
- **Yükseltme:** upgrade-tool: ön-yedek → git → install → generate+migrate deploy (migrator) → build → (RLS) → servis restart → health(uptime) → hata: otomatik kod rollback (SQLite DB otomatik, PG için pg_restore komutu).
- **Rollback planı:** kod otomatik; Postgres verisi MANUEL (`backend/backups/pre-upgrade-*.dump`, log'daki maskeli komut).
- **Sürüm:** MINOR adayı v2.6.0 — açık onay bekliyor.
