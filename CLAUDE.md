# Enflow — Proje Bağlamı

## Proje Nedir

Enflow, B2B satış ve iş süreçlerini yöneten çok kiracılı (multi-tenant) bir SaaS platformudur. Satış fırsatlarının CRM'den başlayıp sözleşme imzalanmasına ve proje yönetimine aktarılmasına kadar tüm yaşam döngüsünü kapsar.

**Hedef kullanıcı rolleri:** GENERAL_MANAGER, SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL, PROJECT_MANAGER, ADMIN

**Kurumsal onay swimlane rolleri (2026-06-16 eklendi):** FINANCE_MGR, IGPD_MGR (İş Geliştirme), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Birimi), LEGAL_MGR (Hukuk) — `src/constants.ts` ROLE_LABELS'ta tanımlı; karşılık gelen `Unit` kayıtları tenant-1'e eklendi. **IGPD_MGR/KGD_MGR fiili onay kapısı (2026-08-19):** önceden yalnız görünürlük/danışma (İGB → `AGENT_IGPD` triyaj notu) idi, hiçbir `ApprovalStage`'de yoktu — `workflowTemplate.ts` `DEFAULT_WORKFLOW_TEMPLATE`'e eklendi: İGB → `OPPORTUNITY_APPROVAL` 2. aşama (SALES_MGR sonrası, GENERAL_MANAGER'dan önce), KY → `CONTRACT_TO_PROJECT` 1. aşama (PROJECT_MGR'dan önce). Şablon değişikliği yalnız HENÜZ kurgulanmamış (yeni) tenant'lara otomatik uygulanır (`applyDefaultWorkflowTemplate` var olan süreçlerin üzerine yazmaz) — zaten kurgulanmış tenant-1'e `backend/src/scripts/backfill-workflow-igpd-kgd-steps.ts` ile geriye dönük işlendi (idempotent, rol zaten varsa atlar).

## Versiyonlama Kuralı

**Güncel sürüm: Enflow v2.5.0** — tek kaynak `src/constants.ts` `APP_VERSION`; kök `package.json` ve `backend/package.json` `version` alanları bununla senkron tutulur (üçü aynı anda güncellenir).

Format `vMAJOR.MINOR.PATCH`:
- **Feature eklemesi** → PATCH artar (`v2.1.0` → `v2.1.1` → `v2.1.2` → ...). Bir değişikliği PATCH'e yansıtmadan **önce**, eklenenin gerçekten bir feature olduğu (bugfix/refactor/dokümantasyon/chore/bakım değil) kullanıcıya sorularak doğrulanır — onay verilmeden versiyon numarası **değiştirilmez**.
- **Mimari değişiklik** (yeni katman, veri modeli/şema genişlemesi, alt-sistem yeniden yapılandırması, kritik bağımlılık/altyapı göçü) → MINOR bir üst basamağa taşınır, PATCH sıfırlanır (`v2.1.x` → `v2.2.0`).
- Versiyon artırımı otomatik/varsayılan davranış değildir; her seferinde kullanıcıdan açık onay alınır.

## Sistem Durumu & Uçtan Uca Akış (Güncel — 2026-06-20)

**Ölçek:** 75 Prisma modeli · 31 API alanı (`/api/*`) · 30 ekran modülü · 11 servis · 8 sanal agent · 7 katman.
**Durum:** Faz 0–9 + bağımlılık/mobil/refactor tamamlandı. Tüm birimler-arası geçişler **otomatik** (zincir kapalı). RBAC süiti **69/69**.

**Uçtan uca otomatik akış:**
```
Ziyaret → CRM(Fırsat) → Presales(BoM/Maliyet) → Teklif/Müzakere
  → [İhale/İSAB] → Sözleşme(ContractWorkflow imza) → Proje → Satınalma → Finans
```
Otomatik geçiş halkaları (Faz 9): **İhale WON→Sözleşme** (T3) · **Sözleşme SIGNED→Proje kaydı** (T4) · **Proje→Satınalma maliyet kalemi** (T5) · **Satınalma faturası→Finans Invoice** (T6) · WON Fırsat→Proje (T1).

**Akış motoru (orkestrasyon):** Workflow/WorkflowStep (skip-logic), TodoTask (birimler-arası görev + SLA), ApprovalChain/Stage (Finans→İGPD→GM→KSU swimlane), `workflowService.triggerHandOff` (devir+e-posta+bildirim), Notification/ActivityLog.

**8 sanal agent (hepsi AVAILABLE):** Tender · Project · Presales · Procurement · Finance · Legal · CRM · İGPD — para (Finance) ve hukuk (Legal) **ADVISORY-only** (asla otonom). Köken etiketi `AGENT:<pluginKey>`.

> 📚 **Sistemi sıfırdan anlamak / tek-kaynak akış referansı:** `walkthrough.md §27` (Bileşen Envanteri & Uçtan Uca Akış — canlı **enflow-wiki** kaynağı, bkz. `wiki/index.html` / `/wiki`). Bu CLAUDE.md mimari/karar referansı; §27 anlatısal akış kaynağı. Ekran-bazlı kullanım kılavuzu için uygulama-içi **Yardım modülü** (`src/content/helpArticles.ts`).

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | **React 19** + TypeScript **6** (strict), **Vite 8 (Rolldown bundler)**, TanStack Query v5 |
| UI | Tailwind CSS v4, glass-morphism (`glass-card`, `input-glass`, `btn-primary`, `btn-secondary`), `motion/react` (paket adı `motion`, **framer-motion değil**) |
| Backend | Express.js v5, TypeScript, Prisma ORM |
| DB | SQLite (dev), Prisma migrations |
| İconlar | `lucide-react` v1 |
| Tipler | **`@types/react@19` + `@types/react-dom@19` kurulu** (React/JSX tipleri tam; `as any` gereksiz) |
| Package manager | **pnpm** |

## Çalıştırma

```bash
# Frontend (dev: port 3000 — vite.config server.port=5173 default ama --port 3000 ile çalışır)
pnpm dev --port 3000

# Backend (port 3002)
cd backend && pnpm dev
```

> ⚠️ **Migration sonrası:** `npx prisma migrate dev` + `npx prisma generate`, ardından **backend'i yeniden başlat** — nodemon eski Prisma client ile çökebilir (TS2339).

**Test kullanıcısı:** `gokhan@t-ecosystem.com` / şifre: `123456`  
**Tenant:** `tenant-1`, Rol: `GENERAL_MANAGER`

## Mimari

### Frontend

- `src/App.tsx` — ana router; `activeTab` state ile modül geçişi (`setActiveTab('module-key')`)
- `src/modules/` — her modül kendi sekmesi
- `src/hooks/useEnflowQueries.ts` — TanStack Query hooks (useOpportunities, useProposals, vb.)
- `src/services/apiClient.ts` — `ApiClient` sınıfı; **`fetchWithAuth(path, init)`** zaten parse edilmiş JSON döner, üstüne `.ok` veya `.json()` çağırma
- `src/services/apiService.ts` — `ApiService` sınıfı, apiClient'ı wrap eder
- `src/contexts/AuthContext.tsx` — `useAuth()` → `currentUser`, `setAuth(token, tenantId)`

**API path kuralı:** `apiClient.fetchWithAuth(path)` çağrısında path `/api` **olmadan** yaz — client zaten ekliyor. Örn: `/contract-workflows` → tam URL `/api/contract-workflows` olur.

### Backend

- `backend/src/index.ts` — Express app, tüm router mount noktaları
- `backend/src/routes/` — her domain için ayrı router
- `backend/prisma/schema.prisma` — tek kaynak gerçeklik; migration'lar `backend/prisma/migrations/` altında
- `req.tenantId` — `Express.d.ts` namespace declaration ile ekleniyor, cast gerekmez
- Express v5'te `req.params.id` tipi `string | string[]` — `String(req.params.id)` ile al

**Upload:** `multer` memoryStorage → lokal `backend/uploads/contracts/{folder}/` + opsiyonel Nextcloud WebDAV  
**Static dosyalar:** `GET /uploads/...` → `backend/uploads/` dizini

## Veritabanı Modelleri (Prisma) — 79 model, katmanlı

Tüm modeller `tenantId` ile izole. (Tam sayım: `grep -c '^model' backend/prisma/schema.prisma`.)

**Platform/SaaS:** `Tenant` · `Subscription` · `UsageMetric`
**Kimlik/RBAC:** `User` (rol + izin JSON) · `Unit`
**Akış motoru:** `Workflow` / `WorkflowStep` (default şablon + skip-logic) · `WorkflowLog` · `TodoTask` (birim görevi, relatedModule + relatedItemId, SLA) · `ApprovalChain` / `ApprovalStage` (Finans→İGPD→GM→KSU) · `Notification` · `ActivityLog` (provenance: actorType, agentRunId)
**Domain — CRM/Satış:** `Customer` · `Opportunity` (costConfig, lostReason, updatedBy) · `Proposal` (versiyonlu)
**Domain — Presales:** `BoMItem` · `CostItem` · `CostAnalysisVersion` (maliyet analizi versiyon geçmişi/snapshot — Faz 10)
**Domain — Sözleşme:** `Contract` (eski) · `ContractWorkflow` (projectId — Faz 9 T4; deliveryPeriodDays/deliveryDueDate/penaltyDailyRatePct/penaltyCapPct — teslim süresi takibi) · `ContractWorkflowDoc` · `DeliveryTimelineStep` (tenderId/contractWorkflowId — alt kırılımlı tahmini teslim takvimi)
**Domain — Proje:** `Project` · `ProjectMilestone` · `ProjectCostItem` (purchaseRequestId — Faz 9 T5) · `ProjectHandoverDoc` (11 zorunlu evrak)
**Domain — Satınalma:** `Vendor` · `PurchaseRequest` (9 statü) · `PurchaseItem` · `PurchaseQuote` · `DeliveryRecord`
**Domain — Finans:** `Invoice` (SALES/PURCHASE, purchaseRequestId — Faz 9 T6) · `Payment` · `GuaranteeLetter`
**Domain — Hukuk:** `LegalCase`
**Domain — İhale/İSAB:** `Tender` (contractWorkflowId — Faz 9 T3) · `TenderChecklistItem`
**Domain — Saha:** `VisitPlan` / `Visit` · `DailyReport`
**Yönetişim/Belge:** `DocumentCodingProfile` / `DocumentCategoryCode` / `DocumentSequence` (tenant-yapılandırılabilir doküman no) · `LessonsLearned` · `RiskOpportunity` · `CorporateMetric` · `ExternalDocumentRegister` · `CorporateDocument` · `ArchiveItem` · `UnitReport` (birim raporu, metricsSnapshot)
**AI/Sanal Agent:** `PluginEntitlement` (lisans) · `AgentRun` (köken/ratifikasyon)

## Modüller ve Sidebar Menüsü

