# Güvenlik İncelemesi — prod-runtime-pg-pipeline — 2026-09-26

## Değerlendirilen yüzey
Servis şablonları, wizard'ın sudo/yönetici adımları, WinSW indirmesi, upgrade-tool (migrator kimliği, yedekler, restart), pg_dump/psql çağrıları, health ucu, graceful shutdown.

## Bulgular
| # | Şiddet | Bulgu | Durum |
|---|---|---|---|
| S1 | Yüksek | Bağlantı URL'si (parola dahil) `pg_dump`/`psql`'e argv ile veriliyordu → aynı makinede `ps` ile görünür (backupService'te önceden de böyleydi) | ✔ Düzeltildi — `pgConnEnv` (env) ; gerçek PG'de doğrulandı |
| S2 | Orta | `upgrade-tool/config.json` migrator parolasını düz metin tutuyor | ✔ 0600; GUI/API yanıtlarında maskeli; ⚠ diskte hâlâ düz metin (`ENFLOW_MIGRATOR_URL` env'i tercih edilir) |
| S3 | Orta | RLS: PG'de login kırıktı (erişilebilirlik, güvenlik açığı değil — fail-closed) | ✔ Düzeltildi; RLS artık gerçek PG'de doğrulandı (77 tablo, cross-tenant 0 satır, context'siz 0 satır) |
| S4 | Orta | `/api/setup/init` yeniden-kurulum riski şüphesi | ✔ Test edildi: kurulu sistemde 403 (CI'da kalıcı) |
| S5 | Düşük | WinSW SHA256 trust-on-first-use (resmi release'ten bir kez hesaplandı); tedarik zinciri riski sınırlı (sabit sürüm+hash+boyut, uyuşmazlıkta yazılmaz) | Kabul; sürüm yükseltirken hash'i bağımsız doğrulayın |
| S6 | Düşük | systemd birimi sertleştirmesi minimal (NoNewPrivileges, PrivateTmp, ProtectSystem=full); `ProtectHome`/`ReadWritePaths` yok | Kabul; ayrı kullanıcı önerisi dokümanda |
| S7 | Bilgi | Servis kullanıcısı seçimi operatöre bırakıldı; root uyarısı veriliyor | Kabul |
| S8 | Orta (kapsam dışı) | `tests/rbac/auth/*.token` + storageState + rapor/ekran görüntüleri **git'te izleniyor** (12 sa TTL dev token'ları, süresi dolmuş) | Ayrı takip işi açıldı (untrack + .gitignore) |
| S9 | Bilgi | `/api/health` kimliksiz: yalnız durum/sürüm/uptime (sürüm sızıntısı düşük risk) | Kabul |

## Doğrulanan iyi uygulamalar
- Migrator kimliği `.env`'e yazılmaz; yoksa upgrade **hiçbir şeye dokunmadan** durur.
- Servis dosyaları kullanıcı girdisini kaçırır (XML/`%`), kullanıcı adı regex ile doğrulanır, artık yer tutucu hata verir.
- Komutlar `execFile`/`spawnSync` (shell yok); sudo yalnız açık onayla; `pg_restore` ipucunda parola maskeli.
- pg_dump RLS bayrağı (`app.bypass_rls`) yalnız yedek sürecine özel PGOPTIONS ile; uygulama bağlantısına sızmaz.

## Sonuç: ONAY (S8 takip işiyle)
