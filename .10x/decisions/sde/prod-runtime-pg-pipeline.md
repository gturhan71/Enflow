# SDE — prod-runtime-pg-pipeline
## M1 (tamam — 2026-09-26, PR 1)
| Görev | Commit | Not |
|---|---|---|
| T1 build | 15a5768 | `tsconfig.build.json`; `start`=node dist; wizard backend build zorunlu; upgrade-tool yükseltme+rollback'te backend build (M2 beklemeden — aksi hâlde stale dist) |
| T2+T3 shutdown | 082a5f0 | `services/periodic.ts` + `lifecycle.ts`; interval artık ilk tick'ten sonra başlar |
| T4 health | 98cc1df | `routes/health.ts`, 200/503 |
| T5 PG şema | b6964e0 | `scripts/sync-postgres-schema.mjs` + verify guard |
| T6 config+baseline | 0d65679 | `src/config/prismaPaths.ts`; baseline 80 tablo |
| T7 pg.mjs | b925011 | + tanımlayıcı kaçışı; paketlere lib/ |
| **fix RLS** | a85101b | **Plan dışı, kritik:** tembel PrismaPromise RLS context'ini kaybediyordu → PG+RLS'te login/tüm auth kırık. Kök fix tenantContext.ts |
| T8 CI | e446579 | `scripts/ci-postgres.sh` + job; plana ek: uygulama-katmanı RLS HTTP testi (setup/2.setup 403/login/yaz-oku) |
## Sapmalar
- Drift kontrolü shadow DB yerine `--from-config-datasource` (Prisma 7'de `--shadow-database-url` yok).
- `/setup/init` yeniden-kurulum açığı şüphesi test edildi → yok (Tenant RLS istisnası); CI'da kalıcı test.
## Teknik borç
- `ci-postgres.sh` yerelde çalışınca Prisma client PG'ye üretilir → sonra `npx prisma generate` (SQLite) gerekir.
- Money alanları PG'de DOUBLE PRECISION (bilinen, BigInt göçü ertelenmiş).
