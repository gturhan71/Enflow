# Enflow — Kapsamlı Kullanım Kılavuzu

> **Sürüm:** 2026-06-18  
> **Hedef Kitle:** Uygulama yöneticileri, proje sahibi, yeni kullanıcılar

---

## İçindekiler

1. [Platforma Genel Bakış](#1-platforma-genel-bakış)
2. [Rol & Yetki Sistemi](#2-rol--yetki-sistemi)
3. [Uçtan Uca İş Akışı](#3-uçtan-uca-iş-akışı)
4. [Giriş & Kimlik Doğrulama](#4-giriş--kimlik-doğrulama)
5. [Dashboard](#5-dashboard)
6. [CRM & Müşteri Modülü](#6-crm--müşteri-modülü)
7. [Presales & Dizayn Modülü](#7-presales--dizayn-modülü)
8. [Müzakere Modülü](#8-müzakere-modülü)
9. [Sözleşme Yönetimi](#9-sözleşme-yönetimi)
10. [Satın Alma Modülü](#10-satın-alma-modülü)
11. [Proje Yönetimi Modülü](#11-proje-yönetimi-modülü)
12. [Görevler & Takip](#12-görevler--takip)
13. [Satış Destek](#13-satış-destek)
14. [Şirket Evrakları](#14-şirket-evrakları)
15. [Fiziksel Arşiv](#15-fiziksel-arşiv)
16. [Şirket Ayarları](#16-şirket-ayarları)
17. [Teknik Referans](#17-teknik-referans)
18. [Ziyaret Planı & Günlük Rapor](#18-ziyaret-planı--günlük-rapor)
19. [Proje Devir Paketi](#19-proje-devir-paketi)
20. [Genel Hususlar & Doküman Kodlama](#20-genel-hususlar--doküman-kodlama)
21. [Finans Modülü](#21-finans-modülü)
22. [Hukuk Görünümü](#22-hukuk-görünümü)
23. [İhale / İSAB Modülü](#23-ihale--isab-modülü)
24. [Yönetim Raporları](#24-yönetim-raporları)
25. [Onay Zinciri & Bekleyen Onaylarım](#25-onay-zinciri--bekleyen-onaylarım)
26. [Sanal Agentlar (Eklenti)](#26-sanal-agentlar-eklenti)

---

## 1. Platforma Genel Bakış

Enflow, B2B teknoloji şirketleri için tasarlanmış **çok kiracılı (multi-tenant) SaaS** bir iş süreçleri platformudur. Satış fırsatının CRM'e girişinden başlayarak teklif hazırlama, müzakere, sözleşme imzalama, satın alma ve proje teslimatına — hatta tahsilata kadar — tüm iş döngüsünü tek bir arayüzde yönetir.

### Temel Değer Önerileri

| Sorun | Enflow Çözümü |
|-------|---------------|
| Fırsatlar Excel'de takip ediliyor | CRM pipeline + durum makinesi |
| BoM & maliyet hesabı elle yapılıyor | Otomatik margin & döviz hesaplama |
| Sözleşme evrakları e-postada kayboluyor | Evrak takip + AI analizi + onay akışı |
| Proje karlılığı proje bitiminde anlaşılıyor | Gerçek zamanlı planlanan / gerçekleşen marj |
| Satın alma süreci izlenemiyor | 9 statülü tam tedarik döngüsü |
| Modüller arası veri tekrarı | Fırsat → Teklif → Sözleşme → Proje otomatik veri aktarımı |

### Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + TypeScript (strict), Vite, TanStack Query v5 |
| UI | Tailwind CSS, glassmorphism (`glass-card`, `input-glass`, `btn-primary`, `btn-secondary`), `motion/react` animasyonları |
| Backend | Express.js v5, TypeScript, Prisma ORM |
| Veritabanı | SQLite (geliştirme), Prisma migrations ile şema yönetimi |
| YZ | İstenilen YZ — tenant-yapılandırmalı, sağlayıcıdan bağımsız (OpenAI-uyumlu uç; Ayarlar→Entegrasyonlar). Sözleşme analizi + görev üretimi; yoksa mock fallback |

---

## 2. Rol & Yetki Sistemi

### Tanımlı Roller

| Rol Kodu | Görünen Ad | Temel Erişim Alanı |
|----------|-----------|-------------------|
| `GENERAL_MANAGER` | Genel Müdür | Tüm modüller + GM-only raporlar, lisans üretimi |
| `SALES_MGR` | Satış Müdürü | CRM, Teklifler, Müzakere |
| `SALES_REP` | Satış Temsilcisi | CRM, Fırsatlar |
| `SALES_SUPPORT` | Satış Destek | İhale dosyaları, Satış Destek modülü |
| `PRESALES_MGR` | Presales Müdürü | BoM, Maliyet Analizi, Tasarım |
| `PRESALES_ENG` | Presales Mühendisi | BoM, Şartname Analizi |
| `PROJECT_MGR` | Proje Yöneticisi | Proje Yönetimi, Görevler |
| `PROCUREMENT_MGR` | Satın Alma Müdürü | Satın Alma modülü tamamı |
| `FINANCE_MGR` | Finans Müdürü | Maliyetler, Fatura, Karlılık |
| `OPERATIONS_MGR` | Operasyon Müdürü | Proje, Satın Alma, Görevler |
| `AUDITOR` | Denetçi | Salt okunur erişim |
| `ADMIN` | Sistem Yöneticisi | Tüm ayarlar |
| `LEGAL_MGR` | Hukuk Müdürü / Şirket Avukatı | Hukuk görünümü, vaka takibi |
| `IGPD_MGR` | İş Geliştirme & Pazarlama Müdürü | Onay zinciri aşaması |
| `KGD_MGR` | Kalite Güvence Müdürü | Onay zinciri aşaması |
| `KSU_MGR` | Kontrat & Sözleşme Müdürü | Onay zinciri aşaması |
| `ISAB_MGR` | İhale Satın Alma Müdürü | İhale/İSAB modülü |

> **Kurumsal onay swimlane rolleri** (FINANCE_MGR, İGPD, KGD, KSU, İSAB) `ApprovalChain` onay aşamalarında kullanılır. Her birim yöneticisi "Bekleyen Onaylarım" sekmesinde kendi sırası gelmiş onayları görür (bkz. § 25). İzinler kullanıcının `permissions` JSON'undan verilir; GM tüm modülleri görür (superuser).

### İzin Kodları

Roller rol bazında erişimi belirler; granüler izin kodları ise buton/sayfa bazında ince ayar sağlar.

```
DASHBOARD_VIEW      → Dashboard'u görebilir
CRM_VIEW            → CRM modülüne erişebilir
CRM_OPPS_VIEW       → Fırsatları görebilir
CRM_PROPOSALS_VIEW  → Teklifleri görebilir
CRM_CUSTOMERS_VIEW  → Müşterileri görebilir
PRESALES_VIEW       → BoM & Şartname erişimi
PRESALES_EDIT       → BoM düzenleyebilir
COST_VIEW           → Alış maliyetlerini görebilir
COST_ANALYSIS_VIEW  → Maliyet analizini görebilir
OFFER_APPROVE       → Teklifleri onaylayabilir
CONTRACTS_VIEW      → Sözleşme modülüne erişim
PROCUREMENT_VIEW    → Satın alma modülü erişimi
PROJECT_MGMT_VIEW   → Proje yönetimi erişimi
TODO_VIEW           → Görevler modülü
DOCUMENTS_VIEW      → Kurumsal evraklar
ARCHIVE_VIEW        → Fiziksel arşiv
SALES_SUPPORT_VIEW  → İhale destek
SETTINGS_VIEW       → Temel ayarlar
SETTINGS_COMPANY    → Şirket profili düzenleme
SETTINGS_UNITS      → Birim yönetimi
SETTINGS_USERS      → Kullanıcı yönetimi
SETTINGS_PERMISSIONS→ İzin yönetimi
SETTINGS_INTEGRATIONS→ Entegrasyon ayarları
FINANCE_VIEW        → Finans modülü erişimi
CORPORATE_GOV_VIEW  → Genel Hususlar (kurumsal yönetim) erişimi
MANAGEMENT_REPORTS_VIEW → Yönetim Raporları erişimi
GENERAL_MANAGER     → GM-only özellikler (lisans üretme, modül tanıtım, sanal agent, gelen raporlar)
```

Roller ve izinler **Ayarlar → Kullanıcılar** ve **Ayarlar → Yetkiler** sekmelerinden yönetilir.

---

## 3. Uçtan Uca İş Akışı

Enflow'daki bir projenin tam yaşam döngüsü:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TAM İŞ AKIŞI                                   │
└─────────────────────────────────────────────────────────────────────────┘

[1] CRM — Müşteri & Fırsat Girişi
     Müşteri kaydı → Fırsat oluştur → Statü: NEW
         ↓
[2] CRM — Pipeline İlerlemesi
     NEW → CONTACTED → QUALIFIED → PROPOSAL
         ↓
[3] Presales — BoM & Tasarım
     Malzeme listesi (Excel / Manuel) → Şartname analizi (AI)
         ↓
[4] Presales — Maliyet Analizi
     Döviz & kur → İşçilik / lojistik / seyahat giderleri → Margin hesabı
         ↓
[5] CRM — Teklif Oluşturma & Onayı
     Teklif hazırla (DRAFT) → Yöneticiye gönder (PENDING_APPROVAL)
     → Onay (APPROVED) → Müşteriye gönder (SENT)
         ↓
[6] Müzakere
     Canlı pazarlık (AI simülasyonu) veya Açık eksiltme
     → Fiyat mutabakatı → Statü: NEGOTIATION
         ↓
[7] CRM — Kazanıldı / Kaybedildi
     Kazanıldı (WON) → Sözleşme Yönetimine otomatik yönlendir
     Kaybedildi (LOST) → Pipeline'dan çıkar
         ↓
[8] Sözleşme Yönetimi
     Sözleşme metni + şartname yükle
     → AI analizi (evrak listesi, risk maddeleri, yapılacaklar)
     → Evrak hazırlık (teminat, SGK yazısı, vb.)
     → İmzalama onayı → SIGNED
     → Proje Yönetimine devret (TodoTask olarak) → TRANSFERRED
         ↓
[9] Satın Alma  (paralel çalışır)
     Satın alma talebi → Tedarikçi teklifleri → PO → Teslimat → Fatura
         ↓
[10] Proje Yönetimi
     WON fırsat → Proje aç → Milestone takibi
     (Satınalma → Kurulum → Test → Kabul → Garanti → Faturalama)
     → Maliyet kaydı → Karlılık analizi → Tahsilat → COMPLETED
         ↓
[11] Görevler (tüm modüllere yatay)
     Her aşamada oluşan görevler birim bazında takip edilir
     Teklif onayları bu modül üzerinden işlenir
```

---

## 4. Giriş & Kimlik Doğrulama

### Giriş Ekranı

- URL: `http://localhost:5173`
- E-posta tabanlı giriş
- **Test hesabı:** `gokhan@t-ecosystem.com` / `123456`
- **Tenant:** `tenant-1` (TechCorp A.Ş.) · Rol: `GENERAL_MANAGER`

### Çok Kiracılı Yapı

Her kullanıcı yalnızca kendi tenant'ının verilerini görür. Prisma'da tüm sorgular `tenantId` ile filtrelidir. `x-tenant-id` HTTP header'ı her API isteğine eklenir.

### Oturum Yönetimi

- JWT token `apiClient`'ta `Bearer` header ile taşınır
- `AuthContext` → `useAuth()` hook'u: `currentUser`, `setAuth(token, tenantId)`
- Token süresi dolunca `/login`'e yönlendirilir

---

## 5. Dashboard

### Erişim

Sol kenar çubuğundan **Dashboard** sekmesi. `GENERAL_MANAGER` rolü ek performans sekmeleri görür.

### KPI Kartları

| Kart | Gösterdiği |
|------|-----------|
| Pipeline Değeri | WON/LOST dışındaki tüm aktif fırsatların toplam değeri |
| Kazanılan Değer | WON fırsatların değeri |
| Aktif Projeler | `IN_PROGRESS` + `PLANNING` statüsündeki proje sayısı |
| Kaybedilen Değer | LOST fırsatların değeri (GM'e gösterilir) |

### Satış Boru Hattı Grafiği

Fırsatlar statüye göre yatay bar grafiğinde. Her dilim ilgili fırsatların toplam değeriyle orantılıdır.

### Aktif Projeler Listesi

Proje adı, müşteri, ilerleme %, bitiş tarihi. Karta tıklamak Proje Yönetimi modülüne yönlendirir.

### Canlı Operasyon Gelişmeleri

Son güncellenen görevler, teklifler ve sözleşmeler akış görünümünde.

### GM-Only: Performans Sekmeleri

- **Kazanma Oranı:** WON / (WON + LOST) — dönem bazında
- **Birim Performansı:** Birim başına fırsat değeri ve tamamlanan görev sayısı

---

## 6. CRM & Müşteri Modülü

### Alt Sekmeler

```
CRM & Müşteri
 ├── Genel Bakış        (crm-dashboard)
 ├── Fırsatlar          (crm-opportunities)
 ├── Teklifler          (crm-proposals)
 ├── Müşteriler         (crm-customers)
 └── Canlı Pazarlıklar  (crm-negotiation)
```

---

### 6.1 Genel Bakış (CRM Dashboard)

CRM modülünün giriş ekranı — metrik kartlar ve alt modüllere hızlı erişim.

**Metrik Kartları:**
- Aktif Müşteri Sayısı
- Pipeline Değeri (WON hariç aktif fırsatlar)
- Kazanılan Değer
- Kazanma Oranı (%)

**Modül Kartları:** Her karta tıklamak ilgili alt sekmeye yönlendirir.

**Pipeline Dağılım Barları:** Her statünün fırsat sayısı ve değeri animasyonlu bar ile gösterilir.

**Son 5 Fırsat:** Güncel fırsatların özeti, üstüne tıklayınca Fırsatlar sekmesine geçilir.

---

### 6.2 Fırsatlar

#### Fırsat Durum Makinesi

```
NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON
                                                      → LOST
```

#### Fırsat Oluşturma

1. **Yeni Fırsat** butonuna tıkla
2. Başlık, değer, müşteri, atanan kişi, beklenen kapanma tarihi, olasılık % gir
3. **Kaydet** → Statü `NEW` olarak oluşur

#### Pipeline Görünümü

Fırsatlar statülerine göre gruplandırılmış kartlarda. Her kartta:
- Müşteri adı ve fırsat başlığı
- Para birimi değeri + olasılık yüzdesi
- Atanan kişi

#### WON / LOST İşaretleme

**Teklif üzerinden (tercih edilen yol):**
- "Yollanan Teklifler" listesinde → **Kazanıldı** veya **Kaybedildi** butonu
- Kazanıldı: Fırsat `WON`, teklif `ACCEPTED` → **Sözleşme Yönetimine otomatik yönlendir**
- Kaybedildi: Fırsat `LOST`, teklif `REJECTED` → Pipeline'dan çıkar

**Fırsat üzerinden (teklif olmadan):**
- "Bekleyen Teklifler" listesindeki fırsat kartında → **Kazanıldı** veya **Kaybedildi** butonu

---

### 6.3 Müşteriler

#### Kayıt Alanları

| Alan | Açıklama |
|------|----------|
| Firma Adı | Zorunlu |
| Kısa Ad | Raporlarda kullanılır |
| Sektör | Finance, Logistics, Manufacturing, vb. |
| Vergi No / Dairesi | Fatura bilgileri |
| Ticaret Sicil No | Sözleşme belgeleri için |
| Risk Skoru | 0-100 → renk kodlu (yeşil/sarı/kırmızı) |
| Kredi Limiti | Para birimi ile |
| Teknoloji Altyapısı | Hangi ürünler kullanıyor |
| Sosyal Medya | LinkedIn, vb. |

#### Excel İçe Aktarma

**Müşteri Listesi → İçe Aktar:**
1. CSV / Excel dosyası sürükle-bırak veya seç
2. Sütunları eşleştir
3. Önizle → İçe Aktar

#### Müşteri Metrikleri

Her müşteri kartında: fırsat sayısı, kazanılan değer, kaybedilen değer, kazanma oranı %.

---

### 6.4 Teklifler

#### Teklif Durum Sıralaması

```
DRAFT (0) → PENDING_APPROVAL (1) → APPROVED (2) → SENT (3) → ACCEPTED (4)
                                 → REJECTED (-1)
```

Bir fırsatta birden fazla versiyon olabilir. `bestProposalPrice()` en yüksek ranklı + en yüksek versiyonlu teklifin fiyatını döner.

#### Teklif Oluşturma

1. Fırsatı seç → **Teklif Oluştur**
2. ProposalEditor: BoM kalemlerini teklif satırlarına ekle, şartlar gir
3. **Taslak Kaydet** (DRAFT)
4. **Onaya Gönder** → `PENDING_APPROVAL`; yöneticiye TodoTask oluşur
5. Yönetici onayı → `APPROVED` → **Müşteriye Gönder** → `SENT`
6. Müşteri kabulü → **Kazanıldı** → `ACCEPTED`

---

### 6.5 Canlı Pazarlıklar

Müzakere modülüne doğrudan erişim sağlar. → Bkz. [Bölüm 8](#8-müzakere-modülü).

---

## 7. Presales & Dizayn Modülü

### Alt Sekmeler

```
Presales & Dizayn
 ├── BoM & Tasarım    (presales-bom)
 └── Maliyet Analizi  (presales-cost)
```

---

### 7.1 BoM & Tasarım

**BoM (Bill of Materials):** Bir fırsat için teknik malzeme listesi hazırlanır.

#### Fırsat Seçimi

Modül açılışında fırsat dropdown'u görünür. Kaydedilmemiş değişiklik varken fırsat değiştirilmek istenirse uyarı çıkar.

#### BoM Kalemi Ekleme

**Manuel:**
1. **Kalem Ekle** butonu
2. Part Number, açıklama, adet, alış maliyeti, marj % gir
3. Satış fiyatı ve toplam otomatik hesaplanır

**Excel / CSV:**
1. **Excel'den Yükle** butonu
2. Dosya seç; uygulama sütunları eşleştirir
3. `MATCHED` / `PENDING_MATCH` durumu gösterilir

#### Şartname Analizi (AI)

**Şartname Analizi sekmesi → İdari / teknik şartname metni yapıştır → Analiz Et:**
- Yapılandırılan YZ (istenilen sağlayıcı) gereksinimleri çıkarır
- Çıkarılan ürün listesi BoM'a ekleme için sunulur

#### Yöneticiye Gönderme

**Onaya Gönder:**
1. BoM özeti (toplam malzeme, genel toplam) önizlenir
2. Yönetici + onay notu seçilir
3. Gönder → `PENDING_APPROVAL`, yöneticiye TodoTask oluşur

---

### 7.2 Maliyet Analizi

BoM malzeme maliyetlerinin üzerine operasyonel giderler eklenerek gerçek maliyet ve kar marjı hesaplanır.

#### Döviz & Kur Ayarları

Sağ üst köşedeki kur tablosu:
- Baz para birimi: TRY / USD / EUR
- USD/TRY ve EUR/TRY kurları — manuel veya otomatik çek
- Tüm hesaplamalar anlık güncellenir

#### Maliyet Kategorileri

| Kategori | Örnekler |
|----------|---------|
| İşçilik | Kurulum, konfigürasyon, proje yönetimi |
| Lojistik | Nakliye, depolama, sigorta |
| Seyahat | Uçak, otel, araç kiralama |
| Dış Kaynak | Danışmanlık, alt yüklenici |

#### Marj Modu

| Mod | Davranış |
|-----|---------|
| `PER_ITEM` | Her BoM kaleminin kendi marj % kullanılır |
| `PROJECT_WIDE` | Tüm projeye tek global marj % uygulanır |

#### Finansal Özet (Sticky Panel)

- Toplam Malzeme Bedeli (TRY)
- Toplam Operasyonel Gider
- Genel Maliyet
- Toplam Satış Bedeli
- **Brüt Kar** ve **Kar Marjı (%)**

---

## 8. Müzakere Modülü

### İki Yöntem

```
Müzakere Modülü
 ├── Canlı Pazarlık   (1v1 AI simülasyonu)
 └── Açık Eksiltme    (rekabetçi tur bazlı fiyatlama)
```

---

### 8.1 Canlı Pazarlık

AI destekli müşteri simülasyonu ile birebir fiyat müzakeresi.

#### Durum Makinesi

```
IDLE → INTRO → NEGOTIATING → AGREED
                            → FAILED
```

#### Kullanım

1. Müzakere edilecek teklifi seç (APPROVED / SENT)
2. **Pazarlığı Başlat** → AI müşteri rolünü üstlenir (INTRO mesajı)
3. Karşı teklif gönder: indirim oranı % belirle
   - **Dip marj koruması:** belirlenen minimum marjın altına inemezsin
4. AI müşteri yanıt verir: kabul / ret / karşı teklif
5. Mutabakat → `AGREED` → Fırsatı WON olarak tescil et

#### Marj Barı

Anlık marjı renk kodlu takip et:
- Yeşil → Güvenli bölge
- Sarı → Dikkat eşiği
- Kırmızı → Dip marjın altında (kabul edilemez)

---

### 8.2 Açık Eksiltme

Birden fazla rakip firmanın katıldığı tur bazlı fiyat eksiltmesi.

#### Durum Makinesi

```
IDLE → SETUP → BIDDING → FINISHED
```

#### Kullanım

1. **Açık Eksiltme Başlat** → `SETUP`
2. Rakip firmaları ekle: isim + başlangıç teklifi
3. Süre sınırı ve minimum adım % belirle
4. **Eksiltme Başlat** → `BIDDING`
5. Her turda firmalar tekliflerini günceller; kendi teklifini gir
6. Tur süreleri dolunca ya da firma sayısı 1'e düşünce → `FINISHED`
7. Kazanan belirlenir; Enflow'un teklifini güncelle

---

## 9. Sözleşme Yönetimi

### Durum Makinesi

```
DRAFT
  → ANALYSIS_DONE               (AI analizi tamamlandı)
  → PREPARATION                 (evrak hazırlık süreci)
  → READY_TO_SIGN               (tüm zorunlu evraklar tam — OTOMATİK geçiş)
  → PENDING_SIGNATURE_APPROVAL  (yöneticiye onaya gönderildi)
  → SIGNED                      (yönetici onayladı)
  → TRANSFERRED                 (görevler Proje Yönetimine aktarıldı — OTOMATİK)
```

**Otomatik Geçişler:**
- `isRequired: true` olan tüm evraklar `UPLOADED` / `VERIFIED` / `WAIVED` olduğunda → `READY_TO_SIGN`
- "Onayla & Aktar" butonunda → `SIGNED` + hemen `/transfer` çağrısı → `TRANSFERRED`

---

### 9.1 Yeni Sözleşme Oluşturma

1. **Yeni Sözleşme** → form aç
2. İhale adı, İKN numarası, sözleşme bedeli, para birimi, son tarih gir
3. Başlık otomatik oluşur: `"{İhale Adı} — İKN: {İKN No}"`
4. **Oluştur** → `DRAFT` statüsü

---

### 9.2 Sekme 1 — Bağlam

Sözleşmenin temel bilgileri:
- İhale adı, İKN numarası
- Sözleşme bedeli (para birimi ile)
- Teslim / imzalanma son tarihi
- İlgili fırsat bağlantısı (kazanılan tekliften otomatik değer aktarımı)

---

### 9.3 Sekme 2 — Analiz

**AI Destekli Sözleşme Analizi:**
1. Sözleşme metni ve idari şartname metnini yapıştır
2. **YZ ile Analiz Et** → tenant'ın yapılandırdığı YZ (istenilen sağlayıcı) çalışır

**Analiz Çıktısı:**
- **Önemli Maddeler:** Cezai şartlar, teslim süreleri, özel yükümlülükler
- **Risk Değerlendirmesi:** Yüksek / Orta / Düşük risk maddeleri
- **Evrak Listesi:** Gereken belgeler otomatik oluşturulur → Belge Takibi sekmesine aktarılır
- **Yapılacaklar:** Proje başlamadan tamamlanması gerekenler

---

### 9.4 Sekme 3 — Evrak Takibi

| Evrak Durumu | Görsel | Aksiyon |
|-------------|--------|---------|
| `PENDING` / `IN_PROGRESS` | Amber **Yükle** butonu | Dosya yükle |
| `UPLOADED` | Yeşil check + dosya linki | **Değiştir** butonu |
| `VERIFIED` | Yeşil "Onaylandı" badge | — |
| `WAIVED` | Gri "Muaf" badge | — |

**Dosya Yükleme:**
- Lokal: `backend/uploads/contracts/{folder}/{timestamp}_{dosya}`
- Nextcloud yapılandırılmışsa: WebDAV ile buluta da yüklenir

**Otomatik İlerleme:** Tüm zorunlu evraklar tamamlandığında statü → `READY_TO_SIGN`

---

### 9.5 Sekme 4 — İmzalama

4 adımlı onay akışı:

```
1. Hazırlık Tamamlandı (READY_TO_SIGN)
   ↓
2. Onaya Gönder → PENDING_SIGNATURE_APPROVAL
   (Birim yöneticisine TodoTask oluşturulur)
   ↓
3. Yönetici Onayı
   ↓
4. İmzalandı → SIGNED  (imzalanma tarihi manuel girilir)
```

---

### 9.6 Sekme 5 — Proje Aktarımı

**Onayla & Aktar** butonu:
1. `SIGNED` → hemen `TRANSFERRED`
2. AI analizinden çıkarılan yapılacaklar **TodoTask** olarak kaydedilir
3. Her görev: birim, öncelik, açıklama, `relatedModule: 'contract-workflow'` ile ilişkilendirilir

---

## 10. Satın Alma Modülü

### Durum Makinesi

```
DRAFT
  → PENDING_UNIT          (birim yöneticisi onayı)
  → PENDING_PROCUREMENT   (satın alma departmanı onayı)
  → PENDING_GM            (genel müdür onayı — yüksek bütçe)
  → PO_ISSUED             (Satın Alma Emri kesildi)
  → IN_DELIVERY           (teslimat sürecinde)
  → INVOICED              (fatura kesildi)
  → CLOSED                (süreç tamamlandı)
  → REJECTED              (herhangi bir aşamada reddedilebilir)
```

---

### 10.1 Satın Alma Talebi Oluşturma

1. **Yeni Talep** butonu
2. **Kaynak Tipi** seç:
   - `MANUAL` → Bağımsız talep
   - `BOM` → BoM'dan bağlantılı
   - `PROJECT` → Projeye bağlı
   - `UNIT` → Birim talebi
3. Başlık, açıklama, aciliyet, ihtiyaç tarihi, bütçe gir
4. **Kalem Satırları** ekle: ürün adı, miktar, birim, tahmini fiyat
5. **Kaydet** → `DRAFT`

**Aciliyet Seviyeleri:**

| Seviye | Renk | Açıklama |
|--------|------|----------|
| `LOW` | Gri | Standart süre |
| `NORMAL` | Mavi | Normal öncelik |
| `HIGH` | Turuncu | Kısa süre |
| `URGENT` | Kırmızı | Acil — kart üstünde flag gösterilir |

---

### 10.2 Onay Hiyerarşisi

1. **Birim Onayı:** Birimin yöneticisine → `PENDING_UNIT`
2. **Satın Alma Onayı:** Satın alma departmanı → `PENDING_PROCUREMENT`
3. **GM Onayı:** Bütçe eşiğini aşıyorsa → `PENDING_GM`
4. **Reddetme:** Herhangi bir aşamada; red notu kaydedilir → `REJECTED`

---

### 10.3 Tedarikçi Teklifleri

**PR Detay Drawer → Teklifler Sekmesi → Teklif Ekle:**
- Tedarikçi seç (kayıtlı vendor) veya isim yaz
- Toplam tutar + para birimi → TRY karşılığı otomatik
- Teslimat süresi (iş günü) ve geçerlilik tarihi
- **Seç** → Bu tedarikçi PO'ya bağlanır; teklifler karşılaştırmalı gösterilir

---

### 10.4 PO (Satın Alma Emri)

Teklif seçilince PO bilgileri dolar:
- PO numarası, seçilen tedarikçi, toplam tutar

**PO Yazdır** → Tarayıcı yazdırma diyaloğu; standart PO formatı HTML.

Statü → `PO_ISSUED`

---

### 10.5 Teslimat Takibi

**Teslimat Sekmesi → Teslimat Kaydı Ekle:**
- Teslimat tarihi, teslim alan kişi
- Sipariş edilen / teslim alınan / hasarlı miktar
- Teslimat notu

Statü → `IN_DELIVERY`

---

### 10.6 Fatura İşleme

**Fatura Sekmesi:**
- Fatura numarası, tutarı, tarihi, ödeme tarihi

Statü → `INVOICED` → **Kapat** → `CLOSED`

---

### 10.7 Tedarikçi Yönetimi

**Tedarikçiler sekmesi — Tedarikçi Kaydı:**

| Alan | Açıklama |
|------|----------|
| Firma Adı | Zorunlu |
| Vergi No | |
| İletişim | Ad, telefon, e-posta |
| IBAN | Ödeme bilgisi |
| Kategori Etiketleri | Donanım, Yazılım, Hizmet, vb. |
| Değerlendirme | 1-5 yıldız |

---

### 10.8 Özet Görünümü

**Özet sekmesi:** Statü bazında talep sayısı ve toplam tutar; bütçe analizi.

---

## 11. Proje Yönetimi Modülü

### Temel Akış

```
WON Fırsat
  → Proje Aç (fırsat verisi otomatik aktarılır)
  → Milestone Takibi (tip bazlı şablon otomatik uygulanır)
  → Maliyet Kaydı
  → Karlılık Analizi
  → Proje Teslimi & Tahsilat
```

---

### 11.1 Proje Oluşturma

**Yeni Proje** butonuna basıldığında **Fırsat Seçici** açılır:

- WON statüsündeki ve **henüz projeye dönüştürülmemiş** fırsatlar listelenir
- Fırsat seçilince form otomatik dolar:
  - Proje adı ← Fırsat başlığı
  - Müşteri ← Fırsatın müşterisi
  - Sözleşme Bedeli ← Fırsatın değeri
  - `opportunityId` backend'e gönderilir; backend eksik alanları fırsattan tamamlar
- **"Fırsatsız Boş Proje Aç"** seçeneği de mevcuttur

**Proje Formu Alanları:**

| Alan | Açıklama |
|------|----------|
| Proje Adı | Zorunlu |
| Proje Tipi | HARDWARE, SOFTWARE, SERVICE, MIXED |
| Durum | PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED |
| Müşteri | Dropdown |
| Proje Yöneticisi | Kullanıcı listesinden |
| Sözleşme Bedeli | Para birimi ile |
| Toplam Bütçe (TRY) | |
| Başlangıç / Planlanan Bitiş | |
| Açıklama | |

---

### 11.2 Milestone Şablonları (Proje Tipine Göre)

Proje oluşturulduğunda seçilen tipe göre otomatik milestone şablonu uygulanır:

**HARDWARE (Donanım):**
```
Planlama → Satınalma* → Sevkiyat → Kurulum → Test → Kabul → Garanti → Faturalama → Tahsilat
```
*Satınalma, Kurulum ve Geliştirme paralel çalışabilir

**SOFTWARE (Yazılım):**
```
Planlama → Geliştirme → Test → Kabul → Faturalama → Tahsilat
```

**SERVICE (Hizmet):**
```
Planlama → Kurulum → Kabul → Faturalama → Tahsilat
```

**MIXED (Karma):**
```
Planlama → Satınalma → Sevkiyat → Kurulum → Geliştirme → Test → Kabul → Garanti → Faturalama → Tahsilat
```

`isParallel: true` → Aşama paralel çalışabilir  
`requiresApproval: true` → GM onayı gerekir (backend TodoTask oluşturur)

---

### 11.3 Görünüm Modları

#### Kanban (Varsayılan)

4 kolonlu board: **Planlama | Devam Ediyor | Beklemede | Tamamlandı**

Her proje kartında:
- Proje tipi etiketi (Donanım / Yazılım / Hizmet / Karma)
- Müşteri adı
- İlerleme çubuğu (%)
- Gerçekleşen kar marjı badge'i
- Gecikmiş milestone sayısı (kırmızı uyarı)

#### Liste Görünümü

Durum / tip filtreleri + metin araması. Her satırda: statü, tip, müşteri, PM, faz, sözleşme bedeli, kar marjı, bitiş tarihi, düzenle/sil butonları.

---

### 11.4 Proje Detay Çekmecesi (4 Sekme)

Proje kartına tıklandığında sağdan kayar panel açılır.

#### Sekme 1 — Genel

- Statü, tip badge + gecikme uyarısı
- Genel ilerleme çubuğu
- Finansal grid:

| | |
|-|-|
| Sözleşme Bedeli | Toplam Bütçe |
| Başlangıç Tarihi | Planlanan Bitiş |
| Gerçekleşen Maliyet | Kalan Bütçe |

- Marj badge'leri: **Planlanan Kar % / Gerçekleşen Kar % / Tahmini Kar %**
- Proje açıklaması

#### Sekme 2 — Milestones

Her milestone genişletilebilir kart:
- İkon (saat / aktivite / check / uyarı / ban)
- Başlık + Paralel / Onay etiketleri + Gecikmiş uyarısı
- **Progress Slider (0-100%)** → backend'e anlık kayıt
- **Durum Geçiş Butonu:** NOT_STARTED → IN_PROGRESS → COMPLETED

Detay alanları: sorumlu kişi, bütçe, notlar.

**Milestone Durum Makinesi:**
```
NOT_STARTED → IN_PROGRESS → COMPLETED
            → BLOCKED
            → CANCELLED
```

#### Sekme 3 — Maliyetler

Kategori bazlı maliyet kalemleri:

| Kategori | Açıklama |
|----------|---------|
| `PROCUREMENT` | Donanım, lisans alımları |
| `TRAVEL` | Uçak, otel, araç kiralama |
| `EXTERNAL_SERVICE` | Danışmanlık, alt yüklenici |
| `OTHER` | Diğer giderler |

**Kalem Ekleme:**
- Kategori, ilgili milestone (opsiyonel), açıklama
- Planlanan tutar (TRY) ve gerçekleşen tutar
- Fatura numarası ve tarih

#### Sekme 4 — Karlılık

```
Sözleşme Bedeli           → 1.000.000 TRY
Planlanan Maliyet         →   750.000 TRY   Hedef Kar: %25,0
Gerçekleşen Maliyet       →   780.000 TRY   Gerçek Kar: %22,0
Tahmini Toplam Maliyet    →   800.000 TRY   Tahmini Kar: %20,0
```

**Maliyet Dağılım Barları:** Her kategorinin toplam içindeki payı.

**Otomatik Risk Uyarısı:** Gerçekleşen marj planlananın 5+ puan altında ise uyarı gösterilir.

---

### 11.5 Risk Paneli

Ana ekranın altında — şu koşullardan birini taşıyan projeler listelenir:
- 1+ gecikmiş milestone (`plannedEnd` geçmiş, statü COMPLETED değil)
- Gerçekleşen kar marjı planlananın 5+ puan altında
- Bütçenin %85'inden fazlası kullanılmış

Her satır tıklanabilir → proje detay çekmecesini açar.

---

### 11.6 Metrik Kartları

| Kart | Açıklama |
|------|----------|
| Aktif Proje | PLANNING + IN_PROGRESS |
| Toplam Değer | Aktif projelerin sözleşme bedelleri |
| Ort. Kar Marjı | Aktif projelerin gerçekleşen marj ortalaması |
| Gecikmiş Proje | Gecikmiş milestone'u olan proje sayısı |

---

### 11.7 PDF Raporları

**Proje Detay → Yazıcı İkonu:**

- **Standart Rapor:** Tam finansal bilgiler, milestone tablosu, maliyet kalemleri, kar analizi, risk uyarısı
- **Müşteri Raporu:** Maliyetler ve marjlar gizlenir; sadece milestone takibi ve özet bilgiler gösterilir

---

## 12. Görevler & Takip

### Görev Kaynakları

| Kaynak | Oluşturma Yöntemi |
|--------|------------------|
| Manuel | TodoModule'de "Yeni Görev" butonu |
| Teklif onayı | Presales → Onaya Gönder → TodoTask |
| Sözleşme aktarımı | ContractWorkflow Proje Aktarımı → AI görevleri TodoTask |
| Milestone onayı | requiresApproval milestone'u tamamlanınca → TodoTask |

### Görev Alanları

| Alan | Açıklama |
|------|----------|
| Başlık | Zorunlu |
| Birim | Hangi birimin görevi |
| Atayan | Görevi veren kişi |
| Öncelik | LOW, MEDIUM, HIGH, URGENT |
| Durum | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| Son Tarih | Opsiyonel |
| İlgili Modül | crm, presales, contract-workflow, project-mgmt, vb. |
| İlgili Kayıt ID | Modüldeki kaydın benzersiz kimliği |

### Durum Makinesi

```
PENDING → IN_PROGRESS → COMPLETED
        → CANCELLED
```

### Teklif Onay Kuyruğu

PENDING onay görevleri kırmızı uyarı banneri ile öne çıkar. Göreve tıklayınca teklif detayı (kalemler, maliyet özeti, şartlar) görünür:
- **Onayla** → Teklif `APPROVED`
- **Reddet** → Teklif `REJECTED`
- **Revize İste** → Presales'e geri gönder

---

## 13. Satış Destek

### İhale Dosyası Yönetimi

**Yeni İhale Dosyası:**
- İhale adı, kurumu, bütçe tahmini
- Son başvuru tarihi → Geri sayım sayacı
- Hazırlık ilerlemesi %
- URGENT flag (acil dosyalar öne çıkar, kırmızı badge)

### Personel Sertifikaları

Teknik personelin sertifikaları ve geçerlilik süreleri:

| Durum | Görsel |
|-------|--------|
| `VALID` | Yeşil badge |
| `RENEWAL_NEEDED` | Sarı uyarı |

### İş Bitirme Dilekçesi

1. Tamamlanmış referans proje seç
2. Müşteri firma bilgileri gir
3. Dilekçe şablonu otomatik oluşturulur
4. Yazdır / dışa aktar

---

## 14. Şirket Evrakları

### Belge Kategorileri

| Kategori | İçerik |
|----------|--------|
| `LEGAL` | Kuruluş belgesi, ticaret sicil, imza sirküleri |
| `ISO` | ISO sertifikaları |
| `CERTIFICATE` | Ürün ve teknik sertifikalar |
| `FINANCIAL` | Mali tablolar, banka referans mektupları |
| `WORK_EXPERIENCE` | İş bitirme belgeleri |

### Kayıt Alanları

Belge adı, kategori, geçerlilik tarihi (süresi yaklaşanlar uyarı verir), dosya URL, etiketler (çoklu).

### Arama & Filtreleme

Metin araması (isim + etiket) + kategori filtresi.

---

## 15. Fiziksel Arşiv

Fiziksel belgelerin (sözleşme klasörleri, fatura dosyaları, resmi yazışmalar) lokasyon takibi.

### Kayıt Alanları

| Alan | Açıklama |
|------|----------|
| Kutu No | Fiziksel kutu etiketi |
| Raf No | Depo raf konumu |
| Kategori | Sözleşme, Fatura, Resmi Yazışma, vb. |
| İçerik Açıklaması | Dosya içeriği |
| Sahip / Birim | Kim / hangi birim teslim etti |
| Tarih | Arşive alınma tarihi |
| Durum | `IN_ARCHIVE` / `BORROWED` |
| Etiketler | Arama kolaylığı |

---

## 16. Şirket Ayarları

```
Şirket Ayarları
 ├── Şirket Profili         (settings-company)
 ├── Birimler               (settings-units)
 ├── Kullanıcılar           (settings-users)
 ├── İş Akışı               (settings-workflow)
 ├── Yetkiler               (settings-permissions)
 ├── Entegrasyonlar         (settings-integrations)
 ├── Abonelik & Kullanım    (settings-subscription)
 ├── Lisans Planları        (settings-license-types)
 ├── Lisans Anahtarı Oluştur (settings-license-generate)  [GM only]
 └── Modüller               (settings-modules)            [GM only]
```

---

### 16.1 Şirket Profili

Tenant bilgileri: şirket adı, logo, iletişim bilgileri.

---

### 16.2 Birimler

Organizasyonel birimler (departmanlar):
- Birim oluştur, isim ve açıklama gir
- **Sil:** "Transfer Et" seçeneği → o birimin kullanıcı/görevleri başka birime aktarılır

Örnek birimler: Satış & Pazarlama, Teknik Çözümler, Operasyon & Lojistik, İdari İşler.

---

### 16.3 Kullanıcılar

- Yeni kullanıcı: isim, e-posta, rol, birim, durum
- Mevcut kullanıcıları düzenle / `INACTIVE` yap

---

### 16.4 İş Akışı (Workflow Builder)

Onay akışı şablonları oluştur:
- WorkflowStep: tip (`AUTO` / `MANUAL`), birim, açıklama, sıra, sonraki adım

---

### 16.5 Yetkiler

Rol-izin matrisi:
- İzin kodlarını rollere ata
- Kullanıcı bazında özel izin ekle / kaldır

---

### 16.6 Entegrasyonlar

| Entegrasyon | Özellikler |
|-------------|-----------|
| **Nextcloud** | Dosya senkronizasyonu; sözleşme evrakları WebDAV ile yüklenir |
| **Microsoft Exchange** | E-posta entegrasyonu, takvim senkronizasyonu |
| **WhatsApp Business** | Bildirim ve teklif özeti mesajları (Meta Cloud API) |

Her entegrasyon: sunucu URL, kimlik bilgileri, **Bağlantıyı Test Et** butonu.

---

### 16.7 Abonelik & Kullanım

- Mevcut plan: STARTER / PROFESSIONAL / ENTERPRISE
- Kullanım metrikleri (aktif kullanıcı, depolama)
- Lisans modeli: KOBI / PAY_AS_YOU_GO / ON_PREMISE

---

### 16.8 Lisans Planları

Mevcut lisans planlarının listesi ve düzenleme:
- Plan adı, model, fiyat, kullanıcı / depolama limitleri, özellik listesi

---

### 16.9 Lisans Anahtarı Oluştur (GM Only)

- Şirket adı, lisans modeli, son kullanma tarihi
- Kullanıcı ve depolama limiti
- Deneme sürümü seçeneği
- **Oluştur** → İmzalanmış lisans anahtarı (JWT benzeri)

---

### 16.10 Modüller (GM Only)

Test ortamındaki modülleri canlıya alma:
- Sistem modülleri (kilitli)
- Test modülleri — toggle ile aktif / pasif

---

## 17. Teknik Referans

### Frontend Servis Katmanı

| Servis | Kullanım |
|--------|---------|
| `apiClient.fetchWithAuth(path, init)` | Parse edilmiş JSON döner; `.json()` veya `.ok` çağırma |
| `apiService.*` | `apiClient`'ı wrap eden yüksek seviye metodlar |
| `useAuth()` | `currentUser`, `setAuth(token, tenantId)` |
| `useEnflowQueries` | TanStack Query hooks (useOpportunities, useProjects, vb.) |

**API path kuralı:** `fetchWithAuth('/projects')` → tam URL `/api/projects` (prefix otomatik)

---

### Backend Endpoint Özeti

| Domain | Prefix | Notlar |
|--------|--------|--------|
| Müşteriler | `/api/customers` | |
| Fırsatlar | `/api/opportunities` | BoM ve maliyet alt-route'ları dahil |
| Teklifler | `/api/proposals` | |
| Sözleşme Workflow | `/api/contract-workflows` | AI analiz + evrak upload (multer) |
| Projeler | `/api/projects` | `GET /summary/all` ← `/:id`'den ÖNCE tanımlanmalı |
| Tedarikçiler | `/api/vendors` | |
| Satın Alma | `/api/purchase-requests` | approve / reject / quote / delivery / invoice / close |
| Görevler | `/api/tasks` | |
| Birimler | `/api/units` | |
| Kullanıcılar | `/api/users` | |
| Evraklar | `/api/documents` | |
| Arşiv | `/api/archive` | |
| Tenant Ayarları | `/api/tenants` | module-settings dahil |
| Abonelik | `/api/subscription` | |
| Bildirimler | `/api/notifications` | |

---

### Veritabanı Modelleri

| Model | Amaç |
|-------|------|
| `Tenant` | Kiracı |
| `User` | Kullanıcı (rol + izin JSON) |
| `Customer` | Müşteri |
| `Opportunity` | Satış fırsatı |
| `Proposal` | Teklif (versiyonlu) |
| `BoMItem` | Malzeme listesi kalemi |
| `CostItem` | Fırsat maliyet kalemi |
| `Contract` | Sözleşme (eski basit model) |
| `ContractWorkflow` | Sözleşme süreç yönetimi |
| `ContractWorkflowDoc` | Sözleşme evrakları |
| `Project` | Proje (type, phase, milestone/cost relations) |
| `ProjectMilestone` | Aşama takibi |
| `ProjectCostItem` | Proje maliyet kalemi |
| `Vendor` | Tedarikçi kaydı |
| `PurchaseRequest` | Satınalma talebi |
| `PurchaseItem` | Talep satır kalemleri |
| `PurchaseQuote` | Tedarikçi teklifleri |
| `DeliveryRecord` | Teslimat kaydı |
| `TodoTask` | Görev (birim bazlı) |
| `Workflow` / `WorkflowStep` | Onay akışı şablonları |
| `ActivityLog` | Değişiklik logu |
| `Notification` | Kullanıcı bildirimi |
| `Subscription` | Abonelik |

---

### Kritik Teknik Notlar

```
motion/react        → Paket adı "motion" — "framer-motion" değil
apiClient           → fetchWithAuth parse edilmiş JSON döner; .json() ÇAĞIRMA
Express v5          → String(req.params.id) kullan
req.tenantId        → Express.d.ts namespace'den; cast gereksiz
multer v2           → upload.single('file'), req.file.buffer
No console.log      → src/utils/logger kullan
No any              → TypeScript strict mode
lucide-react chunk  → vite manualChunks'ta react kontrolünden ÖNCE gelmeli
GET /summary/all    → /:id route'undan ÖNCE tanımlanmalı (route conflict)
opportunityId POST  → Backend fırsatı çekip eksik alanları otomatik tamamlar
PLUGIN_LICENSE_SECRET → Sanal agent lisans imzası; canlıda mutlaka değiştir
```

---

## 18. Ziyaret Planı & Günlük Rapor

Süreç öncesi katman — sidebar'da **Ziyaret Planı** (Dashboard'dan sonra).

### Haftalık Ziyaret Planı
1. Hafta seç → "Yeni Ziyaret" ile satır ekle.
2. Her satır: **müşteri**, **tip** (Demo / Teknik Toplantı / Sunum / Diğer), **planlanan tarih**, ihtiyaç notu.
3. Ziyaret gerçekleşince **gerçekleşen tarih** + durum işaretlenir; yakalanan ihtiyaç notu eklenir.

### Günlük Saha Raporu
- Serbest metin günlük rapor + **"Yöneticiyle Paylaş"** flag'i. Paylaşılan raporlar yönetici görünümünde listelenir.

> **Not:** Müşteri seçici, müşteri verisi yüklendiğinde dolar — Ziyaret Planı sekmesi açıkken `useCustomers` otomatik etkinleşir.

---

## 19. Proje Devir Paketi

Proje Yönetimi → proje detayı → **Devir Paketi** sekmesi (5. sekme).

- **11 zorunlu evrak** checklist'i: Fizibilite, İhale Dokümanları, Sözleşme + Ekleri, Birim Fiyat Teklif Cetveli, Maliyet Tablosu, Kitlist Ağacı, Alınan Teklifler, İhale Kararı, Teminat Mektupları, Proje Devir Formu, Personel Listesi.
- Her evrak: **Yükle** (dosya) / **Muaf** (waive) işaretlenebilir. Yüklenen dosyalar `uploads/project-handovers/{proje_kodu}/`.
- Tüm zorunlu evraklar tamamlanınca devir hazır; aksi halde proje header'ında amber **"Devir Bekliyor"** rozeti (tıklayınca bu sekmeye götürür).

---

## 20. Genel Hususlar & Doküman Kodlama

### Genel Hususlar (Kurumsal Yönetim)
Sidebar'da **Genel Hususlar** — 4 sekme:

| Sekme | Ne için |
|-------|---------|
| Alınan Dersler | Proje sonrası ders kaydı (durum / kök neden / aksiyon / etki) |
| Risk & Fırsat | Risk/fırsat kaydı; **skor = olasılık (1-5) × etki (1-5)**, renk: 1-7 yeşil / 8-14 amber / 15-25 kırmızı |
| KPI | Dönemsel kurumsal metrik (hedef vs gerçekleşen %) |
| Dış Doküman Sicili | Dış kaynaklı dokümanlar (kaynak, versiyon, durum) |

"Yeni Kayıt" formu aktif sekmeye göre alan değiştirir.

### Doküman Kodlama Notasyonu (tenant-yapılandırılabilir)
**Ayarlar → Şirket Profili → Doküman Kodlama Notasyonu:**
- **Şirket kodu** (örn. ENF), **ayraç** (varsayılan `-`), **hane sayısı** (1-10), **yıl** ve **aktif** toggle.
- Kategori sözlüğü CRUD (örn. `SOZ → Sözleşme Evrakları`).
- Canlı önizleme: `ENF-SOZ-2026-00001`. Sözleşme/devir/kurumsal kayıtlara opsiyonel `docNumber` otomatik üretilir.

> Doküman kodlama tamamen özgündür ve her tenant kendi notasyonunu tanımlar — sabit gömülü önek yoktur.

---

## 21. Finans Modülü

Sidebar'da **Finans** (Proje Yönetimi'nden sonra). FINANCE_MGR operasyonel birimi; GM superuser görür.

| Sekme | Kullanım |
|-------|----------|
| Faturalar | Satış/Alış faturası oluştur; durum DRAFT→ISSUED→SENT→PARTIAL→PAID→OVERDUE |
| Tahsilat | Faturaya kısmi/tam ödeme ekle; `paidAmount` ve durum otomatik güncellenir; aging görünümü |
| Teminat Mektupları | Teminat ekle (Geçici/Kesin/Avans/Garanti); yaklaşan & geçmiş vade renk kodu |
| Maliyet Onayı | Bekleyen proje maliyet kalemlerini **Onayla / Reddet** |
| Özet | Toplam alacak, tahsilat, vadesi geçen, aktif teminat, bekleyen onay kartları |

---

## 22. Hukuk Görünümü

**Sözleşme Yönetimi** modülünde üstteki **Sözleşmeler ↔ Hukuk** geçiş çubuğundan erişilir. LEGAL_MGR birimi.

- **Hukuki Vakalar:** tip (Sözleşme İncelemesi / Hukuki Görüş / Uyuşmazlık / Dava / Diğer), durum (Açık→İncelemede→Yanıtlandı→Tırmandırıldı→Kapalı), öncelik. Kapat / Sil.
- **Gelen Talepler:** "Hukuk / Şirket Avukatı" etiketli görevler (TodoModule'den gelen LEGAL talepleri) → **"Vakaya Dönüştür"** → docNumber `ENF-HUK-YYYY-NNNNN`.

---

## 23. İhale / İSAB Modülü

Sidebar'da **Satış Destek** — backend destekli ihale yönetimi (ISAB_MGR). 5 sekme:

| Sekme | Kullanım |
|-------|----------|
| İhale Listesi | İhale oluştur (İKN, idare, yöntem, tahmini bedel, deadline); durum & kalan gün rozetleri |
| İhale Takvimi | Aktif ihaleler son teslim tarihine göre sıralı |
| Uygunluk Denetimi | Seçili ihalenin evrak checklist'i (otomatik 10 kalem); **Tamam / Muaf / Geri Al**, dosya yükle |
| Teminat | Geçici teminat (Finans modülüyle paylaşımlı `BID_BOND`) |
| EKAP | Manuel İKN öneki yer tutucu (gerçek EKAP servisi yok) |

Durum: `DRAFT → PREPARING → SUBMITTED → EVALUATING → WON / LOST / CANCELLED`. Doküman no `ENF-IHL-YYYY-NNNNN`.

---

## 24. Yönetim Raporları

Sidebar'da **Yönetim Raporları** (Dashboard'dan sonra). Her birimin metrikleri mevcut veriden otomatik hesaplanır. Üstte esnek tarih aralığı seçici (varsayılan: bu ay).

| Sekme | İçerik |
|-------|--------|
| Genel Bakış | **İş akışı darboğazı paneli** (hangi birim onay bekliyor + en eski bekleyiş) + 7 birimin başlık metrik kartları |
| Birim Detayı | Birim seç → tüm metrikler + grafikler (bar/pasta/çizgi) |
| Raporlarım | Birim yöneticisi: dönem seç → otomatik metrik ön-izleme + yorum alanları (öne çıkanlar / sorunlar / aksiyon / risk / özet) → **Yönetime Sun** |
| Gelen Raporlar (GM) | Sunulan raporları incele (metrik snapshot + yorumlar) → **Onayla / İade Et** |

Rapor durumu: `DRAFT → SUBMITTED → REVIEWED / RETURNED`. Doküman no `ENF-RPR-YYYY-NNNNN`.

---

## 25. Onay Zinciri & Bekleyen Onaylarım

Çok-aşamalı kurumsal onay (`ApprovalChain`) — örn. Fırsat/Teklif için **Finans → İGPD → GM → KSU**, Sözleşme imzası için **KSU → GM**.

- **Görevler** modülünde **"Bekleyen Onaylarım"** sekmesi: rolünüz zincirin hangi aşamasındaysa ve **sırası geldiyse** (önceki tüm aşamalar onaylı) o onay burada görünür. **Onayla / Reddet**.
- **Boş koltuk (deadlock önleme):** aktif kullanıcısı olmayan role ait aşama otomatik **atlanır (SKIPPED)**; lisanslı **otonom** bir sanal agent varsa aşamayı agent onaylar (§ 26).
- **Köken görünürlüğü:** bir aşama sanal agent tarafından onaylandıysa, sonraki onaylayan **"🤖 {agent} tarafından yapıldı"** rozetini görür ve kendi aşamasında zinciri reddederek kontrol edebilir.

---

## 26. Sanal Agentlar (Eklenti)

> **TEST · Eklenti** — ticari sürümün dışında, ayrı lisanslanabilir upsell. Yalnızca GM görür (`virtual-agents-test`).

Boş birim koltuğunu dolduran sanal vekiller: birimin işini hazırlar (deterministik kural seti — LLM gerektirmez), gerçek kişiye **devreder (handoff)**. Varsayılan mod **Danışman (ADVISORY)** — çıktı insan onayı bekler.

### Eklenti Kataloğu
- 7 agent: İhale, Proje, Presales, Satınalma, Finans **(hazır/AVAILABLE)**; Hukuk, CRM **(yakında)**.
- **Finans ve Hukuk asla otonom çalışamaz** (yalnızca Danışman modu).
- **Lisans:** aktivasyon anahtarı `ENF-PLUGIN-<KEY>[-D<gün>]-<İMZA>`. GM "Lisans Anahtarı Üret" kartından imzalı anahtar üretir → "Aktivasyona aktar" → Etkinleştir.

### Çalıştırmalar
1. Agent + ilgili kayıt seç → **Çalıştır**.
2. Agent denetim yapar (örn. İhale checklist eksiksizliği / deadline; Presales BoM tutarlılığı; Finans eşik-altı maliyet onay önerisi) → handoff görevi + çalıştırma kaydı oluşur.
3. **Onayla & Devral** ile gerçek kişi işi üstlenir (ratifikasyon) veya **Reddet**.
4. Her çalıştırma `AGENT:<key>` köken etiketiyle damgalanır; rozet tıklanınca gerekçe + çıktı detayı açılır.

> ⚠️ **Production:** `PLUGIN_LICENSE_SECRET` ortam değişkeni canlıya çıkışta mutlaka değiştirilmelidir.

---

## 27. Bileşen Envanteri & Uçtan Uca Akış (Enflow-Wiki Kaynağı)

> 📚 **Amaç:** Bu bölüm, ilerde hazırlanacak **statik "enflow-wiki" how-to sayfasının** kaynak referansıdır. Yazılımı *hiç bilmeyen* birine baştan sona anlatacak şekilde, sade dille yazılmıştır. Wiki sayfası yapıldığında bu bölüm doğrudan ona kılavuzluk edecektir.
>
> Ölçek (2026-06-20): **51 veri modeli · 29 ekran modülü · 29 API alanı · 11 servis · 8 sanal agent · 7 katman.** (Faz 0–9 tamam; birimler-arası geçiş zinciri otomatik.)

### 27.1 Enflow nedir? (tek paragraf)

Enflow, bir işin **müşteri ilgisinden** (fırsat) başlayıp **teklif → sözleşme → proje → satınalma → faturalama**ya kadar tüm yolculuğunu tek platformda yöneten, **çok-kiracılı (multi-tenant)** bir kurumsal **süreç yönetim yazılımıdır**. Her aşama bir **birime** (Satış, Presales, İhale, Hukuk, Proje, Satınalma, Finans…) aittir. İşler birimler arasında **görevler**, **onay zincirleri** ve **hand-off (devir)** mekanizmasıyla akar; her adım kayıt altına alınır (log/bildirim).

### 27.2 Uçtan uca akış — bir işin yolculuğu (newcomer anlatımı)

```
[Saha/Ziyaret]    Müşteri ziyaret planlanır, günlük rapor girilir
     │
     ▼
[CRM]             Fırsat açılır (müşteri + tahmini değer). Kazanılır/kaybedilir.
     │
     ▼
[Presales]        Fırsata BoM (malzeme listesi) + maliyet/marj hazırlanır → Teklif
     │            (Şartname varsa SpecAnalysis ile AI analizi)
     ▼
[Teklif/Müzakere] Teklif versiyonlanır, onaya gönderilir (Onay Zinciri devreye girer),
     │            müşteriyle pazarlık turları yürütülür
     ▼
[İhale/İSAB]      (Kamu işi ise) İhale dosyası + uygunluk checklist + geçici teminat
     │
     ▼
[Sözleşme]        ContractWorkflow: evrak hazırlık → imza onayı → SIGNED
     │            (Birim yöneticisi onayı; AI ile sözleşme/şartname analizi)
     ▼
[Proje Yönetimi]  Kazanılan iş projeye döner: milestone'lar, maliyet, karlılık,
     │            11 zorunlu evrakla "Devir Paketi"
     ▼
[Satınalma]       Talep → tedarikçi teklifi → PO → teslimat → fatura (9 statü)
     │
     ▼
[Finans]          Faturalama, tahsilat (kısmi), teminat mektupları, maliyet onayı
```

Bu hattın **üstünde** çalışan kesişen bileşenler: **Onay Swimlane** (Finans→İGPD→GM→KSU), **Hukuk** (vaka takibi), **Genel Hususlar** (risk/ders/KPI), **Yönetim Raporları** (birim metrikleri), **Sanal Agentlar** (boş birim koltuğunu dolduran vekiller).

> ⚙️ **Not (akış olgunluğu):** Bazı birimler-arası geçişler bugün **manuel/yarı-otomatik**tir (örn. Sözleşme→Proje kaydı, Satınalma faturası→Finans, İhale→Sözleşme, Proje→Satınalma maliyet bağı). Bunlar tasarımda var; otomatik akış halkaları geliştirme yol haritasındadır (bkz. `CLAUDE.md` Sonraki Adımlar).

### 27.3 Katmanlı bileşen haritası

| Katman | Bileşenler (model → modül → API) |
|---|---|
| **0 · Platform/SaaS** | Tenant, Subscription, UsageMetric → SubscriptionModule / LicenseTypes / LicenseGenerator / ProvisionWizard → `/tenants` |
| **1 · Kimlik & Yetki (RBAC)** | User, Unit → UserManagement / UnitManagement / PermissionSettings → `/auth`, `/users`, `/units` |
| **2 · Akış motoru** | Workflow, WorkflowStep, WorkflowLog, TodoTask, ApprovalChain, ApprovalStage, Notification, ActivityLog → WorkflowBuilder / TodoModule + `workflowService` → `/workflows`, `/tasks`, `/approval-chains`, `/notifications` |
| **3 · Domain birimleri** | VisitPlan/Visit/DailyReport · Customer/Opportunity · BoMItem/CostItem · Proposal · Tender/TenderChecklistItem · Contract/ContractWorkflow/Doc · Project/Milestone/CostItem/HandoverDoc · Vendor/PurchaseRequest/Item/Quote/DeliveryRecord · Invoice/Payment/GuaranteeLetter · LegalCase → ilgili modüller → `/visits`,`/customers`,`/opportunities`,`/proposals`,`/tenders`,`/contracts`,`/contract-workflows`,`/projects`,`/purchase-requests`,`/vendors`,`/finance`,`/legal` |
| **4 · Yönetişim & Belge** | DocumentCodingProfile/CategoryCode/Sequence · LessonsLearned/RiskOpportunity/CorporateMetric/ExternalDocumentRegister · CorporateDocument/ArchiveItem · UnitReport → CorporateGovernance / Documents / Archive / ManagementReporting → `/document-coding`,`/corporate-governance`,`/documents`,`/archive`,`/reports` |
| **5 · YZ / Sanal Agent** | PluginEntitlement, AgentRun → VirtualAgentsTestModule + SpecAnalysis/ContractWorkflow (istenilen YZ — tenant-yapılandırmalı, `aiClient`) → `/plugins` |
| **6 · Entegrasyon & Admin** | IntegrationWizard, SecurityTestModule → nextcloud/exchange/whatsapp servisleri + EKAP → `/sync`, `/admin/security-test` |

### 27.4 Akış motoru — birimler birbiriyle nasıl "konuşur"

Süreç-yönetiminin kalbi bu katmandır; domain birimlerini birbirine bağlar:

- **İş Akışı Şablonu (Workflow/WorkflowStep):** Tenant'ın aktif birimlerinden türeyen kanonik sıra; bir birim çıkarılınca iş otomatik bir sonraki **aktif** birime yönlenir (skip-logic, deadlock olmaz).
- **Görevler (TodoTask):** Birimler-arası iş, görev olarak atanır. `relatedModule` etiketi işin hangi modüle ait olduğunu söyler: **OPPORTUNITY · PROPOSAL · CONTRACT · PROJECT · PROCUREMENT · DELIVERY · LEGAL · GENERAL**. İş günü SLA ile termin otomatik hesaplanır.
- **Hand-off / Devir (`workflowService.triggerHandOff`):** Bir birim işini bitirince sonraki birime devreder → e-posta + bildirim + log üretilir.
- **Onay Zinciri (ApprovalChain/Stage):** Çok-aşamalı onay (Finans→İGPD→GM→KSU). "Bekleyen Onaylarım" sekmesi role göre sırası gelmiş onayları gösterir; aktif kullanıcısı olmayan rol otomatik atlanır (orphan-skip).
- **Bildirim & Log (Notification / ActivityLog):** Kullanıcı bildirimleri + değişiklik/denetim izi (provenance: `AGENT:<key>` ile agent kökeni dahil).

### 27.5 Roller & birimler

GENERAL_MANAGER (superuser), SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL_MGR, PROJECT_MANAGER, ADMIN + kurumsal onay rolleri: FINANCE_MGR, IGPD_MGR (İş Geliştirme & Pazarlama), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Satın Alma). İzinler kullanıcının `permissions` JSON'undan gelir; GM her şeyi görür.

### 27.6 Wiki kılavuzluk notu

Yapılacak statik **enflow-wiki** how-to sayfası bu bölümü kaynak alacak: (a) 27.1–27.2 → "Enflow nedir / iş nasıl akar" giriş sayfası; (b) 27.3 → bileşen referansı; (c) 27.4 → "birimler nasıl bağlanır" teknik how-to; (d) her domain modülü için bu belgenin ilgili bölümleri (§1–§26) adım-adım kullanım kılavuzu olur. Hedef: **yazılımı hiç görmemiş birinin tek sayfadan uçtan uca anlayabilmesi.**

---

*Bu belge Enflow v2026-06-19 sürümüne aittir. Modül güncellemeleri için [CLAUDE.md](./CLAUDE.md) ve proje memory dosyalarını inceleyin. §27 = gelecek enflow-wiki kaynağı.*
