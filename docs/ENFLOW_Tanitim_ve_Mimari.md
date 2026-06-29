# ENFLOW — Sistem Tanıtım & Mimari Dökümanı
### Pitch Deck · Tanıtım Videosu · Ürün Sunumu Kaynak Dökümanı

> Bu döküman Enflow platformunun mimarisini, rol/yetki (RBAC) sistemini ve nasıl
> değiştirileceğini, tüm birimlerin işleyişini ve raporlarını, sidebar'daki her
> bileşenin açıklamasını, çalışma kriterlerini ve kısıtlarını anlatır. Claude
> Design ile slayt/sunum ve tanıtım videosu üretmek için tasarlanmıştır.

---

## 1. Enflow Nedir? (Tek Cümlelik Değer Önermesi)

**Enflow, B2B satış ve iş süreçlerini — bir satış fırsatının doğuşundan, ihale
dosyasına, teklife, sözleşmeye, satınalmaya, finansa ve proje teslimine kadar —
uçtan uca yöneten, çok-kiracılı (multi-tenant) bir kurumsal SaaS platformudur.**

Kısa vaat cümleleri (slayt başlıkları için):
- *"Fırsattan teslime, tek akış."*
- *"Her birimin koltuğu dolu — boş kalan koltuğu sanal agent doldurur."*
- *"Role göre kokpit: herkes kendi işini, yönetim tüm tabloyu görür."*
- *"Döviz, vade ve teminatı kuruşuna kadar doğru hesaplayan finans zekâsı."*

---

## 2. Sistem Mimarisi

