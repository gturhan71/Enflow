# Enflow Upgrade Tool

On-prem Enflow kurulumunu **en son yayınlanan sürüme yükselten** ve bir güncelleme
gerektiğinde uygulamadaki **GM kullanıcıyı bildirim zili** ile uyaran **ayrı, bağımsız**
operatör aracı. Uygulamanın içinde değildir — `license-tool/` gibi tek başına çalışır,
hiçbir npm bağımlılığı yoktur (yalnız Node built-in + git + pnpm).

## İlke

- **Beyin araçta:** uzak sürüm kontrolü ve yükseltme (ön-yedek → git pull/checkout → pnpm install →
  prisma generate + migrate deploy → backend+frontend build → restart → **sağlık doğrulaması**)
  tamamen bu araçta.
- **Uygulama yalnız yansıtır:** araç repo köküne atomik `update-status.json` yazar; uygulama
  bunu okuyup GM'lere zil bildirimi düşürür (versiyon/yükseltme mantığı uygulamada yoktur).

## Sürüm kaynağı (kanal)

- `auto` (varsayılan): uzakta **semver tag** (`vX.Y.Z`) varsa onu hedefler; yoksa
  `origin/main` commit'ine göre "geride miyiz" karşılaştırması yapar.
- `tag`: yalnız semver tag. `commit`: yalnız origin/main HEAD.

## Çalıştırma

### CLI (cron / otomasyon)

```bash
node upgrade-tool/cli.mjs check      # kontrol + update-status.json yaz (çıkış kodu 10 = güncelleme var)
node upgrade-tool/cli.mjs status     # mevcut durum
node upgrade-tool/cli.mjs upgrade    # güvenli yükseltme (ön-yedek + rollback)
```

