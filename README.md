<div align="center">

# ⚡ Enflow

### Uçtan Uca Kurumsal Süreç & Satış Yaşam Döngüsü Platformu

**Ziyaretten tahsilata kadar tüm B2B iş akışını tek platformda otomatikleştiren, çok kiracılı (multi-tenant) kurumsal SaaS.**

[![Version](https://img.shields.io/badge/sürüm-v2.3-6366f1)](#-sürüm-geçmişi)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8_(Rolldown)-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/lisans-ticari-e11d48)](#-lisans)

</div>

---

## 🎯 Enflow Nedir?

**Enflow**, bir B2B satışın doğduğu ilk saha ziyaretinden başlayıp CRM fırsatına, teknik teklif ve müzakereye, ihale ve sözleşme imzasına, proje yürütmesine, satınalmaya ve nihayet faturalama–tahsilata kadar **tüm kurumsal yaşam döngüsünü tek bir zincirde** yöneten bir platformdur.

Farkı: süreçler birbirine **kopuk modüller** değil, **otomatik devir halkalarıyla** birbirine bağlıdır. Bir ihale kazanıldığında sözleşme kaydı, imza tamamlandığında proje, proje ilerledikçe satınalma ve fatura kalemleri **kendiliğinden** oluşur. Boş kalan birim koltuklarını **deterministik sanal agent'lar** doldurur; para ve hukuk kararları ise her zaman **danışman (advisory)** kalır — asla otonom değil.

```
 Ziyaret ─▶ CRM (Fırsat) ─▶ Presales (BoM / Maliyet) ─▶ Teklif & Müzakere
     │                                                         │
     └──────────────▶ [ İhale / İSAB ] ◀──────────────────────┘
                              │
        Sözleşme (imza) ─▶ Proje ─▶ Satınalma ─▶ Finans (Fatura & Tahsilat)
```

> Zincirin tamamı kapalı: birimler-arası geçişler otomatik, her adım denetim izine (audit log) ve onay swimlane'lerine bağlı.

---

## 👥 Kimler İçin?

| Kitle | Enflow ne sağlar |
|---|---|
| 🏢 **B2B & proje-bazlı çalışan KOBİ / kurumlar** | Satış, ihale, sözleşme, proje ve finansı tek platformda; Excel + e-posta dağınıklığına son. |
| 📊 **Genel müdürler & üst yönetim** | Gerçek-zamanlı yönetim raporları, birim metrikleri, darboğaz analizi, karlılık ve büyüme paneli. |
| 🤝 **Satış & iş geliştirme ekipleri** | CRM, fırsat hijyeni, teklif versiyonlama, canlı pazarlık ve otomatik değer skorlaması. |
| ⚙️ **Presales / teknik & satınalma** | BoM (malzeme listesi), maliyet analizi, tedarikçi teklif kıyaslama, PO ve teslimat takibi. |
| 📑 **Sözleşme, hukuk & kalite birimleri** | Evrak/imza akışı, onay zincirleri, doküman kodlama, dersler & risk/fırsat yönetişimi. |
| 🌐 **Kamu ihalesine giren firmalar** | İhale (EKAP iskeleti) + uygunluk checklist + teminat mektubu yönetimi. |

Kısaca: **birden fazla birimin ortak bir süreçte koordine olması gereken** her kurum için.

---

## ✨ Öne Çıkan Yetenekler

- 🔄 **Uçtan uca otomasyon** — birimler-arası devir zinciri (İhale→Sözleşme→Proje→Satınalma→Finans) tam otomatik.
- 🧭 **Akış motoru** — Workflow + skip-logic, birim görevleri (SLA'lı TodoTask), çok-aşamalı onay swimlane'leri (Finans→İGPD→GM→KSU).
- 🤖 **8 sanal agent** — Tender · Project · Presales · Procurement · Finance · Legal · CRM · İGPD. Para & hukuk **yalnız danışman**.
- 📈 **Yönetim & büyüme analitiği** — birim metrikleri, huni analizi, tahmin, karlılık, müşteri/proje sağlık skorları.
- 💰 **Gelişmiş finans** — çok para birimli, KDV, işletme maliyeti dağıtımı (overhead), DMO katalog & kârlılık motoru.
- 🔐 **Kurumsal güvenlik** — parola (bcrypt) + imzalı JWT, tenant izolasyonu, RBAC (RBAC süiti **486/486**), denetim izi, imzalı lisans (Ed25519).
- 🧩 **Sağlayıcıdan bağımsız YZ** — sözleşme/şartname analizi için OpenAI-uyumlu herhangi bir modeli (OpenAI, Gemini, Anthropic, yerel Ollama…) tenant kendi anahtarıyla bağlar.
- 🏢 **Çok kiracılı SaaS** — 64 veri modeli, 36 API alanı, 29 ekran modülü, tümü `tenantId` ile izole.

---

## 🛠️ Teknoloji

| Katman | Teknoloji |
|---|---|
| **Frontend** | React **19** · TypeScript **6** (strict) · Vite **8** (Rolldown) · TanStack Query v5 |
| **UI** | Tailwind CSS **v4** · glass-morphism · `motion` (framer değil) · `lucide-react` |
| **Backend** | Express **5** · TypeScript · Prisma ORM **7** |
| **Veritabanı** | SQLite (dev/gömülü) · PostgreSQL 14+ (üretim) — dual-adapter |
| **Güvenlik** | bcryptjs · jsonwebtoken (JWT) · helmet · express-rate-limit |
| **Paket yöneticisi** | pnpm |

---

## 🚀 Kurulum

Enflow **temiz bir makineye** (Windows / Linux / macOS) tek komutla kurulur. Sihirbaz; Git'ten en son sürümü indirir, bağımlılıkları kurar (Node/git yoksa **otomatik sağlar**), veritabanını hazırlar ve sırları güvenli üretir.

### Linux / macOS
```bash
# Depo elinizdeyse (en son sürüme günceller + kurar):
./install/install.sh

# Sıfırdan (depoyu klonlar):
curl -fsSL https://raw.githubusercontent.com/gturhan71/Enflow/main/install/install.sh -o install.sh
bash install.sh --dir ~/Enflow
```

### Windows
`install\install.bat` dosyasına **çift tıklayın** (yetki/çalıştırma politikasını kendi halleder, Node/git'i otomatik sağlar). Ya da PowerShell:
```powershell
.\install\install.ps1          # depo elinizdeyse
.\install.ps1 -Dir C:\Enflow   # sıfırdan
```

### Etkileşimsiz (CI / otomasyon)
```bash
./install/install.sh --yes     # tüm varsayılanlar (SQLite, 3000/3002, sırlar otomatik)
```

> İlk açılışta uygulama **boş** gelir; tarayıcıdaki **Kurulum Sihirbazı** şirketinizi, ilk yöneticiyi (parola dahil) ve lisansı tanımlar. Lisans girmezseniz **30 günlük deneme** ile başlar.

**Başlatma:**
```bash
# Üretim (tek origin — backend hem UI hem API'yi sunar):
cd backend && pnpm start        # → http://localhost:3002

# Geliştirme:
cd backend && pnpm dev          # backend (3002)
pnpm dev --port 3000            # frontend (3000) — ayrı terminal
```

📖 Ayrıntılı gereksinimler, PostgreSQL geçişi ve sorun giderme: [`install/README.md`](install/README.md)

---

## 📦 Sürüm Geçmişi

| Sürüm | Tarih | Öne çıkanlar |
|---|---|---|
| **v2.3** | 14.07.2026 | 🔐 **Güvenlik sertleştirmesi** — parola (bcrypt) + imzalı JWT kimlik doğrulama, tenant-izolasyonu IDOR düzeltmeleri, dosya-yükleme MIME beyaz listesi, SSRF guard, helmet + rate-limit. RBAC 486/486. |
| **v2.2** | 03.07.2026 | 📊 **DMO Katalog & Kârlılık** modülü, **İşletme Maliyeti dağıtımı** (2 katmanlı overhead + birim bütçe absorpsiyonu), **Büyüme Analitiği** (13 rapor + 3 seviyeli sağlık skoru). |
| **v2.1** | 02.07.2026 | 🐘 Temiz kurulumda **PostgreSQL** desteği (dual-adapter + winget provizyon), Kurulum Sihirbazı soğuk-başlangıç düzeltmesi. |
| **v2.0** | 18.06.2026 | 🏗️ Kurumsal süreç genişlemesi (Faz 0–9): kalıcı ApprovalChain, Ziyaret Planı, Proje Devir Paketi, doküman kodlama, Finans/Hukuk/İhale modülleri, Yönetim Raporları, **8 sanal agent** + birimler-arası otomatik devir zinciri. |
| **v1.6.x** | 05–09.06.2026 | TypeScript strict-mode refactor, teklif onay akışı, Workflow Hand-off, mobil navigasyon. |

---

## 🔒 Güvenlik

- Kimlik doğrulama **parola (bcrypt hash) + imzalı JWT** ile yapılır; oturumlar süreli, tenant kimliği imzalı token'dan türetilir.
- Üretimde **`AUTH_JWT_SECRET`** (≥16 karakter, güçlü rastgele) **zorunludur**; sihirbaz sırları üretir, `.env` sürüm kontrolüne konmaz.
- API anahtarları (YZ, S3, Nextcloud) yalnız sunucuda/`.env`'de; YZ entegrasyonu tenant-bazlı ve maskelidir.
- Tüm veriler `tenantId` ile izole; her mutasyon **denetim izine** (audit log) yazılır; RBAC 19 rol + izin ağacı.
- Yedek dosyaları web kökü dışında; indirme yalnız yetkili (Backup Admin / GM).

---

## 📄 Lisans

Ticari — **© 2026 Gökhan Turhan. Tüm hakları saklıdır.** Proprietary & Confidential.
İzinsiz kopyalama, değiştirme, dağıtma veya kullanım yasaktır. Bkz. [`LICENSE`](LICENSE).

---

<div align="center">

**Enflow** • Uçtan uca kurumsal süreç yönetimi • Built for Gökhan Turhan

📚 Derinlemesine mimari & akış: [`CLAUDE.md`](CLAUDE.md) · [`walkthrough.md`](walkthrough.md)

</div>
