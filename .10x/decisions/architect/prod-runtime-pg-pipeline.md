# Architect — prod-runtime-pg-pipeline (ADR-001, ADR-002)
## Bileşenler
| Birim | Sorumluluk | Bağımlılık |
|---|---|---|
| `backend/tsconfig.build.json` | prod derleme (scripts dahil, governance-import eden 3 script hariç) | tsc |
| `backend/src/lifecycle.ts` | sinyal → sıralı kapanma, süre aşımı | http.Server, scheduler stop'ları, prisma |
| scheduler'lar (4) | `start*()` → `stop()` döndürür | — |
| `/api/health` | DB ping + versiyon | prisma |
| `install/service/*` + `install/lib/service.mjs` | şablon render + OS'e kurulum | systemctl/launchctl/WinSW |
| `install/lib/pg.mjs` | PG provision + grant SQL (wizard + CI ortak) | psql |
| `backend/prisma.config.ts` `resolvePrismaPaths` | URL → schema/migrations yolu | — |
| `backend/scripts/sync-postgres-schema.mjs` | kanonik → PG şema, `--check` | — |
| `backend/scripts/db-migrate.mjs` | çift migration üretimi | prisma CLI, git |
| `upgrade-tool/core.mjs` | build, OS restart, health-poll, auto code rollback, PG ön-yedek + migrator deploy + RLS yeniden uygulama | service.mjs, pg_dump |
| CI `postgres` job | deploy → drift → RLS → boot/health/SIGTERM | postgres:16 |
## Veri akışı (upgrade, Postgres)
preflight (temiz ağaç) → pg_dump → git checkout → install → generate → **migrate deploy (migrator)** → [RLS varsa apply] → build FE+BE → OS restart → health 60 sn → ok | kod geri al + restart + pg_restore ipucu
## Hata modları
Spec tablosu geçerli. Ek: `closeAllConnections` Node ≥18.2 gerektirir (CI Node 22, SYSTEM_REQUIREMENTS kontrol edilecek).
