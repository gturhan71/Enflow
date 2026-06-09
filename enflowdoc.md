# Enflow — Kurumsal Süreç İşletim Sistemi

> **Sürüm:** v1.6.3 | **Tarih:** 09.06.2026  
> End-to-End Enterprise Process Automation — Presales'dan Proje Teslimata kadar tek platform.

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

Enflow, bir B2B işletmenin tüm iç süreçlerini tek bir platform üzerinde yönetir. Satışın bir müşteri fırsatı açmasından başlayarak projenin saha ekibine teslim edilmesine kadar geçen her adım — teknik analiz, teklif, maliyet, onay, sözleşme, satın alma, proje takibi — Enflow'da kayıt altına alınır ve birimler arası otomatik devir mekanizmasıyla ilerler.

### Hangi Sorunu Çözer?

| Sorun | Enflow Çözümü |
|---|---|
| Birimler arası bilgi kaybolur | Workflow Engine her adımı kaydeder, ilgili birimi uyarır |
| Teklifler Excel'de kaybolur | Versiyonlu teklif editörü, PDF çıktısı, onay zinciri |
| Kim ne yapıyor bilinmez | TodoTask sistemi + Dashboard KPI'ları |
| Sözleşme evrakları eksik imzalanır | Strict evrak doğrulama — eksiksiz olmadan ilerlenemez |
| Her şirket için ayrı sistem | Multi-tenant yapı, `x-tenant-id` ile tam veri izolasyonu |

---

## 2. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   React 18 + Vite · TypeScript strict · Tailwind CSS        │
│   Framer Motion · Recharts · TanStack Query · Sonner Toast  │
│   Port: 3000                                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (x-tenant-id header)
┌───────────────────────────▼─────────────────────────────────┐
│                        BACKEND                              │
│   Node.js + Express.js · TypeScript · ts-node              │
│   Prisma 7 ORM · SQLite / LibSQL                           │
│   Port: 3002                                                │
│                                                             │
│   backend/src/                                              │
│   ├── index.ts          — app setup + route mount'lar       │
│   ├── middleware.ts     — asyncHandler, tenantMiddleware     │
│   └── routes/           — 17 kaynak router dosyası          │
└───────────────────────────┬─────────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────▼─────────────────────────────────┐
│                       DATABASE                              │
│   SQLite (geliştirme) / LibSQL / PostgreSQL (production)    │
│   20 Prisma model · multi-tenant şema                       │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | React 18 (SPA, Client-Side Routing) |
| Build | Vite 6 |
| Dil | TypeScript (strict mode, sıfır `any`) |
| Stil | Tailwind CSS + custom `glass-panel` design system |
| Animasyon | Framer Motion (modal, geçiş, hover efektleri) |
| Grafik | Recharts (bar chart, pipeline görselleştirme) |
| İkon | Lucide React |
| Server State | TanStack React Query v5 |
| Toast | Sonner (global `window.alert` override ile entegre) |
| HTTP | `apiClient.ts` — Axios/fetch wrapper, `x-tenant-id` header otomatik eklenir |

### Backend Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js (ESM, TypeScript via ts-node) |
| Web Framework | Express.js |
| ORM | Prisma 7 |
| Veritabanı | SQLite (LibSQL adapter) → production'da PostgreSQL drop-in |
| Auth | Mock JWT (production için swap edilebilir) |
| Hot Reload | nodemon |

---

## 3. Veri Modeli

Prisma schema'da tanımlı 20 model:

```
Tenant              — Şirket/kiracı kaydı
Subscription        — Kiracı abonelik planı (STARTER/PROFESSIONAL/ENTERPRISE)
UsageMetric         — Kullanım istatistikleri (periyot bazlı)
Unit                — Organizasyon birimi (Satış, Presales, Yönetim...)
User                — Kullanıcı (unit'e bağlı, permissions JSON)
Customer            — Müşteri (risk skoru, kredi limiti, tech stack dahil)
Opportunity         — Satış fırsatı (pipeline)
Proposal            — Versiyonlu teklif
BoMItem             — Malzeme listesi (Bill of Materials) kalemi
CostItem            — Maliyet kalemi
WorkflowLog         — Birimler arası devir geçmişi
Project             — Proje (kazanılan fırsattan oluşur)
Contract            — Sözleşme
TodoTask            — Görev (birime ve kullanıcıya atanabilir)
ArchiveItem         — Fiziksel arşiv kaydı (raf, kutu, ödünç durumu)
ActivityLog         — Denetim izi (her kritik aksiyon)
Notification        — Sistem bildirimleri
CorporateDocument   — Kurumsal doküman (ISO, sertifika, vb.)
Workflow            — İş akışı tanımı
WorkflowStep        — İş akışı adımı (sıralı, birime atanmış)
```

