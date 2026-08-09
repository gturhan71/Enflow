# Enflow — PostgreSQL Migration Seti (Plan · sonra üretilecek)

## Durum

- **SQLite (varsayılan):** `backend/prisma/migrations/` altındaki migration'lar **SQLite
  lehçesindedir** ve `prisma migrate deploy` ile uygulanır. Adapter: `@prisma/adapter-libsql`.
- **PostgreSQL (kurulum sihirbazında seçilir):** Kurulum sihirbazı (`install/wizard.mjs`)
  şema `provider`'ını `postgresql`'e çevirir ve **interim olarak `prisma db push`** ile şemayı
  doğrudan modellerden kurar (migration geçmişi tutulmaz). Adapter: `@prisma/adapter-pg`.
  Adapter seçimi çalışma zamanında `DATABASE_URL` şemasından türetilir (`backend/src/prismaClient.ts`).

> **Neden interim db push?** Mevcut migration SQL'i SQLite'a özgüdür; Postgres'te aynen çalışmaz.
> Temiz kurulum için `db push` yeterli ve güvenlidir (şemayı modellerden üretir). Kalıcı sürüm-yönetimi
> (üretimde şema evrimi izlenebilirliği) için Postgres'e özel bir migration seti gerekir — bu dokümanın konusu.

## Hedef

Postgres için, SQLite migration setinden **bağımsız**, sürüm-kontrollü bir migration geçmişi üretmek;
böylece Postgres'te de `migrate deploy` ile şema evrimi izlenebilir/tekrarlanabilir olur.

## Zorluk

Prisma şemasında **tek `provider`** olur. Aynı `schema.prisma` hem SQLite hem Postgres migration
geçmişini taşıyamaz. İki yol var:

### Yaklaşım A — Sağlayıcı-başına ayrı migration klasörü (önerilen)
1. `backend/prisma/migrations-postgres/` klasörü aç (SQLite'ınki `migrations/` kalır).
2. Postgres baseline'ı üret (boş bir Postgres'e karşı):
   ```bash
   # provider=postgresql + DATABASE_URL boş bir Postgres'e bakarken
   pnpm prisma migrate diff \
     --from-empty \
     --to-schema-datamodel backend/prisma/schema.prisma \
     --script > backend/prisma/migrations-postgres/0000_baseline/migration.sql
   ```
   veya temiz bir Postgres'te `prisma migrate dev --name baseline` (ayrı `--schema`/env ile).
3. Uygulama: Postgres kurulumunda `db push` yerine
   `prisma migrate deploy --schema <postgres-schema>` (klasörü işaret eden config/env ile).
4. Sonraki şema değişikliklerinde **iki** migration üretilir (SQLite + Postgres) — CI'da ikisi de test edilir.

### Yaklaşım B — Tek kaynak model + generate-time provider switch
1. Şema modelleri tek dosyada; `provider` build/instalasyon anında yazılır (bugünkü `setSchemaProvider`).
2. Migration geçmişi yalnız **bir** sağlayıcı için tutulur (bugün SQLite); Postgres daima `db push`.
3. Basit ama Postgres'te şema-evrimi izlenemez (yalnız son durum). *Bugünkü interim durum budur.*

## Önerilen yol haritası

1. **Şimdilik:** `db push` (interim) — çalışıyor; temiz kurulum için yeterli.
2. **Üretim öncesi:** Yaklaşım A ile Postgres baseline üret + sonraki migration'ları çift-üret.
3. **CI:** SQLite + Postgres (docker `postgres:16`) matrisinde `migrate deploy` + RBAC/izolasyon süiti.
4. **Veri taşıma (SQLite→Postgres):** ✅ **uygulandı** — `backend/src/scripts/migrateToPostgres.ts`
   (`pnpm migrate:to-postgres`, backend/ içinde). Mevcut çalışan bir SQLite tenant'ını, kaynağa
   dokunmadan (yalnız okur), hedefi `db push` ile kurup `backupService.exportLogicalData` +
   `restoreService.loadModelsIntoTarget` (döngüsel FK'lar için Postgres-güvenli null+geri-yazma
   stratejisi — Unit↔User çapraz döngüsü, Unit.parentId/User.delegateToUserId kendine-referans)
   ile taşır, model-bazlı satır sayısı doğrulaması geçmeden `backend/.env`'e dokunmaz. Herhangi
   bir adımda hata olursa `schema.prisma` otomatik sqlite'a geri alınır — repo her zaman
   çalışır SQLite durumuna döner.

## Kapasite teyidi (kurulum sihirbazı)

`install/wizard.mjs` artık PostgreSQL sorusundan önce beklenen kullanıcı sayısı + yıllık veri
büyümesi (GB) soruyor; eşik aşılırsa (>20 kullanıcı veya >5GB — asıl sınır SQLite'ın eşzamanlı
YAZMA kısıtı, depolama ikincil sinyal) Postgres sorusunun varsayılanı `true`'ya çevrilir ve
gerekçe basılır. Sert engel yok — kullanıcı SQLite ile devam ederse `migrate:to-postgres`'e
işaret edilir. Ayrıca `backend/src/prismaClient.ts` artık SQLite yolunda `WAL` modu +
`busy_timeout=5s` uygular (tek-dosya/tek-yazar kısıtını sertleştirir, motor seçiminden bağımsız).

## İlgili dosyalar

- `install/wizard.mjs` — DB seçimi, kapasite teyidi, provider switch, PG provizyon (winget/psql), `db push`.
- `backend/src/prismaClient.ts` — `DATABASE_URL` şemasına göre adapter seçimi (libsql | pg) + WAL/busy_timeout.
- `backend/src/scripts/migrateToPostgres.ts` — SQLite→Postgres canlı geçiş aracı (`pnpm migrate:to-postgres`).
- `backend/src/services/restoreService.ts` — `loadModelsIntoTarget` (provider-farkında yükleyici, migrateToPostgres + applyLogicalRestore tarafından paylaşılır).
- `backend/prisma/schema.prisma` — `provider` (kurulumda / geçişte yazılır).
- `install/install.ps1` / `install.bat` — Windows kurulum akışı (Postgres notu).

> **Not:** Postgres kurulum/provizyon yolu (winget + psql + servis) Windows'a özgüdür ve macOS/CI
> geliştirme makinesinde runtime doğrulanamaz; Windows'ta test edilmelidir.
