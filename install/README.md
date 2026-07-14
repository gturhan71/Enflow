# Enflow — Kurulum Kılavuzu

Bu dizin, Enflow'u **temiz bir makineye** (Windows / Linux / macOS) tek komutla
kuran bir **sihirbaz** ve bağımlılık/paket indirme betiklerini içerir. Sihirbaz,
projenin **Git'teki en son sürümünü** indirir, bağımlılıkları kurar, veritabanını
hazırlar ve başlatma adımlarını gösterir.

---

## Minimum Sistem Gereksinimleri

| Bileşen | Minimum | Önerilen |
|---|---|---|
| İşletim sistemi | Windows 10 / Ubuntu 20.04 / macOS 12 | Windows 11 / Ubuntu 22.04+ / macOS 14 |
| **Node.js** | 20 LTS (yoksa **otomatik kurulur**) | 22 LTS veya 24 |
| **pnpm** | 10 (sihirbaz `corepack` ile kurar) | 10.33+ |
| **git** | 2.30+ (yoksa otomatik denenir) | güncel |
| RAM | 2 GB | 4 GB+ |
| Disk | ~1.5 GB boş (node_modules dahil) | 3 GB+ |
| Veritabanı | SQLite (gömülü, varsayılan) | PostgreSQL 14+ (üretim) |
| Ağ | İlk kurulumda internet (Git + paketler) | — |
| Açık portlar | 3000 (frontend), 3002 (backend) | yapılandırılabilir |

> **Bağımlılıklar otomatik kurulur.** Node/git yoksa bootstrap **hibrit** sağlar:
> önce sistem paket yöneticisi (Windows `winget`, macOS `brew`, Linux `apt`/`dnf`),
> olmazsa **portatif** resmi Node binary'sini `install/.tools/` altına indirir (admin gerektirmez),
> o da olmazsa net yönlendirir. pnpm `corepack` ile, Prisma `pnpm install` ile gelir.

---

## Hızlı Kurulum

### Linux / macOS
```bash
# A) Depo zaten elinizdeyse (en son sürüme güncelleyip kurar):
./install/install.sh

# B) Tek başına (sıfırdan — depoyu klonlar):
curl -fsSL https://raw.githubusercontent.com/gturhan71/Enflow/main/install/install.sh -o install.sh
bash install.sh --dir ~/Enflow
```

### Windows
**En kolay:** `install\install.bat` dosyasına **çift tıklayın** (yetki/erişim kontrol eder,
çalıştırma politikasını kendi içinde aşar, Node/git'i otomatik sağlar). Sistem geneli kurulum
için sağ tık → *Yönetici olarak çalıştır* (yetki yoksa portatif mod yine de çalışır).

PowerShell ile elle:
```powershell
# A) Depo elinizdeyse:           (gerekirse: Set-ExecutionPolicy -Scope Process Bypass)
.\install\install.ps1
# B) Tek başına:
.\install.ps1 -Dir C:\Enflow
```

> İlk açılışta uygulama **boş** gelir: tarayıcıda **Kurulum Sihirbazı** şirketinizi, ilk
> yöneticiyi ve lisansı tanımlar (lisans girmezseniz **30 günlük deneme** ile başlar).

### Etkileşimsiz (CI / otomasyon)
```bash
./install/install.sh --yes           # tüm varsayılanlar (SQLite, 3000/3002, sırlar otomatik)
./install/install.ps1 -Yes
```

---

## Kurulum Sihirbazı Ne Yapar (`wizard.mjs`)

1. **Önkoşul denetimi** — Node ≥ 20, git, pnpm (yoksa corepack ile kurar).
2. **Yapılandırma** — backend/frontend portu, veritabanı (SQLite/PostgreSQL),
   `AUTH_JWT_SECRET` + `PLUGIN_LICENSE_SECRET` (güvenli rastgele üretilir), opsiyonel YZ.
3. **Ortam dosyaları** — `backend/.env` yazılır.
4. **Bağımlılıklar** — `pnpm install` (frontend + backend).
5. **Veritabanı** — `prisma generate` + `prisma migrate deploy`; opsiyonel
   `backup_admin` (Yedek Yöneticisi) kullanıcısı.
6. **Derleme** — opsiyonel `pnpm build` (üretim için `dist/`).

Bittiğinde başlatma komutlarını ekrana yazar.

---

## Başlatma

```bash
# ── ÜRETİM (önerilen): `pnpm build` sonrası backend dist'i TEK ORIGIN sunar ──
cd backend && pnpm start        # → http://localhost:3002 (hem UI hem API)
#   Ayrı frontend süreci / preview / proxy GEREKMEZ.

# ── GELİŞTİRME (canlı kaynak, derleme gerekmez) ──
cd backend && pnpm start        # backend (3002)
pnpm dev --port 3000            # frontend (3000) — ayrı terminal  (ya da: run.bat / ./run.sh)
```
Üretim → `http://localhost:3002` · Geliştirme → `http://localhost:3000`

---

## Dağıtılabilir Kurulum Zip'i Üretme

Hedef makineye yalnız bootstrap dosyalarını taşımak için tek bir zip üretir
(zip, depoyu kendisi Git'ten indirir):

```bash
# Linux/macOS
bash install/build-package.sh
# Windows
.\install\build-package.ps1
```
Çıktı: `dist-installer/enflow-installer-<tarih>.zip` —
içinde `install.sh`, `install.ps1`, `wizard.mjs`, `README.md`, `.env.example`.

---

## PostgreSQL (Üretim) Notu

Varsayılan SQLite'tır. PostgreSQL için sihirbazda "PostgreSQL kullanılsın mı?" →
Evet seçin **ve** `backend/prisma/schema.prisma` içindeki
`datasource db { provider = "sqlite" }` satırını `"postgresql"` yapın, ardından
yeniden `pnpm prisma migrate deploy` çalıştırın.

---

## Sorun Giderme

| Belirti | Çözüm |
|---|---|
| `Node ... çok eski` | Node 20+ kurun (nvm / nodejs.org). |
| `pnpm bulunamadı` | `corepack enable` ya da `npm i -g pnpm`. |
| Windows `... betik çalıştırılamıyor` | `Set-ExecutionPolicy -Scope Process Bypass`. |
| Port kullanımda | Sihirbazda farklı port girin; backend portu değişirse `vite.config.ts` proxy hedefini de güncelleyin. |
| `prisma migrate` hatası | `backend/.env` `DATABASE_URL` doğru mu? PostgreSQL'de provider'ı değiştirdiniz mi? |
| Migration sonrası backend çöküyor | `cd backend && pnpm prisma generate` + yeniden başlat. |
| `git clone` reddedildi | HTTPS URL kullanın (varsayılan); SSH anahtarı gerekmez. |

---

## Güvenlik

- `AUTH_JWT_SECRET` (≥16 karakter) ve `PLUGIN_LICENSE_SECRET` üretimde **mutlaka** güçlü rastgele
  olmalı — sihirbaz üretir; `.env` dosyasını gizli tutun, sürüm kontrolüne koymayın.
- API anahtarları (YZ, S3, Nextcloud) yalnız sunucuda/`.env`'de tutulur; uygulama
  içi YZ entegrasyonu tenant-bazlı ve maskelidir.
- Yedek dosyaları web kökü dışındadır; indirme yalnız yetkili (Backup Admin/GM).