---

## 4. Modüller ve Yetenekler

### 4.1 Dashboard

Ana kontrol paneli. Gerçek zamanlı KPI kartları ve canlı operasyon akışı.

**Yapabilecekleri:**
- **Pipeline KPI'ları:** Toplam açık fırsat değeri, kazanılan değer, kaybedilen değer, aktif proje sayısı
- **Birim Performans Grafiği:** Bar chart ile satış/presales/proje birimlerinin karşılaştırmalı performansı (Recharts)
- **Canlı Operasyon Gelişmeleri:** İmzalanan sözleşmeler, atanan görevler, tamamlanan devir işlemleri — anlık feed
- **Backend Health Banner:** API bağlantısını kontrol eder, kesintide kullanıcıyı uyarır
- **Rol bazlı görünüm:** Her kullanıcı kendi birimin KPI'larını görür

---

### 4.2 CRM Modülü

Müşteri ve fırsat yönetiminin merkezi.

**Yapabilecekleri:**

**Müşteri Yönetimi:**
- Müşteri oluşturma/düzenleme: isim, sektör, vergi dairesi, vergi no, ticaret sicil no, kredi limiti, risk skoru, para birimi (USD/EUR/TRY), tech stack, sosyal medya
- Müşteri arama ve filtreleme
- Müşteri bazlı fırsat ve teklif geçmişi

**Fırsat (Opportunity) Yönetimi:**
- Pipeline yönetimi: `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON → LOST`
- Fırsata müşteri, sorumlu kullanıcı ve birim atama
- Tahmini kapanış tarihi ve olasılık yüzdesi
- Fırsatın `WON` olmasıyla otomatik sözleşme oluşturma
- `LOST` statüsünde Dashboard'da "Kaybedilen Değer" KPI'ına anlık yansıma

**Teklif (Proposal) Yönetimi:**
- Fırsata bağlı versiyonlu teklif oluşturma (v1, v2, v3...)
- Teklif düzenleme → PDF çıktısı alma
- Müzakere modu: `openForNegotiation` flag'i ile fırsatı `NEGOTIATION` statüsüne taşıma
- Teklif onay zinciri (Approval Chain) — presales'dan yönetime onaya gönderme
- Statü akışı: `DRAFT → PENDING_APPROVAL → APPROVED / REJECTED → ACCEPTED`

**Hand-Off (İş Devri):**
- Fırsatı başka birimi veya kullanıcıya devretme
- Devir anında WhatsApp + Exchange e-posta bildirimi otomatik gönderilir

---

### 4.3 Presales Modülü

Teknik analiz ve malzeme listesi hazırlama.

**Yapabilecekleri:**

**BoM (Bill of Materials) Editörü:**
- Fırsata BoM kalemi ekleme: part number, açıklama, adet, alış maliyeti, marj yüzdesi, tedarikçi
- Excel dosyasından BoM import (`.xlsx` → `bomParser.ts` ile parse)
- Kalem bazlı satış fiyatı ve toplam hesaplama
- BoM'u kaydetme (mevcut liste silinip yenisi oluşturulur — transactional)

**Maliyet Analizi:**
- Fırsata maliyet kalemi ekleme: iş gücü, lojistik, seyahat, outsourcing, diğer
- Kategori bazlı maliyet dağılımı

**AI Spec Analizi (SpecAnalysis):**
- PDF/Word şartname yükleme
- Google Gemini AI ile otomatik analiz:
  - Teknik gereksinimler özeti
  - Spec detayları
  - Ürün listesi (Part Number) çıkarımı
- Analiz sonucu `AnalysisResult` tipinde döner: title, summary, specDetails, extractedProducts

**Teknik Onay Akışı:**
- Presales, hazırladığı BoM'u onaya gönderir (`WAITING_APPROVAL`)
- Yönetim biriminde `TodoTask` oluşturulur
- Onay verilince fırsat `PROPOSAL` statüsüne geçer

---

### 4.4 Satış Destek Modülü (SalesSupport)

