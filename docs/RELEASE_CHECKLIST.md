# Sürüm Öncesi Kontrol Listesi (üretim çalışma zamanı + Postgres)

> CI (`verify` + `postgres` job'ları) **Linux + Postgres 16** yolunu otomatik doğrular. Aşağıdakiler
> CI'da **olmayan** parçalardır — her MINOR sürüm (ve servis/upgrade koduna dokunan her değişiklik)
> öncesi elle koşulur. Kaynak: `.10x/specs/2026-09-26-production-runtime-and-postgres-pipeline-design.md`,
> ADR-001, ADR-002.

## 0. Otomatik (CI) — yeşil olmalı
- [ ] `verify` job'u (tsc, guard'lar, birim testleri, node:test, build)
- [ ] `postgres` job'u (`scripts/ci-postgres.sh`: migrate deploy → drift → RLS → health → setup/login/yaz-oku → pg_dump → SIGTERM)
- [ ] RBAC süiti (`tests/rbac`) — commit öncesi **tek sefer** (repo kuralı)

## 1. Linux — Ubuntu 22.04+ VM (systemd)
1. [ ] `./install/install.sh` → sihirbazda servis adımına **evet** → `systemctl is-active enflow`
2. [ ] `curl localhost:3002/api/health` → `{"status":"ok","db":"ok"}`
3. [ ] **Reboot** → servis kendiliğinden ayakta (`systemctl status enflow`)
4. [ ] `sudo kill -9 $(systemctl show -p MainPID --value enflow)` → ≤10 sn içinde yeni PID, health 200
5. [ ] `sudo systemctl stop enflow` → ≤10 sn'de durur; `journalctl -u enflow` içinde "Kapanış tamamlandı"
6. [ ] Node **nvm** ile kuruluysa (PATH'te `node` yok): servis yine açılıyor mu? (`process.execPath` düzeltmesi)
7. [ ] Postgres kurulumu: `pg_dump` PATH'te → yedek (STATE) dosyası oluşuyor (`backend/backups`)
8. [ ] **Upgrade (SQLite):** yeni migration içeren bir sürüme yükselt → `upgrade-tool` servisi yeniden başlatır → health
9. [ ] **Upgrade (Postgres, RLS açık):** `ENFLOW_MIGRATOR_URL` ile; ön-yedek `.dump` oluştu, `migrate deploy` migrator ile, RLS yeniden uygulandı
10. [ ] **Bozuk sürüm:** açılışta çöken commit → 60 sn sonra kod otomatik geri alma + önceki sürüm sağlıklı; **veritabanı geri yüklenmez** (yükseltme sırasında yazılan veri korunur), log'da hazır geri yükleme komutu (SQLite `cp`, Postgres maskeli `pg_restore`)
11. [ ] **Normal kullanıcıyla upgrade-tool (Linux):** `systemctl restart` yetki isterse `sudo -n` denenir; sudoers'ta parolasız kural yoksa yükseltme geri ALINMAZ, çıkış kodu 3 + elle komut. (Bu senaryo yalnız birim/entegrasyon testli — gerçek systemd'de doğrulayın.)

## 2. macOS (launchd)
1. [ ] Sihirbaz → servis **evet** → LaunchDaemon (sudo) — `sudo launchctl print system/com.enflow.backend`
2. [ ] Reboot sonrası otomatik başlıyor (oturum açılmadan — Daemon)
3. [ ] `kill -9` → yeniden başlar (KeepAlive); `sudo launchctl kickstart -k system/com.enflow.backend` → "Kapanış tamamlandı"
4. [ ] LaunchAgent modu: oturum açılınca başlıyor
5. [ ] `logs/backend.log` yazılıyor; `pg_dump` (Homebrew) bulunuyor (launchd PATH)
> 2026-09-26: LaunchAgent modu geliştirici Mac'inde **gerçek launchd ile** denendi (kill -9 → 0,7 sn; kickstart -k → temiz kapanış). LaunchDaemon (sudo) yolu ve reboot **denenmedi**.

## 3. Windows 10/11 (WinSW) — CI'da ve geliştirme makinesinde **hiç denenmedi**
1. [ ] Yönetici PowerShell: `install.bat` → servis **evet** → WinSW v2.12.0 indirildi, SHA256 doğrulandı
2. [ ] `service\enflow-service.exe status` → Started; `curl http://localhost:3002/api/health`
3. [ ] Reboot → otomatik başlıyor (`startmode Automatic`)
4. [ ] Süreci Görev Yöneticisi'nden sonlandır → WinSW `onfailure restart` ile geri geliyor (5/20/60 sn)
5. [ ] `service\enflow-service.exe stop` → durur. **Temiz kapanış (graceful) doğrulanmadı:** Node Windows'ta SIGTERM
   almaz; WinSW'nin durdurma yöntemi Ctrl+C mi sonlandırma mı — `logs\` içinde "Kapanış tamamlandı" var mı? Yoksa
   SQLite'ta WAL checkpoint / açık transaction riski → gerekiyorsa ADR-001'e ek (ör. `stopexecutable` ile yerel durdurma ucu).
6. [ ] `logs\` boyuta göre dönüyor (10 MB × 8)
7. [ ] `upgrade-tool` `enflow-service.exe restart` ile yeniden başlatıyor + health
8. [ ] Servis kullanıcısı/izinleri: LocalSystem varsayılan — `backend\uploads` ve `.env` yazma/okuma

## 4. Ortak
- [ ] `install/build-package.*` zip'i temiz makinede açılıp kurulumu tamamlıyor (`lib/`, `service/` dahil mi?)
- [ ] `git status --porcelain` kurulumdan sonra **boş** (SQLite ve Postgres yollarında) → upgrade-tool kirli-ağaç kontrolü geçiyor
- [ ] Sürüm kararı: MINOR (v2.6.0) — `src/constants.ts` `APP_VERSION` + kök/`backend` `package.json` birlikte, **yalnız açık onayla**

## 5. Kiracı izolasyonu (çok kiracılı kurulum) — 2026-09-26 hata avından
- [ ] İkinci kiracı varken birinci kiracının GM'si `POST /api/backup/jobs {"scope":"PLATFORM"}` → **403**; scope'suz → `TENANT` ve indirilen dosyada YALNIZ kendi satırları (otomatik: `tests/e2e-scenario/tests/backup-scope-isolation.spec.ts` + `ci-postgres.sh`)
- [ ] `ls -l backend/.env` → `-rw-------`; `backend/backups` → `drwx------` (upgrade-tool eski kurulumları düzeltir)
- [ ] upgrade-tool arayüzü token'sız `/api/status` → 401