### 2.1 Katmanlı Mimari (7 Katman)
```
┌─────────────────────────────────────────────────────────────┐
│  SUNUM      React 19 + TypeScript 6 (strict) · Vite 8        │
│             (Rolldown) · Tailwind v4 (glass-morphism) ·       │
│             TanStack Query v5 · motion/react · Recharts       │
├─────────────────────────────────────────────────────────────┤
│  API        Express.js v5 · /api/* (29+ domain router)       │
├─────────────────────────────────────────────────────────────┤
│  SERVİS     workflowService · projectFactory · activityLog · │
│             unitReportingService · dashboardService ·         │
│             financingEffect · specAnalysis · entitlement…     │
├─────────────────────────────────────────────────────────────┤
│  AKIŞ MOTORU Workflow/WorkflowStep (skip-logic) · TodoTask · │
│             ApprovalChain/Stage (swimlane) · Notification     │
├─────────────────────────────────────────────────────────────┤
│  AI / AGENT  8 sanal birim-agentı (deterministik) ·          │
│             PluginEntitlement (lisans) · AgentRun (köken)     │
├─────────────────────────────────────────────────────────────┤
│  VERİ        Prisma ORM · SQLite (dev) · 55+ model · migration│
├─────────────────────────────────────────────────────────────┤
│  İZOLASYON   Çok-kiracılı: her kayıt tenantId ile izole       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Teknoloji Yığını (Tech Stack)
| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19, TypeScript 6 (strict), Vite 8 (Rolldown bundler), TanStack Query v5 |
| UI | Tailwind CSS v4, glass-morphism tasarım dili, `motion/react`, `lucide-react` ikonlar, Recharts |
| Backend | Express.js v5, TypeScript, Prisma ORM |
| Veritabanı | SQLite (dev) · Prisma migrations (prod'da Postgres'e taşınabilir) |
| Belge Yönetimi | Yerel `/uploads` + opsiyonel Nextcloud (WebDAV) entegrasyonu |
| Excel/Dosya | SheetJS (xlsx) içe/dışa aktarım · pdf-parse (şartname metin çıkarımı) |
| YZ | **İstenilen YZ** — sağlayıcıdan bağımsız (OpenAI-uyumlu uç); tenant kendi API key'ini Ayarlar→Entegrasyonlar'dan girer. Şartname/sözleşme analizi + deterministik mock fallback |
| Paket yöneticisi | pnpm |

### 2.3 Mimari İlkeler (Anlatı Noktaları)
- **Çok-kiracılılık (Multi-tenancy):** Tüm modeller `tenantId` ile izole; bir
  kiracının verisi diğerine asla sızmaz (RBAC süitinde cross-tenant testleri ile
  doğrulanır).
- **Tek-kaynak gerçeklik:** Veri şeması `schema.prisma`, rol matrisi
  `governance/role-matrix.ts`, akış referansı `walkthrough.md §27`.
- **Otomatik birimler-arası geçiş zinciri:** İhale kazanımı → Sözleşme → Proje →
  Satınalma → Finans halkaları sistem tarafından otomatik tetiklenir (insan eli
  sadece karar verir, veri taşımaz).
- **Denetim izi (provenance):** Her mutasyon `ActivityLog`'a yazılır
  (actorType: HUMAN | AGENT); agent işlemlerinde `agentRunId` ile köken izlenir.
- **Para birimi tutarlılığı (kritik):** Döviz değerleri asla sessizce tek para
  birimine çevrilmez; eksik döviz uyarıyla bloke edilir, finansman etkisi
  döviz-bazlı ayrışık tutulur (yanlış kur = hayati maliyet hatası riski önlenir).

---

## 3. RBAC (Rol Tabanlı Erişim Kontrolü) ve Nasıl Değiştirilir

### 3.1 Çalışma Mantığı
Enflow'da erişim **iki katmanlı** denetlenir:

1. **Sidebar/Modül görünürlüğü (frontend):** Her menü öğesinin bir
   `requiredPermission`'ı vardır (`src/constants.ts` NAV). Kullanıcının
   `permissions` JSON dizisinde o izin yoksa menü görünmez. Üst-menü, alt
   öğelerinden herhangi birine erişim varsa görünür (parent-OR-child mantığı).
2. **Endpoint koruması (backend):** Hassas uç noktalar `requireRole([...])`
   middleware'i ile rol-kapılıdır (örn. yönetim çekilme kararı yalnız
   `GENERAL_MANAGER`).

**Tek kaynak:** `governance/role-matrix.ts` — her rolün birimi, türü, modülleri,
endpoint alanları, karar hakları ve görevleri burada tanımlıdır. `pnpm audit:roles`
komutu bu matrisi gerçek DB izinleri, sidebar ve `requireRole` ile karşılaştırıp
tutarsızlıkları raporlar (deterministik bekçi: 0 ERROR hedefi).

**Doğrulama süiti:** Playwright RBAC süiti **405 test** (19 rol × erişim
senaryoları + cross-tenant izolasyonu) ile her sürümde yeşil tutulur.

### 3.2 RBAC Nasıl Modifiye Edilir (4 Adım)
Bir role yeni bir modül/yetki eklemek/çıkarmak için:

1. **Yetki sabiti** — `src/constants.ts` içinde ilgili `requiredPermission`
   string'ini belirle (örn. `COST_ANALYSIS_VIEW`).
2. **Rol matrisi** — `governance/role-matrix.ts` içinde ilgili rolün `modules`
   dizisine yetkiyi ekle/çıkar (tek-kaynak güncellenir).
3. **Kullanıcı izinleri (DB)** — o roldeki kullanıcıların `User.permissions`
   JSON'ını matrisle eşitle (Ayarlar → Kullanıcılar ekranından veya migration/
   script ile).
4. **Test beklentisi** — `tests/rbac/rbac.config.ts` içindeki görünürlük
   beklentisini güncelle; `pnpm audit:roles` (0 ERROR) + RBAC süiti (yeşil) ile
   doğrula.

> **Örnek (gerçek):** "Maliyet Analizi" yetkisi Presales'ten Satış birimine
> taşındığında — nav öğesi CRM grubuna alındı, `COST_ANALYSIS_VIEW` SALES_REP/
> SALES_MGR'a verildi, Presales rollerinden çıkarıldı, DB senkronlandı ve RBAC
> 405/405 yeşil kaldı.

### 3.3 19 Rol (ROLE_LABELS)
| Rol kodu | Etiket | Tür |
|----------|--------|-----|
| GENERAL_MANAGER | Genel Müdür | Üst yönetim |
| OPERATIONS_MGR | Operasyon Müdürü | Üst yönetim |
| SALES_MGR / SALES_REP / SALES_SUPPORT | Satış Müdürü / Temsilcisi / Destek | Satış |
| PRESALES_MGR / PRESALES_ENG / TECHNICAL_SPEC | Presales Müdürü / Mühendisi / Teknik Uzman | Teknik |
| PROCUREMENT_MGR | Satın Alma Müdürü | Tedarik |
| FINANCE_MGR | Finans Müdürü | Finans |
| PROJECT_MGR | Proje Yöneticisi | Proje |
| ISAB_MGR | İhale Satın Alma Birimi Yön. (İSAB) | İhale |
| IGPD_MGR | İş Geliştirme & Pazarlama Dir. (İGPD) | Pazarlama |
| KGD_MGR | Kalite Güvence Direktörü (KGD) | Kalite |
| KSU_MGR | Kontrat & Sözleşme Uzmanı (KSU) | Sözleşme |
| LEGAL_MGR | Hukuk Müdürü / Şirket Avukatı | Hukuk |
| HR_MGR | İnsan Kaynakları Müdürü | İK |
| AUDITOR | Denetçi / Auditor | Denetim |
| ADMIN | Sistem Yöneticisi | Sistem |

---

## 4. Birimler & Modüller — Detaylı Çalışma Modeli

> Bu bölüm sidebar'daki **her modülü**, modülü kullanan **ekibin çalışma şeklini**,
> arkasındaki **veri modellerini** ve sunumda öne çıkarılacak **★ vurgu noktasını**
> kapsar. Her modül, sürecin bir halkasıdır ve Yönetim Raporları'na canlı metrik
> besler (`unitReportingService`). Birimler-arası geçiş otomatiktir.

### 4.1 Dashboard — Role-Bazlı Kokpit (Herkes)
- **Ekip & rol:** Tüm roller (içerik role göre değişir).
- **Çalışma şekli:** Kullanıcı giriş yapar → rolüne özel widget seti yüklenir.
  GM "yönetim kokpiti" (KPI + darboğaz + zaman uyarıları); Satış Destek ihale
  vadeleri + teminat talepleri; Finans teminat/vade/finansman boşluğu; Presales
  Müdürü Devredilen BoM. Widget'lar ilgili modüle tıkla-git.
- **Veri modeli:** `dashboardService.computeDashboard` aggregator → `DashboardPayload`
  (kpis · timeSensitive · management · personal); kaynak: Opportunity, Tender,
  GuaranteeLetter, Invoice, BomHandoff, ProjectMilestone, TodoTask, Notification.
- **★ Vurgu:** *"Tek dashboard, herkese kendi işi; yönetime tüm tablo."*

### 4.2 Yönetim Raporları (GM + Birim Müdürleri)
- **Ekip & rol:** GM ve `*_MGR` rolleri (MANAGEMENT_REPORTS_VIEW).
- **Çalışma şekli:** Birim seç → canlı metrik + iş-akışı darboğazı; birim
  yöneticisi dönem raporu yazar → üst yöneticiye **escalation** ile gönderir →
  inceleme (onayla/iade); tek + konsolide **yazdırma** çıktısı.
- **Veri modeli:** `UnitReport` (metricsSnapshot, escalatedToId), `unitReportingService`
  (computeUnitMetrics / computeOverview / computeWorkflowBottlenecks /
  computeConsolidation).
- **★ Vurgu:** *"Her birim ölçülür; darboğaz görünür; rapor hiyerarşi ile akar."*

### 4.3 Ziyaret Planı (Satış Temsilcisi / Saha)
- **Ekip & rol:** SALES_REP ve saha ekibi (VISIT_PLAN_VIEW).
- **Çalışma şekli:** Haftalık ziyaret planı (tanışma/planlı/fırsat/proje) → günlük
  rapor ile gerçekleşen kaydı → **plan-gerçekleşen mutabakatı**; personel KPI =
  ziyaret eşleşme oranı; Excel çıktısı.
- **Veri modeli:** `VisitPlan` / `Visit` / `DailyReport` (work-link matrisi,
  metricsSnapshot).
- **★ Vurgu:** *"Sahanın emeği ölçülebilir: planlanan ↔ yapılan ↔ raporlanan."*

### 4.4 CRM & Müşteri + Maliyet Analizi (Satış)
- **Ekip & rol:** SALES_MGR, SALES_REP (CRM_VIEW + alt izinler; COST_ANALYSIS_VIEW).
- **Çalışma şekli:** Müşteri & fırsat yönetimi, teklif, canlı pazarlık. **Fırsat
  açarken satınalma usulü + son teklif tarihi girilir** (Satış Destek tetiklenir).
  Maliyet Analizi (Satış'ta): BoM alış fiyatları üzerinden **forward (tahsilat)
  kuru** + usule göre otomatik masraflar + satış-üzerinden marj → teklif fiyatı;
  kayıt → **Satış Müdürü onay akışı**. Onaylanınca teklif hazırlanır.
- **Veri modeli:** `Customer`, `Opportunity` (procurementMethod, targetBidDate,
  technicalStatus PENDING_APPROVAL→APPROVED, costConfig forward-kur), `Proposal`
  (versiyonlu), `CostItem` (usul masrafları, paymentTermDays).
- **★ Vurgu:** *"Kuru tahsilat tarihine sabitleyen, marjı koruyan akıllı
  maliyetlendirme + müdür onayı."*

### 4.5 Presales & Dizayn (Presales / Teknik)
- **Ekip & rol:** PRESALES_MGR, PRESALES_ENG, TECHNICAL_SPEC (PRESALES_VIEW).
- **Çalışma şekli:** Şartname analizi → ürün/BoM; her kalem için **farklı
  vendorlardan teklif** alınır, **fiyat + 3-seviye teknik uygunluk** (Uygun /
  Kısmen / Uygun Değil) + **orijinal teklif dosyası** (xls/pdf…) kanıtı kaydedilir;
  yalnız teknik-uygun olan seçilebilir (sistem uygunlar içinde en ucuzu önerir) →
  BoM'a **hazırlandığı döviz/kurla** işlenir → BoM Satışa devredilir. Yönetici
  "Devredilen BoM'lar" sekmesinde işin içeriğini liste+detay inceler.
- **Veri modeli:** `BoMItem` (lineKey, currency, paymentTermDays), `BoMLineQuote`
  (technicalCompliance, isSelected, fileUrl), `BomHandoff` (fırsat-bazlı upsert,
  handoffCount, snapshot).
- **★ Vurgu:** *"En uygun BoM = fiyat + teknik uygunluk + kanıt; her seçim
  belgeli ve arşivli."*

### 4.6 Satış Destek / İhale-İSAB (Satış Destek)
- **Ekip & rol:** SALES_SUPPORT, ISAB_MGR (SALES_SUPPORT_VIEW).
- **Çalışma şekli:** Fırsattan otomatik düşen ihaleyi takip eder; idari/teknik
  şartname + atıf yapılan hususları **AI ile analiz** (veya PDF/manuel) → **verilmesi
  gereken döküman listesi**; **Şirket Evrakları envanterinden geçerli evraklar
  otomatik eşlenir**; dosya "İKN + işin adı" ile arşivlenir; **3g/2g/12s/6s
  zaman-duyarlı hatırlatmalar**; **Finans'a teminat talebi** (örnek metin + süresiz);
  "Teklif İletildi" ile **Girilen İhaleler** arşivine taşır.
- **Veri modeli:** `Tender` (method, submissionDeadline, remindersSent, specText,
  status DRAFT→…→SUBMITTED/WITHDRAWN), `TenderChecklistItem` (source AI/CORPORATE_DOC,
  isAiGenerated), `GuaranteeLetter` (talep), `specAnalysis` servisi, `tenderReminders`
  sweep.
- **★ Vurgu:** *"Şartnameyi okuyan, evrakı kendi bulan, vadeyi hatırlatan ihale
  asistanı."*

### 4.7 Sözleşme Yönetimi (KSU + Yönetim)
- **Ekip & rol:** GM, KSU_MGR, SALES_MGR, PROJECT_MGR, LEGAL, FINANCE, İGPD
  (CONTRACTS_VIEW; 7 yönetici rol kapısı).
- **Çalışma şekli:** İhale kazanımıyla otomatik oluşan sözleşme → AI analiz (evrak
  listesi) → evrak hazırlık → imza onay akışı (KSU→GM) → **SIGNED**. İmza sonrası
  **iki yöne devir:** Proje Yönetimi'ne (proje kaydı + görevler) ve **Satınalmaya**
  (BoM + referans alış fiyatları).
- **Veri modeli:** `ContractWorkflow` (status akışı, projectId, procurementRequestId),
  `ContractWorkflowDoc` (AI-üretilen evraklar).
- **★ Vurgu:** *"İmza anında iş; Proje + Satınalma tek tıkla başlar."*

### 4.8 Satın Alma (Satın Alma)
- **Ekip & rol:** PROCUREMENT_MGR (PROCUREMENT_VIEW).
- **Çalışma şekli:** Sözleşmeden gelen BoM **DRAFT talep** olarak düşer; her kalemde
  **referans alış fiyatı + üretici/distribütör kaynağı** görünür → Satınalma
  buna göre teklif toplar; 9 statülü akış (DRAFT→PENDING_UNIT→PENDING_PROCUREMENT
  →PENDING_GM→PO_ISSUED→IN_DELIVERY→INVOICED→CLOSED / REJECTED). PO→ProjeMaliyet,
  fatura→Finans otomatik.
- **Veri modeli:** `PurchaseRequest` (sourceType BOM, 9 statü), `PurchaseItem`
  (estimatedUnitPrice, refVendor/refSource), `PurchaseQuote`, `Vendor`,
  `DeliveryRecord`.
- **★ Vurgu:** *"Satınalma 'alınan fiyatı' bilerek pazarlık eder — körlemesine değil."*

### 4.9 Proje Yönetimi (Proje)
- **Ekip & rol:** PROJECT_MGR (PROJECT_MGMT_VIEW).
- **Çalışma şekli:** İmzalı sözleşmeden **otomatik proje + tipine göre milestone
  şablonu** (HARDWARE/SOFTWARE/SERVICE/MIXED); karlılık (planlı/gerçekleşen/forecast
  marj); GM onayı gereken geçişler; **11 zorunlu devir evrakı** paketi.
- **Veri modeli:** `Project` (avgMargin, code), `ProjectMilestone` (planned/actual,
  COLLECTION/INVOICING tipleri), `ProjectCostItem`, `ProjectHandoverDoc`;
  `projectFactory.createProjectWithMilestones`.
- **★ Vurgu:** *"Sözleşme imzası = hazır proje planı + karlılık takibi."*

### 4.10 Finans (Finans)
- **Ekip & rol:** FINANCE_MGR (FINANCE_VIEW); faiz/financing-apply yalnız GM/FINANCE_MGR.
- **Çalışma şekli:** Fatura/tahsilat/maliyet onayı; **Teminat:** Satış Destek
  talebini (örnek metin + süresiz) **karşılar → Aktif** yapar, Excel takip listesi;
  **Vade & Finansman Etkisi:** ödeme (alış) vadeleri + **taksitli tahsilat planı**
  + banka faizleri → **döviz-bazlı** finansman maliyeti/getirisi; net negatif →
  "Finansman Maliyeti" kalemi (yönetim onayı), pozitif → bilgi (otomatik kâr değil).
- **Veri modeli:** `Invoice`/`Payment`, `GuaranteeLetter` (REQUESTED→ACTIVE,
  isIndefinite, sampleText), `CollectionInstallment`, `BoMItem/CostItem.paymentTermDays`,
  `financingEffect` servisi, `moduleSettings.finance.interestRates`.
- **★ Vurgu:** *"Para zamanın fonksiyonudur: vadeyi, taksiti, faizi, dövizi
  kuruşuna kadar hesaplayan finans zekâsı."*

### 4.11 Görevler & Takip (Tüm Birimler)
- **Ekip & rol:** Tüm roller (TODO_VIEW).
- **Çalışma şekli:** Birimler-arası görev havuzu; **"Bekleyen Onaylarım"** onay
  swimlane'i; iş-günü SLA ile otomatik dueDate.
- **Veri modeli:** `TodoTask` (relatedModule, slaBusinessDays), `ApprovalChain`/`Stage`.
- **★ Vurgu:** *"Her devir bir göreve, her onay bir kuyruğa dönüşür — hiçbir iş
  düşmez."*

### 4.12 Şirket Evrakları (İdari / Tüm Birimler)
- **Ekip & rol:** DOCUMENTS_VIEW olan roller.
- **Çalışma şekli:** Kurumsal doküman envanteri **geçerlilik tarihiyle**; Satış
  Destek ihale evrak listesini buradan **otomatik eşler** (geçerli + tarih
  aralığında).
- **Veri modeli:** `CorporateDocument` (expiryDate, category, fileUrl).
- **★ Vurgu:** *"Geçerli evrak envanterde duruyorsa ihale dosyasına kendiliğinden gelir."*

### 4.13 Fiziksel Arşiv (İdari)
- **Ekip & rol:** ARCHIVE_VIEW olan roller.
- **Çalışma şekli:** Kutu/raf fiziksel arşiv; **kaybedilen fırsat** + **BoM tedarikçi
  değerlendirmesi** otomatik arşivlenir (değişmez kayıt).
- **Veri modeli:** `ArchiveItem` (boxNo/shelfNo/category/tags).
- **★ Vurgu:** *"Karar gerekçeleri dijital + fiziksel arşivde — denetime hazır."*

### 4.14 Genel Hususlar / Kurumsal Yönetişim (KGD + Yönetim)
- **Ekip & rol:** CORPORATE_GOV_VIEW (kalite/yönetişim).
- **Çalışma şekli:** Dersler (lessons learned), risk/fırsat (skor = olasılık×etki),
  KPI, dış doküman kaydı; **tenant-yapılandırılabilir doküman kodlama** (şirket
  kodu/ayraç/sıra) — üçüncü-taraf notasyonu kullanılmaz.
- **Veri modeli:** `LessonsLearned`, `RiskOpportunity`, `CorporateMetric`,
  `ExternalDocumentRegister`, `DocumentCodingProfile`/`CategoryCode`/`Sequence`.
- **★ Vurgu:** *"Kurumsal hafıza + risk + özgün doküman kodlama tek çatıda."*

### 4.15 Şirket Ayarları (ADMIN / GM)
- **Ekip & rol:** SETTINGS_VIEW + alt izinler; lisans üretimi & Modüller yalnız GM.
- **Çalışma şekli:** Şirket profili, **birim & kullanıcı yönetimi**, iş akışı
  şablonu (skip-logic), **yetki (RBAC) düzenleme**, **YZ entegrasyonu** (istenilen
  sağlayıcı — tenant kendi API key'i, OpenAI-uyumlu), Nextcloud/e-posta/WhatsApp,
  abonelik & kullanım, lisans planları, sanal-agent modülleri.
- **Veri modeli:** `Tenant`/`Unit`/`User`, `Workflow`/`WorkflowStep`, `Subscription`,
  `PluginEntitlement`.
- **★ Vurgu:** *"RBAC ve iş akışı kod değiştirmeden, ekrandan yönetilir."*

### 4.16 Test Ortamı — Güvenlik · Sanal Agentlar · Denetim İzi (Yalnız GM)
- **Ekip & rol:** Yalnız GENERAL_MANAGER.
- **Çalışma şekli:** OWASP/güvenlik testi; **8 sanal birim-agentı** kataloğu +
  imzalı lisans + çalıştırma (boş koltuğu deterministik vekil doldurur; para &
  hukuk ADVISORY-only); ActivityLog **denetim izi** görüntüleyici (insan/agent
  köken etiketiyle).
- **Veri modeli:** `PluginEntitlement`, `AgentRun` (provenance, ratifikasyon),
  `ActivityLog`.
- **★ Vurgu:** *"Boş koltuğu agent doldurur; her işlem köken-etiketli denetim izinde."*

**Onay swimlane (kesişen):** OPPORTUNITY/PROPOSAL → FINANCE_MGR → IGPD_MGR →
GENERAL_MANAGER → KSU_MGR; CONTRACT_WORKFLOW_SIGNING → KSU_MGR → GENERAL_MANAGER.
Aktif kullanıcısı olmayan rol otomatik atlanır (lisanslı otonom agent varsa
agent-onaylı). **Hukuk (LEGAL_MGR)** sözleşme/dava hukuki incelemesini danışman
olarak yürütür; **İGPD/KGD** iş geliştirme ve kalite güvence rolüyle swimlane'de
yer alır.

---

## 5. Sidebar Hızlı Erişim Matrisi (Tek Bakışta Özet)

> Bölüm 4'ün özeti; slaytta "tek tablo" görünümü için. Detaylı çalışma şekli
> ve veri modelleri için Bölüm 4'e bakın.

| Menü | Modül | Ne yapar | Erişim (izin) | Kısıt / kriter |
|------|-------|----------|---------------|----------------|
| **Dashboard** | Role-bazlı Kokpit | Role özel widget seti: zamana-duyarlı işler + yönetim KPI'ları | DASHBOARD_VIEW | İçerik role göre değişir; klasik KPI grafikleri yalnız yöneticilere |
| **Yönetim Raporları** | ManagementReporting | Birim metrikleri, iş-akışı darboğazı, birim raporu gönder/incele, yazdırma | MANAGEMENT_REPORTS_VIEW | Yalnız yönetici; rapor inceleme escalation hiyerarşisiyle |
| **Ziyaret Planı** | VisitPlan | Haftalık ziyaret planı + günlük rapor, plan-gerçekleşen mutabakatı, Excel | VISIT_PLAN_VIEW | Personel KPI = ziyaret eşleşme oranı |
| **CRM & Müşteri** | CRMModule | Genel Bakış · Fırsatlar · **Maliyet Analizi** · Teklifler · Müşteriler · Canlı Pazarlıklar | CRM_VIEW (+ alt izinler) | Fırsat açarken usul+vade zorunlu önerilir; maliyet analizi Satış'ta |
| **Presales & Dizayn** | PresalesModule | BoM & Tasarım + vendor teklif değerlendirme + (yönetici) Devredilen BoM'lar | PRESALES_VIEW | "Devredilen BoM'lar" sekmesi yalnız PRESALES_MGR/GM |
| **Satış Destek** | SalesSupport | İhale listesi/takvim, uygunluk denetimi (şartname→döküman), teminat talebi, Girilen İhaleler | SALES_SUPPORT_VIEW | Yönetim "İhaleye İştirak Etme" (çekilme) butonu yalnız GM |
| **Sözleşme Yönetimi** | ContractWorkflow | Evrak/imza/AI analiz, Proje'ye + **Satınalmaya** aktar | CONTRACTS_VIEW | 7 yönetici rol kapısı; imzalı sözleşme satınalmaya devredilir |
| **Satın Alma** | ProcurementModule | Talep→tedarikçi→PO→teslimat→fatura (9 statü); referans alış fiyatları görünür | PROCUREMENT_VIEW | Sözleşmeden gelen BoM DRAFT PR olarak düşer |
| **Proje Yönetimi** | ProjectManagement | Milestone, maliyet, karlılık, 11 evraklı devir paketi | PROJECT_MGMT_VIEW | İmzalı sözleşmeden otomatik proje |
| **Finans** | FinanceModule | Faturalar · Tahsilat · Teminat Mektupları · Maliyet Onayı · **Vade & Finansman** · Özet | FINANCE_VIEW | Faiz oranları/financing-apply yalnız GM/FINANCE_MGR |
| **Görevler & Takip** | TodoModule | Görev yönetimi + "Bekleyen Onaylarım" swimlane | TODO_VIEW | İş-günü SLA ile otomatik dueDate |
| **Şirket Evrakları** | DocumentsModule | Kurumsal doküman envanteri (geçerlilik tarihli) | DOCUMENTS_VIEW | İhale evraklarına otomatik eşleme kaynağı |
| **Fiziksel Arşiv** | ArchiveModule | Kutu/raf fiziksel arşiv; kaybedilen fırsat + BoM değerlendirme arşivi | ARCHIVE_VIEW | — |
| **Genel Hususlar** | CorporateGovernance | Dersler/risk/KPI/dış doküman + tenant doküman kodlama | CORPORATE_GOV_VIEW | Doküman no tenant-yapılandırılabilir |
| **Şirket Ayarları** | SettingsModule | Şirket profili, birimler, kullanıcılar, iş akışı, yetkiler, entegrasyon, abonelik, lisans, modüller | SETTINGS_VIEW (+ alt) | Lisans anahtarı üretimi + Modüller yalnız GM |
| **Test Ortamı** (GM) | Güvenlik / Sanal Agentlar / Denetim İzi | OWASP testi · 8 agent kataloğu+lisans · ActivityLog görüntüleyici | GM-only | Yalnız Genel Müdür |

---

## 6. Uçtan Uca Otomatik Akış (Anlatı Şeması)

```
Ziyaret/CRM ──► Fırsat (satınalma usulü + son teklif tarihi)
   │                        │
   │                        ├─► Satış Destek: ihale dosyası
   │                        │   (şartname analizi → döküman listesi →
   │                        │    Şirket Evraklarından otomatik eşleme →
   │                        │    3g/2g/12s/6s hatırlatmalar → Teklif İletildi)
   │                        │
   │   [Yönetim: İhaleye girmeme kararı — akış kesilir, KPI-NÖTR]
   │                        │
   ▼                        ▼