Kazanılan fırsatların sözleşmeye dönüştürülmesi ve evrak yönetimi.

**Yapabilecekleri:**
- Kazanılan fırsatlar için gerekli evrak listesi oluşturma (Sözleşme taslağı, maliyet analizi, imza sirküleri vb.)
- Evrak yükleme ve doğrulama (her evrak tek tek onaylanmadan sözleşme tamamlanamaz)
- Satış destek görevlerinin atanması ve takibi

---

### 4.5 Sözleşme Modülü (ContractModule)

Sözleşme yaşam döngüsü yönetimi.

**Yapabilecekleri:**
- `WON` statüsündeki fırsatlardan otomatik sözleşme kartı oluşturma
- Statü akışı: `DRAFT → SIGNED → EXPIRED / TERMINATED`
- İmza tarihi, bitiş tarihi, teminat tutarı ve teminat bitiş tarihi takibi
- **Evrak Doğrulama (Strict Validation):** Tüm gereken dokümanlar `APPROVED` statüsüne geçmeden sözleşme imzalanamaz
- Sözleşme tamamlandığında otomatik paralel iş tetikleme:
  - Proje Yönetimi birimine "Proje Başlatma" görevi
  - Satın Alma birimine "BoM Tedariki" görevi
- Hand-Off: Sözleşme tamamlandığında ilgili birime otomatik devir

---

### 4.6 Proje Yönetimi Modülü

Saha operasyonlarının kanban bazlı takibi.

**Yapabilecekleri:**
- Proje oluşturma (fırsattan veya manuel)
- Statü yönetimi: `DRAFT → ANALYSIS → AWAITING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED`
- Proje bazlı görev (ProjectTask) yönetimi: `TODO → DOING → DONE`
- Satın alma notları (procurementNotes) ekleme
- Deadline ve ilerleme yüzdesi takibi
- Hand-Off ile birimi değiştirme

---

### 4.7 Satın Alma Modülü (ProcurementModule)

BoM kalemlerinin tedarik sürecinin yönetimi.

**Yapabilecekleri:**
- Onaylı BoM kalemlerinin sipariş durumu takibi
- ETA (Tahmini Teslimat) yönetimi
- Tedarikçi bazlı kalem görüntüleme
- Fiziksel depo giriş kontrolü

---

### 4.8 Görev Modülü (TodoModule)

Birim ve kullanıcı bazlı görev yönetimi.

**Yapabilecekleri:**
- Görev oluşturma: başlık, açıklama, öncelik (`LOW/MEDIUM/HIGH/URGENT`), birim, sorumlu, vade tarihi
- Statü akışı: `PENDING → IN_PROGRESS → COMPLETED / CANCELLED`
- İlgili modüle bağlama (`relatedModule`, `relatedItemId`)
- İlerleme notları ekleme
- Öncelik bazlı filtreleme ve sıralama
- Workflow Engine'den otomatik oluşturulan görevler (sistem kaynaklı)

---

### 4.9 Belgeler Modülü (DocumentsModule)

Kurumsal doküman arşivi.

