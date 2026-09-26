# Enflow — PostgreSQL Migration Seti (Plan · sonra üretilecek)

## Durum (2026-09-26 — ADR-002, uygulandı)

- **SQLite (varsayılan):** `backend/prisma/migrations/` (SQLite lehçesi) + `prisma/schema.prisma`
  (kanonik, provider=sqlite, **asla yerinde değiştirilmez**). Adapter: `@prisma/adapter-libsql`.
- **PostgreSQL:** kendi migration hattı — `prisma/postgres/schema.prisma` (kanonikten
  `scripts/sync-postgres-schema.mjs` ile üretilir, yalnız provider farkı) +
  `prisma/migrations-postgres/` (`0000_baseline` + sonrakiler). Adapter: `@prisma/adapter-pg`.
- **Seçim:** `backend/prisma.config.ts` → `resolvePrismaPaths(DATABASE_URL)`; `generate` /
  `migrate deploy` her ortamda aynı komut. Kurulum sihirbazı artık `db push` YAPMAZ, izlenen
  hiçbir dosyayı değiştirmez (çalışma ağacı temiz → upgrade-tool çalışır).
- **Geliştirici akışı:** `cd backend && pnpm db:migrate <ad>` — SQLite `migrate dev` + PG
  migration'ı (son PG migration şema anlık görüntüsü `prisma/postgres/.migrated-schema.prisma`
  → güncel PG şeması farkı; yerel Postgres gerekmez). `pnpm verify` PG şeması/migration
  eksikse kırılır. Rename gibi veri-koruyan dönüşümler diff'te DROP+ADD olur → SQL'i gözden geçirin.
- **CI:** `postgres` job'u (`scripts/ci-postgres.sh`, yerelde de çalışır): provizyon → `migrate
  deploy` → drift kontrolü → RLS uygula+doğrula → backend runtime rolüyle → setup/login/yaz-oku →
  `pg_dump` (RLS altında) → SIGTERM.
- **Yükseltme (upgrade-tool):** Postgres'te **migrator URL zorunlu** (`ENFLOW_MIGRATOR_URL` veya
  `upgrade-tool/config.json → migratorUrl`; yoksa hiçbir değişiklik yapılmadan durur). Sıra:
  `pg_dump -Fc` ön-yedek (RLS bayraklarıyla; alınamazsa durur, `ENFLOW_SKIP_PG_BACKUP=1` ile
  bilinçli atlanır) → git → install → `generate` + `migrate deploy` (migrator) → build → RLS
  kuruluysa `apply-postgres-rls` yeniden → OS servisini/`restartCommand` ile yeniden başlat →
  `/api/health` (yeniden başlamış + `db:ok`) 60 sn. Başarısızlıkta kod otomatik geri alınır (restart hatası hariç — o durumda yükseltme geri alınmaz, çıkış kodu 3),
  önceki sürüm yeniden başlatılır; **Postgres verisi otomatik geri yüklenmez** — log'a maskeli
  hazır `pg_restore` komutu yazılır.
- **Eski `db push` kurulumları:** sahada canlı veri taşıyan yok (2026-09-26) → benimsetme aracı
  yapılmadı. Eski test kurulumları atılır ya da `pnpm migrate:to-postgres` ile yeniden taşınır.
- **SQLite → Postgres veri taşıma:** `backend/src/scripts/migrateToPostgres.ts`
  (`pnpm migrate:to-postgres`) — kaynağa dokunmaz; hedefe `migrate deploy` + mantıksal yükleme +
  satır sayısı doğrulaması; doğrulama geçmeden `.env`'e dokunmaz.

> Aşağıdaki "Hedef / Zorluk / Yaklaşım" bölümleri tarihsel tasarım notudur (Yaklaşım A uygulandı).

## En-az-yetki: iki-rol ayrımı (2026-09-13, Adım 0 madde 5)

`install/wizard.mjs` artık Postgres'te **tek** rol değil **iki** rol oluşturur:

- **`<appUser>_migrator`** — DB owner (DDL). Yalnız `db push` / ileride `migrate deploy`
  sırasında kullanılır; `backend/.env`'e **yazılmaz**, kurulum özetinde bir kez gösterilir.
- **`<appUser>` (runtime)** — `backend/.env` → `DATABASE_URL` bunu kullanır. DDL/CREATEROLE/
  SUPERUSER **yok**; `db push` sonrası yalnız `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL
  TABLES` + `ALTER DEFAULT PRIVILEGES` (gelecekteki tablolar için otomatik) uygulanır.

**Etki:** Bu dokümandaki "Uygulama" adımları (Yaklaşım A/B, `migrate deploy`) ve
`backend/src/scripts/migrateToPostgres.ts` gibi Postgres'e şema yazan her araç, **migrator**
kimlik bilgileriyle çalıştırılmalıdır — mevcut `DATABASE_URL` (runtime) ile çalıştırılırsa
DDL izni olmadığından başarısız olur. `migrateToPostgres.ts` bugün operatörün verdiği hedef
`DATABASE_URL`'i doğrudan kullanıyor (kendi rol provizyonu yok) — bu scripti migrator/runtime
ayrımına uyarlamak (veya en azından dokümante etmek: "hedef Postgres'e migrator kimlik
bilgileriyle bağlanın, script bitince runtime rolüne GRANT'leri elle/otomatik uygulayın")
**ayrı bir takip işi**, bu turda yapılmadı. Aynı şekilde `upgrade-tool/core.mjs`'in Postgres
şema güncellemesi akışı da bugün yok (yalnız SQLite hedefliyor) — ileride eklenirse migrator
kimlik bilgilerini kullanmalı.

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

## Taban-katman şifreleme (öneri, kod değişikliği gerektirmez)

Uygulama-katmanı alan-bazlı şifreleme (`docs/TENANT_DATA_ENCRYPTION_PLAN.md`) yalnız seçili
hassas alanları kapsar; genel bir güvenlik taban katmanı için ayrıca:

- **Taşımada:** Postgres bağlantı dizesine `?sslmode=require` (veya daha sıkısı) eklenmesi
  önerilir — özellikle `DATABASE_URL` uzak bir sunucuya işaret ediyorsa.
- **Durağan veri:** İşletim sistemi/disk düzeyinde şifreleme (BitLocker/FileVault veya bulut
  sağlayıcısının disk encryption seçeneği) kurulum rehberliğinde önerilir; bu Enflow kod
  tabanının kapsamı dışında, altyapı/işletim sorumluluğundadır.