| Sekme key | Bileşen | Açıklama |
|-----------|---------|----------|
| `dashboard` | `Dashboard` | Özet metrikler |
| `visit-plan` | `VisitPlanModule` | Haftalık ziyaret planı + günlük rapor |
| `crm-dashboard` | `CRMModule` | CRM Genel Bakış — alt modüllere kart üzerinden erişim |
| `crm-opportunities` | `CRMModule` | Fırsatlar |
| `crm-customers` | `CRMModule` | Müşteriler |
| `crm-proposals` | `CRMModule` | Teklifler |
| `crm-negotiation` | `CRMModule` | Canlı Pazarlıklar |
| `presales` | `PresalesModule` | BoM (malzeme listesi) + maliyet analizi + Şartname Analizi + **Şartname ↔ Ürün Uygunluk** (`SpecComplianceMatrix` — teknik şartname maddeleri vs. ürün specsheet'leri, YZ uygunluk matrisi + xlsx; yalnız YZ anahtarı varsa) |
| `negotiation` | `NegotiationModule` | Müzakere + anlaşma |
| `contract` | `ContractModule` | Eski sözleşme modülü |
| `project-mgmt` | `ProjectManagementModule` | Tam proje yaşam döngüsü — milestone, maliyet, karlılık, devir paketi |
| `procurement` | `ProcurementModule` | Satınalma talebi → tedarikçi → PO → teslimat → fatura (9 statü) |
| `sales-support` | `SalesSupport` | **İhale/İSAB** — Tender CRUD + uygunluk checklist + teminat (backend destekli) |
| `finance` | `FinanceModule` | Fatura/tahsilat/teminat/maliyet onayı/özet (FINANCE_VIEW) |
| `profitability` | `ProfitabilityModule` | **Kârlılık** — zamana duyarlı proje/aylık/çeyreklik/yıllık kârlılık; planlanan (öngörü) + gerçekleşen paralel, tahakkuk + nakit esası paralel, as-of tarihli, EAC. Faz A–E: canlı plan + `/api/profitability/{ledger,summary,cashflow,treasury,instruments,snapshots,plan-drift,dmo}` + `POST /snapshot` (tarihli-defter `profitabilityLedger.ts` → `bucketBy` `profitabilityRollup.ts`; nakit pozisyonu + faiz-bazlı hazine `profitabilityCashflow.ts`; aylık plan-drift `ProfitabilitySnapshot` + `profitabilitySnapshot.ts` + cron `profitabilitySnapshotScheduler.ts`; finansal enstrüman senaryoları `profitabilityInstruments.ts` — faktoring/vadeli mevduat/forward FX, gösterge deltalar). Nakit pozisyonu grafiği + hazine paneli + plan-drift tablosu + enstrüman senaryo kartları. **Faz E:** DMO kanalı (`profitabilityDmo.ts` + `GET /dmo`, `requireEntitlement('DMO_MODULE')`) — `DmoOrder` snapshot'larını döneme kovalar (ciro/risturn/komisyon/net kâr/kârsız sayısı), **proje kümülatifine karışmaz**; modülde "Projeler | DMO Kanalı" üst sekmesi, DMO sekmesi yalnız lisanslıysa görünür (`DmoChannelTab.tsx`). Yeni `PROFITABILITY_VIEW` izni (GM/FINANCE_MGR/SALES_MGR/PROJECT_MGR/BACKUP_ADMIN). Tek kaynak: `docs/KARLILIK_ANALIZI_PLAN.md` |
| `management-reports` | `ManagementReportingModule` | Yönetim Raporları — birim metrik + darboğaz + UnitReport + yazdırma (MANAGEMENT_REPORTS_VIEW) |
| `corporate-governance` | `CorporateGovernanceModule` | Genel Hususlar — dersler/risk/KPI/dış doküman + doküman kodlama (CORPORATE_GOV_VIEW) |
| `todo` | `TodoModule` | Görev yönetimi + "Bekleyen Onaylarım" onay swimlane |
| `documents` | `DocumentsModule` | Kurumsal dokümanlar — sidebar'da alt-menü: Kurumsal Evraklar + Fiziksel Arşiv |
| `archive` | `ArchiveModule` | Fiziksel arşiv — `documents` sidebar grubunun alt-öğesi (`src/constants.ts` NAV_ITEMS.subItems), kendi route/component'i aynı kalır |
| `settings` | `SettingsModule` | Ayarlar (kullanıcı, birim, yetki, abonelik, doküman kodlama, entegrasyon) |
| `contract-workflow` | `ContractWorkflowModule` | **Sözleşme Yönetimi** (tam modül) — evrak/imza/AI analiz/transfer→Proje + Hukuk görünümü (mode: contracts\|legal). Backend rol kapısı: GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL+FINANCE+İGPD |
| `contract-workflow-test` | (legacy alias → `ContractWorkflowModule`) | Geriye dönük uyumluluk; ayrı UI yok |
| `security-test` | `SecurityTestModule` | **TEST/GM** — OWASP/güvenlik testi |
| `virtual-agents-test` | `VirtualAgentsTestModule` | **TEST/GM** — Sanal agent kataloğu + lisans + çalıştırma (8 agent) |
| `activity-log` | `ActivityLogModule` | **TEST/GM** — Denetim İzi (ActivityLog) filtreli görüntüleyici |
| `platform-tickets` | `PlatformTicketsModule` | Talep & Geri Bildirim — tenant kullanıcısı Enflow'a ürün talebi/hata/iyileştirme gönderir (DASHBOARD_VIEW, herkes); sınıflandırma/öncelik/timeline **dış** bir triage aracı tarafından `/api/platform-tickets-admin` üzerinden yazılır |

## ContractWorkflow Modülü — Aktif Geliştirme

### Durum Akışı

```
DRAFT
  → ANALYSIS_DONE      (AI analizi tamamlandı, evrak listesi oluştu)
  → PREPARATION        (evrak hazırlık)
  → READY_TO_SIGN      (tüm zorunlu evraklar yüklendi — otomatik geçiş)
  → PENDING_SIGNATURE_APPROVAL  (birim yöneticisine onaya gönderildi)
  → SIGNED             (yönetici onayladı)
  → TRANSFERRED        (görevler Proje Yönetimine aktarıldı — otomatik)
```

**Otomatik geçişler:**
- Tüm `isRequired: true` evraklar `UPLOADED/VERIFIED/WAIVED` olduğunda → `READY_TO_SIGN` (handleFileUpload içinde)
- "Onayla & Aktar" butonunda → önce `SIGNED`, hemen ardından `/transfer` çağrısı → `TRANSFERRED`

### 5 Sekme

1. **Bağlam** — İhale adı, İKN, sözleşme bedeli (kazanılan tekliften otomatik), son tarih
2. **Analiz** — Sözleşme metni + idari şartname; YZ ile analiz (tenant-yapılandırmalı **istenilen YZ** — Ayarlar→Entegrasyonlar; yoksa deterministik mock fallback)
3. **Evrak Takibi** — Evrak kartları, her kart satır içi "Yükle" butonu; yükleme tamamlanınca otomatik ilerleme
4. **İmzalama** — 4 adımlı onay akışı (bkz. yukarıdaki durum akışı)
5. **Proje Aktarımı** — AI görevleri TodoTask olarak aktarılır; bilgi ekranı

### Evrak Durum Akışı

`PENDING` / `IN_PROGRESS` → amber **Yükle** butonu  
`UPLOADED` (dosya var) → yeşil check + dosya linki + **Değiştir**  
`VERIFIED` → yeşil "Onaylandı" badge  
`WAIVED` → gri "Muaf" badge

### Backend Endpoint'leri (`/api/contract-workflows`)

```
GET    /                          → tüm workflow'lar (tenant)
POST   /                          → yeni workflow; title otomatik: "{tenderName} — İKN: {tenderNo}"
GET    /:id                        → tek workflow (documents include)
PUT    /:id                        → güncelle (title, status, signedDate, vb.)
DELETE /:id                        → sil

POST   /:id/analyze                → YZ analiz (tenant-yapılandırmalı, sağlayıcıdan bağımsız); evrak listesi oluştur
POST   /:id/documents              → evrak ekle
PUT    /:id/documents/:docId       → evrak güncelle
DELETE /:id/documents/:docId       → evrak sil
POST   /:id/documents/:docId/upload → dosya yükle (multer); lokal veya Nextcloud
POST   /:id/transfer               → AI görevleri → TodoTask; status=TRANSFERRED
```

### Dosya Yükleme Notları

- Klasör adı: `slugify(tenderName)_slugify(tenderNo)` — Türkçe karakterler ASCII'ye çevrilir
- Lokal path: `backend/uploads/contracts/{folder}/{timestamp}_{filename}`
- Nextcloud: MKCOL + PUT via WebDAV (yapılandırılmışsa); hata olursa lokale düşer
- Upload `fetch` ile yapılır (`apiClient` değil) — çünkü `FormData` gönderiliyor, manuel header eklenir

## Teklif Durum Sıralaması

```ts
const STATUS_RANK = { APPROVED: 4, ACCEPTED: 3, SENT: 2, PENDING_APPROVAL: 1, DRAFT: 0, REJECTED: -1 }
```
`bestProposalPrice(opportunityId, proposals)` → en yüksek ranked + en yüksek versiyonlu teklifin fiyatı

## Önemli Teknik Kararlar

- **`motion/react`** — `framer-motion` paketi yok, `motion` paketi var (`^12.x`)
- **`apiClient.fetchWithAuth`** — parse edilmiş JSON döner; `.ok` / `.json()` çağırma
- **Express v5 params** — `String(req.params.id)` helper kullan
- **`req.tenantId`** — `Express.d.ts` namespace'den geliyor, cast gereksiz
- **multer v2** — `upload.single('file')` middleware, `req.file.buffer` kullan
- **No `console.log`** — `utils/logger` kullan (production rule)
- **No `any`** — TypeScript strict mode; `@types/react` kurulu olduğundan React/JSX tipleri tam, `as any` gerekmez
- **Vite 8 / Rolldown** — chunking `vite.config.ts` `build.rollupOptions.output.advancedChunks.groups` (regex `test`, `minSize:0`); eski `manualChunks` fonksiyonu Rolldown'da vendor'ları inline ediyordu
- **TypeScript 6** — `catch (e: unknown)` daraltması zorunlu; opsiyonel JSX bileşeni guard'la (`{x && <x/>}`)
- **Migration sonrası** — `prisma generate` + **backend restart** (nodemon eski client'la çöker)
- **Portlar** — dev frontend **3000**, backend **3002** (vite.config server.port=5173 default, `--port 3000` ile çalıştırılır)
- **Servis yeniden kullanımı** — proje oluşturma `backend/src/services/projectFactory.ts` `createProjectWithMilestones` (projects.ts POST + contractWorkflow `/transfer` ortak); create metod imzaları `Partial<X>`
- **Denetim-izi** — mutasyon sonrası `logActivity({ tenantId, userId, action, entityType, entityId, details? })` (`backend/src/services/activityLog.ts`, **non-throwing** — ana akışı bozmaz); okuma `GET /api/activity-logs`. Agent işlemleri `actorType:'AGENT'`+`agentRunId` (Faz 8.3). Yeni mutasyon endpoint'i = logActivity çağrısı ekle.
- **YZ entegrasyonu — sağlayıcıdan bağımsız** — Tüm YZ çağrıları `backend/src/services/aiClient.ts` (`chatJSON`, **OpenAI-uyumlu `/chat/completions`** `fetch`) üzerinden. Sağlayıcı **hard-code edilmez** ("istenilen YZ"): tenant kendi `{ baseUrl, apiKey, model }` değerini **Ayarlar→Entegrasyonlar**'dan girer → `Tenant.moduleSettings.ai`. Route: `GET/PUT /api/tenants/ai-settings` (GM-only; key **maskeli**, GET'te yalnız `hasKey`, **asla loglanmaz/echo edilmez**). Kullanan: `specAnalysis.analyzeSpec` (sözleşme/ihale) + `POST /api/presales/spec-extract` (şartname→ürün) + `POST /api/presales/spec-compliance` (şartname maddeleri ↔ ürün specsheet uygunluk matrisi; grup başına 1 `chatJSON`; **deterministik fallback YOK** — YZ yoksa `{usedAI:false, groups:[], message}` döner, istemci "Karşılaştır"ı pasifleştirir; sonuç istemcide xlsx'e dönüşür, DB'ye yazılmaz). Config yoksa/hata → deterministik **mock fallback** (yalnız fallback'i olan çağrılar; spec-compliance hariç). **Client-side YZ çağrısı yasak** (eski Gemini/`@google/genai` kaldırıldı; `@anthropic-ai/sdk` de kaldırıldı).
- **Tenant verisi şifreleme** (Faz 12) — `backend/src/services/tenantEncryption.ts`: `encryptForTenant`/`decryptForTenant`, AES-256-GCM, tenant-başına DEK (envelope, `Tenant.dekWrapped`, master key `DATA_ENCRYPTION_MASTER_KEY`). Şifreli değer öneki `enc:v1:` — önek yoksa düz metin kabul edilir (kademeli geçiş, decrypt kırılmaz). Kapsam: YZ `apiKey` + `Vendor.iban`/`bankName` + `Customer.taxNumber`/`taxOffice`. Yeni alan eklerken: route'ta `encryptForTenant` (yazım) / `decryptForTenant` (okuma) çağır, **genel Prisma `$extends`'e ekleme** (money-rounding hot path'i tüm modeller için uniform, alan şifreleme seçici — ayrı tutulmalı). `Tenant` döndüren route'larda `dekWrapped` **her zaman** `omit` edilmeli. bkz. `docs/TENANT_DATA_ENCRYPTION_PLAN.md`.

## Proje Yönetimi Modülü — Mimari

**Akış:** WON fırsat → Proje Yönetimi'nde "Yeni Proje" → fırsat seçici → proje formu otomatik dolar → backend milestone şablonu oluşturur.

### Proje Tipleri ve Milestone Şablonları
| Tip | Otomatik Aşamalar |
|-----|------------------|
| HARDWARE | Planlama → Satınalma → Sevkiyat → Kurulum → Kabul → Garanti → Faturalama → Tahsilat |
| SOFTWARE | Planlama → Geliştirme → Test → Kabul → Faturalama → Tahsilat |
| SERVICE | Planlama → Kurulum → Kabul → Faturalama → Tahsilat |
| MIXED | HARDWARE + DEVELOPMENT + TESTING |

Paralel çalışabilecek milestone'lar `isParallel: true`, GM onayı gerektiren geçişler `requiresApproval: true`.

### Karlılık Hesaplama
```ts
plannedMargin = (contractValue - totalPlannedCost) / contractValue * 100
actualMargin  = (contractValue - totalActualCost)  / contractValue * 100
forecastCost  = actualCost + remainingPlannedCost
```

### Backend Endpoint'leri (`/api/projects`)
```
GET    /                    → liste (status/type filtresi)
GET    /summary/all         → MUTLAKA /:id'den ÖNCE — karlılık özeti (CONFLICT önlemek için)
GET    /:id                 → tek proje (milestones + projectCostItems dahil)
POST   /                    → oluştur; opportunityId verilirse opp verisi otomatik çekilir
PUT    /:id                 → güncelle
DELETE /:id                 → sil

GET/POST          /:id/milestones
PUT/DELETE        /:id/milestones/:msId   → progress/status günceller; project.phase ve project.progress otomatik güncellenir
GET/POST/PUT/DELETE /:id/costs
```

## Satınalma Modülü — Durum Akışı

```
DRAFT → PENDING_UNIT → PENDING_PROCUREMENT → PENDING_GM → PO_ISSUED → IN_DELIVERY → INVOICED → CLOSED
                                                                                              → REJECTED (herhangi aşamada)
```

### Backend Endpoint'leri (`/api/purchase-requests`, `/api/vendors`)
```
GET/POST/PUT/DELETE /vendors
GET/POST/PUT/DELETE /purchase-requests
POST /:id/approve          → bir sonraki onay aşamasına ilerlet
POST /:id/reject           → REJECTED yap
POST /:id/quotes           → tedarikçi teklifi ekle
PUT/DELETE /:id/quotes/:qid
POST /:id/quotes/:qid/select → seçili teklif işaretle
POST /:id/delivery         → teslimat kaydı
POST /:id/invoice          → fatura bilgisi
POST /:id/close            → CLOSED yap
```

## API Referansı (domain endpoint özetleri)

Tümü `tenantMiddleware` izolasyonlu; path'ler `/api` ön-ekli. Frontend `apiClient.fetchWithAuth(path)` çağrısında `/api` **yazılmaz**.

- **/approval-chains** — GET (`?entityType=&entityId=`, `?pendingForRole=<ROLE>` sırası-gelmiş), `/:id/stages/:sid/approve|reject`, DELETE. Şablon (`approvalChainService`): OPPORTUNITY/PROPOSAL → FINANCE_MGR→IGPD_MGR→GENERAL_MANAGER→KSU_MGR; CONTRACT_WORKFLOW_SIGNING → KSU_MGR→GENERAL_MANAGER. `autoSkipOrphanStages`: aktif kullanıcısı olmayan rol SKIPPED (otonom agent lisanslıysa APPROVED-by-agent).
- **/workflows** — `/default` (ensureDefaultWorkflow, `/:id`'den ÖNCE), `/:id/steps/:sid/resolve-next` (skip-logic), CRUD. `Workflow.isDefault`, `WorkflowStep.enabled/requiresCompletion`.
- **/tasks** — TodoTask CRUD; `relatedModule` ∈ {OPPORTUNITY,PROPOSAL,CONTRACT,PROJECT,PROCUREMENT,DELIVERY,LEGAL,GENERAL}; `slaBusinessDays` → otomatik dueDate (`businessDays.ts`).
- **/projects** — `/summary/all` (`/:id`'den ÖNCE), CRUD, `/:id/milestones`, `/:id/costs`, `/:id/handover-docs` (11 evrak auto-seed + upload). Proje oluşturma ortak servis: `projectFactory.createProjectWithMilestones`.
- **/purchase-requests**, **/vendors** — 9 statü (DRAFT→PENDING_UNIT→PENDING_PROCUREMENT→PENDING_GM→PO_ISSUED→IN_DELIVERY→INVOICED→CLOSED / REJECTED). `/approve` `/reject` `/quotes[/:qid/select]` `/delivery` `/invoice` `/close`. PO_ISSUED→ProjectCostItem (T5); invoice→Finans Invoice (T6). **`/invoice` (PURCHASE_TO_INVOICE, 2026-08-19)** artık diğer 9 süreç kapısıyla aynı desende — tam `advanceProcess`/ApprovalChain (çok-adımlı MANUAL onay + AUTO `CREATE_INVOICE_FROM_PURCHASE` son adımı, `processEngine.ts` `finalizePurchaseInvoice`). İlk fatura gönderiminde alanlar (invoiceNo/Amount/Date/PaidAt) PR'a **taslak** yazılır (status değişmez), zincir tamamlanınca (tenant'ın kaç MANUAL aşama koyduğundan bağımsız — ara onaylar generic `/approval-chains/:id/stages/:sid/approve` üzerinden `PendingChainApprovals.tsx`'te geçer) AUTO adım statüyü INVOICED/CLOSED'a ilerletir + Finans Invoice'unu oluşturur; zincir PENDING'se `202 {pending:true}` döner. `status==='INVOICED'` iken aynı endpoint'e yapılan takip çağrısı (ödeme tarihi/kapama) zincire tekrar girmez, doğrudan `finalizePurchaseInvoice` çalışır.
- **/finance** — `/invoices` (SALES/PURCHASE) + `/invoices/:id/payments` (recalcInvoice), `/guarantees[/:id/upload]`, `/cost-approvals`, `/costs/:id/approve`, `/summary`.
- **/legal** — `/cases` CRUD + `/cases/:id/upload`, `/requests` (LEGAL TodoTask'lar). docNumber ENF-HUK-*.
- **/tenders** — CRUD (PUT WON → ContractWorkflow oluştur+bağla, **T3**) + `/:id/checklist` (10 kalem auto-seed) + upload. Teminat: `GuaranteeLetter type=BID_BOND + tenderId` (Finans ile paylaşımlı).
- **/contract-workflows** — DRAFT→ANALYSIS_DONE→PREPARATION→READY_TO_SIGN→PENDING_SIGNATURE_APPROVAL→SIGNED→TRANSFERRED; `/:id/analyze` (AI), `/documents[/:id/upload]`, `/:id/transfer` (TodoTask + **Project kaydı**, **T4**). 5 sekme UI (GM-only test).
- **/reports** — `/units`, `/unit-metrics?unitKey=&start=&end=`, `/bottlenecks`, `/overview`, `/unit-reports` CRUD + `/submit` (metricsSnapshot) + `/review`. `unitReportingService`.
- **/document-coding** — `/profile` (companyCode/separator/sequenceDigits), `/categories`. `nextDocumentNumber(tenantId, categoryCode)` → `{companyCode}{sep}{cat}[{sep}{year}]{sep}{seq}` (profil yoksa null).
- **/corporate-governance** — `/lessons`, `/risks` (score=p×i), `/metrics`, `/external-docs`.
- **/visits** — `/plans[/:id/visits]`, `/daily-reports`.
- **/plugins** — `/catalog`, `/entitlements`, `/activate`, `/generate-key` (GM-only, imzalı `ENF-PLUGIN-<KEY>[-D<gün>]-<İMZA>`), `/agents/:key/run` (lisans yoksa **402**), `/runs[/:id]`, `/runs/:id/ratify`.

## Sanal Agentlar (özet)

Boş birim koltuğunu dolduran **deterministik (LLM'siz)** vekiller — `virtualAgentService.HANDLERS`. Çıktı → handoff TodoTask (`assignedBy=AGENT:<key>`) + AgentRun (ADVISORY→PENDING_RATIFICATION / AUTONOMOUS→auto-RATIFIED). **8 agent:** Tender (checklist/deadline) · Project (devir/milestone) · Presales (BoM tutarlılık) · Procurement (en ucuz teklif/deadline) · **Finance (ADVISORY-only)** · **Legal (ADVISORY-only)** · CRM (fırsat hijyeni) · İGPD (BD/beklenen değer). Lisans kapısı `entitlementService`; orphan-stage otonom dalı `getAgentPluginForRole`. Lisanslar artık Ed25519 (vendor private key, tenant yalnız public key ile doğrular) — `PLUGIN_LICENSE_SECRET` kaldırıldı, bkz. `docs/LICENSING_ARCHITECTURE.md`.

## Faz Geçmişi (özet)

> ⚠️ **Kritik kural:** Doküman kodlama özgün + tenant-yapılandırılabilir; referans alınan ISO 9001 diyagramının üçüncü-taraf şirket adı/notasyonu kod/migration/UI/docs'ta **hiçbir yerde** kullanılmaz.

| Faz | Konu | Migration / Not |
|---|---|---|
| 0 | Kalıcı ApprovalChain/Stage + 4 swimlane birimi (İGPD/KSU/KGD/İSAB) | add_approval_chain |
| 1 | Aşama-bazlı onay swimlane, kayıp fırsat+arşiv, iş-günü SLA, proje kod üreticisi | faz1_lost_reason_project_code_sla |
| 2 | Ziyaret Planı + Günlük Rapor, Proje Devir Paketi (11 evrak) | faz2_visit_plan_daily_report_project_handover |
| 3 | Tenant-bazlı doküman kodlama + Genel Hususlar (dersler/risk/KPI/dış-doküman) | faz3_doc_coding_corporate_governance |
| 4 | Hukuk talebi (TodoTask `relatedModule=LEGAL`) | — |
| 5 | Varsayılan iş akışı şablonu + skip-logic + ApprovalChain deadlock fix | add_workflow_default_and_skip_logic |
| 6a/6b/6c | Finans (fatura/tahsilat/teminat/maliyet-onayı) · Hukuk görünümü (LegalCase) · İhale/İSAB (Tender+checklist) | faz6a_finance / faz6b_legal / faz6c_tender |
| 7.1–7.3 | Yönetim Raporları: birim metrik + iş-akışı darboğazı + UnitReport gönder/incele | faz7_unit_report |
| 7.4 | UnitReport yazdırma çıktısı (tek+konsolide) + dönem karşılaştırma (▲/▼ delta) | — (frontend) |
| 8.0–8.4 | Sanal agent altyapısı (PluginEntitlement/AgentRun) · imzalı lisans üretimi · köken etiketi (provenance) · 5 handler | faz8_plugin... / faz8_3_agent_provenance |
| 8.5 | Hukuk agent (AGENT_LEGAL, ADVISORY-only) | — |
| 8.6 | CRM + İGPD agent (AGENT_IGPD yeni) → **8 agent tamam** | — |
| 9 | Birimler-arası geçiş otomasyonu: **T3** İhale→Sözleşme · **T4** Sözleşme→Proje · **T5** Proje→Satınalma · **T6** Satınalma→Finans | faz9_flow_links |
| 9 (agent otonomi) | Generic `autonomousAction` altyapısı — otonom mod artık önerdiğini **uygular** (recommend→act); ilk eylem Procurement en-ucuz-teklif-seç | faz9_autonomous_action |
| 9 (agent otonomi 2) | CRM + İGPD **deterministik triyaj** otonom (annotation): `Opportunity.agentTriage` JSON'a yazar (kritik alanlara dokunmaz); Tender/Project/Presales **tasarım gereği danışman** | faz9_agent_triage |
| Bakım | as-any temizliği (no-any) · Vite 8/Rolldown + TS 6 + @types/react · mobil drawer/safe-area · stray express kaldırma | — |
| 10 | Maliyet analizi versiyon geçmişi (`CostAnalysisVersion` — her `/cost-analysis` kaydında BoM/gider/costConfig snapshot'ı) + fırsat kartında kronolojik Teklif/Maliyet Analizi geçmiş paneli (`OpportunityHistoryPanel`) — geçmiş tekliften "Düzenle" ile yeni versiyon oluşturma, güncel maliyet analizine deep-link | add_cost_analysis_version |
| 11 | Yönetim Dashboard'una **Ziyaret Performansı** widget'ı (`computeVisitPerformance`, `unitReportingService.ts`) — bu ayki planlanan/gerçekleşen ziyaret oranı + son 6 ay, penceresi (60 gün) dolmuş "olgun" ziyaretlerden heuristik ziyaret→fırsat dönüşüm oranı (aynı müşteri bir kez sayılır, en erken ziyarete atıf). GENERAL_MANAGER + SALES_MGR varsayılan kokpitine eklendi (`widgetCatalog.ts` `visitPerformance`), migration yok | — |
| 12 | **Tenant verisi alan-bazlı şifreleme** — envelope encryption, tenant-başına DEK (`Tenant.dekWrapped`, `AUTH_JWT_SECRET` deseniyle aynı `DATA_ENCRYPTION_MASTER_KEY` env var). Kapsam: Tenant YZ `apiKey`, `Vendor.iban`/`bankName`, `Customer.taxNumber`/`taxOffice` (AES-256-GCM, `enc:v1:` önekli, arama/filtrede kullanılmadığı doğrulandı). Yeni `backend/src/services/tenantEncryption.ts` (`encryptForTenant`/`decryptForTenant`) + backfill script (`backfill-tenant-encryption.ts`, idempotent) + `install/wizard.mjs` otomatik key üretimi. Route-bazlı çağrı (genel Prisma `$extends` hot path'ine eklenmedi — bkz. gerekçe `docs/TENANT_DATA_ENCRYPTION_PLAN.md`). Yan-etki: `GET/POST/PUT /api/tenants` artık `dekWrapped`'i `omit` ediyor (önceden hiçbir alan şifrelenmediği için bu risk yoktu). Key rotation + `backend/uploads/` dosya şifrelemesi + gerçek KMS entegrasyonu bilinçli olarak kapsam dışı bırakıldı. | add_tenant_dek |
| 13 | **Platform Ticket — talep/geri bildirim toplama** (`PlatformTicket` modeli). Enflow SaaS olarak tenant'lardan gelen ürün talebi/hata/iyileştirme/mimari-değişiklik taleplerini toplar; sınıflandırma/öncelik/timeline/sonuç **bu repo dışındaki** bir YZ triage aracının işi. Kullanıcı gönderirken `reportedType` (Hata\|İyileştirme\|Yorum) ile kendi ilk izlenimini bildirir — bu, dış aracın nihai `category`sinden (BUG\|IMPROVEMENT\|ARCHITECTURE_CHANGE) bağımsızdır (bir "yorum" değerlendirmede "mimari değişiklik" olarak sınıflandırılabilir). İki ayrı router: `/api/platform-tickets` (`tenantMiddleware`-only, her rol POST+GET, `title`+`description`+`reportedType` dışındaki alanlar istemciden yok sayılır) ve `/api/platform-tickets-admin` (yeni `platformApiKeyMiddleware` — `PLATFORM_TICKET_API_KEY` paylaşımlı-secret, `timingSafeEqual` uzunluk-kontrollü, **cross-tenant**, `tenantMiddleware` YOK — dış aracın tüm tenant'ları okuyup `category`/`priority`/`scope`(`TENANT_SPECIFIC`\|`PLATFORM_WIDE`)/`status`/`targetTimeline`/`resolutionNote` yazması için). `scope` alanı, tek-şema çok-kiracılı mimaride bir tenant'ın mimari talebinin diğerlerini etkileyip etkilemediğini işaretler — gerçek tenant-bazlı config-divergence mekanizması bu fazın kapsamı DIŞINDA, ileride ayrı bir iş. Durum değiştiğinde submitter'a `Notification` (`relatedModule: 'platform-tickets'`). Sidebar: `DASHBOARD_VIEW` (herkes, `help` emsali). | add_platform_ticket / add_platform_ticket_reported_type |
| 14 | **Sözleşmeye bağlı teslim süresi takibi** (v2.5.0) — malın/işin fiili teslim tarihi (imza gününden başlar, sözleşmenin kendi `deadline`/geçerlilik süresinden BAĞIMSIZ, aşılması cezai şart doğurur) İhale→Sözleşme→Proje zinciri boyunca taşınır. Yeni `DeliveryTimelineStep` modeli (Tender/ContractWorkflow'a alt-kırılımlı tahmini takvim — Sipariş Onayı/Üretim/Sevkiyat/Teslim, `deliveryTimeline.ts` saf üretici) + `ContractWorkflow.deliveryPeriodDays/deliveryDueDate/penaltyDailyRatePct/penaltyCapPct` (otomatik ceza hesabı, `deliveryPenalty.ts`) + T4'te gerçek `ProjectMilestone(DELIVERY)` satırlarına dönüşüm (`processEngine.ts` `createProjectFromEntity`). `deliveryDeadlineReminders.ts` sweep'i (tenderReminders.ts deseni) PROJECT_MGR+PROCUREMENT_MGR+SALES_MGR+LEGAL_MGR+proje PM'ine 30/15/7/1 gün + süre-aşımı uyarısı düşürür; DELIVERY milestone'u COMPLETED işaretlenince aynı birimlere "teslimat teyit edildi" bildirimi (`DELIVERY_CONFIRMED` denetim izi). İhale aşamasında tedarikçi teslim teyidi olmadan teklif verilmesi engellenmez, yumuşak uyarı verir. Tek kaynak: `docs/TESLIM_SURESI_TAKIP_PLAN.md` | add_delivery_deadline_tracking |
| 15 | **Veritabanı güvenliği — Adım 0 (Faz 1+2)** (2026-09-13) — harici bir güvenlik kontrol listesi (Prisma Studio/DB'ye yetkilendirme atlanarak erişim riski) Enflow'un gerçek bare-metal kurulum mimarisine (Docker/Traefik YOK, `install/wizard.mjs`) uyarlandı. **Faz 1 — ağ sertleştirmesi:** `wizard.mjs`'e uzak-Postgres tespiti + `nmap` doğrulama komutu + opt-in (varsayılan hayır, onaysız hiçbir şey değişmez) ufw/Windows Firewall kısıtlaması (`offerFirewallHardening`) eklendi; `install/README.md`+`ILK_KURULUM_KILAVUZU.md`+`docs/SYSTEM_REQUIREMENTS.md`'ye "DB portu/Prisma Studio ASLA internete açılmaz" uyarıları eklendi. **Faz 2 — en-az-yetki:** `provisionPostgresDb` artık **iki rol** oluşturuyor — `<kullanıcı>_migrator` (DB owner, DDL, yalnız kurulum/şema güncellemesinde, `.env`'e yazılmaz) + runtime `<kullanıcı>` (`NOSUPERUSER NOCREATEDB NOCREATEROLE`, `db push` sonrası `grantRuntimePrivileges` ile yalnız DML + `ALTER DEFAULT PRIVILEGES`). **Faz 3 (PostgreSQL Row-Level Security) — KOD TAMAM, Postgres'te DOĞRULANMADI:** `tenantContext.ts` (AsyncLocalStorage) + `prismaClient.ts` iki-katmanlı `$extends` (`basePrisma`/`prisma` ayrımı — tek katmanda `.$transaction` çağrısı TS7022 döngüsel tip hatası veriyordu) + `runManagedTransaction` (kod tabanındaki 12 mevcut `prisma.$transaction` çağrı yeri buna geçirildi) + 4 bypass yolu (login, bootstrapTenant, `POST /api/tenants`, platform-tickets-admin, restore) + 4 standalone scheduler'a `runWithTenant` sarmalaması + `apply-postgres-rls.ts`/`verify-postgres-rls.ts` (yeni scriptler, DMMF-bazlı 64 doğrudan+13 dolaylı+2 istisna=79 model haritası) + `wizard.mjs` opt-in uygulama adımı. `tsc` 0 hata, unit 176/176, SQLite canlı curl testi sorunsuz — **gerçek Postgres'e karşı hiç çalıştırılmadı**, mimari değişiklik olduğundan (MINOR versiyon adayı v2.6.0) production öncesi Postgres doğrulaması + kullanıcı onayı bekliyor. Tek kaynak: `docs/VERITABANI_GUVENLIGI_PLAN.md`. | — (migration yok, SQLite şeması değişmedi) |

Her faz sonunda RBAC süiti **69/69** geçti (Faz 14 hariç — bkz. plan dokümanındaki not, sonraki genel RBAC koşusuna dahil edilmeli; Faz 15: RBAC süiti artık 1027 test — SQLite'a karşı koşuldu, 1000 geçti/26 kaldı, `git stash` ile değişiklikler geri alınıp AYNI 26 test birebir aynı hatalarla yine başarısız olduğu doğrulandı → önceden var, Faz 15'ten bağımsız, sıfır regresyon; Postgres-özel Faz 2/3 değişikliği yerel bir Postgres örneğiyle henüz manuel doğrulanmadı). Detaylı tarihçe: `walkthrough.md` (§1–§27) + `memory/project_status.md`.
## Sonraki Adımlar (Planlanan)

> Tamamlanan tüm işler için bkz. yukarıdaki **Faz Geçmişi (özet)** tablosu (Faz 0–9 + bakım). Birimler-arası geçiş zinciri (T1, T3–T6) ve 8 birim agent'ı tamamlandı.

**Kalan / gelecek iyileştirmeler (zemin):**

- [x] **Presales — Şartname ↔ Ürün Specsheet Uygunluk Karşılaştırması** (2026-08-27) — Presales'e yeni `Şartname ↔ Ürün Uygunluk` sekmesi (`src/modules/SpecComplianceMatrix.tsx`). Teknik şartname + ürün başına bir/çok ürün specsheet'i yüklenir; şartnamede birden fazla ürün varsa her biri ayrı **grup**, aynı ürün için rakip markalar aynı grupta **aday** kolonlarıdır. Teknik/idari şartname fırsat oluşturulurken girildiyse (`OpportunityRequiredDoc` `TECH_SPEC`/`ADMIN_SPEC` UPLOADED) fırsattan **otomatik** gelir — client `getOpportunityRequiredDocs` → `fileUrl`'i doğrudan `fetch` edip `docText.extractTextFromFile` ile metnini çıkarır (bunun için `vite.config.ts` proxy'sine `/uploads` eklendi; prod'da zaten aynı origin). Uzak-depo (Nextcloud mutlak URL) evrakı client'tan okunamazsa uyarı verir, elle yükleme yolu açık kalır. `POST /api/presales/spec-compliance` (`backend/src/routes/presales.ts`, `tenantMiddleware`-only, `aiClient.chatJSON` **grup başına 1 çağrı**) her (madde × aday) için `MEETS|PARTIAL|FAILS|UNKNOWN` + kanıt alıntısı + ürün başına "önerilen marka" üretir. Sonuç istemcide **xlsx**'e (Özet + grup başına sayfa) dönüşür (`XLSX`, kurulu); öneri tek tıkla BoM'a kalem olur (mevcut `onTransferToBoM` — PresalesModule'de `transferToBoM` olarak ortaklaştı). **Yalnız YZ anahtarı tanımlıysa çalışır** — deterministik fallback YOK; anahtar yoksa `{usedAI:false, groups:[], message}` döner ve UI'da kalıcı sarı not + "Karşılaştır" pasif + `useAIGate().requireAI` popup. **Stateless** — yeni Prisma modeli/migration yok, dosyalar diske yazılmaz. Metin çıkarımı `src/lib/docText.ts`'e taşındı (SpecAnalysis'ten refactor, DRY). ActivityLog: `PRESALES_SPEC_COMPLIANCE`. Not katmanları: `helpArticles.ts` presales makalesi + `walkthrough.md` §7/§27 (+`wiki/index.html`).
- [x] **Yönetim Dashboard'u — Ziyaret Performansı widget'ı** (2026-08-09, Faz 11) — Satış ekibinin ziyaret planı/gerçekleşme performansı önceden yalnız Ziyaret Planı sekmesinde/rapor konsolidasyonunda görünüyordu; artık KURUMSAL KOKPİT'e taşındı. `computeVisitPerformance` (`unitReportingService.ts`) `computeConsolidation`'ın hafif bir alt kümesi (DailyReport matrisi hesaplamıyor, 45sn'lik Dashboard polling'ine uygun): bu ayki planlanan/gerçekleşen/coveragePct + son 180 günden, penceresi (60 gün) dolmuş "olgun" tamamlanmış ziyaretler üzerinden ziyaret→fırsat dönüşüm oranı (Visit↔Opportunity arasında FK yok, heuristik: ziyaretten sonraki 60 gün içinde aynı müşteriye açılan Opportunity "dönüşüm" sayılır; bir müşteri dönem içinde en fazla bir kez sayılır, en erken eşleşen ziyarete atıf yapılır — çifte sayım engellenir). `resolveUnitStaff`/`getVisitTargetRate` yardımcıları `computeConsolidation`'dan çıkarılıp paylaşıldı (davranış değişmedi). `GET /api/reports/dashboard` → `management.visitPerformance`; `widgetCatalog.ts` `visitPerformance` GENERAL_MANAGER + SALES_MGR varsayılan kokpitine eklendi, "Detay" temsilci bazlı dökümü gösterir. Yeni Prisma modeli/migration yok.
- [x] **Fırsat kartı — Teklif & Maliyet Analizi geçmişi** (2026-08-09, Faz 10, migration `add_cost_analysis_version`) — Daha önce maliyet analizi hiç versiyonlanmıyordu (her `POST /:id/cost-analysis` BoM/CostItem/costConfig'i silip yeniden yazıyordu, geçmiş kayboluyordu). Yeni `CostAnalysisVersion` modeli her kayıtta bir anlık görüntü (BoM+gider+costConfig+marj+teklif) tutar; `GET /:id/cost-analysis-versions` ile listelenir. Fırsat kartına (`OpportunitiesView.tsx`) eklenen `OpportunityHistoryPanel.tsx` genişletilebilir bölüm: **Teklifler** (zaten versiyonlu `Proposal` kayıtlarından, kronolojik + "Düzenle" — seçilen versiyonun içeriği editöre yüklenir, kaydedince mevcut mantıkla tutarlı şekilde yeni versiyon oluşturur) ve **Maliyet Analizleri** (yeni tablo, kronolojik, salt-okunur özet + "Güncel Analize Git" ile `crm-cost` sekmesine deep-link). `CRMModule` yeni `onNavigate` prop'u (App.tsx `navigate` fonksiyonu) ile itemId'li geçiş sağlar; `editingProposalId` state'i belirli bir teklif versiyonunu editöre yükler.
- [x] **Enflow-Wiki — CANLI** — yazılımı hiç bilmeyene anlatan **statik how-to/referans** sayfası. `wiki/build.mjs` (bağımlılıksız üretici) `walkthrough.md §27`'den `wiki/index.html` üretir; GitHub Pages'e otomatik deploy edilir (`.github/workflows/wiki-pages.yml`) ve backend `GET /wiki` ile de sunulur (açılışta best-effort yeniden üretim). Akış değişince önce §27 güncellenir, sonra `node wiki/build.mjs` çalıştırılır.
- [x] **Uygulama-içi Yardım modülü** (2026-08-03) — `HelpModule.tsx`, `Header`'daki (önceden ölü) Yardım ikonuyla açılır; içerik `src/content/helpArticles.ts`'te NAV_ITEMS'teki her modül için son-kullanıcı diliyle yazılmış "ne işe yarar / nasıl kullanılır" makaleleri. Rol-duyarlı (kullanıcı yalnız kendi sidebar'ında gördüğü modüllerin makalelerini görür), bağlamsal açılır (o an bulunulan sekmenin makalesiyle açılır). Backend değişikliği yok. Wiki'ye link verir — iki katman birbirini tekrar etmez: Wiki = "Enflow nedir / uçtan uca akış" (dışa dönük genel tanıtım), Yardım = "bu ekranı nasıl kullanırım" (içe dönük, oturum-içi).
- [x] **İlk Kurulum ve Yönetici Başlangıç Kılavuzu** (2026-08-09) — `install/ILK_KURULUM_KILAVUZU.md`: hiç kurulum yapmamış biri için işletim sistemine göre (Windows/macOS/Linux) kurulum → ilk açılış sihirbazı (`SetupWizard.tsx`) → lisans girişi (abonelik/plan ayrı, sanal agent/eklenti lisansı ayrı) → birim oluşturma ("Varsayılan Şablonu Yükle" hızlı yolu + elle ek birim) → kullanıcı oluşturma + **kritik uyarı**: rol seçmek otomatik izin vermez, Yetkiler sekmesinden elle açılmalı → iş akışı (otomatik türeyen varsayılan şablon, Builder/Simülasyon sekmeleri) → birim-bazlı genel kullanım tablosu (8 varsayılan swimlane birimi + sık eklenen ek birimler + 20 rol referansı). Aynı içerik iki katmana daha özetlenerek eklendi: `walkthrough.md §27.7` (→ `node wiki/build.mjs` ile `wiki/index.html`'e yansıtıldı, eski §27.7 "Wiki kılavuzluk notu" §27.8'e kaydı) ve `src/content/helpArticles.ts` `settings` makalesine yeni "İlk kurulumda önerilen sıra" + "Lisans türleri" bölümleri. Üç katman aynı bilgiyi farklı derinlikte anlatır — tek doğruluk kaynağı bu kılavuz dosyasıdır, değişiklikte önce o güncellenir.
- [x] **ActivityLog kapsamı — TAM** (2026-06-20) — merkezi `logActivity` helper (`backend/src/services/activityLog.ts`, non-throwing, actorType HUMAN|AGENT) + `GET /api/activity-logs?entityType=&entityId=&action=&limit=` (`activityLogs.ts`); **19 router**a denetim-izi (CREATE/UPDATE/DELETE + statü geçişleri): tüm süreç zinciri + admin (users/units) + approvalChains + corporateGovernance/visits/workflows. **Denetim İzi UI** (`ActivityLogModule.tsx`, GM-only Test Ortamı, `activity-log` sekmesi) — filtreli liste, agent köken etiketi (`agentProvenance`).
- [x] **ContractWorkflow tam modüle terfi** (2026-06-20) — `ContractWorkflowTest`→`ContractWorkflowModule` rename; backend rol kapısı GM-only'den 7 yönetici role genişledi (GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL+FINANCE+İGPD; PRESALES/SALES_REP RBAC gereği deny); latent bug fix (gerçek `contract-workflow` sekmesinde opportunities/proposals yüklenmiyordu).
- [x] **Agent otonomi genişlemesi — Faz 9 (recommend→act)** (2026-06-20) — Bugüne dek AUTONOMOUS mod yalnız auto-ratify ediyordu (etki-alanı mutasyonu yapmıyordu); artık döngü kapalı. Generic `autonomousAction` altyapısı: `AgentOutput` opsiyonel `{ kind, summary, reversible, execute }` döner; `runAgent` (`backend/src/services/virtualAgentService.ts`) bunu **yalnız** mod AUTONOMOUS + eklenti AUTONOMOUS'a izinli (`plugin.allowedModes`) + eylem `reversible` ise çalıştırır. İlk somut eylem **Procurement → en ucuz teklifi otomatik seç** (`SELECT_CHEAPEST_QUOTE`; deselect-all→select, idempotent/geri-alınabilir; sadece valid+öneri-var+seçilmemişse). Eylem `AgentRun.actionTaken`'a (migration `faz9_autonomous_action`) + ayrı `AGENT_ACTION` ActivityLog'a (actorType=AGENT, agentRunId) yazılır; handoff görevi "✅ … yapıldı, incele" olur. **Güvenlik:** ADVISORY modda eylem ASLA çalışmaz; `AGENT_FINANCE`/`AGENT_LEGAL` `allowedModes:['ADVISORY']` → AUTONOMOUS'a hiç geçemez (ikinci kemer `allowedAuto` guard). Frontend: `AgentRun.actionTaken` tipi + RunCard emerald rozeti + AgentTag drill-down satırı. Diğer handler'lar (tender/project/presales/igpd/crm) `autonomousAction` tanımlamaz → davranışları değişmez. `autoSkipOrphanStages` orphan-stage otonom dalı ayrı path, dokunulmadı.
  - **Doğrulama:** curl — ADVISORY→actionTaken null/seçim yok; AUTONOMOUS→Beta seçildi+RATIFIED+AGENT_ACTION log; rerun(alreadySelected)→eylem yok; AGENT_FINANCE→AUTONOMOUS=400; yanlış tenant=404. Playwright (GM) RunCard "Otonom eylem" rozeti, 0 page-error. RBAC 69/69, tsc 0. Test verisi temizlendi.
- [x] **Agent otonomi 2 — CRM + İGPD deterministik triyaj** (2026-06-21, migration `faz9_agent_triage`) — İlke: yalnız **insan eli değmeden deterministik üretilebilen** çıktı otonom olur. CRM (kural-bazlı `recommendation` + issues) ve İGPD (`expectedValue = round(probability/100 × value)` + `valueTier` + `recommendation`) otonom modda triyajlarını yeni nullable `Opportunity.agentTriage` JSON alanına **annotation** olarak yazar — `value/probability/status/lostReason` gibi kritik alanlara **asla dokunmaz**, geri-alınabilir + idempotent (`mergeTriage` her agentın kendi bölümünü günceller, diğerini korur). `runAgent` **değişmedi** (Faz 9.1 altyapısı kullanıldı); `actionTaken` + `AGENT_ACTION` log + handoff görevi. Frontend: `Opportunity.agentTriage` tipi + CRM fırsat kartında 🤖 triyaj rozeti; `opportunities` GET parse. **Tender/Project/Presales tasarım gereği danışman** — deterministik-güvenli mutasyonları yok (checklist/devir evrakı kanıt ister; BoM/milestone insan kararı). Para/Hukuk `allowedModes:['ADVISORY']` kapsam dışı.
  - **Doğrulama:** curl — ADVISORY→agentTriage null; AUTONOMOUS İGPD→`igpd.expectedValue=360000` (0.6×600k), value/prob/status değişmedi; CRM→`crm` yazıldı + `igpd` korundu (merge); rerun idempotent; WON fırsatta NO_ACTION→eylem yok; yanlış tenant=404. AGENT_ACTION logları actorType=AGENT. Playwright (GM) CRM kartında 🤖 BD/CRM rozeti, 0 page-error. RBAC 69/69, tsc 0. Test verisi temizlendi.
- [ ] **Entegrasyon katmanı doğrulaması** — Nextcloud DMS / Exchange e-posta / WhatsApp (denetimlerde kapsanmadı).
- [x] **Zamana duyarlı Kârlılık & Nakit/Hazine analizi** (2026-08-28, branch `feat/profitability-analysis`, tek kaynak `docs/KARLILIK_ANALIZI_PLAN.md`) — **Faz A+B+C+D tamam (plan kapsamının tümü):** `profitabilityLedger.ts` (proje verisini tarihli `ProfitEvent[]`'e indirger — PLAN + ACTUAL üreticiler, saf) + `profitabilityRollup.ts` (`bucketBy` → proje/aylık/çeyreklik/yıllık `PeriodRow`; planlanan+gerçekleşen bağımsız kolon, tahakkuk+nakit ayrık, EAC = geçmiş-gerçekleşen + gelecek-plan, FX oranı olmayan döviz TRY başlığına katılmaz + `fxWarnings`) + `profitabilityCashflow.ts` (as-of birleştirme [geçmiş=gerçekleşen, gelecek=plan] → konsolide nakit pozisyonu serisi + açık pencereleri; `computeTreasury` nakit eğrisini zaman üzerinde integre eder → açık finansman maliyeti + fazla getirisi = hazine katkısı, Faz 1 faiz) + `profitabilityService.ts` (Prisma birleştirme) + `routes/profitability.ts` (`GET /ledger` `/summary` `/cashflow` `/treasury` — salt-okur, `requireRole` GM/FINANCE_MGR/PROJECT_MGR/SALES_MGR). Faiz oranı tek kaynak `financingEffect.DEFAULT_INTEREST_RATES` (`finance.ts` de içe aktarır); tenant override `moduleSettings.finance.interestRates`/`fxRates`. Yeni `PROFITABILITY_VIEW` izni: `roleDefaultPermissions.ts` + `governance/role-matrix.ts` (GM/FINANCE_MGR/SALES_MGR/PROJECT_MGR/BACKUP_ADMIN) + `rbac.config.ts` uiMatrix "Kârlılık menüsü". Yeni izin yalnız kullanıcı oluşturulurken atandığından var olan kurulumlar için `backfill-profitability-view-permission.ts` (idempotent, matrix-kaynaklı, additive). RBAC `ui-access` "Kârlılık menüsü" 20/20. Frontend `ProfitabilityModule.tsx` (`profitability` sekmesi): grain switcher + Plan↔Gerçek↔İkisi + as-of + yıl + özet kartları + dönem net kârlılık grafiği + dönem tablosu (`MarginBadge`) + konsolide nakit pozisyonu grafiği (recharts LineChart, sıfır çizgisi) + hazine katkı paneli. **Faz C:** `ProfitabilitySnapshot` modeli + migration `add_profitability_snapshot` + `profitabilitySnapshot.ts` (`takeSnapshot` upsert-idempotent aylık `asOfKey` + `listSnapshots` + `getPlanDrift`) + `profitabilitySnapshotScheduler.ts` (aylık, 6sa tarama, `schedulerLock`) + `POST /snapshot` (GM/FINANCE_MGR, ActivityLog `PROFITABILITY_SNAPSHOT`) + `GET /snapshots` `/plan-drift` + modülde "Plan snapshot al" + plan-drift tablosu. **Sürüm artırılmadı** (kullanıcı kararı 2026-08-28 — Faz C mimari değişiklik olsa da `APP_VERSION` v2.4.0'da kaldı). **Faz D:** `profitabilityInstruments.ts` (saf) — FACTORING (gelecek tahsilatı öne çekme: finansman rahatlaması − tenor-ölçekli komisyon), DEPOSIT (nakit fazlası vade-spread'i), FORWARD_FX (döviz akışı kilidi carry'si, kapsanmış faiz paritesi) → baz duruma karşı gösterge delta; `GET /instruments` (ayarlanabilir `factoringDiscountPct`/`depositRatePct`/`forwardHorizonDays`/…) + modülde senaryo kartları. **Faz B.1 (işletme maliyeti simetrisi):** overhead artık gerçekleşen tarafta da (`overheadEvents` ortak helper — `buildPlanEvents` tüm süre, `buildActualEvents` `asOf`'a kadar absorbe edilmiş pay, EAC'de çift sayım yok); tüm GET uçlarında `?overhead=0` + modülde "İşletme maliyeti Dahil/Hariç" toggle'ı (`stripOverhead` servis katmanında `category:'OVERHEAD'` süzer); yalnız `Project.applyOverhead=true` projeleri etkiler. Birim testleri 36 (`__tests__/profitability{Ledger,Rollup,Cashflow,Snapshot,Instruments}.test.ts`), backend unit 166/166, tsc 0, audit 0/0.

---

## Auto-generated signatures
<!-- Updated by gen-context.js -->
# Code signatures

## SigMap commands

| When | Command |
|------|---------|
| Before answering a question about code | `sigmap ask "<your question>"` |
| To rank files by topic | `sigmap --query "<topic>"` |
| After changing config or source dirs | `sigmap validate` |
| To verify an AI answer is grounded | `sigmap judge --response <file>` |

Always run `sigmap ask` (or `sigmap --query`) before searching for files relevant to a task.

## deps
```
src/components/settings/TenantSettings.tsx ← ../lib/utils, ../types, ../services/apiService
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, types, services/apiService
src/modules/ActivityLogModule.tsx ← services/apiService, lib/agentProvenance, types
src/modules/BackupModule.tsx ← services/apiService, types
src/modules/contract-workflow/ContextTab.tsx ← ../types, types, DeliveryTimelinePanel
src/modules/contract-workflow/LegalCaseForm.tsx ← ../services/apiService, constants, types
src/modules/contract-workflow/LegalView.tsx ← ../services/apiService, ../types, constants, helpers, types
src/modules/contract-workflow/SigningTab.tsx ← types
src/modules/contract-workflow/types.ts ← ../types
src/modules/ContractWorkflowModule.tsx ← services/apiService, contexts/AIGateContext, contexts/AuthContext, types/tender, contract-workflow/types
src/modules/CorporateGovernanceModule.tsx ← services/apiService, contexts/AuthContext
src/modules/dashboard/KpiDetailDrawer.tsx ← ../lib/format, crm/constants, project-mgmt/constants, DrawerShell
src/modules/dashboard/WidgetDetailDrawer.tsx ← ../types, ../lib/format, widgetCatalog, helpers, crm/constants
src/modules/DmoModule.tsx ← services/apiService, contexts/AuthContext, lib/format, types
src/modules/FinanceModule.tsx ← services/apiService, contexts/AuthContext, types, lib/format
src/modules/project-mgmt/CostForm.tsx ← ../types, constants
src/modules/project-mgmt/helpers.ts ← ../lib/format, ../types, constants
src/modules/project-mgmt/ProjectDetail.tsx ← ../services/apiService, ../lib/format, ../types, constants, helpers
src/modules/reporting/ConsolidationView.tsx ← helpers
src/modules/SalesSupport.tsx ← services/apiService, contexts/AuthContext, contexts/AIGateContext, lib/format, lib/guaranteeText
src/modules/todo/helpers.ts ← ../types
src/modules/todo/PendingProposalApprovals.tsx ← ../types, helpers
src/modules/todo/ResolvedApprovals.tsx ← ../types, helpers
src/modules/todo/TaskList.tsx ← ../types, helpers, dashboard/helpers, icons, ../components/AgentTag
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, todo/helpers, todo/PendingChainApprovals
backend/src/middleware.ts ← prismaClient, services/auth, utils/logger, services/tenantContext
backend/src/prismaClient.ts ← services/moneyRounding, services/tenantContext
backend/src/services/activityLogArchiveScheduler.ts ← prismaClient, activityLogArchiveService, schedulerLock, tenantContext
backend/src/services/approvalChainService.ts ← prismaClient, pluginCatalog, agentProvenance, governance, approvalSlaEscalation
backend/src/services/backupScheduler.ts ← prismaClient, backupService, backupVerifyService, activityLog, schedulerLock
backend/src/services/backupVerifyService.ts ← prismaClient, backupTargets, backupService, tenantContext
backend/src/services/bootstrapTenant.ts ← prismaClient, licenseVerify, auth, planCatalog, tenantContext
backend/src/services/corporateDocumentReminders.ts ← prismaClient, dashboardStream
backend/src/services/deliveryDeadlineReminders.ts ← prismaClient, dashboardStream, utils/entityTypeTab
backend/src/services/documentNumberService.ts ← prismaClient
backend/src/services/personnelTransferService.ts ← prismaClient
backend/src/services/processEngine.ts ← prismaClient, activityLog, approvalSlaEscalation, utils/businessDays, approvalChainService
backend/src/services/profitabilitySnapshotScheduler.ts ← prismaClient, profitabilitySnapshot, schedulerLock, tenantContext
backend/src/services/restoreService.ts ← prismaClient, tenantContext, backupTargets, backupService
backend/src/services/updateNotifier.ts ← prismaClient, schedulerLock, tenantContext
src/App.tsx ← utils/logger, types, layout/Sidebar, layout/Header, modules/Dashboard
src/components/CustomerCombobox.tsx ← types, utils/textSimilarity
src/components/MoneyInput.tsx ← lib/format
src/components/ProcessTriggerButton.tsx ← lib/utils, services/apiService, types/workflow
src/components/settings/SubscriptionSettings.tsx ← ../types
src/components/settings/UnitManagement.tsx ← ../lib/utils, ../types, ../services/apiService
src/components/settings/UserManagement.tsx ← ../types, ../constants, ../services/apiService, PersonnelTransferModal
src/contexts/AuthContext.tsx ← types, services/apiService
src/hooks/useBoM.ts ← services/apiService, contexts/UnsavedChangesContext, types
src/hooks/useEnflowQueries.ts ← services/apiService
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext, services/apiService
src/lib/permissionTree.ts ← constants
src/modules/contract-workflow/AnalysisTab.tsx ← types
src/modules/contract-workflow/DetailHeader.tsx ← types, constants, helpers, ../components/ProcessTriggerButton
src/modules/contract-workflow/DocumentsTab.tsx ← ../services/apiService, ../types, ../lib/guaranteeText, types, constants
src/modules/contract-workflow/helpers.ts ← ../services/apiClient, ../types, constants, types
src/modules/contract-workflow/WorkflowListPanel.tsx ← ../types, ../types/tender, types, constants, helpers
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService, contexts/AuthContext, lib/procurementCosts
src/modules/crm/constants.ts ← ../types
src/modules/crm/CustomersView.tsx ← ../lib/utils, ../types, ../components/HealthCards, ../components/PermissionGate, ../components/InfoTooltip
src/modules/crm/DashboardView.tsx ← ../types, constants, ../components/InfoTooltip
src/modules/crm/NewCustomerModal.tsx ← ../types, ../components/CustomerCombobox
src/modules/crm/NewOpportunityModal.tsx ← ../lib/utils, ../types, ../lib/procurementCosts, ../services/apiService, ../components/MoneyInput
src/modules/crm/OpportunitiesView.tsx ← ../lib/utils, ../types, ../components/SaveButton, ../components/PermissionGate, ../contexts/AuthContext
src/modules/crm/OpportunityDocumentsPanel.tsx ← ../lib/utils, ../types, ../services/apiService
src/modules/crm/OpportunityRequiredDocsPanel.tsx ← ../lib/utils, ../types, ../services/apiService
src/modules/crm/ProposalsView.tsx ← ../lib/utils, ../types, helpers
src/modules/CRMModule.tsx ← types, ProposalEditor, NegotiationModule, components/HandOffModal, services/apiService
src/modules/Dashboard.tsx ← types, constants, types/workflow, lib/utils, lib/format
src/modules/LicenseTypesModule.tsx ← lib/utils, contexts/AuthContext, services/apiService
src/modules/ManagementReportingModule.tsx ← services/apiService, contexts/AuthContext, types, reporting/helpers, reporting/AnalyticsTab
src/modules/negotiation/AuctionBoard.tsx ← ../lib/utils, types
src/modules/negotiation/AuctionSidePanel.tsx ← ../lib/utils
src/modules/negotiation/ChatInfoPanel.tsx ← ../lib/utils, ../types
src/modules/negotiation/ChatWindow.tsx ← ../lib/utils, types
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, negotiation/types, negotiation/AccessDeniedPanel
src/modules/PlatformTicketsModule.tsx ← services/apiService, types
src/modules/PresalesModule.tsx ← types, SpecAnalysis, SpecComplianceMatrix, contexts/AuthContext, components/PermissionGate
src/modules/procurement/PRDetailDrawer.tsx ← ../services/apiService, ../lib/format, ../types, constants, StatusBadge
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, lib/format, types, procurement/constants
src/modules/profitability/DmoChannelTab.tsx ← ../services/apiService, ../lib/format, project-mgmt/MarginBadge, ../types
src/modules/ProfitabilityModule.tsx ← services/apiService, lib/format, project-mgmt/MarginBadge, profitability/DmoChannelTab, types
src/modules/project-mgmt/KanbanView.tsx ← ../types, constants, helpers, MarginBadge
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, components/HealthCards, lib/format, types
src/modules/reporting/BottleneckPanel.tsx ← ../types, ../constants, ../components/InfoTooltip
src/modules/reporting/OverviewTab.tsx ← ../types, ../constants, helpers, BottleneckPanel, MetricCard
src/modules/ServiceTicketsModule.tsx ← services/apiService, types
src/modules/SettingsModule.tsx ← types, IntegrationWizard, WorkflowBuilder, components/settings/TenantSettings, components/settings/UnitManagement
src/modules/SpecAnalysis.tsx ← lib/utils, services/apiService, lib/docText, contexts/AIGateContext, utils/logger
src/modules/SpecComplianceMatrix.tsx ← lib/utils, lib/docText, services/apiService, contexts/AIGateContext, utils/logger
src/modules/todo/PendingChainApprovals.tsx ← ../types, ../components/AgentTag, ../lib/agentProvenance, helpers, ../lib/procurementCosts
src/modules/todo/UnifiedWorkQueue.tsx ← ../types, dashboard/helpers, helpers
src/modules/VirtualAgentsTestModule.tsx ← services/apiService, contexts/AuthContext, types, lib/agentProvenance
src/modules/VisitPlanModule.tsx ← lib/utils, services/apiService, contexts/AuthContext
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, types/workflow, constants
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, serviceTicketService
src/types/crm.ts ← auth, presales
backend/src/services/agentProvenance.ts ← pluginCatalog
backend/src/services/aiClient.ts ← prismaClient, tenantEncryption
backend/src/services/approvalSlaEscalation.ts ← prismaClient, utils/businessDays
backend/src/services/dashboardService.ts ← prismaClient, unitReportingService
backend/src/services/dashboardStream.ts ← prismaClient
backend/src/services/deploymentGuard.ts ← utils/logger
backend/src/services/governance.ts ← prismaClient
backend/src/services/invoiceService.ts ← prismaClient, activityLog, documentNumberService
backend/src/services/opportunityFolderService.ts ← prismaClient, utils/fileUpload
backend/src/services/profitabilityCashflow.ts ← profitabilityLedger
backend/src/services/profitabilityDmo.ts ← prismaClient, profitabilityRollup
backend/src/services/profitabilityInstruments.ts ← profitabilityLedger, profitabilityCashflow
backend/src/services/profitabilityRollup.ts ← profitabilityLedger
backend/src/services/profitabilityService.ts ← prismaClient, profitabilityLedger, profitabilityRollup, financingEffect, profitabilityCashflow
backend/src/services/profitabilitySnapshot.ts ← prismaClient, profitabilityService
backend/src/services/schedulerLock.ts ← prismaClient
backend/src/services/serviceTicketReminders.ts ← prismaClient, utils/entityTypeTab
backend/src/services/slaEscalation.ts ← prismaClient, utils/entityTypeTab
backend/src/services/specAnalysis.ts ← aiClient
backend/src/services/unitReportingService.ts ← prismaClient
backend/src/services/virtualAgentService.ts ← prismaClient, entitlementService, pluginCatalog, agentProvenance
backend/src/services/workflowTemplate.ts ← prismaClient, activityLog, bootstrapTenant
backend/src/usageService.ts ← prismaClient, planCatalog
backend/src/utils/fileUpload.ts ← logger, usageService
backend/src/utils/secureUpload.ts ← usageService
```

## versions (installed direct deps)
```
@tailwindcss/vite@4.3.1
@tanstack/react-query@5.101.0
@types/node@26.0.0
@types/react-dom@19.2.3
@types/react@19.2.17
@vitejs/plugin-react@6.0.2
autoprefixer@10.5.0
clsx@2.1.1
d3@7.9.0
date-fns@4.4.0
dotenv@17.4.2
jspdf-autotable@5.0.8
jspdf@4.2.1
lucide-react@1.21.0
mammoth@1.12.0
motion@12.40.0
pdfjs-dist@6.0.227
react-dom@19.2.7
react@19.2.7
recharts@3.8.1
sonner@2.0.7
tailwind-merge@3.6.0
tailwindcss@4.3.1
tsx@4.22.4
typescript@6.0.3
vite@8.0.16
xlsx@0.18.5
```

## todos
```
backend/src/services/processEngine.ts:978  # TODO: Task SLA eskalasyon sweep'ine (slaEscalation.ts) girebilmeli: aynı
```

## changes (last 10 commits — 4 days ago)
```
src/modules/ActivityLogModule.tsx             ~ActivityLogModule  ~actionTone
src/modules/contract-workflow/ContextTab.tsx  ~ContextTab
src/modules/contract-workflow/LegalCaseForm.tsx ~LegalCaseForm
src/modules/ContractWorkflowModule.tsx        ~ContractWorkflowModule
src/modules/DmoModule.tsx                     ~CatalogTab  ~AgreementsTab  ~AgreementForm  ~DmoModule
src/modules/FinanceModule.tsx                 ~OverheadPoolTab
src/modules/reporting/ConsolidationView.tsx   ~ConsolidationView
src/modules/SalesSupport.tsx                  +TenderList  +ChecklistTab  ~TenderList  ~ChecklistTab
src/modules/todo/PendingProposalApprovals.tsx ~PendingProposalApprovals
src/modules/todo/TaskList.tsx                 ~TaskRow
backend/src/prismaClient.ts                   +runManagedTransaction
backend/src/services/activityLogArchiveScheduler.ts ~tick
backend/src/services/approvalChainService.ts  ~autoSkipOrphanStages
backend/src/services/backupScheduler.ts       ~tick
backend/src/services/backupVerifyService.ts   ~verifyBackup  ~sha256File  ~drainVerifyQueue
backend/src/services/bootstrapTenant.ts       ~bootstrapTenant
backend/src/services/corporateDocumentReminders.ts +sweepCorporateDocumentReminders  +safeParse
backend/src/services/deliveryDeadlineReminders.ts +resolveDue  +notifyAll  +sweepDeliveryDeadlineReminders  +safeParse
backend/src/services/deliveryPenalty.ts       +computePenaltyExposure
backend/src/services/deliveryTimeline.ts      +buildDeliveryTimeline  +addDays  +computeDeliveryDueDate
backend/src/services/documentNumberService.ts ~incrementDocumentSequence
backend/src/services/personnelTransferService.ts ~transferOwnership  ~deactivateUser
backend/src/services/processEngine.ts         ~createProjectFromEntity  ~createContractFromTender  ~ProcessNotConfiguredError
backend/src/services/profitabilitySnapshotScheduler.ts ~tick
backend/src/services/restoreService.ts        ~applyLogicalRestore
backend/src/services/tenantContext.ts         +getTenantContext  +runWithTenant  +runWithRlsBypass
backend/src/services/updateNotifier.ts        +baz  +ref  ~baz  ~ref
```

## backend

### backend/prisma/migrations/20260913092634_add_delivery_deadline_tracking/migration.sql
```
TABLE DeliveryTimelineStep
TABLE new_Customer
TABLE new_Opportunity
TABLE new_Tender
TABLE new_WorkflowStep
INDEX Customer_tenantId_parentId_idx ON Customer
INDEX Opportunity_tenantId_status_idx ON Opportunity
INDEX Opportunity_tenantId_assignedToId_idx ON Opportunity
INDEX Opportunity_tenantId_trackingCode_key ON Opportunity
INDEX Tender_tenantId_status_idx ON Tender
INDEX DeliveryTimelineStep_tenantId_tenderId_idx ON DeliveryTimelineStep
INDEX DeliveryTimelineStep_tenantId_contractWorkflowId_idx ON DeliveryTimelineStep
INDEX ContractWorkflow_tenantId_projectId_idx ON ContractWorkflow
```

### backend/src/middleware.ts
```
export const asyncHandler = (fn) =>  :9-11
export const requireRole = (allowed) =>  :82-90
export const requireEntitlement = (pluginKey) =>  :116-123
```

### backend/src/prismaClient.ts
```
export type ManagedTx  :112-112
export async function runManagedTransaction(callback, options?,) → Promise<T>  :121-135
```

### backend/src/services/activityLogArchiveScheduler.ts
```
export function startActivityLogArchiveScheduler() → void  :53-58
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain(tenantId, entityType, entityId, roles?, amount?,)  :25-61  # Mevcut PENDING bir zincir varsa onu döner; yoksa şablona gör
export async function autoSkipOrphanStages(tenantId, chainId)  :74-217  # Skip-logic: **hiçbir aktif kullanıcıya** karşılık gelmeyen P
export async function getDelegatedRoles(tenantId, userId) → Promise<string[]>  :225-237  # B-08 — vekalet (delegasyon): kullanıcı X izinliyken (delegat
export async function resolveEffectiveApprover(tenantId, stage, userId,) → Promise<boolean>  :250-268  # Bir kullanıcı bir onay aşamasını çözümleyebilir mi
export async function resolveGroupAfterDecision(tenantId, chainId)  :278-335  # Bir onay kararından (approve/reject) sonra aynı `order`'ı pa
export async function resetApprovalChain(tenantId, entityType, entityId)  :338-351  # Onay geri çekildiğinde (revert-approval) en güncel zinciri P
```

### backend/src/services/backupScheduler.ts
```
export function startBackupScheduler() → void  :66-70
```

### backend/src/services/backupVerifyService.ts
```
export async function verifyBackup(jobId) → Promise<  :47-47
export async function drainVerifyQueue(limit = 5) → Promise<number>  :126-140  # verifyStatus=PENDING + COMPLETED yedekleri sırayla doğrular 
```

### backend/src/services/bootstrapTenant.ts
```
export interface BootstrapInput  :40-47
  companyName: string  :41-41
  admin: { name: string  :42-42
  license?: string  :44-44
  tenantId?: string  :46-46
export interface BootstrapResult  :48-53
  tenantId: string  :49-49
  token: string  :50-50
  user: { id: string  :51-51
  subscription: { plan: string  :52-52
export async function bootstrapTenant(input) → Promise<BootstrapResult>  :55-135
```

### backend/src/services/corporateDocumentReminders.ts
```
export async function sweepCorporateDocumentReminders(tenantId) → Promise<void>  :26-74
```

### backend/src/services/deliveryDeadlineReminders.ts
```
export async function sweepDeliveryDeadlineReminders(tenantId) → Promise<void>  :49-109
```

### backend/src/services/deliveryPenalty.ts
```
export interface PenaltyExposureInput  :6-12
  contractValue: number  :7-7
  dailyRatePct: number | null | undefined  :8-8
  capPct: number | null | undefined  :9-9
  dueDate: Date  :10-10
  asOf: Date  :11-11
export interface PenaltyExposureResult  :14-19
  overdueDays: number  :15-15
  rawPenalty: number  :16-16
  cappedPenalty: number  :17-17
  isCapped: boolean  :18-18
export function computePenaltyExposure(opts) → PenaltyExposureResult | null  :24-36  # Gecikme yoksa veya günlük oran tanımlı değilse `null` döner 
```

### backend/src/services/deliveryTimeline.ts
```
export interface DeliveryPhaseTemplate  :7-10
  title: string  :8-8
  pctOfPeriod: number  :9-9
export interface DeliveryTimelineStepInput  :19-23
  title: string  :20-20
  sortOrder: number  :21-21
  plannedDate: Date  :22-22
export function buildDeliveryTimeline(referenceStart, totalDays, phases = DEFAULT_DELIVERY_PHASES,) → DeliveryTimelineStepInput[]  :30-41  # `referenceStart`'tan itibaren `totalDays` süreye yayılan faz
export function addDays(date, days) → Date  :43-45
export function computeDeliveryDueDate(referenceStart, totalDays) → Date  :47-49
```

### backend/src/services/documentNumberService.ts
```
export async function incrementDocumentSequence(tenantId, categoryCode, year) → Promise<number>  :24-45  # (tenant, kategori, yıl) bazında atomik sayaç artırımı — satı
export async function nextDocumentNumber(tenantId, categoryCode) → Promise<string | null>  :47-68
export async function nextOpportunityTrackingCode(tenantId, createdAt = new Date()) → Promise<string>  :80-104  # Fırsat (Opportunity) için benzersiz, kalıcı bir takip kodu ü
export async function previewDocumentNumber(tenantId, categoryCode = 'ORN') → Promise<string | null>  :110-128  # Üretilecek numaranın bir ÖNİZLEMESİNİ döndürür (sayaç artırm
```

### backend/src/services/personnelTransferService.ts
```
export interface OwnedCategory  :24-29
  key: string  :25-25
  label: string  :26-26
  count: number  :27-27
  sample: { id: string  :28-28
export interface OwnedItemsResult  :31-41
  userId: string  :32-32
  userName: string  :33-33
  role: string  :34-34
  status: string  :35-35
  categories: OwnedCategory[]  :36-36
  totalActive: number  :37-37
  inboundDelegationCount: number  :38-38
  createdOpportunityCount: number  :39-39
  hardDeleteBlocked: boolean  :40-40
export interface TransferResult  :43-46
  transferred: Record<string, number>  :44-44
  clearedInboundDelegations: number  :45-45
export async function getOwnedItems(tenantId, userId) → Promise<OwnedItemsResult>  :154-173
export async function transferOwnership(params) → Promise<TransferResult>  :193-202
export async function deactivateUser(tenantId, userId) → Promise<void>  :204-213
export async function hardDeleteUser(tenantId, userId) → Promise<  :215-215
```

### backend/src/services/processEngine.ts
```
export interface StepRecipientQuery  :35-40
  unitId: string  :36-36
  role: string | null  :37-37
  delegateUserId?: string | null  :38-38
  recipientField?: string | null  :39-39
export interface StageActionCtx  :119-129
  tenantId: string  :120-120
  entityType: string  :121-121
  entityId: string  :122-122
  step: WorkflowStep  :123-123
  actorUserId?: string  :124-124
  input?: Record<string, unknown>  :128-128
export interface FieldSpec  :135-135
  key: string  :135-135
export interface AdvanceProcessOpts  :730-738
  actorUserId?: string  :731-731
  stageId?: string  :732-732
  decision?: 'APPROVE' | 'REJECT'  :733-733
  note?: string  :734-734
  input?: Record<string, unknown>  :737-737
export interface AdvanceProcessResult  :740-744
  chain: ApprovalChain & { stages: ApprovalS  :741-741
  advancedToOrder: number | null  :742-742
  actionsInvoked: string[]  :743-743
export class ProcessNotConfiguredError  :28-33
```

### backend/src/services/profitabilitySnapshotScheduler.ts
```
export function startProfitabilitySnapshotScheduler() → void  :46-49
```

### backend/src/services/restoreService.ts
```
export type LogicalPayloadData  :20-20
export async function loadModelsIntoTarget(tx, data, provider, scope?, scopeTenant?,) → Promise<Record<string, number>  :59-111  # Tüm modelleri (sil +) yeniden yükler — hem in-place restore 
export async function analyzeRestore(tenantId, backupId, startedBy?,) → Promise<  :153-157  # backup vs canlı veri farkını hesaplar; RestoreJob (AWAITING_
export async function applyLogicalRestore(restoreId, actor?) → Promise<  :246-246  # Mantıksal geri yükleme: güvenlik snapshot + FK kapalı + sil/
export async function stageStateRestore(restoreId) → Promise<  :286-286  # State dosyasını stage eder (kontrollü-restart ile uygulanır)
```

### backend/src/services/tenantContext.ts
```
export function getTenantContext() → TenantContext | undefined  :15-17
export function runWithTenant(tenantId, fn) → T  :21-23
export function runWithRlsBypass(fn) → T  :29-31
```

### backend/src/services/updateNotifier.ts
```
export interface UpdateStatus  :18-33
  checkedAt?: string  :19-19
  current?: { shortSha?: string | null  :20-20
  update?: { available?: boolean  :21-22
  applied?: boolean  :23-23
  failed?: boolean  :24-24
  kind?: 'tag' | 'commit'  :25-25
  target?: string | null  :26-26
  ref?: string | null  :27-27
  notes?: string | null  :28-28
  publishedAt?: string | null  :29-29
  to?: string | null  :30-30
  error?: string | null  :31-31
export function enflowHome() → string  :36-38  # Repo kökü: ENFLOW_HOME ya da backend/src/services'ten üç üst
export function readUpdateStatus() → UpdateStatus | null  :40-46
export function startUpdateNotifier() → void  :123-127
```

### backend/pnpm-lock.yaml
```
keys: [lockfileVersion, settings, importers, packages, snapshots]
```

### backend/prisma/migrations/20260813184227_add_process_engine_fields/migration.sql
```
TABLE new_ApprovalStage
TABLE new_WorkflowStep
INDEX Workflow_tenantId_processKey_key ON Workflow
```

### backend/prisma/migrations/20260813203000_add_delegate_and_manual_default/migration.sql
```
TABLE new_WorkflowStep
```

### backend/prisma/migrations/20260816193936_add_platform_ticket/migration.sql
```
TABLE PlatformTicket
INDEX PlatformTicket_tenantId_status_idx ON PlatformTicket
```

### backend/prisma/migrations/20260816195438_add_platform_ticket_reported_type/migration.sql
```
TABLE new_PlatformTicket
INDEX PlatformTicket_tenantId_status_idx ON PlatformTicket
```

### backend/prisma/migrations/20260819134722_add_customer_parent_hierarchy/migration.sql
```
TABLE new_Customer
INDEX Customer_tenantId_parentId_idx ON Customer
```

### backend/prisma/migrations/20260823213111_add_scheduler_lock/migration.sql
```
TABLE SchedulerLock
```

### backend/prisma/migrations/20260823213343_add_scale_indexes/migration.sql
```
INDEX ContractWorkflow_tenantId_status_idx ON ContractWorkflow
INDEX Notification_tenantId_userId_idx ON Notification
INDEX Opportunity_tenantId_status_idx ON Opportunity
INDEX Opportunity_tenantId_assignedToId_idx ON Opportunity
INDEX Project_tenantId_status_idx ON Project
INDEX PurchaseRequest_tenantId_status_idx ON PurchaseRequest
INDEX TodoTask_tenantId_status_idx ON TodoTask
INDEX TodoTask_tenantId_assignedToUserId_idx ON TodoTask
```

### backend/prisma/migrations/20260825131003_add_opportunity_tracking_code/migration.sql
```
INDEX Opportunity_tenantId_trackingCode_key ON Opportunity
```

### backend/prisma/migrations/20260825131415_add_opportunity_required_doc/migration.sql
```
TABLE OpportunityRequiredDoc
INDEX OpportunityRequiredDoc_tenantId_opportunityId_idx ON OpportunityRequiredDoc
```

### backend/prisma/migrations/20260828090314_add_profitability_snapshot/migration.sql
```
TABLE ProfitabilitySnapshot
INDEX ProfitabilitySnapshot_tenantId_periodKey_idx ON ProfitabilitySnapshot
INDEX ProfitabilitySnapshot_tenantId_scope_projectKey_periodKey_asOfKey_key ON ProfitabilitySnapshot
```

### backend/prisma/migrations/migration_lock.toml
```
key provider
```

### backend/scripts/loadtest/mixed-read.mjs
```
async function login()  :18-27
async function main()  :29-57
```

### backend/src/planCatalog.ts
```
export type PlanId  :5-5
```

### backend/src/services/agentProvenance.ts
```
export function agentActorId(pluginKey) → string  :17-19  # Bir agent eklentisi için kanonik aktör kimliği üretir
export function isAgentActor(actorId?) → boolean  :22-25  # Verilen aktör kimliği bir sanal agent'a mı ait
export function parseAgentActor(actorId?)  :28-28  # Aktör kimliğinden pluginKey çözer; legacy etiket için null p
export function agentDisplayLabel(actorId?) → string  :40-47  # UI/log için okunur agent adı
```

### backend/src/services/aiClient.ts
```
export interface TenantAIConfig  :36-41
  baseUrl: string  :37-37
  apiKey: string  :38-38
  model: string  :39-39
  label?: string  :40-40
export async function getTenantAIConfig(tenantId) → Promise<TenantAIConfig | null>  :44-66  # moduleSettings
export async function isAIConfigured(tenantId) → Promise<boolean>  :68-70
export function assertSafeAiUrl(rawUrl) → void  :81-96  # SSRF azaltımı: YZ baseUrl yalnız http(s) olabilir ve bulut m
export async function chatJSON(opts) → Promise<T | null>  :102-164  # Tenant YZ'sine OpenAI-uyumlu chat isteği gönderir ve JSON ya
```

### backend/src/services/approvalSlaEscalation.ts
```
export async function getApprovalSlaBusinessDays(tenantId) → Promise<number>  :17-25
export async function sweepApprovalSlaEscalations(tenantId) → Promise<void>  :27-91
```

### backend/src/services/dashboardService.ts
```
export async function computeDashboard(tenantId, userId?)  :15-150
```

### backend/src/services/dashboardStream.ts
```
export function pingDashboard(tenantId) → void  :15-17
export async function getDashboardPingAt(tenantId) → Promise<number | null>  :20-23  # Son sinyal zamanını epoch-ms olarak döner; hiç ping atılmamı
```

### backend/src/services/deploymentGuard.ts
```
export function checkDeploymentTopology() → void  :15-30
```

### backend/src/services/financingEffect.ts
```
export interface CashEvent  :13-19
  kind: 'PAYMENT' | 'COLLECTION'  :14-14
  label: string  :15-15
  date: string  :16-16
  amount: number  :17-17
  currency: string  :18-18
export interface FinancingResultLine  :21-23
  effect: number  :22-22
export interface FinancingResult  :25-30
  closingDate: string  :26-26
  byCurrency: Record<string, { cost: number  :27-27
  events: FinancingResultLine[]  :28-28
  cashFlowGap: { currency: string  :29-29
export interface FinancingBomInput  :78-78
  partNumber: string  :78-78
export interface FinancingCostInput  :79-79
  description: string  :79-79
export interface FinancingInstallmentInput  :80-80
  note: string | null  :80-80
export function computeFinancingEffect(events, interestRates, referenceStart?,) → FinancingResult  :38-70
export function paymentDate(referenceStart, termDays) → string  :73-76  # referans tarihten gün vade ile ödeme tarihi (ISO)
export function buildFinancingEvents(boms, costs, installments, referenceStart?,) → CashEvent[]  :88-114  # BoM kalemleri (ödeme çıkışı) + CostItem'lar (ödeme çıkışı, F
```

### backend/src/services/governance.ts
```
export interface ApprovalTier  :13-13
  maxAmount: number  :13-13
export async function getApprovalMatrix(tenantId) → Promise<ApprovalTier[] | null>  :15-25
export async function resolveApproverRoles(tenantId, amount?,) → Promise<string[] | null>  :30-39  # Tutara göre onay rolleri; matris yoksa veya tutar yoksa null
export async function isSoDEnabled(tenantId) → Promise<boolean>  :41-47
export async function resolveEntityCreator(entityType, entityId) → Promise<string | null>  :50-66  # Onay zinciri / domain entity'sinin oluşturanını çözer (yoksa
export async function sodViolation(tenantId, actorUserId, entityType, entityId,) → Promise<string | null>  :72-85  # SoD ihlali varsa açıklama döner; ihlal yoksa/kapalıysa/çözül
```

### backend/src/services/invoiceService.ts
```
export interface CreateInvoiceInput  :9-27
  type?: string  :10-10
  invoiceNo?: string  :11-11
  amount: number | string  :12-12
  currency?: string  :13-13
  issueDate?: string  :14-14
  dueDate?: string  :15-15
  status?: string  :16-16
  projectId?: string | null  :17-17
  contractId?: string | null  :18-18
  milestoneId?: string | null  :19-19
  customerId?: string | null  :20-20
  customerName?: string | null  :21-21
  vendorName?: string | null  :22-22
  notes?: string | null  :23-23
  createdById?: string | null  :24-24
  categoryCode?: string  :25-25
  issueRateToTRY?: number | string  :26-26
export async function createInvoiceRecord(tenantId, data, actorUserId?)  :29-72
```

### backend/src/services/opportunityFolderService.ts
```
export type OpportunityEntityType  :28-28
export function resolveOpportunityUploadDir(trackingCode, subfolder)  :14-14  # `backend/uploads/opportunities/{trackingCode}/{subfolder}/` 
export function opportunityLocalUrl(trackingCode, subfolder, fileName) → string  :20-22
export function opportunityRemotePath(trackingCode, subfolder) → string  :24-26
export async function resolveOpportunityForEntity(entityType, entity, tenantId) → Promise<  :36-40  # Bir modül kaydının ait olduğu Fırsat'ı (varsa) çözer
```

### backend/src/services/profitabilityCashflow.ts
```
export interface CashPoint  :18-25
  date: string  :19-19
  inflow: number  :20-20
  outflow: number  :21-21
  cumulative: number  :22-22
  label: string  :23-23
  source: 'PLAN' | 'ACTUAL'  :24-24
export interface CashSeries  :27-33
  currency: string  :28-28
  points: CashPoint[]  :29-29
  maxDeficit: number  :30-30
  troughDate: string | null  :31-31
  endingPosition: number  :32-32
export interface DeficitWindow  :35-41
  currency: string  :36-36
  from: string  :37-37
  to: string  :38-38
  troughDate: string  :39-39
  troughAmount: number  :40-40
export interface CashflowResult  :43-50
  asOf: string  :44-44
  fxRates: Record<string, number>  :45-45
  byCurrency: CashSeries[]  :46-46
  consolidatedTRY: CashSeries  :47-47
  deficitWindows: DeficitWindow[]  :48-48
```

### backend/src/services/profitabilityDmo.ts
```
export interface DmoPeriodRow  :24-36
  periodKey: string  :25-25
  label: string  :26-26
  orderCount: number  :27-27
  revenue: number  :28-28
  cost: number  :29-29
  grossProfit: number  :30-30
  risturn: number  :31-31
  commission: number  :32-32
  netProfit: number  :33-33
  netMarginPct: number  :34-34
  unprofitableCount: number  :35-35
export interface DmoProfitResult  :38-46
  grain: DmoGrain  :39-39
  year: number | null  :40-40
  asOf: string  :41-41
  rows: DmoPeriodRow[]  :42-42
  totals: Omit<DmoPeriodRow, 'periodKey' | 'l  :43-43
  pipeline: { evaluationCount: number  :44-44
  currency: string  :45-45
export type DmoGrain  :16-16
export async function getDmoProfitability(tenantId, opts = {},) → Promise<DmoProfitResult>  :70-141
```

### backend/src/services/profitabilityInstruments.ts
```
export interface InstrumentParams  :20-26
  factoringAnnualDiscountPct: number  :21-21
  factoringHorizonDays: number  :22-22
  depositRatePct: number  :23-23
  depositTermDays: number  :24-24
  forwardHorizonDays: number  :25-25
export interface InstrumentScenario  :36-44
  instrument: 'FACTORING' | 'DEPOSIT' | 'FORWARD_  :37-37
  label: string  :38-38
  description: string  :39-39
  delta: number  :40-40
  detail: Record<string, number>  :41-41
  assumptions: Record<string, number>  :42-42
  reversible: boolean  :43-43
export interface InstrumentsResult  :46-51
  asOf: string  :47-47
  baseline: { treasuryNet: number  :48-48
  scenarios: InstrumentScenario[]  :49-49
  totalOpportunity: number  :50-50
export function buildInstrumentScenarios(events, opts, interestRates, params = {},) → InstrumentsResult  :191-216
```

### backend/src/services/profitabilityLedger.ts
```
export interface ProfitEvent  :17-30
  date: Date  :18-18
  amount: number  :19-19
  currency: string  :20-20
  direction: ProfitDirection  :21-21
  basis: ProfitBasis  :22-22
  source: ProfitSource  :23-23
  category: string  :24-24
  projectId: string | null  :25-25
  opportunityId: string | null  :26-26
  ref: string  :27-27
  confidence: 'FIRM' | 'ESTIMATED'  :28-28
  label: string  :29-29
export interface LedgerProject  :34-46
  id: string  :35-35
  name: string  :36-36
  totalValue: number  :37-37
  contractCurrency: string  :38-38
  progress: number  :39-39
  startDate: Date | null  :40-40
  plannedEndDate: Date | null  :41-41
  createdAt: Date  :42-42
  opportunityId: string | null  :43-43
  applyOverhead: boolean  :44-44
  overheadAmount: number  :45-45
```

### backend/src/services/profitabilityRollup.ts
```
export interface RollupOpts  :16-23
  grain: Grain  :17-17
  asOf: Date  :18-18
  fxRates?: Record<string, number>  :19-19
  reportCurrency?: string  :20-20
  projectNames?: Record<string, string>  :22-22
export interface CurrencyBreak  :25-28
  plannedRevenue: number  :26-26
  actualRevenue: number  :27-27
export interface PeriodRow  :30-48
  periodKey: string  :31-31
  label: string  :32-32
  currency: string  :33-33
  plannedRevenue: number  :35-35
  actualRevenue: number  :36-36
  plannedCashIn: number  :38-38
  actualCashIn: number  :39-39
  eacCost: number  :41-41
  varianceMarginPct: number  :42-42
  eventCount: number  :44-44
  byCurrency: Record<string, CurrencyBreak>  :45-45
  fxAssumptions: Record<string, number>  :46-46
  fxWarnings: string[]  :47-47
export type Grain  :14-14
export function periodKeyOf(date, grain) → string  :52-59
```

### backend/src/services/profitabilityService.ts
```
export interface ProfitScope  :21-21
  kind: 'ALL' | 'PROJECT'  :21-21
export interface LedgerResult  :131-137
  scope: ProfitScope  :132-132
  asOf: string  :133-133
  fxRates: Record<string, number>  :134-134
  plan: ProfitEvent[]  :135-135
  actual: ProfitEvent[]  :136-136
export interface SummaryResult  :159-166
  scope: ProfitScope  :160-160
  grain: Grain  :161-161
  asOf: string  :162-162
  reportCurrency: string  :163-163
  fxRates: Record<string, number>  :164-164
  rows: PeriodRow[]  :165-165
export interface CashflowApiResult  :198-198
export interface TreasuryApiResult  :199-199
export interface InstrumentsApiResult  :226-226
export async function getLedger(tenantId, scope, opts = {},) → Promise<LedgerResult>  :139-157
export async function getSummary(tenantId, scope, grain, opts = {},) → Promise<SummaryResult>  :168-188
export async function getCashflow(tenantId, scope, opts = {},) → Promise<CashflowApiResult>  :201-210
export async function getTreasury(tenantId, scope, opts = {},) → Promise<TreasuryApiResult>  :212-224
export async function getInstruments(tenantId, scope, opts = {},) → Promise<InstrumentsApiResult>  :228-238
export function parseFxParam(raw?) → Record<string, number> | undef  :241-250  # "USD:40,EUR:44" → { USD: 40, EUR: 44 }
export function parseScopeParam(raw?) → ProfitScope  :253-256  # "project:<id>" | "all" → ProfitScope
```

### backend/src/services/profitabilitySnapshot.ts
```
export interface SnapshotResult  :17-22
  asOf: string  :18-18
  asOfKey: string  :19-19
  written: number  :20-20
  periodKeys: string[]  :21-21
export interface SnapshotRow  :67-81
  id: string  :68-68
  scope: string  :69-69
  projectKey: string  :70-70
  asOf: string  :71-71
  asOfKey: string  :72-72
  periodKey: string  :73-73
  currency: string  :74-74
  plannedRevenue: number  :75-75
  plannedCost: number  :76-76
  plannedMargin: number  :77-77
  cashInPlanned: number  :78-78
  cashOutPlanned: number  :79-79
  createdAt: string  :80-80
export interface PlanDriftPoint  :104-104
  asOfKey: string  :104-104
export interface PlanDriftSeries  :105-105
  periodKey: string  :105-105
export function asOfKeyOf(d) → string  :13-15
export async function takeSnapshot(tenantId, opts = {}) → Promise<SnapshotResult>  :29-65  # Bir tenant için planlı aylık `PeriodRow`'ların anlık görüntü
```

### backend/src/services/roleDefaultPermissions.ts
```
export function defaultPermissionsForRole(role) → string[]  :64-66
```

### backend/src/services/schedulerLock.ts
```
export async function acquireLock(name, ttlMs) → Promise<boolean>  :23-42  # Kilidi devralmayı dener
export async function releaseLock(name) → Promise<void>  :45-50  # İş bitince kilidi hemen serbest bırakır (expiresAt'i geçmişe
```

### backend/src/services/serviceTicketReminders.ts
```
export async function sweepServiceTicketSla(tenantId) → Promise<void>  :13-55
```

### backend/src/services/slaEscalation.ts
```
export async function sweepSlaEscalations(tenantId) → Promise<void>  :14-69
```

### backend/src/services/specAnalysis.ts
```
export interface AnalyzedDoc  :11-18
  name: string  :12-12
  docType: string  :13-13
  description: string  :14-14
  deadline_priority: string  :15-15
  estimated_days: number  :16-16
  notes: string  :17-17
export interface SpecAnalysis  :20-33
  documents: AnalyzedDoc[]  :21-21
  tasks?: { order: number  :22-22
  key_clauses?: { clause: string  :23-23
  contract_summary?: { project_name?: string  :24-25
  tender_no?: string  :26-26
  type?: string  :27-27
  tax_obligations?: string[]  :28-28
  key_deadlines?: string[]  :29-29
  special_requirements?: string[]  :30-30
  project_impacts?: string[]  :31-31
export function mockDocuments() → AnalyzedDoc[]  :64-75
export async function analyzeSpec(inputText, opts,) → Promise<  :105-108  # Şartname/sözleşme metnini analiz eder; tenant YZ'si yapıland
```

### backend/src/services/unitReportingService.ts
```
export interface UnitDefinition  :6-10
  key: string  :7-7
  label: string  :8-8
  role: string  :9-9
export interface Period  :52-55
  start: Date  :53-53
  end: Date  :54-54
export interface Metric  :76-82
  label: string  :77-77
  value: number | string  :78-78
  unit?: string  :79-79
  hint?: string  :80-80
  tone?: 'default' | 'positive' | 'warning'   :81-81
export interface ChartSeries  :84-88
  title: string  :85-85
  type: 'bar' | 'pie' | 'line'  :86-86
  data: { name: string  :87-87
export interface UnitMetricsResult  :90-97
  unitKey: string  :91-91
  label: string  :92-92
  role: string  :93-93
  period: { start: string  :94-94
  metrics: Metric[]  :95-95
  charts: ChartSeries[]  :96-96
export interface WorkflowBottleneck  :457-461
```

### backend/src/services/virtualAgentService.ts
```
export interface AgentOutput  :13-25
  rationale: string  :14-14
  output: Record<string, unknown>  :15-15
  taskTitle: string  :17-17
  autonomousAction?: { kind: string  :19-20
  summary: string  :21-21
  reversible: boolean  :22-22
  execute: () => Promise<void>  :23-23
export function scoreQuotes(quotes,)  :189-191
export function hasHandler(pluginKey) → boolean  :505-507
export async function runAgent(params) → Promise<  :513-518  # Bir agent eklentisini çalıştır
export async function ratifyAgentRun(params) → Promise<  :633-639  # Devir alan gerçek kişi çıktıyı ratifiye eder veya reddeder
```

### backend/src/services/workflowTemplate.ts
```
export interface ApplyTemplateResult  :152-156
  addedUnits: string[]  :153-153
  createdProcesses: string[]  :154-154
  skippedProcesses: string[]  :155-155
export async function applyDefaultWorkflowTemplate(tenantId, actorUserId?) → Promise<ApplyTemplateResult>  :164-222  # Şablonu bir tenant'a uygular: (1) eksik varsayılan birimleri
```

### backend/src/usageService.ts
```
export async function checkLimit(tenantId, feature, amount = 1) → Promise<boolean>  :16-41
export async function checkUserSeatLimit(tenantId) → Promise<  :46-46
export async function incrementUsage(tenantId, feature, amount = 1)  :54-61
```

### backend/src/utils/entityTypeTab.ts
```
export function entityTypeToTab(entityType?) → string | undefined  :25-27
```

### backend/src/utils/fileUpload.ts
```
export function slugify(str) → string  :13-18
export function getUploadDir(root, folderName) → string  :20-24
export async function uploadToNextcloud(fileBuffer, fileName, remotePath, ncUrl, ncUser, ncPass,) → Promise<string>  :26-72
export async function tryUploadToNextcloud(tenantId, fileBuffer, fileName, remotePath,) → Promise<string | null>  :82-115  # `uploadToNextcloud`'u env değişkenleri + INTEGRATION_SYNC ko
```

### backend/src/utils/secureUpload.ts
```
export function documentUpload(maxMb = 50)  :48-54  # Bellek-tabanlı, tür-doğrulamalı yükleme
export function enforceStorageLimit()  :62-73  # multer'dan SONRA, route handler'dan ÖNCE — yüklenen dosyayı 
```

## governance

### governance/role-matrix.ts
```
export interface DecisionRight  :16-20
  decision: string  :17-17
  via: string  :18-18
  threshold?: string  :19-19
export interface RoleTask  :22-26
  task: string  :23-23
  raci: RACI  :24-24
  via: string  :25-25
export interface RoleSpec  :28-41
  role: string  :29-29
  unit: string  :30-30
  kind: RoleKind  :31-31
  staffing: Staffing  :32-32
  modules: string[]  :33-33
  endpointDomains: string[]  :34-34
  decisionRights: DecisionRight[]  :35-35
  tasks: RoleTask[]  :36-36
  approvalIn: string[]  :37-37
  agentSubstitute?: { pluginKey: string  :38-38
  reviewed?: 'DONE' | 'ACCEPTED'  :39-39
  notes?: string  :40-40
export type RoleKind  :11-11
export type Staffing  :12-12
export type RACI  :13-13
export type AgentMode  :14-14
```

## src

### src/components/settings/TenantSettings.tsx
```
props TenantSettingsProps
hook useState
hook useEffect
hook useCallback
export TenantSettings
handler onChange
handler onClick
```

### src/layout/Header.tsx
```
hook useAuth
hook useTheme
hook useState
hook useRef
hook useOpportunities
hook useCustomers
hook useProjects
hook useTasks
hook useMemo
hook useEffect
export Header
handler onAccess
handler onClick
handler onChange
handler onKeyDown
```

### src/modules/ActivityLogModule.tsx
```
component ArchivesTab
component ActivityLogModule
hook useState
hook useCallback
hook useEffect
export ActivityLogModule
handler onClick
handler onChange
```

### src/modules/BackupModule.tsx
```
hook useState
hook useCallback
hook useEffect
export BackupModule
handler onRun
handler onVerify
handler onRestore
handler onChange
handler onClick
```

### src/modules/contract-workflow/constants.ts
```
export type TabId  :15-15
```

### src/modules/contract-workflow/ContextTab.tsx
```
component ContextTab
handler onBlur
handler onClick
```

### src/modules/contract-workflow/LegalCaseForm.tsx
```
component LegalCaseForm
hook useState
handler onClick
handler onChange
```

### src/modules/contract-workflow/LegalView.tsx
```
component LegalView
hook useState
hook useCallback
hook useEffect
handler onClick
```

### src/modules/contract-workflow/SigningTab.tsx
```
component SigningTab
handler onClick
handler onChange
```

### src/modules/contract-workflow/types.ts
```
export interface ContractWorkflowDoc  :3-16
  id: string  :4-4
  workflowId: string  :5-5
  name: string  :6-6
  docType: string  :7-7
  description?: string  :8-8
  deadline?: string | null  :9-9
  status: string  :10-10
  fileUrl?: string | null  :11-11
  isRequired: boolean  :12-12
  isAiGenerated: boolean  :13-13
  sortOrder: number  :14-14
  notes?: string  :15-15
export interface DeliveryTimelineStep  :18-23
  id: string  :19-19
  title: string  :20-20
  sortOrder: number  :21-21
  plannedDate?: string | null  :22-22
export interface PenaltyExposure  :25-30
  overdueDays: number  :26-26
  rawPenalty: number  :27-27
  cappedPenalty: number  :28-28
  isCapped: boolean  :29-29
export interface ContractWorkflow  :32-61
  id: string  :33-33
```

### src/modules/ContractWorkflowModule.tsx
```
component ContractWorkflowModule
hook useAuth
hook useState
hook useAIGate
hook useCallback
hook useEffect
export ContractWorkflowModule
handler onCreate
handler onSelectWorkflow
handler onTenderNameBlur
handler onTenderNoBlur
handler onContractValueBlur
handler onDeadlineBlur
handler onNotesBlur
handler onDeliveryFieldsBlur
handler onSaveTexts
handler onAnalyse
handler onFileSelect
handler onAddDoc
handler onDeleteDoc
handler onDocStatusChange
handler onDocFieldUpdate
handler onFetchFromArchive
handler onMarkReadyToSign
handler onSendForApproval
```

### src/modules/CorporateGovernanceModule.tsx
```
hook useAuth
hook useState
hook useCallback
hook useEffect
export CorporateGovernanceModule
handler onDelete
handler onTrack
handler onClick
handler onChange
```

### src/modules/dashboard/KpiDetailDrawer.tsx
```
props Props
export KpiKey
export KpiDetailDrawer
handler onClose
handler onClick
```

### src/modules/dashboard/WidgetDetailDrawer.tsx
```
component Rows
component Row
props Props
export WidgetDetailDrawer
handler onClose
handler onNavigate
```

### src/modules/DeliveryTimelinePanel.tsx
```
props DeliveryTimelinePanelProps
export DeliveryTimelineStepLike
export DeliveryTimelinePanel
```

### src/modules/DmoModule.tsx
```
component DmoModule
component OrdersTab
component OrderDrawer
component CatalogTab
component AgreementsTab
component RatesTab
component ReconciliationTab
component Modal
component CatalogForm
component AgreementForm
component RateForm
component OrderForm
component ParamsModal
hook useAuth
hook useState
hook useCallback
hook useEffect
export DmoModule
handler onClick
handler onSelect
handler onEdit
handler onDelete
handler onSaved
handler onClose
handler onChange
```

### src/modules/FinanceModule.tsx
```
component OverheadPoolTab
hook useAuth
hook useState
hook useCallback
hook useEffect
export FinanceModule
handler onPay
handler onDelete
handler onChanged
handler onDecide
handler onClick
handler onChange
handler onBlur
handler onClose
```

### src/modules/project-mgmt/CostForm.tsx
```
props CostFormProps
hook useState
export CostForm
handler onClick
handler onChange
```

### src/modules/project-mgmt/helpers.ts
```
export function isHandoverComplete(docs) → boolean  :27-30
export const fmtDate = (d?) =>  :5-6
export const fmtShort = (d?) =>  :7-8
export const isOverdue = (d?) =>  :9-25
export const calcFinancials = (p) =>  :13-25
export const printProjectReport = (project, forCustomer = false) =>  :34-80
```

### src/modules/project-mgmt/ProjectDetail.tsx
```
props ProjectDetailProps
hook useState
hook useEffect
hook useMemo
export ProjectDetail
handler onClick
handler onChange
handler onApplied
handler onSave
```

### src/modules/reporting/ConsolidationView.tsx
```
component ConsolidationView
```

### src/modules/SalesSupport.tsx
```
component TenderList
component TenderCalendar
component ChecklistTab
component GuaranteesTab
component SubmittedTenders
component TenderSelectorEmpty
component Modal
component TenderForm
props SalesSupportProps
hook useAuth
hook useState
hook useCallback
hook useEffect
hook useMemo
hook useAIGate
export SalesSupport
handler onOf
handler onSelect
handler onChanged
handler onWithdraw
handler onReleaseHold
handler onSelectTender
handler onChange
handler onClick
handler onKeyDown
```

### src/modules/todo/helpers.ts
```
export interface ProposalDetailItem  :177-188
  partNumber: string  :178-178
  description: string  :179-179
  quantity: number  :180-180
  purchaseCost?: number  :181-181
  purchaseCostBase?: number  :184-184
  unitSalePrice?: number  :185-185
  totalSalePrice?: number  :186-186
  marginPercentage?: number  :187-187
export interface ProposalDetail  :190-199
  price: string  :191-191
  totalPrice: number  :192-192
  totalCost: number  :193-193
  items: ProposalDetailItem[]  :194-194
  description: string  :195-195
  terms: string  :196-196
  version: number  :197-197
  opportunityTitle: string  :198-198
export const taskTargetTab = (t) =>  :56-65
export const fmtCompletedAt = (d?) =>  :76-77
export const daysUntil = (iso?) =>  :83-88
export const fmtDueDate = (iso?) =>  :91-97
export const getPriorityColor = (priority) =>  :105-112
export const getPriorityLabel = (priority) =>  :115-120
export const composedTitle = (newTask, taskAction, ctx) =>  :128-139
```

### src/modules/todo/PendingProposalApprovals.tsx
```
component PendingProposalApprovals
```

### src/modules/todo/ResolvedApprovals.tsx
```
component ResolvedApprovals
hook useState
```

### src/modules/todo/TaskList.tsx
```
component TaskRow
component Section
component TaskList
hook useState
hook useMemo
handler onClick
handler onChange
```

### src/modules/TodoModule.tsx
```
hook useAuth
hook useState
hook useCallback
hook useEffect
export TodoModule
handler onLoading
handler onAction
handler onPreview
handler onApprove
handler onReject
handler onMarkRead
handler onNavigate
handler onToggleStatus
handler onAssign
handler onSubmit
```

### src/types/project.ts
```
export interface ProjectMilestone  :9-34
  id: string  :10-10
  projectId: string  :11-11
  title: string  :12-12
  description?: string | null  :13-13
  milestoneType: MilestoneType  :14-14
  status: MilestoneStatus  :15-15
  progress: number  :16-16
  assignedToId?: string | null  :17-17
  assignedToName?: string | null  :18-18
  plannedStart?: string | null  :19-19
  plannedEnd?: string | null  :20-20
  actualStart?: string | null  :21-21
  actualEnd?: string | null  :22-22
  budgetAmount?: number | null  :23-23
  actualCost?: number | null  :24-24
  currency: string  :25-25
  isParallel: boolean  :26-26
  requiresApproval: boolean  :27-27
  approvedById?: string | null  :28-28
  approvedAt?: string | null  :29-29
  order: number  :30-30
  notes?: string | null  :31-31
  createdAt: string  :32-32
  updatedAt: string  :33-33
```

### src/types/tender.ts
```
export interface DeliveryTimelineStep  :2-7
  id: string  :3-3
  title: string  :4-4
  sortOrder: number  :5-5
  plannedDate?: string | null  :6-6
export interface TenderChecklistItem  :8-22
  id: string  :9-9
  tenderId: string  :10-10
  name: string  :11-11
  isRequired: boolean  :12-12
  status: 'PENDING' | 'DONE' | 'WAIVED'  :13-13
  fileUrl?: string | null  :14-14
  sortOrder: number  :15-15
  notes?: string | null  :16-16
  docType?: string | null  :17-17
  deadline?: string | null  :18-18
  isAiGenerated?: boolean  :19-19
  source?: 'MANUAL' | 'AI' | 'CORPORATE_DOC' |  :20-20
  corporateDocId?: string | null  :21-21
export interface Tender  :23-51
  id: string  :24-24
  tenantId: string  :25-25
  name: string  :26-26
  ikn?: string | null  :27-27
  authority?: string | null  :28-28
```

### src/App.tsx
```
hook useState
hook useRef
hook useEffect
hook useOpportunities
hook useCustomers
hook useProjects
hook useContracts
hook useTasks
hook useUnits
hook useUsers
hook useDocuments
hook useProposals
export App
handler onApproveProposal
handler onNavigate
handler onLogout
handler onComplete
handler onLogin
```

### src/components/CustomerCombobox.tsx
```
component CustomerCombobox
hook useState
hook useMemo
handler onChange
```

### src/components/HandOffModal.tsx
```
props HandOffModalProps
hook useState
export HandOffModal
handler onClick
handler onChange
```

### src/components/MoneyInput.tsx
```
component MoneyInput
hook useState
hook useRef
hook useEffect
handler onChange
```

### src/components/ProcessTriggerButton.tsx
```
component ProcessTriggerButton
hook useState
hook useEffect
```

### src/components/settings/SubscriptionSettings.tsx
```
props SubscriptionSettingsProps
export SubscriptionSettings
```

### src/components/settings/UnitManagement.tsx
```
props UnitManagementProps
hook useState
export UnitManagement
handler onClick
handler onSubmit
handler onChange
```

### src/components/settings/UserManagement.tsx
```
props UserManagementProps
hook useState
export UserManagement
handler onSubmit
handler onConfirm
```

### src/content/helpArticles.ts
```
export interface HelpArticleSection  :8-11
  heading: string  :9-9
  body: string  :10-10
export interface HelpArticle  :13-18
  moduleId: string  :14-14
  summary: string  :15-15
  audience: string  :16-16
  sections: HelpArticleSection[]  :17-17
export const getHelpArticle = (moduleId) =>  :184-184
```

### src/contexts/AuthContext.tsx
```
hook useState
hook useEffect
hook useContext
export AuthProvider
```

### src/hooks/useBoM.ts
```
export interface AbbreviatedBoMItem  :7-20
  id?: string  :8-8
  lineKey?: string  :9-9
  pn: string  :10-10
  desc: string  :11-11
  qty: number  :12-12
  cost: number  :13-13
  margin: number  :14-14
  vendor?: string  :15-15
  currency?: string  :16-16
  brandId?: string  :17-17
  categoryId?: string  :18-18
  source?: string  :19-19
export const useBoM = (selectedOppId, setOpportunities, opportunities?) =>  :25-120
```

### src/hooks/useEnflowQueries.ts
```
export const useOpportunities = (tenantId, options = {}) =>  :6-14
export const useCustomers = (tenantId, options = {}) =>  :16-24
export const useProjects = (tenantId, options = {}) =>  :26-34
export const useContracts = (tenantId, options = {}) =>  :36-44
export const useTasks = (tenantId, options = {}) =>  :46-54
export const useUnits = (tenantId, options = {}) =>  :56-64
export const useUsers = (tenantId, options = {}) =>  :66-74
export const useDocuments = (tenantId, options = {}) =>  :76-84
export const useProposals = (tenantId, options = {}) =>  :86-94
export const useModuleSettings = (tenantId) =>  :96-103
```

### src/layout/Sidebar.tsx
```
hook useUnsavedChanges
hook useAuth
hook useState
hook useEffect
export Sidebar
handler onClick
```

### src/lib/format.ts
```
export const fmtCurrency = (n, currency = 'TRY') =>  :10-11
export const fmtCurrencyExact = (v, currency = 'TRY') =>  :13-14
export const fmtCurrencyOrDash = (amount, currency = 'TRY') =>  :16-19
export const formatMoneyInput = (n) =>  :25-26
export const parseMoneyInput = (raw) =>  :31-41
```

### src/lib/guaranteeText.ts
```
export function sampleGuaranteeText(workName, refNo, type, amount, currency, expiry, indefinite,) → string  :4-16
export async function uploadGuaranteeSampleFile(guaranteeId, file) → Promise<void>  :25-40  # Talep aşamasında eklenen örnek teminat mektubu dosyasını Gua
```

### src/lib/permissionTree.ts
```
export interface PermChild  :15-18
  permission: string  :16-16
  label: string  :17-17
export interface PermGroup  :19-25
  id: string  :20-20
  label: string  :21-21
  icon: React.ComponentType<{ size?: number  :22-22
  permission: string  :23-23
  children: PermChild[]  :24-24
export function buildPermissionGroups() → PermGroup[]  :50-67
```

### src/modules/contract-workflow/AnalysisTab.tsx
```
component AnalysisTab
handler onChange
handler onClick
```

### src/modules/contract-workflow/DetailHeader.tsx
```
component DetailHeader
handler onClick
```

### src/modules/contract-workflow/DocumentsTab.tsx
```
component GuaranteeRequestSection
component DocumentsTab
hook useState
hook useCallback
hook useEffect
handler onClick
handler onChange
handler onBlur
```

### src/modules/contract-workflow/helpers.ts
```
export interface DeadlineAlarm  :46-52
  level: 'none' | 'warning' | 'critical'  :47-47
  daysLeft: number | null  :48-48
  missingRequired: number  :49-49
  totalRequired: number  :50-50
  label: string  :51-51
export async function apiFetch(path, init?)  :8-10
export function bestProposalPrice(opportunityId, proposals) → number | null  :14-36
export function computeDeadlineAlarm(wf) → DeadlineAlarm  :54-68
export const stepIndex = (status) =>  :38-52
export const isDocsComplete = (wf) =>  :70-70
```

### src/modules/contract-workflow/WorkflowListPanel.tsx
```
component WorkflowListPanel
component WorkflowCard
export WorkflowFormState
handler onChange
handler onClick
```

### src/modules/CostAnalysisModule.tsx
```
hook useAuth
hook useState
hook useEffect
hook useMemo
export CostAnalysisModule
handler onChange
handler onClick
```

### src/modules/crm/constants.ts
```
export const proposalStatusTone = (status) =>  :16-32
export const getStatusStyle = (status) =>  :21-32
```

### src/modules/crm/CustomersView.tsx
```
component CustomersView
handler onChange
handler onClick
```

### src/modules/crm/DashboardView.tsx
```
component DashboardView
handler onOpps
handler onValue
```

### src/modules/crm/NewCustomerModal.tsx
```
component NewCustomerModal
hook useState
handler onClick
handler onSubmit
handler onChange
handler onPick
```

### src/modules/crm/NewOpportunityModal.tsx
```
component NewOpportunityModal
hook useState
hook useEffect
handler onClick
handler onSubmit
handler onChange
```

### src/modules/crm/OpportunitiesView.tsx
```
component OpportunitiesView
hook useAuth
hook useState
hook useMemo
handler onClick
handler onChange
handler onEditProposal
handler onGoToCostAnalysis
```

### src/modules/crm/OpportunityDocumentsPanel.tsx
```
component OpportunityDocumentsPanel
hook useState
hook useCallback
handler onClick
```

### src/modules/crm/OpportunityRequiredDocsPanel.tsx
```
component OpportunityRequiredDocsPanel
hook useState
hook useCallback
hook useEffect
handler onClick
handler onChange
```

### src/modules/crm/ProposalsView.tsx
```
component ProposalsView
```

### src/modules/CRMModule.tsx
```
hook useAuth
hook useState
hook useEffect
hook useSearch
hook useMemo
export CRMModule
handler onProposal
handler onOpportunity
handler onSave
handler onSaveAll
handler onProgressStatus
handler onMarkLost
handler onHandOff
handler onEdit
handler onCheckIn
handler onEditProposal
handler onGoToCostAnalysis
handler onRequestApproval
handler onOpenReport
handler onOpenContacts
handler onEditCustomer
handler onDeleteCustomer
handler onCreateProposal
handler onWonOpportunity
handler onLostOpportunity
```

### src/modules/dashboard/widgetCatalog.ts
```
export interface WidgetMeta  :15-19
  key: WK  :16-16
  philosophy: string  :17-17
  horizon: DecisionHorizon  :18-18
export interface UserDashboardLayout  :196-199
  widgets: { key: WK  :197-197
  order: WK[]  :198-198
export type WK  :6-6
export type DecisionHorizon  :13-13
export function resolveRoleDefault(role, roleTemplateOverride?) → WK[]  :204-209
export function resolveEffectiveWidgets(role, saved, roleTemplateOverride?) → WK[]  :213-219
export function buildEditableLayout(role, saved, roleTemplateOverride?)  :223-223
```

### src/modules/Dashboard.tsx
```
hook useState
hook useAuth
hook useMemo
hook useEffect
hook useDashboardStream
export Dashboard
handler onClick
handler onExpand
handler onNavigate
handler onOpps
handler onValue
handler onCount
handler onSave
```

### src/modules/LicenseTypesModule.tsx
```
hook useAuth
hook useState
hook useEffect
export LicenseTypesModule
handler onChange
handler onClick
```

### src/modules/ManagementReportingModule.tsx
```
component ManagementReportingModule
hook useAuth
hook useState
hook useCallback
hook useEffect
handler onChange
handler onClick
handler onEdit
handler onSubmit
handler onDelete
handler onReviewed
```

### src/modules/negotiation/AuctionBoard.tsx
```
component AuctionBoard
handler onChange
handler onClick
```

### src/modules/negotiation/AuctionSidePanel.tsx
```
component AuctionSidePanel
handler onChange
handler onClick
```

### src/modules/negotiation/ChatInfoPanel.tsx
```
component ChatInfoPanel
handler onClick
```

### src/modules/negotiation/ChatWindow.tsx
```
component ChatWindow
handler onSubmit
handler onChange
handler onClick
```

### src/modules/NegotiationModule.tsx
```
hook useAuth
hook useState
hook useMemo
hook useEffect
hook useRef
export NegotiationModule
handler onBackToDashboard
handler onDeal
handler onSelect
handler onStart
handler onFinalize
handler onCustomCounterSubmit
handler onQuickCounter
handler onRestart
handler onMarkLost
handler onState
handler onPct
handler onLaunch
handler onRound
handler onWinner
handler onNewAuction
handler onSubmitRound
handler onLog
```

### src/modules/PlatformTicketsModule.tsx
```
component PlatformTicketsModule
hook useState
hook useCallback
hook useEffect
export PlatformTicketsModule
handler onClick
handler onChange
handler onSubmit
```

### src/modules/PresalesModule.tsx
```
props PresalesModuleProps
hook useAuth
hook useRef
hook useState
hook useEffect
hook useBoM
hook useCallback
export PresalesModule
handler onChange
handler onClick
handler onTransferToBoM
handler onSelected
```

### src/modules/procurement/PRDetailDrawer.tsx
```
props PRDetailDrawerProps
hook useState
export PRDetailDrawer
handler onClick
handler onChange
```

### src/modules/ProcurementModule.tsx
```
props ProcurementModuleProps
hook useAuth
hook useState
hook useCallback
hook useEffect
export ProcurementModule
handler onClick
handler onDelete
handler onEdit
handler onRefresh
handler onSave
```

### src/modules/profitability/DmoChannelTab.tsx
```
component DmoChannelTab
component Card
hook useState
hook useCallback
hook useEffect
hook useMemo
handler onChange
```

### src/modules/ProfitabilityModule.tsx
```
component ProfitabilityModule
component MainTabs
component TreasuryRow
component SummaryCard
hook useState
hook useCallback
hook useEffect
hook useMemo
handler onTab
handler onChange
```

### src/modules/project-mgmt/KanbanView.tsx
```
component KanbanView
```

### src/modules/ProjectManagementModule.tsx
```
props ProjectManagementModuleProps
hook useAuth
hook useState
hook useCallback
hook useEffect
hook useMemo
export ProjectManagementModule
handler onOpportunities
handler onClick
handler onChange
handler onSelect
handler onEdit
handler onDelete
handler onRefresh
handler onPrintReport
handler onSave
```

### src/modules/reporting/BottleneckPanel.tsx
```
component BottleneckPanel
```

### src/modules/reporting/OverviewTab.tsx
```
component OverviewTab
```

### src/modules/ServiceTicketsModule.tsx
```
component ServiceTicketsModule
props Props
hook useState
hook useEffect
hook useCallback
export ServiceTicketsModule
handler onClick
handler onChange
handler onSubmit
```

### src/modules/SettingsModule.tsx
```
props SettingsModuleProps
hook useQueryClient
hook useModuleSettings
hook useState
hook useEffect
hook useAuth
export SettingsModule
handler onChange
handler onClick
handler onData
```

### src/modules/SpecAnalysis.tsx
```
props SpecAnalysisProps
hook useAIGate
hook useState
export SpecAnalysis
handler onChange
handler onClick
```

### src/modules/SpecComplianceMatrix.tsx
```
props SpecComplianceMatrixProps
hook useAIGate
hook useState
hook useEffect
hook useCallback
export SpecComplianceMatrix
handler onChange
handler onClick
```

### src/modules/todo/PendingChainApprovals.tsx
```
component PendingChainApprovals
hook useState
hook useEffect
handler onChange
```

### src/modules/todo/UnifiedWorkQueue.tsx
```
component Section
component UnifiedWorkQueue
hook useState
hook useMemo
handler onClick
```

### src/modules/VirtualAgentsTestModule.tsx
```
hook useAuth
hook useState
hook useCallback
hook useEffect
export VirtualAgentsTestModule
handler onChange
handler onClick
handler onSetMode
handler onDisable
handler onRatify
```

### src/modules/VisitPlanModule.tsx
```
props VisitPlanModuleProps
hook useAuth
hook useState
hook useCallback
hook useEffect
export VisitPlanModule
handler onChange
handler onClick
handler onBlur
```

### src/modules/WorkflowBuilder.tsx
```
hook useUnsavedChanges
hook useState
hook useMemo
hook useEffect
export WorkflowBuilder
handler onConfig
handler onClick
handler onChange
```

### src/services/apiService.ts
```
class ApiService  :24-850
  setAuth(tenantId, token)  :25-27
  async login(email, password)  :29-31
  async forgotPassword(email)  :33-35
  async getSetupStatus() → Promise<  :38-38
  async runSetup(payload) → Promise<  :43-43
  async getCustomers()  :51-51
  async createCustomer(data)  :52-52
  async updateCustomer(id, data)  :53-53
  async deleteCustomer(id)  :54-54
  async getContacts(customerId)  :55-55
  async createContact(customerId, data)  :56-56
  async updateContact(customerId, contactId, data)  :57-57
  async deleteContact(customerId, contactId)  :58-58
  async getOpportunities()  :61-61
  async createOpportunity(data)  :62-62
  async updateOpportunity(id, data)  :63-63
  async deleteOpportunity(id)  :64-64
  async checkInOpportunityProgress(id, data)  :65-65
  async getOpportunityProgressLog(id)  :66-66
  async saveBoMItems(oppId, items, opts?)  :67-67
  async saveCostItems(oppId, items)  :68-68
  async saveCostAnalysis(oppId, data)  :69-69
  async getCostAnalysisVersions(oppId)  :70-70
  async getSalesSettings()  :71-71
```

### src/types/crm.ts
```
export interface Opportunity  :4-41
  id: string  :5-5
  trackingCode?: string | null  :6-6
  title: string  :7-7
  value: number  :8-8
  currency?: string  :9-9
  probability: number  :10-10
  expectedCloseDate?: string  :11-11
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' |  :12-12
  description?: string  :13-13
  lostReason?: string  :14-14
  agentTriage?: { crm?: { recommendation: string  :15-16
  igpd?: { recommendation: string  :17-17
  technicalStatus?: string  :19-19
  bomStatus?: string  :20-20
  techEvalStatus?: 'PENDING' | 'COMPLETED' | 'REJECTED  :21-21
  techEvalReason?: string | null  :22-22
  procurementMethod?: string  :23-23
  targetBidDate?: string  :24-24
  bomEvaluation?: string  :25-25
  tenantId?: string  :26-26
  customerId: string  :27-27
  assignedToId: string  :28-28
  createdById?: string  :29-29
  presalesId?: string  :30-30
```

### src/types/dashboard.ts
```
export interface DashboardPayload  :1-35
  kpis: { winRate: number  :2-2
  timeSensitive: { tenderDeadlines: { id: string  :3-4
  guaranteeExpiries: { id: string  :5-5
  guaranteeRequests: { id: string  :6-6
  costApprovalsPending: { id: string  :7-7
  invoicesDue: { id: string  :8-8
  milestonesDue: { id: string  :9-9
  contractDeadlines: { id: string  :10-10
  legalDeadlines: { id: string  :11-11
  management: { bottlenecks: { role: string  :13-14
  tenderPipeline: { active: number  :15-15
  bomHandoffs: { count: number  :16-16
  financing: { receivableByCurrency: Record<stri  :17-17
  purchaseRequests: Record<string, number>  :18-18
  projects: { active: number  :19-19
  topRisks: { id: string  :20-20
  agentActivityToday: { pendingRatification: number  :21-21
  visitPerformance: { period: { start: string  :22-23
  planned: number  :24-24
  completed: number  :25-25
  cancelled: number  :26-26
  coveragePct: number  :27-27
  targetRate: number  :28-28
  conversion: { windowDays: number  :29-29
```

### src/types/presales.ts
```
export interface CostRequirement  :1-10
  id: string  :2-2
  projectId: string  :3-3
  description: string  :4-4
  category: 'LABOR' | 'LOGISTICS' | 'TRAVEL' |   :5-5
  identifiedBy: string  :6-6
  costedBy?: string  :7-7
  estimatedCost?: number  :8-8
  status: 'IDENTIFIED' | 'COSTED' | 'APPROVED  :9-9
export interface BoMItem  :11-32
  id: string  :12-12
  lineKey?: string  :13-13
  opportunityId?: string  :14-14
  projectId?: string  :15-15
  partNumber: string  :16-16
  description: string  :17-17
  quantity: number  :18-18
  purchaseCost: number  :19-19
  marginPercentage: number  :20-20
  unitSalePrice?: number  :21-21
  totalSalePrice?: number  :22-22
  vendor?: string  :23-23
  currency?: string  :24-24
  vatRate?: number  :25-25
  source?: string  :26-26
```

### src/types/profitability.ts
```
export interface ProfitEvent  :6-19
  date: string  :7-7
  amount: number  :8-8
  currency: string  :9-9
  direction: 'IN' | 'OUT'  :10-10
  basis: 'ACCRUAL' | 'CASH'  :11-11
  source: 'PLAN' | 'ACTUAL'  :12-12
  category: string  :13-13
  projectId: string | null  :14-14
  opportunityId: string | null  :15-15
  ref: string  :16-16
  confidence: 'FIRM' | 'ESTIMATED'  :17-17
  label: string  :18-18
export interface ProfitCurrencyBreak  :21-24
  plannedRevenue: number  :22-22
  actualRevenue: number  :23-23
export interface ProfitPeriodRow  :26-40
  periodKey: string  :27-27
  label: string  :28-28
  currency: string  :29-29
  plannedRevenue: number  :30-30
  actualRevenue: number  :31-31
  plannedCashIn: number  :32-32
  actualCashIn: number  :33-33
  eacCost: number  :34-34
```

### src/types/reports.ts
```
export interface ReportMetric  :2-8
  label: string  :3-3
  value: number | string  :4-4
  unit?: string  :5-5
  hint?: string  :6-6
  tone?: 'default' | 'positive' | 'warning'   :7-7
export interface ReportChartSeries  :9-13
  title: string  :10-10
  type: 'bar' | 'pie' | 'line'  :11-11
  data: { name: string  :12-12
export interface UnitMetrics  :14-21
  unitKey: string  :15-15
  label: string  :16-16
  role: string  :17-17
  period: { start: string  :18-18
  metrics: ReportMetric[]  :19-19
  charts: ReportChartSeries[]  :20-20
export interface WorkflowBottleneck  :22-26
  role: string  :23-23
  pendingCount: number  :24-24
  oldestWaitingDays: number  :25-25
export interface OverviewUnit  :27-33
  unitKey: string  :28-28
  label: string  :29-29
  role: string  :30-30
```

### src/types/workflow.ts
```
export interface EntityFieldSpec  :88-88
  key: string  :88-88
export interface WorkflowStep  :138-159
  id: string  :139-139
  workflowId?: string  :140-140
  unitId: string  :141-141
  role?: string | null  :142-142
  delegateUserId?: string | null  :144-144
  recipientField?: string | null  :147-147
  approvalMode?: ApprovalMode  :148-148
  actionKey?: string | null  :149-149
  actionConfig?: string | null  :151-151
  type: 'AUTO' | 'MANUAL'  :152-152
  description: string  :153-153
  order: number  :154-154
  nextStepId: string | null  :155-155
  enabled?: boolean  :156-156
  requiresCompletion?: boolean  :157-157
  completionNote?: string | null  :158-158
export interface ApprovalStage  :160-174
  id: string  :161-161
  role: string | null  :162-162
  unitId?: string | null  :163-163
  delegateUserId?: string | null  :164-164
  mode?: ApprovalMode  :165-165
```

### src/utils/textSimilarity.ts
```
export function normalizeCompanyName(name) → string  :10-17  # Karşılaştırma için şirket adını sadeleştirir: küçük harf, no
export function levenshteinDistance(a, b) → number  :20-39  # Standart düzenleme mesafesi (dinamik programlama)
export function similarityRatio(a, b) → number  :42-46  # 0 (tamamen farklı) — 1 (aynı) arası benzerlik oranı
```

## upgrade-tool

### upgrade-tool/core.mjs
```
export function resolveHome  :22-27
export function currentVersion  :40-47
export async function latestVersion  :68-94
export function compare  :97-111
export function statusPath  :114-114
export function writeStatus  :116-122
export function readStatus  :123-125
export async function checkAndWrite  :128-146
export async function runUpgrade  :198-259
function git  :14-16
function gitSafe  :17-19
function parseSemver  :30-33
function cmpSemver  :34-37
function githubJson  :50-62
function dbProvider  :149-159
function backupDb  :161-175
function restoreDb  :176-181
function run  :183-192
```

### upgrade-tool/README.md
```
h1 Enflow Upgrade Tool
h2 İlke
h2 Sürüm kaynağı (kanal)
h2 Çalıştırma
h3 CLI (cron / otomasyon)
h3 Web GUI (operatör)
h2 Güvenlik
h2 Üretilen dosyalar (commit edilmez)
code-fence bash
code-fence plain
code-fence cron
code-fence powershell
```


> **Not everything is here.** 194 file(s) omitted, 1 collapsed to anchors to stay under the 19004-token budget (tests and configs go first). The retrieval index still has them all — run `sigmap ask "<question>"` to pull in anything missing.