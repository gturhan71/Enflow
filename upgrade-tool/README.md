# Enflow Upgrade Tool

On-prem Enflow kurulumunu **en son yayınlanan sürüme yükselten** ve bir güncelleme
gerektiğinde uygulamadaki **GM kullanıcıyı bildirim zili** ile uyaran **ayrı, bağımsız**
operatör aracı. Uygulamanın içinde değildir — `license-tool/` gibi tek başına çalışır,
hiçbir npm bağımlılığı yoktur (yalnız Node built-in + git + pnpm).

## İlke

- **Beyin araçta:** uzak sürüm kontrolü ve yükseltme (git pull/checkout → pnpm install →
  prisma migrate deploy → build → restart) tamamen bu araçta.
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
`ENFLOW_CHANNEL` (auto|tag|commit), `ENFLOW_RESTART_CMD`, `ENFLOW_ALLOW_DIRTY=1`.

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
  bakım penceresi saatleri, restart komutu → `upgrade-tool/config.json` (commit edilmez).
- Sunucu periyodik kontrol yapar; `autoUpgrade` açık ve bakım penceresindeyse otomatik yükseltir.

## Güvenlik

- Sunucu yalnız `127.0.0.1`'e bağlanır — dışa açmayın.
- Aracı **install'ın sahibi OS kullanıcısı** ile çalıştırın (git + pnpm + restart yetkisi gerekir).
- Yükseltme **yıkıcıdır**: önce DB ön-yedeği (SQLite kopya; Postgres'te `pg_dump` operatör
  sorumluluğunda) alınır; herhangi bir adım hata verirse `git reset --hard` + DB geri yükleme
  ile **otomatik rollback** yapılır.
- `.env` (JWT/PLUGIN_LICENSE_SECRET) git-ignore olduğundan yükseltmede korunur.
- `restartCommand` ayarlı değilse araç süreçleri yeniden başlatmaz; elle restart gerekir.

## Üretilen dosyalar (commit edilmez)

- `upgrade-tool/config.json` — operatör ayarları
- `update-status.json` (repo kökünde) — uygulama köprüsü
- `backend/*.pre-upgrade-*` — yükseltme öncesi DB ön-yedekleri
