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

## M2 (tamam — 2026-09-26, PR 2 — M1 üstüne yığılı, base=feat/prod-runtime-pg-pipeline)
| Görev | Commit | Not |
|---|---|---|
| T10 wizard | 9830036 | db push + setSchemaProvider kaldırıldı; `--dry-run` PG yolu izlendi |
| T11 migrateToPostgres | cc081d5 | dosya flip'i yok; hata yolunda SQLite client yeniden üretilir |
| T9 db:migrate | de1a030 | **Sapma:** ADR-002'deki "git HEAD PG şeması" yerine `.migrated-schema.prisma` anlık görüntüsü (commit edilmemiş ardışık migration'da SQL tekrarını önler); `sync --check` PG migration eksikse de kırılır |
| **fix backup** | 49fef93 | **Plan dışı, kritik:** PG STATE yedeği hiç çalışmıyordu — `?schema=public` libpq'da geçersiz + FORCE RLS altında pg_dump reddediliyor; ikisi de `catch{}` ile yutuluyordu (iş COMPLETED ama dump yok) |
| T12+T13 upgrade | 5f54456, 986c8bc | service.mjs (OS restart çözümleyici), health doğrulama, otomatik kod rollback, PG yolu (migrator zorunlu, pg_dump, RLS yeniden, pg_restore ipucu) |
## Uçtan uca kanıt (sahte remote + Postgres 16 + RLS)
- migrator yok → hiçbir şey değişmeden durdu ✔
- v1→v2 (yeni migration): dump alındı, migrate deploy (migrator), RLS yeniden, restart, health ✔
- bozuk v3 (açılışta çöker): 60 sn sağlıksız → git reset → generate+build → önceki sürüm yeniden başlatıldı+sağlıklı → status failed → maskeli pg_restore ✔
- Deneme sırasında bulunan zayıflık: eski süreç sağlıklı yanıt verirse yükseltme 'başarılı' sayılabiliyordu → `maxUptimeSec` kontrolü eklendi.
## Bilinen eksikler
- Windows/macOS servis yolu (`resolveRestartCommand`) yalnız birim testli; gerçek servis M3'te.
- `migrateToPostgres` iki-rol (migrator) ayrımına hâlâ uyarlanmadı (önceki takip işi).

## M3 (tamam — 2026-09-26, PR 3 — M2 üstüne yığılı)
| Görev | Commit | Not |
|---|---|---|
| T14 şablonlar+plan | 78a0abf | `planInstall` (saf) + `renderServiceFile`; plutil OK |
| T15 WinSW | (T15) | sabit v2.12.0 + SHA256 (kullanıcı onayıyla bir kez indirildi/silindi) |
| T16 wizard 8/8 + **fix spawn** | c7c8c82 | executePlan; **gerçek launchd'de bulundu:** `spawn('node')` ENOENT → asenkron error → backend çöker |
| T17+T18 docs | 6d4182e | README/KILAVUZ/SYSTEM_REQUIREMENTS/upgrade README/RELEASE_CHECKLIST |
| **fix security** | ff1fa4f | pg parolası argv→env; config 0600 |
| T19 | — | RBAC 1027/1027 (izole), e2e 12/12, QA+Security raporları |
