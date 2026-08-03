# Enflow — Kurumsal Süreç İşletim Sistemi

> **Sürüm:** v2.0 | **Tarih:** 16.06.2026  
> End-to-End Enterprise Process Automation — CRM'den Proje Teslimatına, Tahsilata kadar tek platform.

---

## İçindekiler

1. [Ne Yapar?](#1-ne-yapar)
2. [Mimari Genel Bakış](#2-mimari-genel-bakış)
3. [Veri Modeli](#3-veri-modeli)
4. [Modüller ve Yetenekler](#4-modüller-ve-yetenekler)
5. [İş Akışı Motoru](#5-iş-akışı-motoru)
6. [Bildirim Katmanı](#6-bildirim-katmanı)
7. [Yetkilendirme Sistemi (RBAC)](#7-yetkilendirme-sistemi-rbac)
8. [Multi-Tenancy](#8-multi-tenancy)
9. [Lisans ve Abonelik Modeli](#9-lisans-ve-abonelik-modeli)
10. [Entegrasyonlar](#10-entegrasyonlar)
11. [Backend API](#11-backend-api)
12. [Frontend Mimari](#12-frontend-mimari)
13. [Çalıştırma](#13-çalıştırma)

---

## 1. Ne Yapar?

Enflow, bir B2B işletmenin tüm iç süreçlerini tek bir platform üzerinde yönetir. Satışın bir müşteri fırsatı açmasından başlayarak projenin teslim edilmesine ve tahsilata kadar geçen her adım — teknik analiz, teklif, maliyet, müzakere, sözleşme, satın alma, proje takibi ve karlılık raporu — Enflow'da kayıt altına alınır ve birimler arası otomatik devir mekanizmasıyla ilerler.

### Hangi Sorunu Çözer?

| Sorun | Enflow Çözümü |
|---|---|
| Birimler arası bilgi kaybolur | Workflow Engine her adımı kaydeder, ilgili birimi uyarır |
| Teklifler Excel'de kaybolur | Versiyonlu teklif editörü, PDF çıktısı, onay zinciri |
| Kim ne yapıyor bilinmez | TodoTask sistemi + Dashboard KPI'ları |
| Sözleşme evrakları eksik imzalanır | AI analizi + evrak doğrulama — eksiksiz olmadan ilerlenemez |
| Her şirket için ayrı sistem | Multi-tenant yapı, `x-tenant-id` ile tam veri izolasyonu |
| Proje karlılığı bilinemez | Planlanan / gerçekleşen / tahmini marj — canlı hesaplama |
| Satınalma süreci izlenemiyor | 9 statülü tam tedarik döngüsü (Talep → PO → Teslimat → Fatura) |
| Müzakere sürecinde taban kaybolur | Dip marj korumalı müzakere simülasyonu + açık eksiltme |

---

## 2. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   React 18 + Vite · TypeScript strict · Tailwind CSS        │
│   motion/react · TanStack Query v5 · lucide-react           │
│   Port: 5173                                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (/api prefix, x-tenant-id header)
┌───────────────────────────▼─────────────────────────────────┐
│                        BACKEND                              │
│   Node.js + Express.js v5 · TypeScript                     │
│   Prisma ORM · SQLite (dev) → PostgreSQL (prod)            │
│   Port: 3002                                                │
│                                                             │
│   backend/src/                                              │
│   ├── index.ts          — app setup + route mount'lar       │
│   ├── middleware.ts     — asyncHandler, tenantMiddleware     │
│   └── routes/           — 19 kaynak router dosyası          │
└───────────────────────────┬─────────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────▼─────────────────────────────────┐
│                       DATABASE                              │
│   SQLite (geliştirme) / PostgreSQL (production)             │
│   26 Prisma model · multi-tenant şema                       │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | React 18 (SPA, Client-Side Routing) |
| Build | Vite 6 (17 chunk — manualChunks ile optimize) |
| Dil | TypeScript (strict mode, sıfır `any`) |
| Stil | Tailwind CSS + glassmorphism design system (`glass-card`, `input-glass`, `btn-primary`) |
| Animasyon | **motion/react** (paket adı `motion`, framer-motion DEĞİL) |
| Grafik | Recharts |
| İkon | lucide-react |
| Server State | TanStack React Query v5 |
| HTTP | `apiClient.ts` — fetchWithAuth, parse edilmiş JSON döner; `.json()` çağırma |
| AI | Claude claude-sonnet-4-6 (sözleşme analizi, görev üretimi) |

### Backend Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js + TypeScript |
| Web Framework | Express.js v5 |
| ORM | Prisma (SQLite dev, PostgreSQL prod) |
| Auth | JWT tabanlı (x-tenant-id header zorunlu) |
| Dosya Upload | multer v2 (memoryStorage → lokal / Nextcloud WebDAV) |

---

## 3. Veri Modeli

Prisma schema'da 50+ model. Çekirdek modeller:

```
Tenant              — Şirket/kiracı kaydı
Subscription        — Kiracı abonelik planı + lisans bilgileri
UsageMetric         — Kullanım istatistikleri (periyot bazlı)
Unit                — Organizasyon birimi
User                — Kullanıcı (unit'e bağlı, permissions JSON)
Customer            — Müşteri (risk skoru, kredi limiti, tech stack)
Opportunity         — Satış fırsatı (pipeline)
Proposal            — Versiyonlu teklif
BoMItem             — Malzeme listesi (Bill of Materials) kalemi
CostItem            — Fırsat maliyet kalemi (LABOR/LOGISTICS/TRAVEL/OTHER)
Contract            — Sözleşme (eski basit model)
ContractWorkflow    — Sözleşme süreç yönetimi (5 aşamalı AI destekli)
ContractWorkflowDoc — Sözleşme evrakları (upload + durum takibi)
Project             — Proje (type, phase, milestone/cost relations)
ProjectMilestone    — Aşama takibi (paralel, onay gerektiren, progress bar)
ProjectCostItem     — Proje maliyet kalemi (PROCUREMENT/TRAVEL/EXTERNAL_SERVICE/OTHER)
Vendor              — Tedarikçi kaydı (kategori, IBAN, değerlendirme)
PurchaseRequest     — Satınalma talebi (9 statü, tam tedarik döngüsü)
PurchaseItem        — Talep satır kalemleri
PurchaseQuote       — Tedarikçi teklifleri (çoklu, karşılaştırmalı)
DeliveryRecord      — Teslimat kaydı (miktar takibi dahil)
TodoTask            — Görev (birim bazlı, relatedModule + relatedItemId)
ArchiveItem         — Fiziksel arşiv kaydı (raf, kutu, ödünç durumu)
ActivityLog         — Denetim izi
Notification        — Sistem bildirimleri
CorporateDocument   — Kurumsal doküman (ISO, sertifika, vb.)
Workflow            — İş akışı tanımı (isDefault, varsayılan şablon)
WorkflowStep        — İş akışı adımı (enabled, requiresCompletion — skip-logic)
```

**Kurumsal süreç & operasyonel birim modelleri (Faz 0–8):**

```
VisitPlan / Visit       — Haftalık müşteri ziyaret planı (DEMO/TECHNICAL_MEETING/...)
DailyReport             — Günlük saha raporu (yöneticiyle paylaşım flag'i)
ProjectHandoverDoc      — Proje devir paketi evrakları (11 zorunlu evrak)
ApprovalChain / Stage   — Kalıcı çok-aşamalı onay zinciri (Finans→İGPD→GM→KSU)
DocumentCodingProfile   — Tenant-bazlı doküman kodlama profili (özgün notasyon)
DocumentCategoryCode    — Tenant'ın tanımladığı kategori sözlüğü
DocumentSequence        — Atomik artan doküman sayacı (kategori+yıl)
LessonsLearned          — Alınan dersler (Genel Hususlar)
RiskOpportunity         — Risk & Fırsat kaydı (skor = olasılık × etki)
CorporateMetric         — Dönemsel KPI (hedef/gerçekleşen)
ExternalDocumentRegister— Dış kaynak doküman sicili
Invoice / Payment       — Fatura (SALES/PURCHASE) + kısmi ödeme (Finans)
GuaranteeLetter         — Teminat mektubu (BID_BOND/PERFORMANCE/...; İhale ile paylaşımlı)
LegalCase               — Hukuki vaka (inceleme/görüş/dava; talep→vaka dönüşümü)
Tender / ChecklistItem  — İhale/İSAB (İKN, idare, yöntem + uygunluk denetimi)
UnitReport              — Birim dönemsel performans raporu (otomatik metrik + yönetici yorumu)
PluginEntitlement       — Sanal agent eklenti/lisans kapısı (ADVISORY/AUTONOMOUS)
AgentRun                — Sanal agent çalıştırma kaydı (köken etiketi, ratifikasyon)
```

---

## 4. Modüller ve Yetenekler

### 4.1 Dashboard

Ana kontrol paneli. Gerçek zamanlı KPI kartları ve canlı operasyon akışı.

**Yapabilecekleri:**
- **Pipeline KPI'ları:** Toplam açık fırsat değeri, kazanılan değer, kaybedilen değer, aktif proje sayısı
- **Satış Boru Hattı Grafiği:** Statü bazında fırsat değerleri (Recharts bar chart)
- **Aktif Projeler Listesi:** İlerleme %, bitiş tarihi — tıkla, Proje Yönetimine git
- **Canlı Operasyon Gelişmeleri:** Güncel görevler, teklifler, sözleşmeler akış görünümünde
- **GM-Only Sekmeler:** Kazanma oranı, birim performans karşılaştırması

---

### 4.2 CRM & Müşteri Modülü

Satış pipeline yönetimi, müşteri ve teklif takibinin merkezi. 5 alt sekmeli dashboard yapısıyla.

**Alt Sekmeler:**
```
CRM & Müşteri
 ├── Genel Bakış       — Metrik kartlar, modül kartları, pipeline dağılım
 ├── Fırsatlar         — NEW→WON/LOST pipeline
 ├── Teklifler         — Versiyonlu teklif yönetimi
 ├── Müşteriler        — Tam müşteri profili + Excel import
 └── Canlı Pazarlıklar — Müzakere modülüne erişim
```

**Fırsat Durum Makinesi:**
```
NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON
                                                      → LOST
```

**Teklif Durum Sıralaması:**
```
DRAFT (0) → PENDING_APPROVAL (1) → APPROVED (2) → SENT (3) → ACCEPTED (4)
                                 → REJECTED (-1)
```

**Kazanıldı / Kaybedildi Akışı:**
- Teklif üzerinden: `SENT` teklif → **Kazanıldı** → Fırsat `WON`, teklif `ACCEPTED` → Sözleşme Yönetimine otomatik yönlendir
- Fırsat üzerinden (teklif olmadan): Direkt `WON` / `LOST` işaretleme

**Müşteri Kaydı:** Firma adı, sektör, vergi bilgileri, ticaret sicil, kredi limiti, risk skoru (renk kodlu), tech stack, sosyal medya; Excel toplu import.

---

### 4.3 Presales & Dizayn Modülü

Teknik analiz ve malzeme listesi hazırlama. 2 alt sekme.

**BoM & Tasarım:**
- Part Number, açıklama, adet, alış maliyeti, marj % → satış fiyatı otomatik
- Excel / CSV import; `MATCHED` / `PENDING_MATCH` durumu
- Şartname Analizi: metin yapıştır → Claude AI gereksinimler + ürün listesini çıkarır
- **Onaya Gönder:** BoM özeti önizle → yönetici seç → TodoTask oluşturulur

**Maliyet Analizi:**
- Kategori bazlı giderler: İşçilik, Lojistik, Seyahat, Dış Kaynak
- Döviz & kur yönetimi (USD/EUR/TRY, anlık hesaplama)
- **Marj Modu:** `PER_ITEM` (kalem bazlı) veya `PROJECT_WIDE` (global)
- Sticky finansal özet: Toplam Maliyet, Toplam Satış, Brüt Kar, Kar Marjı %

---

### 4.4 Müzakere Modülü

Teklifin müşteri ile müzakere sürecinin yönetimi. İki mod:

**Canlı Pazarlık (AI Simülasyonu):**
```
IDLE → INTRO → NEGOTIATING → AGREED
                            → FAILED
```
- Teklif seç → AI müşteri simülasyonu başlar
- Karşı teklif ver (%) → Dip marj koruması: minimum marjın altına inemezsin
- Anlık marj barı: Yeşil / Sarı / Kırmızı renk kodu
- `AGREED` → Fırsatı WON olarak tescil et

**Açık Eksiltme:**
```
IDLE → SETUP → BIDDING → FINISHED
```
- Rakip firmaları ve başlangıç tekliflerini gir
- Tur bazlı fiyat eksiltmesi, süre sınırı, minimum adım %
- Kazanan belirlenir; Enflow'un teklifini güncelle

---

### 4.5 Sözleşme Yönetimi (ContractWorkflow)

AI destekli 5 aşamalı sözleşme süreç yönetimi.

**Durum Makinesi:**
```
DRAFT
  → ANALYSIS_DONE               (AI analizi tamamlandı)
  → PREPARATION                 (evrak hazırlık)
  → READY_TO_SIGN               (tüm zorunlu evraklar tam — OTOMATİK)
  → PENDING_SIGNATURE_APPROVAL  (yönetici onayı bekleniyor)
  → SIGNED                      (onaylandı)
  → TRANSFERRED                 (Proje Yönetimine devredildi — OTOMATİK)
```

**5 Sekme:**

| Sekme | İçerik |
|-------|--------|
| 1 — Bağlam | İhale adı, İKN, sözleşme bedeli, son tarih |
| 2 — Analiz | Sözleşme metni + şartname → AI ile analiz (önemli maddeler, riskler, evrak listesi, yapılacaklar) |
| 3 — Evrak Takibi | PENDING/UPLOADED/VERIFIED/WAIVED durumlu evrak kartları; dosya yükle → otomatik ilerleme |
| 4 — İmzalama | 4 adımlı onay akışı; imzalanma tarihi girişi |
| 5 — Proje Aktarımı | AI görevleri → TodoTask; Onayla & Aktar → SIGNED + TRANSFERRED |

**Dosya Yükleme:** multer → lokal `backend/uploads/contracts/` + opsiyonel Nextcloud WebDAV.

**Otomatik Geçişler:**
- Tüm `isRequired: true` evraklar `UPLOADED/VERIFIED/WAIVED` → `READY_TO_SIGN`
- "Onayla & Aktar" → `SIGNED` + `/transfer` çağrısı → `TRANSFERRED`

**Hukuk Görünümü (mod geçişi):** Modül üstünde `Sözleşmeler ↔ Hukuk` geçiş çubuğu. Hukuk modunda `LegalCase` takibi (tip CONTRACT_REVIEW/LEGAL_OPINION/DISPUTE/LITIGATION; durum OPEN→IN_REVIEW→RESPONDED→ESCALATED→CLOSED; öncelik) + "Gelen Talepler" (LEGAL etiketli TodoTask'lar) → "Vakaya Dönüştür". Doküman no `ENF-HUK-YYYY-NNNNN`. (LEGAL_MGR operasyonel birimi.)

---

### 4.6 Satın Alma Modülü

Tam tedarik döngüsü — talepten faturaya.

**Durum Makinesi:**
```
DRAFT → PENDING_UNIT → PENDING_PROCUREMENT → PENDING_GM
  → PO_ISSUED → IN_DELIVERY → INVOICED → CLOSED
  → REJECTED (herhangi bir aşamada)
```

**Kaynaklar:** `MANUAL` | `BOM` | `PROJECT` | `UNIT`  
**Aciliyet:** `LOW` | `NORMAL` | `HIGH` | `URGENT`

**Akış Adımları:**
1. Talep oluştur + kalem satırları ekle → `DRAFT`
2. Onay hiyerarşisi: Birim → Satın Alma → GM (bütçe eşiğine göre)
3. Tedarikçi teklifleri topla → karşılaştır → seç
4. PO kesilir → yazdır → `PO_ISSUED`
5. Teslimat kaydı (miktar takibi) → `IN_DELIVERY`
6. Fatura bilgisi gir → `INVOICED` → Kapat → `CLOSED`

**Tedarikçi Yönetimi:** Firma adı, vergi no, iletişim, IBAN, kategori etiketleri, 1-5 yıldız değerlendirme.

**PR Detay Drawer — 4 Sekme:** Bilgi | Teklifler (karşılaştırmalı) | Teslimat | Fatura

---

### 4.7 Proje Yönetimi Modülü

Satınalma'dan tahsilata tam proje yaşam döngüsü.

**Proje Oluşturma Akışı:**
```
WON Fırsat → Fırsat Seçici → Proje Formu (otomatik dolar) → Backend milestone şablonu oluşturur
```

**Proje Tipleri & Milestone Şablonları:**

| Tip | Otomatik Aşamalar |
|-----|------------------|
| HARDWARE | Planlama → Satınalma → Sevkiyat → Kurulum → Test → Kabul → Garanti → Faturalama → Tahsilat |
| SOFTWARE | Planlama → Geliştirme → Test → Kabul → Faturalama → Tahsilat |
| SERVICE | Planlama → Kurulum → Kabul → Faturalama → Tahsilat |
| MIXED | Planlama → Satınalma → Sevkiyat → Kurulum → Geliştirme → Test → Kabul → Garanti → Faturalama → Tahsilat |

**Görünüm Modları:**
- **Kanban:** 4 kolon (PLANNING / IN_PROGRESS / ON_HOLD / COMPLETED) — proje kartları
- **Liste:** Durum/tip filtreleri + metin araması

**Proje Detay Çekmecesi — 4 Sekme:**

| Sekme | İçerik |
|-------|--------|
| Genel | Finansal grid, marj badge (Planlanan/Gerçekleşen/Tahmini) |
| Milestones | Genişletilebilir kartlar, progress slider, durum geçiş butonları |
| Maliyetler | PROCUREMENT/TRAVEL/EXTERNAL_SERVICE/OTHER kategorileri, kalem ekleme |
| Karlılık | Maliyet karşılaştırması, kategori dağılım barları, otomatik risk uyarısı |

**Karlılık Formülleri:**
```
plannedMargin = (contractValue - totalPlannedCost) / contractValue × 100
actualMargin  = (contractValue - totalActualCost)  / contractValue × 100
forecastCost  = actualCost + remainingPlannedCost
```

**Risk Paneli:** Gecikmiş milestone, %85+ bütçe kullanımı veya 5+ puan marj kaybı olan projeler listelenir.

**PDF Raporlar:** Standart (tam finansal) + Müşteri (maliyetler gizli) — tarayıcı yazdırma.

**Milestone Durum Makinesi:**
```
NOT_STARTED → IN_PROGRESS → COMPLETED
            → BLOCKED
            → CANCELLED
```

---

### 4.8 Görev Modülü (TodoModule)

Birim ve kullanıcı bazlı görev yönetimi + teklif onay kuyruğu.

**Görev Kaynakları:**
- Manuel oluşturma (TodoModule)
- Presales BoM → Onaya Gönder → TodoTask
- Sözleşme Aktarımı → AI görevleri → TodoTask
- Milestone `requiresApproval: true` → GM TodoTask

**Teklif Onay Kuyruğu:** PENDING onay görevleri kırmızı uyarı ile öne çıkar; görev içinde Onayla / Reddet / Revize İste aksiyonları.

**Durum Makinesi:** `PENDING → IN_PROGRESS → COMPLETED / CANCELLED`

---

### 4.9 İhale / İSAB Modülü (Satış Destek)

Backend destekli ihale yönetimi (ISAB_MGR operasyonel birimi). 5 sekme:

| Sekme | İçerik |
|-------|--------|
| İhale Listesi | `Tender` CRUD — İKN, idare, yöntem (OPEN/RESTRICTED/NEGOTIATED/DIRECT), durum, deadline + kalan gün rozeti |
| İhale Takvimi | Aktif ihaleler `submissionDeadline` sıralı, SLA renk tonu |
| Uygunluk Denetimi | Seçili ihalenin checklist'i (auto-seed 10 kalem), zorunlu sayaç + progress, dosya yükleme |
| Teminat | Geçici teminat (`GuaranteeLetter` `type=BID_BOND`+`tenderId` — Finans modülüyle paylaşımlı) |
| EKAP | Manuel İKN öneki yer tutucu (gerçek EKAP web servisi yok) |

**Durum Makinesi:** `DRAFT → PREPARING → SUBMITTED → EVALUATING → WON / LOST / CANCELLED`  
**Doküman no:** opsiyonel `categoryCode='IHL'` → `ENF-IHL-YYYY-NNNNN`

---

### 4.10 Şirket Evrakları (DocumentsModule)

Kurumsal doküman arşivi — LEGAL / ISO / CERTIFICATE / FINANCIAL / WORK_EXPERIENCE kategorileri, geçerlilik tarihi uyarısı, etiket bazlı arama.

---

### 4.11 Fiziksel Arşiv (ArchiveModule)

Islak imzalı evrakların kutu/raf/ödünç takibi — `IN_ARCHIVE` / `BORROWED` durum yönetimi.

---

### 4.12 Workflow Builder

Birimler arası iş akışlarının görsel tasarım aracı. WorkflowStep: birim, tip (AUTO/MANUAL), sıra, sonraki adım bağlantısı. Simülasyon modu ile adım adım test.

---

### 4.13 Ayarlar Modülü

10 alt sekme:

| Sekme | İçerik |
|-------|--------|
| Şirket Profili | Tenant adı, logo |
| Birimler | CRUD + silerken transfer koruması |
| Kullanıcılar | Kullanıcı CRUD, rol + birim atama |
| İş Akışı | Workflow Builder |
| Yetkiler | Rol-izin matrisi |
| Entegrasyonlar | Nextcloud / Exchange / WhatsApp |
| Abonelik & Kullanım | Plan, kullanım metrikleri |
| Lisans Planları | Plan listesi ve düzenleme |
| Lisans Anahtarı Oluştur | İmzalanmış lisans üretimi [GM only] |
| Modüller | Test modüllerini canlıya alma [GM only] |

---

### 4.14 Lisans Modülleri

**LicenseTypesModule:** Mevcut plan listesi, model, fiyat, limitler, özellikler.

**LicenseGeneratorModule [GM only]:** Şirket bazlı lisans anahtarı üretimi (KOBI / PAY_AS_YOU_GO / ON_PREMISE), geçerlilik süresi, kullanıcı / depolama limiti, deneme flag'i, JSON indirme.

---

### 4.15 Abonelik Modülü

Aktif plan bilgisi, kullanım metrikleri, plan yükseltme, lisans anahtar yönetimi.

---

### 4.16 Ziyaret Planı & Günlük Rapor (Faz 2)

Süreç öncesi katman — `visit-plan` sekmesi (Dashboard'dan sonra, CRM'den önce).

- **Haftalık ziyaret tablosu:** müşteri / tip (DEMO/TECHNICAL_MEETING/PRESENTATION/OTHER) / planlanan tarih + ihtiyaç notu; gerçekleşen tarih & durum.
- **Günlük saha raporu:** serbest metin + "Yöneticiyle Paylaş" flag'i.
- Modeller: `VisitPlan` / `Visit` / `DailyReport`. Backend `/api/visits`.

---

### 4.17 Proje Devir Paketi (Faz 2)

Proje Yönetimi detayında 5. sekme. `ContractWorkflowDoc` pattern'inin klonu — **11 zorunlu evrak** (Fizibilite, İhale Dokümanları, Sözleşme+Ekleri, Birim Fiyat Cetveli, Maliyet Tablosu, Kitlist Ağacı, Alınan Teklifler, İhale Kararı, Teminat Mektupları, Devir Formu, Personel Listesi). Tüm zorunlu evraklar `UPLOADED/VERIFIED/WAIVED` olunca devir tamamlanır; aksi halde header'da amber "Devir Bekliyor" rozeti. Model: `ProjectHandoverDoc`.

---

### 4.18 Genel Hususlar (Kurumsal Yönetim) (Faz 3)

`corporate-governance` sekmesi — 4 sekme, kurumsal yönetişim:

| Sekme | Model | İçerik |
|-------|-------|--------|
| Alınan Dersler | `LessonsLearned` | Durum / kök neden / aksiyon / etki |
| Risk & Fırsat | `RiskOpportunity` | Olasılık×Etki skoru (1-7 yeşil / 8-14 amber / 15-25 kırmızı) |
| KPI | `CorporateMetric` | Hedef / gerçekleşen yüzde |
| Dış Doküman Sicili | `ExternalDocumentRegister` | Kaynak, versiyon, durum |

**Doküman Kodlama Sistemi (tenant-yapılandırılabilir):** Ayarlar → Şirket Profili → "Doküman Kodlama Notasyonu". Şirket kodu + ayraç + hane + yıl/aktif toggle + kategori sözlüğü. Format: `{companyCode}{sep}{categoryCode}[{sep}{year}]{sep}{paddedSeq}` (örn. `ENF-SOZ-2026-00001`). **Sabit gömülü kategori/önek yoktur — tamamen özgün ve tenant-bazlı.**

---

### 4.19 Finans Modülü (Faz 6a)

`finance` sekmesi (FINANCE_MGR operasyonel birimi). 5 sekme:

| Sekme | İçerik |
|-------|--------|
| Faturalar | `Invoice` (SALES/PURCHASE) CRUD; durum DRAFT→ISSUED→SENT→PARTIAL→PAID→OVERDUE |
| Tahsilat | `Payment` kısmi ödeme; `paidAmount`/`status` otomatik türetilir (`recalcInvoice`) |
| Teminat Mektupları | `GuaranteeLetter` (BID_BOND/PERFORMANCE/ADVANCE/WARRANTY) — yaklaşan/geçmiş renk kodu |
| Maliyet Onayı | PENDING `ProjectCostItem` onay/red |
| Özet | Alacak / tahsilat / vadesi-geçen / teminat / bekleyen-onay metrikleri |

Backend `/api/finance`. POST'lar opsiyonel `categoryCode` ile docNumber üretir.

---

### 4.20 Yönetim Raporları (Faz 7)

`management-reports` sekmesi — konsolide birim performansı. Her operasyonel birimin metrikleri mevcut veriden **otomatik** hesaplanır.

- **Genel Bakış:** iş akışı darboğazı paneli (açık `ApprovalChain`'lerin sırası gelmiş ilk PENDING aşaması role göre = iş akışı hangi birimde bekliyor) + 7 birimin başlık metrik kartları.
- **Birim Detayı:** seçili birimin tüm metrikleri + recharts grafikleri (bar/pie/line), esnek tarih aralığı.
- **Raporlarım:** birim yöneticisi `UnitReport` taslağı — otomatik metrik ön-izleme + narrative (öne çıkanlar/sorunlar/aksiyon/risk/özet) → "Yönetime Sun" (gönderim anı `metricsSnapshot` JSON).
- **Gelen Raporlar (GM-only):** SUBMITTED raporları incele → Onayla / İade. Durum: `DRAFT → SUBMITTED → REVIEWED / RETURNED`.

Backend `/api/reports` (`unitReportingService.ts`). Doküman no `ENF-RPR-YYYY-NNNNN`.

---

### 4.21 Sanal Agentlar [TEST · Eklenti] (Faz 8)

Boş birim koltuğunu dolduran sanal agent altyapısı — **ticari sürüm dışında, ayrı lisanslanabilir upsell**. GM-only `virtual-agents-test` sekmesi. Varsayılan mod **ADVISORY** (çıktı insan ratifikasyonu bekler).

- **Eklenti Kataloğu:** 7 agent (AGENT_TENDER, AGENT_PROJECT, AGENT_PRESALES, AGENT_PROCUREMENT, AGENT_FINANCE AVAILABLE; AGENT_LEGAL, AGENT_CRM COMING_SOON). **AGENT_FINANCE/LEGAL `allowedModes=['ADVISORY']` — para/hukuk asla otonom.** Lisans aktivasyonu + GM-only anahtar üretimi (imzalı HMAC: `ENF-PLUGIN-<KEY>[-D<gün>]-<İMZA>`).
- **Çalıştırmalar:** agent çalıştır → deterministik handler (LLM gerektirmez) tutarlılık/risk denetimi → handoff `TodoTask` (gerçek kişiye devir) + `AgentRun` + `ActivityLog`. "Onayla & Devral" ile ratifiye edilir.
- **Köken etiketi (provenance):** her işlem `AGENT:<pluginKey>` ile damgalanır; `AgentTag` rozeti ("🤖 {agent} tarafından yapıldı") + drill-down popover. Sonraki onaylayan agent-onaylı aşamayı görür ve kontrol eder.

Backend `/api/plugins` (catalog/entitlements/activate/generate-key/run/runs/ratify; lisans yoksa **402 upsell sinyali**).

> ℹ️ Lisanslama Ed25519'a geçti (`PLUGIN_LICENSE_SECRET` kaldırıldı) — bkz. `docs/LICENSING_ARCHITECTURE.md`.

---

### 4.22 Bekleyen Onaylarım — Onay Zinciri Swimlane (Faz 1)

TodoModule içinde generic sekme: `currentUser.role` zincirin hangi aşamasındaysa (FINANCE_MGR/IGPD_MGR/GENERAL_MANAGER/KSU_MGR vb.), sırası gelmiş onaylar listelenir. Backend `GET /api/approval-chains?pendingForRole=<ROLE>` — "sırası gelmiş" = önceki tüm aşamalar `APPROVED`. Boş koltuk (aktif kullanıcısı olmayan rol) → `autoSkipOrphanStages` ile SKIPPED (deadlock önleme) veya lisanslı otonom agent varsa agent-onaylı.

---

## 5. İş Akışı Motoru

### Tam Akış Diyagramı

```
[1] CRM — Fırsat Girişi (NEW)
  ↓
[2] CRM — Pipeline ilerlemesi → PROPOSAL
  ↓
[3] Presales — BoM + Şartname Analizi (AI)
  ↓
[4] Presales — Maliyet Analizi (döviz, marj modu)
  ↓
[5] CRM — Teklif oluştur → PENDING_APPROVAL → APPROVED → SENT
  ↓
[6] Müzakere — Canlı pazarlık / Açık eksiltme → Anlaşma
  ↓
[7] CRM — Kazanıldı (WON) → Sözleşme Yönetimine yönlendir
  ↓
[8] Sözleşme — AI analiz → Evrak takip → İmzala → Proje Aktarımı
  ↓ (paralel)
[9a] Satın Alma — Talep → PO → Teslimat → Fatura
[9b] Proje Yönetimi — WON fırsat → Milestone takibi → Karlılık → Tahsilat
  ↓
[10] Görevler — Tüm aşamalarda birim bazlı görev takibi
```

### WorkflowLog Kaydı

Her hand-off işleminde `ActivityLog` + `WorkflowLog` kaydı:
- `fromUnitId` / `toUnitId`, `assignedBy` / `assignedTo`, `note`
- `status`: `PENDING → COMPLETED / APPROVED / CANCELLED`

### WorkflowService API

```typescript
triggerHandOff(fromUser, toUser, item, note, type)
  → WhatsApp bildirimi + Exchange e-posta + WorkflowLog

requestApproval(opportunityId)
  → technicalStatus: 'WAITING_APPROVAL'
  → Yönetim birimine TodoTask
  → WorkflowLog (PENDING)

approveOpportunity(opportunityId)
  → technicalStatus: 'APPROVED' → status: 'PROPOSAL'
  → WorkflowLog (APPROVED)
```

---

## 6. Bildirim Katmanı

### 6.1 WhatsApp (Meta Cloud API)

```typescript
whatsappService.sendMessage(phoneNumber, message)
// POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
```

Tetiklendiği durumlar: Hand-Off, onay talebi, kritik görev ataması.

### 6.2 Microsoft Exchange

```typescript
exchangeService.sendEmail(to, subject, body)
// EWS veya Graph API
```

Tetiklendiği durumlar: Hand-Off, sözleşme tamamlanma, onay sonucu.

### 6.3 Sistem İçi Bildirimler

```typescript
apiService.createNotification({ userId, title, message, type, tenantId })
// type: 'SYSTEM' | 'URGENT' | 'SUCCESS' | 'WARNING'
```

Dashboard Header'da kırmızı bayraklı uyarı ikonu + bildirim paneli.

---

## 7. Yetkilendirme Sistemi (RBAC)

### Tanımlı Roller

| Rol Kodu | Görünen Ad |
|----------|-----------|
| `GENERAL_MANAGER` | Genel Müdür |
| `SALES_MGR` | Satış Müdürü |
| `SALES_REP` | Satış Temsilcisi |
| `SALES_SUPPORT` | Satış Destek |
| `PRESALES_MGR` | Presales Müdürü |
| `PRESALES_ENG` | Presales Mühendisi |
| `PROJECT_MGR` | Proje Yöneticisi |
| `PROCUREMENT_MGR` | Satın Alma Müdürü |
| `FINANCE_MGR` | Finans Müdürü |
| `OPERATIONS_MGR` | Operasyon Müdürü |
| `AUDITOR` | Denetçi |
| `ADMIN` | Sistem Yöneticisi |
| `LEGAL_MGR` | Hukuk Müdürü / Şirket Avukatı |
| `IGPD_MGR` | İş Geliştirme Müdürü |
| `KGD_MGR` | Kalite Güvence Müdürü |
| `KSU_MGR` | Kontrat & Sözleşme Müdürü |
| `ISAB_MGR` | İhale Birimi Müdürü |

> Kurumsal onay swimlane rolleri (FINANCE_MGR, İGPD, KGD, KSU, İSAB) `ApprovalChain` aşamalarında kullanılır; karşılık gelen `Unit` kayıtları tenant'a eklenir. İzin kullanıcı `permissions` JSON'undan verilir (kod-seviyesi rol→izin haritası yok); GM superuser tüm modülleri görür.

### PermissionGate Bileşeni

```tsx
<PermissionGate permission="OFFER_APPROVE">
  <ApproveButton />
</PermissionGate>
```

`hasPermission(code)` → AuthContext'ten kullanıcının `permissions` dizisini kontrol eder. İzin yoksa bileşen render edilmez. Admin panelinden bir izin kaldırıldığında, ilgili buton/sayfa **anlık** olarak kaybolur.

---

## 8. Multi-Tenancy

Her API isteğinde `x-tenant-id` header zorunludur.

```
GET /api/opportunities
Headers: x-tenant-id: tenant-abc-123
```

### Tenant Middleware

```typescript
const tenantMiddleware = asyncHandler(async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId; // Express.d.ts namespace augmentation
  next();
});
```

### Veri İzolasyonu

Her Prisma sorgusunda `where: { tenantId: req.tenantId }` filtresi zorunlu.

### Modül Tanıtım Sistemi

`Tenant.moduleSettings` JSON alanı — test modüllerini canlıya alma:
```
GET/PUT /api/tenants/module-settings
```

---

## 9. Lisans ve Abonelik Modeli

### Plan Karşılaştırması

| Özellik | STARTER | PROFESSIONAL | ENTERPRISE |
|---|---|---|---|
| Kullanıcı | 5 | 25 | Sınırsız |
| Depolama | 10GB | 100GB | 1TB |
| CRM & Pipeline | ✅ | ✅ | ✅ |
| Workflow Engine | ❌ | ✅ | ✅ |
| WhatsApp Entegrasyon | ❌ | ✅ | ✅ |
| Proje Yönetimi | ✅ | ✅ | ✅ |
| Satın Alma Modülü | ❌ | ✅ | ✅ |
| On-Premise Kurulum | ❌ | ❌ | ✅ |

### Lisans Modelleri

| Model | Açıklama |
|-------|---------|
| `KOBI` | Bulut tabanlı SaaS, aylık abonelik |
| `PAY_AS_YOU_GO` | Kullanım bazlı ücretlendirme |
| `ON_PREMISE` | Şirket içi kurulum, tek seferlik lisans |

### Lisans Anahtarı Yapısı

```json
{
  "companyName": "Örnek A.Ş.",
  "model": "KOBI",
  "expiryDate": "2027-06-16T...",
  "issuedAt": "2026-06-16T...",
  "isTrial": false,
  "limits": { "users": 25, "storage": 100 },
  "signature": "base64-imza"
}
```

---

## 10. Entegrasyonlar

### 10.1 Nextcloud DMS

- Sözleşme evrakları WebDAV ile yüklenir (multer buffer → MKCOL + PUT)
- Hata olursa lokale düşer (fallback)
- Yapılandırma: URL, adminUser, appPassword, basePath
- Kullanıcı senkronizasyonu (syncUser)

### 10.2 Microsoft Exchange

- E-posta gönderme (hand-off, onay bildirimleri)
- Takvim senkronizasyonu
- Yapılandırma: serverUrl, domain, adminEmail, adminPass

### 10.3 WhatsApp Business Cloud API

- Meta Graph API v18.0 üzerinden mesaj gönderme
- Yapılandırma: phoneNumberId, accessToken, businessAccountId, webhookVerifyToken

### 10.4 Claude AI (Anthropic)

- Sözleşme metni + idari şartname analizi
- Çıktı: önemli maddeler, risk değerlendirmesi, evrak listesi, yapılacaklar
- Proje aktarım görevleri üretimi
- Model: `claude-sonnet-4-6` / mock fallback (API key yoksa)

---

## 11. Backend API

Tüm endpoint'ler `/api/` prefix'li. Tenant gerektiren route'larda `x-tenant-id` header zorunlu.

### Kaynaklar ve Endpoint'ler

| Kaynak | Route | Notlar |
|---|---|---|
| Health | `/api/health` | GET |
| Auth | `/api/auth` | POST /login, POST /forgot-password |
| Tenants | `/api/tenants` | GET, POST, PUT /:id, GET/PUT /module-settings |
| Subscription | `/api/subscription` | GET, PUT /plan, POST /activate-license |
| Usage | `/api/usage` | GET |
| Units | `/api/units` | GET, POST, DELETE /:id |
| Users | `/api/users` | GET, POST, PUT /:id, DELETE /:id |
| Customers | `/api/customers` | GET, POST, PUT /:id, DELETE /:id |
| Opportunities | `/api/opportunities` | GET, POST, PUT /:id + BoM/costs/approval alt-route'ları |
| Proposals | `/api/proposals` | GET, POST, PUT /:id, DELETE /:id |
| ContractWorkflows | `/api/contract-workflows` | CRUD + /analyze + /documents + /documents/:id/upload + /transfer |
| Projects | `/api/projects` | GET, POST, PUT /:id, DELETE /:id, GET /summary/all, + milestones + costs alt-route'ları |
| Vendors | `/api/vendors` | GET, POST, PUT /:id, DELETE /:id |
| PurchaseRequests | `/api/purchase-requests` | CRUD + approve/reject/quotes/delivery/invoice/close |
| Tasks | `/api/tasks` | GET, POST, PUT /:id, DELETE /:id |
| Contracts | `/api/contracts` | GET, POST, PUT /:id, DELETE /:id (eski model) |
| Archive | `/api/archive` | GET, POST, PUT /:id, DELETE /:id |
| Notifications | `/api/notifications` | GET, POST, PUT /:id, DELETE /:id |
| Documents | `/api/documents` | GET, POST, PUT /:id, DELETE /:id |
| Workflows | `/api/workflows` | GET, POST, PUT /:id, GET /default, GET /:id/steps/:stepId/resolve-next |
| Logs | `/api/logs/notifications` | GET, POST |
| Visits | `/api/visits` | plans + visits + daily-reports CRUD |
| ApprovalChains | `/api/approval-chains` | GET (?entityType / ?pendingForRole), POST, stages/:id/approve, /reject, DELETE |
| DocumentCoding | `/api/document-coding` | GET/PUT /profile, kategori CRUD |
| CorporateGovernance | `/api/corporate-governance` | /lessons, /risks, /metrics, /external-docs |
| Finance | `/api/finance` | /invoices + /payments + /guarantees + /cost-approvals + /summary |
| Legal | `/api/legal` | /cases CRUD + /upload + /requests |
| Tenders | `/api/tenders` | CRUD + /:id/checklist (auto-seed) + upload |
| Reports | `/api/reports` | /units, /unit-metrics, /bottlenecks, /overview, /unit-reports (+submit/review) |
| Plugins | `/api/plugins` | /catalog, /entitlements, /activate, /generate-key [GM], /agents/:key/run, /runs, /runs/:id/ratify |
| Static | `/uploads/...` | Yüklenen dosyalar |

### Kritik Route Sırası

```
// GET /projects/summary/all MUTLAKA /:id'den ÖNCE tanımlanmalı
router.get('/summary/all', handler);
router.get('/:id', handler);
```

### Retry Mekanizması

SQLite lock hatalarında (`P2028`, `P2034`) otomatik retry:
- 3 deneme, exponential backoff (500ms → 1s → 2s)
- `asyncHandler` + `withRetry` — `backend/src/middleware.ts`

---

## 12. Frontend Mimari

### Klasör Yapısı

```
src/
├── App.tsx                — Root, global state, activeTab route logic
├── types.ts               — Tüm TypeScript interface'leri (tek kaynak gerçeklik)
├── constants.ts           — NAV_ITEMS, ROLE_LABELS, MOCK_* verileri
├── contexts/
│   ├── AuthContext.tsx    — currentUser, hasPermission(), setAuth()
│   ├── ThemeContext.tsx   — Aydınlık/karanlık tema
│   └── UnsavedChangesContext.tsx — Kaydedilmemiş değişiklik koruması
├── hooks/
│   ├── useEnflowQueries.ts — TanStack Query hooks
│   ├── useBoM.ts          — BoM state yönetimi
│   └── useShared.ts       — useSearch, useForm
├── layout/
│   ├── Sidebar.tsx        — Sol navigasyon (NAV_ITEMS bazlı, izin kontrollü)
│   ├── Header.tsx         — Bildirim ikonu, kullanıcı profili
│   └── MobileNav.tsx      — Mobil bottom navigation
├── modules/               — 21 modül (bkz. Bölüm 4)
├── components/
│   ├── PermissionGate.tsx — RBAC render guard
│   ├── SaveButton.tsx     — Global kaydet butonu
│   ├── HandOffModal.tsx   — İş devri modal
│   ├── FinalProposalGenerator.tsx — PDF teklif
│   ├── TaskProgressTracker.tsx
│   ├── WorkflowSimulation.tsx
│   ├── CostAnalysisModule.tsx
│   └── settings/          — TenantSettings, UnitManagement, UserManagement, vb.
├── services/
│   ├── apiClient.ts       — fetchWithAuth (parse edilmiş JSON döner; .json() çağırma)
│   ├── apiService.ts      — Tüm API metodlarının façade'ı
│   ├── crmService.ts      — CRM & teklif API'ları
│   ├── projectService.ts  — Proje API'ları
│   ├── taskService.ts     — Görev API'ları
│   ├── documentService.ts — Evrak + arşiv + sözleşme API'ları
│   ├── settingsService.ts — Ayarlar + abonelik + kullanıcı API'ları
│   ├── workflowService.ts — Hand-off + bildirim tetikleme
│   ├── whatsappService.ts — WhatsApp Cloud API
│   ├── exchangeService.ts — Exchange e-posta
│   └── nextcloudService.ts — Nextcloud DMS
└── utils/
    ├── logger.ts          — import.meta.env.DEV gate'li logger (console.log yerine)
    └── bomParser.ts       — Excel → ParsedBoMItem[] dönüşümü
```

### Global State Stratejisi

- **Server State:** TanStack React Query v5 (cache, refetch, stale-time)
- **UI State:** Component-level `useState`
- **Cross-cutting State:** Context API (Auth, Theme, UnsavedChanges)

### Vite Chunk Optimizasyonu

```typescript
// vite.config.ts — manualChunks
// 3.47MB tek chunk → 17 chunk (en büyük ~520KB gzip ~121KB)
{
  'vendor-lucide': id.includes('lucide-react'),   // ← react'tan ÖNCE gelmeli
  'vendor-charts': id.includes('recharts') || ...,
  'vendor-query':  id.includes('@tanstack'),
  'vendor-motion': id.includes('motion'),
  'vendor-react':  id.includes('react-dom') || ...,
  // ...
}
```

### API Path Kuralı

```typescript
// apiClient.fetchWithAuth(path) → path /api olmadan yaz; client ekliyor
apiClient.fetchWithAuth('/projects')         // → GET /api/projects
apiClient.fetchWithAuth('/vendors', {...})    // → POST /api/vendors
```

---

## 13. Çalıştırma

### Gereksinimler

- Node.js 20+
- pnpm 10+

### Kurulum

```bash
# Frontend
pnpm install

# Backend
cd backend
pnpm install
npx prisma generate
npx prisma migrate dev   # migrations uygular
```

### Geliştirme

```bash
# Terminal 1 — Backend (Port 3002)
cd backend && pnpm dev

# Terminal 2 — Frontend (Port 5173)
pnpm dev
```

**Test kullanıcısı:** `gokhan@t-ecosystem.com` / `123456`  
**Tenant:** `tenant-1` (TechCorp A.Ş.) · Rol: `GENERAL_MANAGER`

### Ortam Değişkenleri

**backend/.env:**
```env
DATABASE_URL="file:./dev.db"
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...   # opsiyonel — yoksa mock analiz çalışır
```

**Frontend:** Vite proxy yapılandırması `vite.config.ts`'de — `/api` istekleri `localhost:3002`'ye yönlendirilir.

### Production Build

```bash
# Frontend
pnpm build   # dist/ klasörüne çıkarır (17 optimized chunk)

# Backend
cd backend
npx tsc      # dist/ klasörüne derler
node dist/index.js
```

### Veritabanı Yönetimi

```bash
cd backend

npx prisma studio                          # görsel DB editörü
npx prisma migrate dev --name <isim>       # yeni migration oluştur + uygula
npx prisma generate                        # client'ı yenile (schema değişiminde)
```

---

## Teknik Standartlar

```
TypeScript      → Strict mode, sıfır any; Omit<T,'id'> create, Partial<T> update
Logging         → src/utils/logger kullan; console.log yasak
motion/react    → Paket adı "motion" — "framer-motion" değil
apiClient       → fetchWithAuth parse edilmiş JSON döner; .json() ÇAĞIRMA
Express v5      → String(req.params.id) kullan (params tipi string | string[])
req.tenantId    → Express.d.ts namespace'den; cast gereksiz
multer v2       → upload.single('file'), req.file.buffer
Route sırası    → GET /summary/all MUTLAKA GET /:id'den ÖNCE
opportunityId   → Backend POST /projects'ta opp verisi otomatik çekilir
lucide-react    → vite manualChunks'ta react kontrolünden ÖNCE gelmeli
```

---

*Bu doküman Enflow v2.0 mimarisini ve yeteneklerini kapsamlı biçimde açıklar. Son güncelleme: 16.06.2026.*