**Yapabilecekleri:**
- Doküman yükleme ve kategorileme: `LEGAL / ISO / CERTIFICATE / FINANCIAL / WORK_EXPERIENCE`
- Son kullanım tarihi takibi (otomatik uyarı)
- Tag bazlı etiketleme
- Nextcloud DMS entegrasyonu (dokümanları Nextcloud'a push etme)

---

### 4.10 Arşiv Modülü (ArchiveModule)

Fiziksel arşiv kayıt sistemi.

**Yapabilecekleri:**
- Islak imzalı evrak kutu/raf takibi
- Ödünç verme durumu yönetimi
- Kategori, etiket ve tarih bazlı arama
- Multi-tenant veri izolasyonu

---

### 4.11 Workflow Builder

Birimler arası iş akışlarının görsel tasarım aracı.

**Yapabilecekleri:**
- Yeni iş akışı oluşturma (ad, açıklama)
- Adım ekleme: hangi birim → sıra → tip (`AUTO/MANUAL`) → sonraki adım
- Mevcut workflow'u düzenleme (adımlar transactional olarak sıfırlanıp yeniden oluşturulur)
- **Simülasyon Modu:** Bir workflow'un adım adım nasıl işlediğini otomatik veya manuel adımlarla görselleştirme (5 saniyelik otomatik ilerleme ile play/pause)
- Aktif workflow seçimi ve anlık önizleme

---

### 4.12 Ayarlar Modülü (SettingsModule)

Platform yönetim merkezi. 6 alt sekme:

**Şirket Ayarları:**
- Şirket logo yükleme
- Multi-tenant: aktif kiracı seçimi ve yönetimi

**Birim Yönetimi:**
- Organizasyon birimi oluşturma/silme
- Silme işleminde `TRANSFER_REQUIRED` koruması: birimde kullanıcı varsa önce transfer gerekir

**Kullanıcı Yönetimi:**
- Kullanıcı oluşturma/düzenleme/silme
- Rol ve birim atama
- İzin (permission) listesi güncelleme

**İzin Yönetimi (PermissionSettings):**
- Kullanıcı bazlı granüler izin kontrolü
- Her izin kodu için toggle (açık/kapalı)
- Değişiklikler anlık olarak kullanıcının arayüzüne yansır (PermissionGate)

**Abonelik Ayarları:**
- Aktif plan görüntüleme (STARTER / PROFESSIONAL / ENTERPRISE)
- Kullanım metrikleri (count, birim maliyet, toplam maliyet)
- Plan yükseltme

**Entegrasyon Sihirbazı (IntegrationWizard):**
- WhatsApp Business API yapılandırması (Phone Number ID, Access Token, Webhook)
- Microsoft Exchange yapılandırması (sunucu, domain, e-posta, şifre, takvim sync)
- Nextcloud DMS yapılandırması (URL, admin kullanıcı, app password, base path)

---

### 4.13 Abonelik Modülü (SubscriptionModule)

Ürünün kendi lisans yönetim sayfası.

**Lisans Modelleri:**

| Model | Açıklama | Fiyat |
|---|---|---|
| **KOBİ (SaaS)** | Bulut tabanlı, 5 kullanıcı, 10GB | $49/ay |
| **PAY AS YOU GO** | Kullanım bazlı ücretlendirme, 15 kullanıcı, 50GB | $0.15/API çağrısı |
| **ON-PREMISE** | Şirket içi kurulum, sınırsız kullanıcı, 1TB | Tek seferlik |

**Yapabilecekleri:**
- Plan seçimi ve aktivasyon
- Aktif lisans bilgisi (süre, kullanıcı limiti, depolama limiti)
- Lisans anahtarı görüntüleme ve kopyalama
- Lisans iptali

---

### 4.14 Lisans Üretici Modülü (LicenseGeneratorModule)

Enflow'u başkalarına lisanslayan operator'lar için araç.

**Yapabilecekleri:**
- Şirket bazlı lisans anahtarı üretme
- Model seçimi: `KOBI / PAY_AS_YOU_GO / ON_PREMISE`
- Geçerlilik süresi (ay bazlı veya 30 günlük deneme)
- Kullanıcı ve depolama limiti belirleme
- JSON formatında imzalanmış lisans verisi oluşturma
- Kopyalama ve `.json` indirme

---

### 4.15 Maliyet Analizi (CostAnalysisModule)

Bağımsız veya Presales içine gömülü çalışan maliyet hesaplama.

**Yapabilecekleri:**
- Kategori bazlı (iş gücü, lojistik, seyahat, outsourcing, diğer) maliyet kalemi yönetimi
- Toplam maliyet hesaplama
- BoM toplam satış fiyatı ile karşılaştırmalı marj analizi

---

### 4.16 Müzakere Modülü (NegotiationModule)

Teklifin müşteri ile müzakere sürecinin yönetimi.

**Yapabilecekleri:**
- Teklifi müzakereye açma (`openForNegotiation` flag)
- Müzakere notları ve versiyon takibi
- Fırsatı `NEGOTIATION` statüsüne taşıma

---

### 4.17 Final Teklif Üretici (FinalProposalGenerator)

PDF teklif belgesi oluşturma bileşeni.

**Yapabilecekleri:**
- Teklif içeriğini formatlı PDF olarak render etme
- Şirket logosu, BoM tablosu, maliyet özeti dahil
- Türkçe karakter desteği (trToEn normalizasyon fonksiyonu)
- Base64 ArrayBuffer → PDF dönüşümü
- Onay zinciri (ApprovalChain) aşamaları görüntüleme

---

## 5. İş Akışı Motoru

Enflow'un temel gücü. Birimler arası tüm iş geçişleri bu motor üzerinden geçer.

### Akış Mimarisi

```
[Presales] → BoM tamamlandı → Onaya gönder
                    ↓
[Yönetim] → TodoTask oluşturulur + WhatsApp/E-posta bildirimi
                    ↓
[Yönetim] → Onayla/Reddet
                    ↓ (Onay)
[Satış] → Teklif hazırla → PDF çıktısı → Müşteriye sun
                    ↓ (WON)
[Satış Destek] → Evrak hazırlığı (strict validation)
                    ↓ (Tüm evraklar tamamlandı)
[Sözleşme] → İmzala
                    ↓ (Paralel tetikleme)
         ┌──────────┴──────────┐
[Proje Yönetimi]       [Satın Alma]
 Proje başlatma        BoM tedariki
```

### WorkflowLog Kaydı

Her hand-off işleminde `WorkflowLog` tablosuna kayıt düşülür:
- `fromUnitId` / `toUnitId`
- `assignedBy` / `assignedTo`
- `note`
- `status`: `PENDING → COMPLETED / APPROVED / CANCELLED`

### WorkflowService API

```typescript
triggerHandOff(fromUser, toUser, item, note, type)
  → WhatsApp bildirimi (toUser.phone)
  → Exchange e-posta (toUser.email)
  → WorkflowLog kaydı

requestApproval(opportunityId)
  → technicalStatus: 'WAITING_APPROVAL'
  → Yönetim birimine TodoTask oluşturma
  → WorkflowLog kaydı (PENDING)

approveOpportunity(opportunityId)
  → technicalStatus: 'APPROVED'
  → status: 'PROPOSAL'
  → WorkflowLog güncelleme (APPROVED)
```

---

## 6. Bildirim Katmanı

Her kritik iş akışı adımında üç kanaldan bildirim gider:

### 6.1 WhatsApp (Meta Cloud API)

```typescript
whatsappService.sendMessage(phoneNumber, message)
// POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
// Bearer {accessToken}
```

Tetiklendiği durumlar: Hand-Off, onay talebi, kritik görev ataması.

### 6.2 Microsoft Exchange (E-Posta)

```typescript
exchangeService.sendEmail(to, subject, body)
// EWS veya Graph API üzerinden kurumsal e-posta
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

### PermissionGate Bileşeni

```tsx
<PermissionGate permission="PROPOSAL_CREATE">
  <CreateProposalButton />
</PermissionGate>
```

- `hasPermission(code)` → AuthContext'ten kullanıcının `permissions` dizisini kontrol eder
- İzin yoksa bileşen render edilmez (veya `showIfNoPermission: true` ile disabled render)
- Admin panelinden bir izin kaldırıldığında, ilgili buton/sayfa **anlık** olarak kaybolur

### İzin Kodları (örnekler)

```
DASHBOARD_VIEW
OPPORTUNITY_CREATE / OPPORTUNITY_EDIT
PROPOSAL_CREATE / PROPOSAL_APPROVE
BOM_EDIT
CONTRACT_SIGN
TASK_ASSIGN
SETTINGS_MANAGE
USER_MANAGE
WORKFLOW_CONFIGURE
```

### Kullanıcı Rolleri

Roller esnek string alanı — `ADMIN`, `MANAGER`, `SALES`, `PRESALES`, `PM`, `PROCUREMENT` gibi tanımlanabilir. İzinler rol bazlı değil kullanıcı bazlı atanır (granüler kontrol).

---

## 8. Multi-Tenancy

Her API isteğinde `x-tenant-id` header zorunludur.

```
GET /api/opportunities
Headers: x-tenant-id: tenant-abc-123
```

### Tenant Middleware (backend/src/middleware.ts)

```typescript
const tenantMiddleware = asyncHandler(async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  // Header yoksa → 400
  // Tenant bulunamazsa → 404
  req.tenantId = tenantId; // Express.Request augmentation
  next();
});
```

### Veri İzolasyonu

Her Prisma sorgusunda `where: { tenantId: req.tenantId }` filtresi uygulanır. Bir şirket başka şirketin verisini hiçbir şekilde göremez.

### Tenant Yaşam Döngüsü

```
POST /api/tenants → Tenant + Subscription (STARTER) transaction'da oluşturulur
GET  /api/tenants → Tüm tenant'lar (admin görünümü)
PUT  /api/tenants/:id → İsim güncelleme
PUT  /api/tenants/:id/subscription → Plan güncelleme
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
| On-Premise Kurulum | ❌ | ❌ | ✅ |
| SLA | — | %99.5 | %99.9 |