Çevre değişkenleri: `ENFLOW_HOME` (varsayılan: aracın üst dizini = repo kökü),
`ENFLOW_CHANNEL` (auto|tag|commit), `ENFLOW_ALLOW_DIRTY=1`,
`ENFLOW_RESTART_CMD` (boşsa **kurulu OS servisi otomatik bulunur**: systemd / launchd / WinSW),
`ENFLOW_MIGRATOR_URL` (**Postgres'te zorunlu** — DDL yetkili migrator rolü, aşağıya bakın),
`ENFLOW_SKIP_PG_BACKUP=1` (pg_dump ön-yedeğini bilerek atla — önerilmez).

**Cron örneği (her 6 saatte kontrol):**
```cron
0 */6 * * *  cd /opt/enflow && node upgrade-tool/cli.mjs check >> /var/log/enflow-upgrade.log 2>&1
```

**Windows karşılığı (Görev Zamanlayıcı):** `install/install.ps1` kurulum sonunda bunu
otomatik önerir/kurar (`schtasks` ile `EnflowUpdateCheck` görevi, 6 saatte bir). Bu
adım atlandıysa veya elle kurmak isterseniz:
```powershell
$node = (Get-Command node).Source
schtasks /Create /TN "EnflowUpdateCheck" /TR "`"$node`" `"C:\Enflow\upgrade-tool\cli.mjs`" check" /SC HOURLY /MO 6 /RL LIMITED /F
```
Bu kayıt olmadan `update-status.json` hiç üretilmez/tazelenmez ve uygulamadaki
`updateNotifier` (GM'lere zil bildirimi) hiçbir zaman tetiklenmez — kurulu sistem
yeni bir sürümün çıktığını fark etmez. Not: varsayılan (parola saklamayan) görev yalnız
kullanıcı oturum açıkken çalışır; sunucu-benzeri 7/24 kurulumlarda bunun yerine
`node upgrade-tool/server.mjs`'i bir Windows servisi olarak çalıştırmak (ör. NSSM ile)
daha uygundur — kendi periyodik döngüsü vardır (bkz. aşağıdaki "Web GUI").

### Web GUI (operatör)

```bash
node upgrade-tool/server.mjs         # → http://127.0.0.1:7071
```

- Yerel vs en-son sürüm kartları, **Şimdi Kontrol Et** / **Şimdi Yükselt** (canlı log).
- Ayarlar: kanal, otomatik-kontrol aralığı, **bakım penceresinde otomatik yükselt**,
  bakım penceresi saatleri, restart komutu (boş = kurulu servis), **Postgres migrator
  bağlantısı** (`migratorUrl` — parola içerir; API/GUI yanıtlarında `********` maskeli),
  pg_dump atlama → `upgrade-tool/config.json` (commit edilmez).
- Sunucu periyodik kontrol yapar; `autoUpgrade` açık ve bakım penceresindeyse otomatik yükseltir.

## Güvenlik

- Sunucu yalnız `127.0.0.1`'e bağlanır — dışa açmayın. Ama loopback yetmez: aynı makinedeki her kullanıcı
  ve DNS-rebinding yapan bir web sayfası bu porta erişebilir; ayarlardaki `restartCommand` yükseltmede
  `sh -c` ile **çalıştırılır**. Bu yüzden:
  - **Token:** tüm `/api/*` uçları `X-Enflow-Token` ister. Token ilk açılışta rastgele üretilip
    `upgrade-tool/.gui-token` dosyasına (0600 — yalnız sahibi okur) yazılır. Sunucu başlangıç çıktısı arayüz
    URL'sini verir: `http://127.0.0.1:7071/#token=…` — bu URL'yi tarayıcıda açın (token `#` parçasındadır,
    sunucuya/Referer'a gitmez; sayfa onu `sessionStorage`'a alıp adres çubuğundan siler).
  - **Host denetimi:** `Host` başlığı yalnız `127.0.0.1`/`localhost`/`[::1]` + port olabilir (DNS rebinding → 403).
  - Ayar alanları allowlist'li ve tip denetimli; `config.json` 0600; istek gövdesi ≤64 KB.
- Aracı **install'ın sahibi OS kullanıcısı** ile çalıştırın (git + pnpm + restart yetkisi gerekir).
- Yükseltme **yıkıcıdır**: önce DB ön-yedeği alınır — SQLite: `.db` + `-wal` + `-shm` kopyası;
  Postgres: `pg_dump -Fc` (`backend/backups/pre-upgrade-<ts>.dump`; RLS bayraklarıyla). `pg_dump`
  yoksa/başarısızsa yükseltme **başlamaz** (`ENFLOW_SKIP_PG_BACKUP=1` ile bilinçli atlanır).
- **Adım sırası:** ön-yedek → git → install → `prisma generate` → **build (backend + frontend)** →
  **`migrate deploy`** → (RLS) → restart → sağlık. Build migration'dan ÖNCE: derleme/tip hataları
  veritabanına hiç dokunulmadan yakalanır.
- Adım hatası ya da sağlıksız açılışta **kod otomatik geri alınır**: `git reset --hard` + `generate` +
  build + önceki sürümü yeniden başlat + sağlık kontrolü.
- **Veritabanı (SQLite dahil) KENDİLİĞİNDEN geri yüklenmez.** Servis yükseltme boyunca çalışır ve
  kullanıcılar yazar; ön-yedek yükseltmenin başında alındığından otomatik geri yükleme, o andan sonra
  yazılan tüm veriyi silerdi (denemede 58 satırdan 23'ü kayboldu). Migration hiç başlamadıysa (ör. build
  hatası) geri yükleme zaten gerekmez ve log bunu söyler. Migration başladıysa log'a parolası maskeli
  hazır komut yazılır (SQLite: `cp <ön-yedek> <db>` + `-wal/-shm`; Postgres: `pg_restore --clean --if-exists …`);
  servis durdurulmuşken, bilinçli karar olarak siz çalıştırırsınız.
- **Yeniden başlatma başarısızsa** (yetki, servis hatası) yükseltme **geri alınmaz** — kod, build ve şema
  tamamdır. Araç `ok:true, restartFailed` döner, CLI **çıkış kodu 3** verir ve elle komutu yazar (Linux/macOS'ta
  önce doğrudan, olmazsa parolasız `sudo -n` denenir; ikisi de olmazsa `sudo systemctl restart enflow` gibi).
- **Sağlık doğrulaması:** yeniden başlatmadan sonra `http://127.0.0.1:<PORT>/api/health`
  60 sn boyunca yoklanır; `db: ok` **ve** sürecin gerçekten yeniden başlamış olması (yanıttaki
  `uptimeSec`) beklenir — eski sürecin sağlıklı yanıtı yükseltmeyi "başarılı" göstermez.
- **Postgres migrator:** şema DDL'i runtime rolüyle yapılamaz. `ENFLOW_MIGRATOR_URL` (veya
  `config.json → migratorUrl`) yoksa yükseltme **hiçbir şeye dokunmadan** durur. RLS kuruluysa
  yeni tablolar için politikalar otomatik yeniden uygulanır (`apply-postgres-rls`, idempotent).
- `.env` (JWT/şifreleme anahtarları) git-ignore olduğundan yükseltmede korunur.
- Restart: `restartCommand` verilmişse o; yoksa kurulu servis (systemd `systemctl restart enflow`,
  launchd `launchctl kickstart -k`, WinSW `enflow-service.exe restart`). Hiçbiri yoksa araç
  yeniden başlatmaz ve sağlık kontrolünü atlar — elle restart gerekir.

## Üretilen dosyalar (commit edilmez)

- `upgrade-tool/config.json` — operatör ayarları
- `update-status.json` (repo kökünde) — uygulama köprüsü
- `backend/*.pre-upgrade-*` — yükseltme öncesi SQLite ön-yedekleri · `backend/backups/pre-upgrade-*.dump` — Postgres ön-yedekleri (`backend/backups/` git-ignore)
