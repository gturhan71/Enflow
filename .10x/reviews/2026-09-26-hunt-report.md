# 10x Hata Avı — birleşmiş main (M1+M2+M3) — 2026-09-26

Yöntem: QA + Güvenlik + SRE bakışıyla, yalnızca **çalıştırılarak kanıtlanan** hatalar. Hepsi `fix/hunt-findings` dalında düzeltildi; her biri için düzeltme olmadan kırmızı olan regresyon testi var.

| # | Şiddet | Hata | Kanıt | Düzeltme | Regresyon testi |
|---|---|---|---|---|---|
| H1 | **KRİTİK** | `POST /api/backup/jobs` varsayılan `PLATFORM` kapsamı: tenant-1'in GM'si TÜM kiracıların verisini (kullanıcı parola hash'leri dahil) tek dosyada alıp indirebiliyordu; PLATFORM restore da aynı yetkiyle (RLS bypass'lı) tüm kiracıları silip yükleyebilecek durumdaydı (restore yalnız kodla) | İzole çok kiracılı SQLite: indirilen dosyada tenant2 müşterileri + 33 kullanıcı. PG+RLS'te "yarım yedek" (17/19 satır) | PLATFORM yalnız tek kiracılıda; çok kiracılıda 403 (create/download/restore), varsayılan TENANT, zamanlanmış → TENANT/DATA, ayar kaydı 400 | e2e `backup-scope-isolation` (düzeltmesiz 4/5 kırmızı) + `ci-postgres.sh` |
| H2 | YÜKSEK | Yükseltme başarısız → rollback SQLite ön-yedeğini geri yüklüyordu; servis çalışırken yazılan veri siliniyordu (DB'ye hiç dokunulmamış build hatasında bile) | 58 satırdan 23'ü kayıp (gerçek upgrade-tool) | DB otomatik geri yüklenmez; dokunulmadıysa gerekmez, dokunulduysa hazır komut; sıra **build → migrate** | `upgrade.integration` (eski core.mjs'de 4/5 kırmızı) |
| H3 | YÜKSEK | Restart komutu hata verirse (yetki) tamamen başarılı yükseltme kod+DB ile geri alınıyordu; Linux'ta `systemctl restart` sudo'suz | 26 satır kayıp; kod v2'ye döndü | Restart hatası rollback nedeni değil (`ok:true, restartFailed`, çıkış kodu 3, elle komut); adaylar doğrudan → `sudo -n` | `upgrade.integration`, `service.test` |
| H4 | ORTA | `.env` 0644 (JWT + şifreleme anahtarı + DB parolası), `backups/` 0755, dump/yedekler 0644 | bu makinede `-rw-r--r--` | wizard 0600; yedek dizini 0700 / dosya 0600; upgrade-tool mevcut kurulumları sıkılaştırır; açılışta uyarı | e2e (mod), `harden.test`, `deploymentGuard.test`; wizard gerçek çalıştırma |
| H5 | ORTA | upgrade-tool arayüzü kimliksiz + Host denetimsiz: yerel kullanıcı `restartCommand` yazıp yükseltmede komut çalıştırabilir; DNS rebinding açık | token'sız PUT → 200; Host: attacker.example → 200 | X-Enflow-Token (0600 dosya, `#token=` URL), Host allowlist, ayar allowlist, CSP | `gui-server.test` (gerçek süreç) + gerçek tarayıcı |

## Açık / kanıtlanmadı
- **Yarım kalan yedek işi `RUNNING` kalır mı** (SIGTERM/kill sırasında): açılışta temizleyen kod yok; çalıştırılıp doğrulanmadı.
- **`systemctl restart` normal kullanıcıda gerçekten yetki hatası verir mi:** Linux VM'de doğrulanmadı (H3'ün düzeltmesi bundan bağımsız güvenli).
- **LOCAL yedek `location` alanı** tenant GM'sinin verdiği yola yazıyor (sunucunun yazabildiği her dizin) — dosya adı benzersiz olduğundan üzerine yazma yok; etki düşük, kanıtlanmadı.
- Windows/WinSW, gerçek systemd/LaunchDaemon: `docs/RELEASE_CHECKLIST.md`.

## Ders
1. "RLS doğrulandı" ≠ "izolasyon doğrulandı": RBAC süiti erişim iznini sınıyor, **veri içeriğini** değil — H1 bu yüzden yıllarca yakalanmadı. e2e `backup-scope-isolation` içerik-tabanlı ilk örnek.
2. Rollback kodunda "geri yükle" cazip ama servis çalışırken veri kaybettirir — geri alma politikası açıkça "veri asla otomatik silinmez" olmalı.
3. Testler eski hatayı gerçekten yakalıyor mu diye **eski kodda çalıştırılarak** doğrulandı (bir test zayıflığı — canlı yazıcının rollback build'inde yeniden yazması — bu yolla bulundu).