### Lisans Anahtarı Yapısı

```json
{
  "companyName": "Örnek A.Ş.",
  "model": "KOBI",
  "expiryDate": "2027-06-09T...",
  "issuedAt": "2026-06-09T...",
  "isTrial": false,
  "limits": { "users": 5, "storage": 10 },
  "signature": "base64-imza"
}
```

`LicenseGeneratorModule` bu yapıyı üretir ve `.json` olarak indirmeye sunar.

---

## 10. Entegrasyonlar

### 10.1 Nextcloud DMS

- Kurumsal dokümanları Nextcloud'a WebDAV/API üzerinden push
- Yapılandırma: URL, adminUser, appPassword, basePath
- `nextcloudService.ts` — isEnabled kontrolü ile korumalı

### 10.2 Microsoft Exchange

- Exchange Web Services (EWS) veya Graph API
- E-posta gönderme, takvim senkronizasyonu
- Yapılandırma: serverUrl, domain, adminEmail, adminPass, syncCalendar
- `exchangeService.ts`

### 10.3 WhatsApp Business Cloud API

- Meta Graph API v18.0 üzerinden mesaj gönderme
- Yapılandırma: phoneNumberId, accessToken, businessAccountId, webhookVerifyToken
- `whatsappService.ts`

### 10.4 Google Gemini AI

