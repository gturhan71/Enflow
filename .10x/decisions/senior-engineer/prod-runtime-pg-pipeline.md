# Senior Engineer — uygulama yaklaşımı
- **T1:** `tsconfig.build.json` extends tsconfig; `include: ["src/**/*"]`, `exclude: [..., "src/**/__tests__/**", "src/scripts/auditRoles.ts", "src/scripts/syncRolePermissions.ts", "src/scripts/backfill-profitability-view-permission.ts"]`. `src/generated/` git'te izleniyor mu kontrol et — ölü ise build'den çıkar. `backend/package.json` `audit:roles`/`sync:roles` ts-node ile kalır.
- **T2:** her `start*` → `const t = setTimeout(...); const i = setInterval(...); return () => { clearTimeout(t); clearInterval(i); }`. Dönüş tipi `() => void`; çağıranlar etkilenmez.
- **T3:** `installShutdown` saf enjeksiyonlu (process.on/exit parametre) → vitest'te sahte server. Sıra: close → closeAllConnections → stops → disconnect. `reports.ts` SSE interval'ları `req.on('close')` ile zaten temizleniyor mu doğrula.
- **T4:** `Promise.race([prisma.$queryRaw\`SELECT 1\`, timeout(2000)])`; handler'ı `routes/health.ts`'e çıkar, prisma enjekte edilebilir.
- **T5:** tek regex: datasource bloğundaki provider → `postgresql`; başa "OTOMATİK ÜRETİLDİ — düzenleme" başlığı. `--check`: üret + karşılaştır.
- **T6:** `resolvePrismaPaths(url?)` → `{schema, migrationsPath}`; `prisma.config.ts` `migrations: { path }`. Baseline'da tip eşlemelerini gözden geçir.
- **T7:** fonksiyon imzaları aynen taşınır; wizard import eder. CI bash yerine `node install/lib/pg.mjs provision ...` mini CLI.
- **T8:** GH Actions `services.postgres` (image postgres:16, health-cmd pg_isready). Admin → provision (migrator+runtime) → deploy (migrator) → drift (`--from-config-datasource … --exit-code`, exit 2 = fail) → grant → RLS apply/verify (migrator) → `node dist/index.js &` (runtime URL) → curl health → `kill -TERM` → çıkış kodu 0 ve ≤10 sn.
- **T9:** `git show HEAD:backend/prisma/postgres/schema.prisma` yoksa (ilk sefer) `--from-migrations` yerine hata ver ve baseline'ı işaret et. Boş diff → klasör yok.
- **T10/T11:** migrator URL yalnız child env'inde; `.env`'e yazılmaz (mevcut ilke).
- **T12:** `resolveRestartCommand({platform, installed})` saf; installed tespiti: systemd `systemctl is-enabled enflow`, launchd plist varlığı, Windows `enflow-service.exe` varlığı. Health poll `fetch` (Node 22).
- **T13:** backupService'teki pg_dump çağrısını kopyalamak yerine küçük bir `pgDump(url, file)` yardımcıyı upgrade-tool'da (bağımsız .mjs) yaz — backend TS'e bağımlılık kurma.
- **T15:** WinSW sürümü + SHA256 sabit olarak `install/service/winsw.lock.json`'da.
## Zor noktalar
RLS'in PG'de ilk koşusu (T8); SSE kapanışı (T3); Windows servis kullanıcısı/izinleri (T15/T16).