Presales BoM ──► Vendor teklif değerlendirme (fiyat + teknik uygunluk +
   │             dosya kanıtı → en uygun → BoM'a işle, hazırlandığı kurla)
   │             └─► Devredilen BoM (yönetici KPI + liste/detay)
   ▼
Satış: Maliyet Analizi (forward kur + usul masrafları + marj)
   │   └─► Satış Müdürü onayı
   ▼
Sözleşme imza (ContractWorkflow)
   ├─► Proje Yönetimi (otomatik proje + milestone)
   └─► Satın Alma (BoM + referans alış fiyatları → DRAFT talep)
   ▼
Finans: teminat (talep→düzenle) · vade & finansman etkisi (taksitli tahsilat)
   ▼
Dashboard: role-bazlı kokpit tüm bunları + zamana-duyarlı işleri öne çıkarır
```

**Otomatik geçiş halkaları:** İhale WON→Sözleşme · Sözleşme SIGNED→Proje ·
Proje→Satınalma maliyet kalemi · Satınalma faturası→Finans · WON Fırsat→Proje.

---

## 7. Öne Çıkan Yetenekler (Pitch Vurguları)

1. **Role-bazlı kokpit** — Her kullanıcı kendi işine odaklı bir dashboard görür;
   GM tüm tabloyu (KPI + darboğaz + zaman uyarıları) görür.
2. **Zamana-duyarlı zekâ** — İhale vadeleri, teminat süreleri, fatura vadeleri,
   bekleyen onaylar eşik bazlı uyarılarla öne çıkar (poll-sweep, cron'suz).
3. **Vendor teklif değerlendirme** — Fiyat + teknik uygunluk + orijinal dosya
   kanıtıyla en uygun teklif BoM'a; değerlendirme arşivlenir ve teklife yansır.
4. **Finansal zekâ** — Forward kur, satınalma usulü masrafları, **taksitli
   tahsilat + banka faizi** ile döviz-bazlı finansman maliyeti/getirisi;
   negatif etki maliyet kalemi, pozitif etki yönetim kararı.
5. **Teminat yönetimi** — Şartnameden talep → Finans örnek metinle düzenler;
   süresiz teminatlar; Excel takip listesi.
6. **Yönetimsel adalet** — "İhaleye girmeme" kararı birim KPI'larını
   cezalandırmaz (emek görünür, kayıp sayılmaz).
7. **8 sanal birim-agentı** — Boş koltuğu deterministik vekiller doldurur; para
   ve hukuk **ADVISORY-only** (asla otonom); imzalı lisans + köken etiketi.
8. **Denetlenebilirlik** — Her işlem ActivityLog'da; insan/agent ayrımı; RBAC
   405 test ile her sürümde güvence.

---

## 8. Pitch Deck İçin Slayt İskeleti (Öneri)

1. **Kapak** — "Enflow: Fırsattan teslime, tek akış."
2. **Problem** — B2B/ihale süreçleri parçalı; döviz/vade/teminat hataları
   maliyetli; birimler-arası kopukluk.
3. **Çözüm** — Uçtan uca, otomatik geçişli, role-bazlı kokpitli platform.
4. **Mimari** — 7 katman + çok-kiracılı + AI agent şeması (Bölüm 2.1).
5. **Akış** — Uçtan uca akış şeması (Bölüm 6).
6. **Role-bazlı Dashboard** — GM kokpiti ekran görüntüsü; "herkese kendi işi".
7. **Finansal Zekâ** — Forward kur + taksitli finansman etkisi; "kuruşuna kadar".
8. **Yönetişim & Güvenlik** — RBAC 19 rol, 405 test, denetim izi, çok-kiracılı izolasyon.
9. **Sanal Agentlar** — Boş koltuğu dolduran 8 deterministik vekil.
10. **Kapanış / CTA** — Demo + iletişim.

> **Görsel öneri:** Bölüm 2.1, 4, 6 tablo/şemaları Claude Design'da infografik;
> Dashboard ekran görüntüleri rol-bazlı farkı göstermek için yan yana.

---

## 9. Çalışma Kriterleri & Kısıtlar (Özet)

- **Çok-kiracılı izolasyon:** Veri `tenantId` ile ayrışır; cross-tenant erişim yok.
- **Rol kapısı:** Hassas aksiyonlar `requireRole` ile; örn. çekilme kararı/faiz
  ayarı/lisans üretimi yalnız üst yönetim.
- **Para birimi:** Tek-toplam zorlanmaz; eksik döviz bloke edilir (kritik kural).
- **Pozitif finansman etkisi** otomatik kâr sayılmaz (yönetim insiyatifi).
- **Para (Finans) ve Hukuk agentları** asla otonom değildir (ADVISORY-only).
- **Doküman kodlama** özgün + tenant-yapılandırılabilir (üçüncü-taraf notasyonu yok).
- **Canlıya çıkışta:** `PLUGIN_LICENSE_SECRET` değiştirilmeli; SQLite→Postgres
  taşınabilir; Nextcloud/e-posta entegrasyonları yapılandırılır.

---

*Bu döküman kod tabanından (schema.prisma, constants.ts, role-matrix.ts,
unitReportingService, dashboardService, finance/tenders/contractWorkflow
route'ları ve CLAUDE.md) türetilmiştir. Sunum/video üretiminde slayt başlıkları
ve şemalar doğrudan kullanılabilir.*