- PDF/Word şartname analizi (`SpecAnalysis.tsx`)
- `@google/genai` SDK
- Yanıt tipi: `{ title, summary, specDetails, extractedProducts[] }`

---

## 11. Backend API

Tüm endpoint'ler `/api/` prefix'li. Tenant gerektiren route'larda `x-tenant-id` header zorunlu.

### Kaynaklar ve Endpoint'ler

| Kaynak | Route | Metotlar |
|---|---|---|
| Health | `/api/health` | GET |
| Auth | `/api/auth` | POST /login, POST /forgot-password |
| Tenants | `/api/tenants` | GET, POST, PUT /:id, PUT /:id/subscription |
| Subscription | `/api/subscription` | GET |
| Usage | `/api/usage` | GET |
| Units | `/api/units` | GET, POST, DELETE /:id |
| Users | `/api/users` | GET, POST, PUT /:id, DELETE /:id |
| Customers | `/api/customers` | GET, POST, PUT /:id, DELETE /:id |
| Opportunities | `/api/opportunities` | GET, POST, PUT /:id |
| BoM | `/api/opportunities/:id/bom` | POST |
| Costs | `/api/opportunities/:id/costs` | POST |
| Approval | `/api/opportunities/:id/request-approval` | POST |
| Approve | `/api/opportunities/:id/approve` | POST |
| Revert | `/api/opportunities/:id/revert-approval` | POST |
| Sync | `/api/sync` | POST |
| Projects | `/api/projects` | GET, POST, PUT /:id, DELETE /:id |
| Tasks | `/api/tasks` | GET, POST, PUT /:id, DELETE /:id |
| Contracts | `/api/contracts` | GET, POST, PUT /:id, DELETE /:id |
| Archive | `/api/archive` | GET, POST, PUT /:id, DELETE /:id |
| Notifications | `/api/notifications` | GET, POST, PUT /:id, DELETE /:id |
| Documents | `/api/documents` | GET, POST, PUT /:id, DELETE /:id |
| Proposals | `/api/proposals` | GET, POST, PUT /:id, DELETE /:id |
| Workflows | `/api/workflows` | GET, POST, PUT /:id |
| Logs | `/api/logs/notifications` | GET, POST |

### Retry Mekanizması (withRetry)

SQLite lock hatalarında (`P2028`, `P2034`, `database is locked`) otomatik retry:
- 3 deneme, exponential backoff (500ms → 1s → 2s)
- `withRetry(fn, retries, delay)` — `backend/src/middleware.ts`

---

## 12. Frontend Mimari

### Klasör Yapısı

