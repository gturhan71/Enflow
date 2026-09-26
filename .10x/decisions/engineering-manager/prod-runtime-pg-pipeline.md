# EM — prod-runtime-pg-pipeline: görev planı
Toplam ≈ 19 görev × ≤0,5 gün ≈ **9–10 geliştirici-günü**. Üç kilometre taşı; her biri tek başına değer üretir ve ayrı PR olabilir.

## M1 — "Postgres + RLS CI'da yeşil" (en yüksek risk önce)
| # | Görev | Bağımlı | Tahmin |
|---|---|---|---|
| T1 | `tsconfig.build.json` + `build`/`start` script'leri + `backend/dist` gitignore + `pnpm verify`'a backend build | — | 0,5 |
| T2 | 4 scheduler `stop()` döndürsün + test | — | 0,25 |
| T3 | `lifecycle.ts` graceful shutdown (+closeAllConnections) + index.ts bağlama + test | T2 | 0,5 |
| T4 | `/api/health` DB ping/timeout/versiyon + test | — | 0,25 |
| T5 | `sync-postgres-schema.mjs` (+`--check`) + `prisma/postgres/schema.prisma` + verify'a ekle | — | 0,5 |
| T6 | `prisma.config.ts` `resolvePrismaPaths` + test + `migrations-postgres/0000_baseline` + lock | T5 | 0,5 |
| T7 | `install/lib/pg.mjs` — provision/grant SQL'ini wizard'dan çıkar (davranış aynı) | — | 0,5 |
| T8 | CI `postgres` job: deploy → drift → rol/grant → RLS apply+verify → boot/health/SIGTERM | T1,T3,T4,T6,T7 | 0,5–1 |
**Risk:** T8 ilk kez RLS'i gerçek PG'de koşacak → hata çıkabilir; düzeltme ayrı görev olarak eklenir (tampon 1 gün).

## M2 — "Postgres kurulumu güvenle yükseltilebilir"
| # | Görev | Bağımlı | Tahmin |
|---|---|---|---|
| T9 | `db-migrate.mjs` çift migration akışı + CLAUDE.md notu | T6 | 0,5 |
| T10 | Wizard: `setSchemaProvider` kaldır, PG'de `migrate deploy` (migrator) + pg.mjs kullan | T6,T7 | 0,5 |
| T11 | `migrateToPostgres.ts`: dosya flip'i kaldır, config + child `prisma generate` env ile | T6 | 0,5 |
| T12 | upgrade-tool: backend build adımı + OS restart çözümleyici + health-poll + otomatik kod geri alma + test | T1,T4 | 0,5 |
| T13 | upgrade-tool PG yolu: pg_dump ön-yedek, migrator URL, deploy, RLS yeniden uygula, pg_restore ipucu | T6,T12 | 0,5 |

## M3 — "OS-native servis"
| # | Görev | Bağımlı | Tahmin |
|---|---|---|---|
| T14 | systemd + launchd şablonları + `install/lib/service.mjs` render + test | T1 | 0,5 |
| T15 | WinSW şablonu + sabit sürüm indirme + SHA256 doğrulama | T14 | 0,5 |
| T16 | Wizard servis adımı (opt-in, OS'e göre, hata → elle talimat) + T12 çözümleyiciyle entegrasyon | T14,T15 | 0,5 |
| T17 | Dokümanlar: install/README, ILK_KURULUM, SYSTEM_REQUIREMENTS (Node ≥18.2, ENFLOW_MIGRATOR_URL), POSTGRES_MIGRATION_PLAN (B8 notu), start.sh/run.cjs dev-only başlıkları | hepsi | 0,5 |
| T18 | Release checklist: Ubuntu/Windows/macOS VM manuel test senaryoları (`docs/RELEASE_CHECKLIST.md`) | T16 | 0,25 |
| T19 | Kapanış: RBAC süiti (commit öncesi tek koşu kuralı), `.10x` QA/Security fazları, sürüm kararı | hepsi | 0,5 |

## Sıralama gerekçesi
M1 önce: en belirsiz parça (RLS gerçek PG'de hiç koşmadı) ve diğer her şeyin güvenlik ağı (CI). M2, M1'in şema altyapısını kullanır. M3 en düşük teknik risk ama en çok manuel test ister.
## Bilinen belirsizlikler
- RLS PG'de hata verebilir (T8 tamponu). · `migrate diff` SQLite→PG tip farkları (Decimal/DateTime) baseline'da incelenecek. · Windows/macOS CI'da yok → T18 manuel.
