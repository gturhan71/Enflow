# Staff Engineer — prod-runtime-pg-pipeline
## Uyulacak desenler
- Backend log: `utils/logger` (console.log yasak — `check:no-console` guard'ı `install/`/`scripts/` .mjs'lere uygulanmıyor, oradaki mevcut `log()/warn()` yardımcıları kullanılır).
- Wizard/upgrade-tool `.mjs`, bağımlılıksız Node (mevcut stil) — yeni npm paketi eklenmez.
- Saf fonksiyonlar ayrı modül + vitest (`resolvePrismaPaths`, şema dönüşümü, restart komutu çözümleyici, template render, shutdown orkestrasyonu).
- Yorum dili Türkçe, kod İngilizce (mevcut repo stili); başlık yorumunda "neden".
- Yeni env değişkenleri `.env.example`'a + `SYSTEM_REQUIREMENTS.md`'ye (`ENFLOW_MIGRATOR_URL`).
## Yeniden kullanım
`backupService` pg_dump mantığı, wizard `provisionPostgresDb/grantRuntimePrivileges` → `install/lib/pg.mjs`'e taşınır (CI de kullanır); `apply/verify-postgres-rls` olduğu gibi.
## Cross-cutting
- Guard: `pnpm verify`'a `sync-postgres-schema --check` + backend build eklenir.
- CLAUDE.md "Migration sonrası" ve "Çalıştırma" bölümleri güncellenir.