```
src/
├── App.tsx                — Root, global state, route logic
├── types.ts               — Tüm TypeScript interface'leri (tek kaynak)
├── constants/             — Mock data, simulation adımları, sabitler
├── contexts/
│   ├── AuthContext.tsx    — Kullanıcı auth, hasPermission(), currentUser
│   ├── ThemeContext.tsx   — Aydınlık/karanlık tema
│   └── UnsavedChangesContext.tsx — Kaydetmeden çıkış koruması
├── hooks/
│   ├── useEnflowQueries.ts — TanStack Query wrapper'ları (useOpportunities, useCustomers...)
│   ├── useBoM.ts          — BoM state yönetimi
│   └── useShared.ts       — useSearch, useForm
├── layout/
│   ├── Sidebar.tsx        — Sol navigasyon
│   ├── Header.tsx         — Bildirim ikonu, kullanıcı profili
│   └── MobileNav.tsx      — Mobil bottom navigation
├── modules/               — 21 modül (bkz. Bölüm 4)
├── components/
│   ├── PermissionGate.tsx — RBAC render guard
│   ├── SaveButton.tsx     — Global kaydet butonu (UnsavedChanges entegreli)
│   ├── HandOffModal.tsx   — İş devri modal
│   ├── FinalProposalGenerator.tsx — PDF teklif üretici
│   ├── TaskProgressTracker.tsx    — Görev ilerleme takip
│   ├── WorkflowSimulation.tsx     — Workflow simülatörü
│   └── settings/          — Ayarlar alt bileşenleri
├── services/
│   ├── apiClient.ts       — HTTP client (tenant header otomatik)
│   ├── apiService.ts      — Façade (tüm servisler burada birleşir)
│   ├── crmService.ts      — Müşteri ve fırsat API'ları
│   ├── workflowService.ts — Hand-off + bildirim tetikleme
│   ├── whatsappService.ts — WhatsApp Cloud API
│   ├── exchangeService.ts — Exchange e-posta
│   └── nextcloudService.ts — Nextcloud DMS
└── utils/
    ├── logger.ts          — import.meta.env.DEV gate'li logger
    └── bomParser.ts       — Excel → ParsedBoMItem[] dönüşümü
```

### Global State Stratejisi

- **Server State:** TanStack React Query (cache, refetch, stale-time)
- **UI State:** Component-level `useState`
- **Cross-cutting State:** Context API (Auth, Theme, UnsavedChanges)
- **Gerçek zamanlı:** React Query polling + manuel invalidation

### UnsavedChanges Koruması

`UnsavedChangesContext` — kullanıcı kaydedilmemiş değişiklik varken modülü terk etmeye çalışırsa uyarı gösterir.

```tsx
const { setHasUnsavedChanges } = useUnsavedChanges();
// Form değiştiğinde:
setHasUnsavedChanges(true);
// Kaydedildiğinde:
setHasUnsavedChanges(false);
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
npx prisma db push   # İlk kurulum — SQLite oluşturur
```

### Geliştirme

```bash
# Terminal 1 — Backend (Port 3002)
cd backend
pnpm dev

# Terminal 2 — Frontend (Port 3000)
pnpm dev
```

### Ortam Değişkenleri

**backend/.env:**
```env
DATABASE_URL="file:./dev.db"
NODE_ENV=development
```

**Frontend:** Vite proxy yapılandırması `vite.config.ts`'de — `/api` istekleri `localhost:3002`'ye yönlendirilir.

### Production Build

```bash
# Frontend
pnpm build   # dist/ klasörüne çıkarır

# Backend
cd backend
npx tsc      # dist/ klasörüne derler
node dist/index.js
```

### Veritabanı Yönetimi

```bash
cd backend

# Prisma Studio (görsel DB editörü)
npx prisma studio

# Schema değişikliklerini uygula
npx prisma db push

# Migration oluştur (production)
npx prisma migrate dev --name <migration-name>
```

---

## Teknik Standartlar (v1.6.3+)

- **TypeScript:** Strict mode, sıfır `any`, `Omit<T,'id'>` create, `Partial<T>` update
- **Logging:** `import.meta.env.DEV` korumalı logger — production build'de `debug/info/warn` susturulur, `error` her zaman loglanır
- **Backend:** Resource-per-file router pattern — `backend/src/routes/`
- **Hata Yakalama:** `catch (err)` → `err instanceof Error ? err.message : 'fallback'`
- **Tenant Güvenliği:** Her DB sorgusunda `tenantId` filtresi zorunlu
- **Transaction:** Tutarlılık gerektiren çok adımlı işlemler `prisma.$transaction` ile

---

*Bu doküman Enflow v1.6.3 mimarisini ve yeteneklerini kapsamlı biçimde açıklar. Son güncelleme: 09.06.2026.*
