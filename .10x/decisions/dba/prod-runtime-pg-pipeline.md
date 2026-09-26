# DBA — prod-runtime-pg-pipeline
- İki migration hattı: `prisma/migrations` (sqlite, 93) + `prisma/migrations-postgres` (0000_baseline). Kanonik şema sqlite; PG şeması üretilir (`--check` guard).
- Baseline tip eşlemesi: Float→DOUBLE PRECISION (92), DateTime→TIMESTAMP(3) (240), Json→JSONB. Para için BigInt göçü ayrı iş.
- RLS: 77 tablo (64 doğrudan + 13 dolaylı) + 2 istisna; gerçek PG 16'da doğrulandı (DB-seviyesi 3 test + uygulama HTTP yolu).
- Roller: migrator (owner/DDL, .env'de yok) + runtime (DML, ALTER DEFAULT PRIVILEGES) — CI aynı SQL'i kullanır (`install/lib/pg.mjs`).
- Bulunan hata: tembel PrismaPromise + AsyncLocalStorage → context kaybı (a85101b).
- M2: `pnpm db:migrate` çift migration; PG deploy = migrator; upgrade ön-yedeği `pg_dump -Fc --enable-row-security` + `PGOPTIONS=-c app.bypass_rls=on` (FORCE RLS tablo sahibini de bağlar). Yedeğin `?schema=` parametresi libpq'ya geçirilmemeli.
