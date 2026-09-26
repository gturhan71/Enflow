# ADR-002: Sağlayıcı-başına migration klasörü + config-tabanlı şema seçimi

**Status:** Accepted · **Date:** 2026-09-26 · **Feature:** prod-runtime-pg-pipeline · **Author:** 10x-Team (Architect + Staff Engineer)

## Context
Prisma şemasında tek `provider` olur. Wizard bugün izlenen `schema.prisma`'yı regex ile postgresql'e çevirip `db push` yapıyor → migration geçmişi yok, çalışma ağacı kirli, upgrade-tool Postgres kurulumunu güncelleyemiyor. Kullanıcı kararı: SQLite ve Postgres ikisi de üretimde desteklenir. Prisma 7.8: `prisma.config.ts` (`schema`, `migrations.path`, `datasource`), `migrate diff --from-schema/--to-schema/--from-config-datasource/--exit-code`; `--shadow-database-url` bayrağı yok.

## Decision
1. `prisma/schema.prisma` (sqlite) kanonik ve değişmez; `scripts/sync-postgres-schema.mjs` → `prisma/postgres/schema.prisma` (izlenir; `--check` CI'da).
2. `prisma.config.ts` `DATABASE_URL` şemasına göre `schema` + `migrations.path` seçer (saf fonksiyon `resolvePrismaPaths(url)`, test edilir).
3. `prisma/migrations-postgres/0000_baseline` = `--from-empty --to-schema`.
4. `pnpm db:migrate <ad>`: SQLite `migrate dev` + PG migration'ı `git HEAD` PG şeması → yeni PG şeması `migrate diff --script` ile (yerel Postgres gerekmez).
5. Drift kontrolü CI'da: `migrate deploy` sonrası `migrate diff --from-config-datasource --to-schema prisma/postgres/schema.prisma --exit-code` (shadow DB gerekmez).
6. Kurulum/upgrade Postgres'te `migrate deploy` + migrator rolü; upgrade ön-yedeği `pg_dump -Fc`.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Bugünkü: regex flip + db push | Sıfır iş | Geçmiş yok, kirli ağaç, upgrade kırık | Problemin kendisi |
| Yalnız Postgres prod | Tek migration hattı | Her müşteriye PG kurulumu (Windows zor) | Kullanıcı reddetti |
| `--from-migrations` + shadow DB ile PG migration üretimi | Geçmişe göre birebir doğru | Geliştiricide Postgres gerekir | Dev sürtünmesi; CI drift kontrolü aynı güvenceyi verir |
| Elle yazılan PG migration'ları | Tam kontrol | Hata açık, disiplin gerektirir | Otomasyon + CI kontrolü daha güvenli |

## Consequences
**Pozitif:** İzlenen dosyalar asla değişmez → upgrade-tool çalışır; Postgres şema evrimi izlenebilir; RLS her PR'da gerçek PG'de doğrulanır.
**Negatif:** Her şema değişikliği iki migration klasörüne dokunur; `prisma generate` hâlâ sağlayıcıya özgü (kurulum anında seçilir).
**Riskler:** `migrate diff --from-schema` (HEAD) ile üretilen migration, HEAD'den önceki commit edilmemiş PG değişikliklerini kaçırabilir → CI drift kontrolü yakalar. Veri koruyan dönüşümler (rename) diff'te drop+add olur → PR incelemesinde elle düzeltme (SQLite'ta da aynı durum).

## Dependencies
ADR-001 (`dist/scripts` RLS script'leri, health). Gelecekte üçüncü sağlayıcı eklenirse aynı desen genişler.
