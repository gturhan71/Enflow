# Tasarım: Üretim Çalışma Zamanı + Postgres Migration Hattı

**Tarih:** 2026-09-26 · **Durum:** Onay bekliyor · **Feature slug:** `prod-runtime-pg-pipeline`
**Kaynak:** `.10x/reviews/2026-09-26-project-assessment.md` P0-1 + P0-2
**Kullanıcı kararları:** SQLite + Postgres ikisi de üretimde desteklenir · OS-native servis (systemd/launchd/WinSW) · A5 otomatik geri-alma dahil · sahada canlı `db push` Postgres kurulumu yok.

## Problem

1. Backend üretimde `ts-node src/index.ts` ile çalışıyor (derleme yok, dev bağımlılığı prod'da); süreç yöneticisi yok (`start.sh` = pkill + nohup); SIGTERM'de düzgün kapanma yok (`app.listen` dönüşü saklanmıyor, scheduler'ların stop'u yok).
2. Postgres yolu: wizard izlenen `schema.prisma`'yı regex ile değiştiriyor → çalışma ağacı kirli; şema `db push` ile kuruluyor (migration geçmişi yok).
3. **Postgres kurulumu fiilen upgrade edilemiyor:** upgrade-tool kirli ağaçta durur; zorlanırsa `git checkout` provider'ı sqlite'a döndürür ve SQLite migration'larını deploy etmeye çalışır; pg ön-yedek yok; `migrate deploy` DDL yetkisiz runtime rolüyle koşar.
4. Faz 15 RLS gerçek Postgres'te hiç doğrulanmadı.

## Başarı ölçütleri

- Temiz Linux/macOS/Windows makinede wizard → servis kurulumu → reboot sonrası uygulama otomatik ayakta, `/api/health` 200.
- `kill -9` sonrası servis yöneticisi süreci ≤10 sn içinde yeniden başlatır.
- `systemctl stop` / servis durdurma → süreç ≤10 sn içinde temiz çıkar (log'da "shutdown complete").
- Wizard sonrası `git status --porcelain` boş (hem SQLite hem Postgres yolunda).
- CI `postgres` job'u: boş PG → tüm migration'lar → drift yok → RLS uygula + doğrula → backend boot + health — yeşil.
- Postgres kurulumunda upgrade-tool bir sürümden sonrakine migration içeren yükseltmeyi başarıyla uygular; bozuk sürümde kod geri alınır ve `pg_restore` komutu basılır.

## A — Üretim çalışma zamanı

**A1 Build/start.** `backend/package.json`: `build` = `tsc -p tsconfig.build.json` → `backend/dist/`; `start` = `node dist/index.js`; `dev` değişmez (ts-node + nodemon). `tsconfig.build.json` `src/scripts/**`'u da derler (bakım script'leri prod'da `node dist/scripts/<ad>.js`); test dosyaları hariç. `dist/` `src/` ile aynı derinlikte olduğundan `__dirname` bazlı yollar (uploads, `../../dist`, wiki, backups) değişmeden çalışır — doğrulandı. `backend/dist/` gitignore'a eklenir.

**A2 Graceful shutdown.** `index.ts` `app.listen` dönüşünü saklar. `startXScheduler()` fonksiyonları bir `stop()` döndürecek şekilde genişletilir (interval handle temizliği). `SIGTERM`/`SIGINT` → yeni bağlantı kabulünü durdur (`server.close`) → scheduler'ları durdur → `prisma.$disconnect()` → `exit(0)`; 10 sn içinde bitmezse `exit(1)`. Tek seferlik (ikinci sinyal zorla çıkar).

**A3 Health/readiness.** `/api/health` → `SELECT 1` DB ping (≤2 sn timeout); `{ status, db, version, uptime }`; DB erişilemezse 503. Kimlik doğrulamasız, hassas veri içermez.

**A4 Servis şablonları** (`install/service/`):
- `enflow.service` (systemd): `User=enflow`, `WorkingDirectory=<home>/backend`, `EnvironmentFile=<home>/backend/.env`, `ExecStart=<node> dist/index.js`, `Restart=on-failure`, `RestartSec=5`, `TimeoutStopSec=15`, `NODE_ENV=production`.
- `com.enflow.backend.plist` (launchd): `KeepAlive`, `RunAtLoad`, `StandardOutPath/ErrorPath` → `<home>/logs/`.
- `enflow-service.xml` (WinSW): sabit sürüm WinSW exe, indirmeden sonra SHA256 doğrulaması (eşleşmezse kurulum durur); `onfailure restart`, log rotation (`roll-by-size`).
- Wizard'a opt-in adım "Servis olarak kurulsun mu?" — yönetici/sudo gerektirdiğini söyler; hayır → bugünkü elle başlatma talimatı (artık `node dist/index.js`). Şablonlar yer tutuculardan doldurulur (`{{HOME}}`, `{{NODE}}`).

**A5 upgrade-tool.** Adımlara `pnpm --dir backend build` eklenir. `restartCommand` verilmemişse kurulu servise göre OS varsayılanı (`systemctl restart enflow` / `launchctl kickstart -k gui|system/com.enflow.backend` / `enflow-service.exe restart`). Restart sonrası `/api/health` 60 sn yoklanır; 200 gelmezse: kod `git reset --hard prevRef` → yeniden `install`+`build` → restart → sonucu `update-status.json`'a `failed` olarak yazar.

**A6 Dev araçları.** `start.sh`/`run.cjs` yalnız dev (başlık yorumu). `install/README.md`, `ILK_KURULUM_KILAVUZU.md`, `SYSTEM_REQUIREMENTS.md` üretim = servis olarak güncellenir.

## B — Postgres migration hattı

**B1 İki şema, tek kaynak.** `prisma/schema.prisma` (sqlite) kanonik, asla yerinde değiştirilmez. `scripts/sync-postgres-schema.mjs` → `prisma/postgres/schema.prisma` (izlenir, yalnız `provider` farkı). `--check` modu fark varsa exit 1 → `pnpm verify`'a eklenir.

**B2 Config seçimi.** `prisma.config.ts`: `DATABASE_URL` `postgres://`/`postgresql://` ile başlıyorsa `schema: prisma/postgres/schema.prisma`, `migrations.path: prisma/migrations-postgres`; aksi hâlde bugünkü yollar. Wizard'daki `setSchemaProvider` ve `migrateToPostgres.ts`'deki provider flip kaldırılır; ikisi de config'e güvenir.

**B3 Baseline.** `prisma/migrations-postgres/0000_baseline/migration.sql` = `prisma migrate diff --from-empty --to-schema prisma/postgres/schema.prisma --script` + `migration_lock.toml` (postgresql).

**B4 Geliştirici akışı.** `pnpm db:migrate <ad>` (`backend/scripts/db-migrate.mjs`): (1) SQLite `prisma migrate dev --name <ad>`; (2) sync-postgres-schema; (3) `git show HEAD:backend/prisma/postgres/schema.prisma` → geçici dosya; (4) `migrate diff --from-schema <eski> --to-schema <yeni> --script` → `migrations-postgres/<zaman>_<ad>/migration.sql`; boş diff ise klasör oluşturulmaz. Yerel Postgres gerekmez. `CLAUDE.md` "Migration sonrası" notu güncellenir.

**B5 CI `postgres` job.** `services: postgres:16` (iki DB: `enflow` + `enflow_shadow`). Adımlar: install → `prisma generate` (PG URL ile) → `migrate deploy` → `migrate diff --from-migrations prisma/migrations-postgres --to-schema prisma/postgres/schema.prisma --shadow-database-url … --exit-code` (drift = fail) → runtime rolü + grant (wizard'daki SQL'in paylaşılan modüle çıkarılmış hâli) → `node dist/scripts/apply-postgres-rls.js` → `verify-postgres-rls.js` → backend'i runtime rolüyle başlat → `/api/health` 200 → durdur (A2 SIGTERM yolu da test edilmiş olur).

**B6 Wizard.** Postgres yolunda `db push` → `prisma migrate deploy` (migrator URL). `grantRuntimePrivileges` aynen.

**B7 upgrade-tool Postgres yolu.** Ön-yedek: `pg_dump -Fc` → `backend/backups/pre-upgrade-<ts>.dump` (pg_dump yoksa yükseltme durur, `--skip-pg-backup` ile bilinçli atlanabilir). Migrator kimliği: `ENFLOW_MIGRATOR_URL` env veya `upgrade-tool/config.json` `migratorUrl` (gitignored); yoksa Postgres upgrade başlamaz. `migrate deploy` migrator ile; RLS kurulu ise (`pg_policies`'te `tenant_isolation` varsa) `apply-postgres-rls` yeniden koşar (idempotent — doğrulandı). Hata → kod otomatik geri alınır; DB otomatik geri yüklenmez, log'a hazır `pg_restore --clean --if-exists -d … <dump>` komutu yazılır.

**B8 Mevcut db-push kurulumları.** Sahada canlı yok → benimsetme aracı yapılmaz. `POSTGRES_MIGRATION_PLAN.md`'ye not: eski test kurulumları atılır veya `migrate:to-postgres` ile yeniden taşınır.

## Hata modları

| Durum | Davranış |
|---|---|
| WinSW SHA256 uyuşmaz | Servis kurulumu durur, elle başlatma talimatı |
| Servis kurulumu yetki yok | Uyarı + elle kurulum komutu, wizard devam eder |
| Shutdown 10 sn'yi aşar | `exit(1)`, servis yöneticisi zaten durdurma modunda |
| DB erişilemez | health 503; systemd yeniden başlatmaz (süreç ayakta), log'da hata |
| PG migration drift | CI kırmızı |
| Upgrade sonrası health yok | Kod geri alma + restart + `failed` status |
| Upgrade'de pg migration hatası | Kod geri alma; DB için `pg_restore` komutu log'da |

## Test stratejisi

- Unit (vitest): shutdown orkestrasyonu (sahte server/scheduler), health handler (DB ok/fail), `sync-postgres-schema` dönüşümü, prisma.config seçim fonksiyonu, upgrade-tool restart-komutu çözümleyici.
- CI: B5 job'u (entegrasyon + RLS'in ilk gerçek doğrulaması).
- Manuel (release checklist): Ubuntu VM'de systemd kur/reboot/kill -9/upgrade; Windows VM'de WinSW; macOS launchd.

## Kapsam dışı

Docker imajı; çoklu backend replikası; scheduler'ları ayrı sürece ayırma; eski db-push kurulumlarını benimsetme aracı; BigInt para göçü; Postgres otomatik geri yükleme.

## Sürüm

Mimari değişiklik (altyapı göçü + migration hattı) → MINOR adayı. Faz 15 (RLS) de bekleyen MINOR adayıydı; bu iş CI'da RLS'i doğruladığı için ikisi birlikte **v2.6.0** olarak önerilir — CLAUDE.md kuralı gereği artırım ayrıca açık onayla yapılır.
