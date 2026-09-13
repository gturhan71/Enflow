# Enflow — Kurulum Kılavuzu

Bu dizin, Enflow'u **temiz bir makineye** (Windows / Linux / macOS) tek komutla
kuran bir **sihirbaz** ve bağımlılık/paket indirme betiklerini içerir. Sihirbaz,
projenin **Git'teki en son sürümünü** indirir, bağımlılıkları kurar, veritabanını
hazırlar ve başlatma adımlarını gösterir.

---

## Sistem Gereksinimleri

Kurulum senaryosuna göre (geliştirme/pilot, küçük ölçek üretim SQLite, kurumsal üretim
PostgreSQL) donanım/yazılım gereksinimlerinin tam dökümü artık tek kaynakta:
**[`docs/SYSTEM_REQUIREMENTS.md`](../docs/SYSTEM_REQUIREMENTS.md)**. Sihirbaz, hangi
senaryoyu önereceğine kurulum sırasında sorduğu kapasite teyidi sorularıyla (beklenen
kullanıcı sayısı + yıllık veri hacmi) kendisi karar verir.

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
2. **Yapılandırma** — backend/frontend portu, kapasite teyidi (beklenen kullanıcı sayısı
   + yıllık veri hacmi → eşik aşılırsa PostgreSQL önerilir), veritabanı (SQLite/PostgreSQL —
   Postgres seçilirse **iki rol** oluşturulur: DDL yetkili `migrator` + DML-only `runtime`,
   bkz. Güvenlik bölümü), `AUTH_JWT_SECRET` (güvenli rastgele üretilir), opsiyonel YZ.
3. **Ortam dosyaları** — `backend/.env` yazılır (runtime DB rolüyle — migrator kimlik
   bilgileri `.env`'e yazılmaz, yalnız kurulum özetinde bir kez gösterilir).
4. **Bağımlılıklar** — `pnpm install` (frontend + backend).
5. **Veritabanı** — `prisma generate` + `prisma migrate deploy` (SQLite) /
   `prisma db push` (Postgres, migrator kimlik bilgileriyle) + runtime rolüne DML-only GRANT.
6. **Ağ sertleştirmesi** — DB/Studio port maruziyeti uyarısı + opsiyonel (onaylı) ufw/Windows
   Firewall kısıtlaması.
7. **Derleme** — opsiyonel `pnpm build` (üretim için `dist/`).

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

Varsayılan SQLite'tır. PostgreSQL için sihirbazda "PostgreSQL kullanılsın mı?" → Evet
seçin (kapasite eşiği aşıldığında sihirbaz bunu zaten varsayılan öneri yapar) —
`schema.prisma` provider'ı ve rol/DB provizyonu **otomatik** yapılır, elle düzenleme
gerekmez. Sihirbaz **iki rol** oluşturur: `<kullanıcı>_migrator` (DB owner, DDL —
yalnız kurulum/şema güncellemesinde kullanılır) ve asıl `DATABASE_URL`'in kullandığı
**runtime rolü** (yalnız DML — SELECT/INSERT/UPDATE/DELETE, DROP/ALTER/CREATE ROLE
yok). Migrator şifresi yalnız kurulum özetinde bir kez gösterilir, güvenle saklayın —
gelecekteki bir şema güncellemesinde (bkz. aşağıdaki not) yeniden gerekecek. Mevcut
bir SQLite kurulumunu sonradan taşımak için: `cd backend && pnpm
migrate:to-postgres` (bkz. [`POSTGRES_MIGRATION_PLAN.md`](POSTGRES_MIGRATION_PLAN.md)).

---

## Sorun Giderme

| Belirti | Çözüm |
|---|---|
| `Node ... çok eski` | Node 20+ kurun (nvm / nodejs.org). |
| `pnpm bulunamadı` | `corepack enable` ya da `npm i -g pnpm`. |
| Windows `... betik çalıştırılamıyor` | `Set-ExecutionPolicy -Scope Process Bypass`. |
| Port kullanımda | Sihirbazda farklı port girin; backend portu değişirse `vite.config.ts` proxy hedefini de güncelleyin. |
| `prisma migrate` hatası | `backend/.env` `DATABASE_URL` doğru mu? |
| Migration sonrası backend çöküyor | `cd backend && pnpm prisma generate` + yeniden başlat. |
| `git clone` reddedildi | HTTPS URL kullanın (varsayılan); SSH anahtarı gerekmez. |

---

## Güvenlik

- `AUTH_JWT_SECRET` (≥16 karakter) üretimde **mutlaka** güçlü rastgele olmalı — sihirbaz
  üretir; `.env` dosyasını gizli tutun, sürüm kontrolüne koymayın.
- API anahtarları (YZ, S3, Nextcloud) yalnız sunucuda/`.env`'de tutulur; uygulama
  içi YZ entegrasyonu tenant-bazlı ve maskelidir.
- Yedek dosyaları web kökü dışındadır; indirme yalnız yetkili (Backup Admin/GM).

### Veritabanı ve Prisma Studio Erişimi

Tek-kaynak plan/gerekçe: [`docs/VERITABANI_GUVENLIGI_PLAN.md`](../docs/VERITABANI_GUVENLIGI_PLAN.md).

- **`npx prisma studio`'yu prod sunucusunda ASLA çalıştırmayın.** Yalnız yerel
  geliştirmede kullanın. Uzak sunucudaki veriye bakmanız gerekiyorsa SSH tüneli açın
  (`ssh -L 5555:localhost:5555 kullanici@sunucu`) ve Studio'yu sunucuda `--hostname
  0.0.0.0` gibi bir seçenekle **asla dışa açmayın** — tünel yalnız sizin makinenizden
  bağlanır, port dışarıya hiç açılmaz.
- **Postgres kullanan kurulumlarda DB portu (varsayılan 5432) internete KAPALI
  olmalı** — yalnız uygulama sunucusunun bulunduğu private network/VPC'den erişilebilir.
  Sihirbaz (`wizard.mjs`) kurulum sonunda bunu ufw (Linux) veya Windows Firewall ile
  **onayınızla** (varsayılan hayır) uygulayabilir; onaylamazsanız ekrana yazdığı komutları
  elle çalıştırın.
- `prisma` CLI backend `devDependencies`'te (prod bağımlılığı değil) — ama backend
  prod'da da derlenmemiş `ts-node` ile çalıştığı için `devDependencies` prod host'tan
  kaldırılamıyor (bilinçli, dokümante edilmiş sınır — bkz. plan). Gerçek koruma CLI'yi
  silmek değil, **ağ izolasyonu** + aşağıdaki en-az-yetkili DB kullanıcısı.
- Postgres kurulumunda sihirbaz **iki ayrı rol** oluşturur: `<kullanıcı>_migrator`
  (DDL — yalnız kurulum/şema güncellemesinde kullanılır, `.env`'e yazılmaz) ve asıl
  `DATABASE_URL` içindeki **runtime rolü** (yalnız SELECT/INSERT/UPDATE/DELETE —
  DROP/ALTER/CREATE ROLE yetkisi yok). Uygulama bu ayrım sayesinde bir güvenlik açığında
  bile şemayı değiştiremez.
