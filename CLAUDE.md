# Enflow — Proje Bağlamı

## Proje Nedir

Enflow, B2B satış ve iş süreçlerini yöneten çok kiracılı (multi-tenant) bir SaaS platformudur. Satış fırsatlarının CRM'den başlayıp sözleşme imzalanmasına ve proje yönetimine aktarılmasına kadar tüm yaşam döngüsünü kapsar.

**Hedef kullanıcı rolleri:** GENERAL_MANAGER, SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL, PROJECT_MANAGER, ADMIN

**Kurumsal onay swimlane rolleri (2026-06-16 eklendi):** FINANCE_MGR, IGPD_MGR (İş Geliştirme), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Birimi), LEGAL_MGR (Hukuk) — `src/constants.ts` ROLE_LABELS'ta tanımlı; karşılık gelen `Unit` kayıtları tenant-1'e eklendi.

## Versiyonlama Kuralı

**Güncel sürüm: Enflow v2.2.0** — tek kaynak `src/constants.ts` `APP_VERSION`; kök `package.json` ve `backend/package.json` `version` alanları bununla senkron tutulur (üçü aynı anda güncellenir).

Format `vMAJOR.MINOR.PATCH`:
- **Feature eklemesi** → PATCH artar (`v2.1.0` → `v2.1.1` → `v2.1.2` → ...). Bir değişikliği PATCH'e yansıtmadan **önce**, eklenenin gerçekten bir feature olduğu (bugfix/refactor/dokümantasyon/chore/bakım değil) kullanıcıya sorularak doğrulanır — onay verilmeden versiyon numarası **değiştirilmez**.
- **Mimari değişiklik** (yeni katman, veri modeli/şema genişlemesi, alt-sistem yeniden yapılandırması, kritik bağımlılık/altyapı göçü) → MINOR bir üst basamağa taşınır, PATCH sıfırlanır (`v2.1.x` → `v2.2.0`).
- Versiyon artırımı otomatik/varsayılan davranış değildir; her seferinde kullanıcıdan açık onay alınır.

## Sistem Durumu & Uçtan Uca Akış (Güncel — 2026-06-20)

**Ölçek:** 51 Prisma modeli · 29 API alanı (`/api/*`) · 29 ekran modülü · 11 servis · 8 sanal agent · 7 katman.
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

## Veritabanı Modelleri (Prisma) — 51 model, katmanlı

Tüm modeller `tenantId` ile izole. (Tam sayım: `grep -c '^model' backend/prisma/schema.prisma`.)

**Platform/SaaS:** `Tenant` · `Subscription` · `UsageMetric`
**Kimlik/RBAC:** `User` (rol + izin JSON) · `Unit`
**Akış motoru:** `Workflow` / `WorkflowStep` (default şablon + skip-logic) · `WorkflowLog` · `TodoTask` (birim görevi, relatedModule + relatedItemId, SLA) · `ApprovalChain` / `ApprovalStage` (Finans→İGPD→GM→KSU) · `Notification` · `ActivityLog` (provenance: actorType, agentRunId)
**Domain — CRM/Satış:** `Customer` · `Opportunity` (costConfig, lostReason, updatedBy) · `Proposal` (versiyonlu)
**Domain — Presales:** `BoMItem` · `CostItem`
**Domain — Sözleşme:** `Contract` (eski) · `ContractWorkflow` (projectId — Faz 9 T4) · `ContractWorkflowDoc`
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
| `presales` | `PresalesModule` | BoM (malzeme listesi) + maliyet analizi |
| `negotiation` | `NegotiationModule` | Müzakere + anlaşma |
| `contract` | `ContractModule` | Eski sözleşme modülü |
| `project-mgmt` | `ProjectManagementModule` | Tam proje yaşam döngüsü — milestone, maliyet, karlılık, devir paketi |
| `procurement` | `ProcurementModule` | Satınalma talebi → tedarikçi → PO → teslimat → fatura (9 statü) |
| `sales-support` | `SalesSupport` | **İhale/İSAB** — Tender CRUD + uygunluk checklist + teminat (backend destekli) |
| `finance` | `FinanceModule` | Fatura/tahsilat/teminat/maliyet onayı/özet (FINANCE_VIEW) |
| `management-reports` | `ManagementReportingModule` | Yönetim Raporları — birim metrik + darboğaz + UnitReport + yazdırma (MANAGEMENT_REPORTS_VIEW) |
| `corporate-governance` | `CorporateGovernanceModule` | Genel Hususlar — dersler/risk/KPI/dış doküman + doküman kodlama (CORPORATE_GOV_VIEW) |
| `todo` | `TodoModule` | Görev yönetimi + "Bekleyen Onaylarım" onay swimlane |
| `documents` | `DocumentsModule` | Kurumsal dokümanlar |
| `archive` | `ArchiveModule` | Fiziksel arşiv |
| `settings` | `SettingsModule` | Ayarlar (kullanıcı, birim, yetki, abonelik, doküman kodlama, entegrasyon) |
| `contract-workflow` | `ContractWorkflowModule` | **Sözleşme Yönetimi** (tam modül) — evrak/imza/AI analiz/transfer→Proje + Hukuk görünümü (mode: contracts\|legal). Backend rol kapısı: GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL+FINANCE+İGPD |
| `contract-workflow-test` | (legacy alias → `ContractWorkflowModule`) | Geriye dönük uyumluluk; ayrı UI yok |
| `security-test` | `SecurityTestModule` | **TEST/GM** — OWASP/güvenlik testi |
| `virtual-agents-test` | `VirtualAgentsTestModule` | **TEST/GM** — Sanal agent kataloğu + lisans + çalıştırma (8 agent) |
| `activity-log` | `ActivityLogModule` | **TEST/GM** — Denetim İzi (ActivityLog) filtreli görüntüleyici |

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
- **YZ entegrasyonu — sağlayıcıdan bağımsız** — Tüm YZ çağrıları `backend/src/services/aiClient.ts` (`chatJSON`, **OpenAI-uyumlu `/chat/completions`** `fetch`) üzerinden. Sağlayıcı **hard-code edilmez** ("istenilen YZ"): tenant kendi `{ baseUrl, apiKey, model }` değerini **Ayarlar→Entegrasyonlar**'dan girer → `Tenant.moduleSettings.ai`. Route: `GET/PUT /api/tenants/ai-settings` (GM-only; key **maskeli**, GET'te yalnız `hasKey`, **asla loglanmaz/echo edilmez**). Kullanan: `specAnalysis.analyzeSpec` (sözleşme/ihale) + `POST /api/presales/spec-extract` (şartname→ürün). Config yoksa/hata → deterministik **mock fallback**. **Client-side YZ çağrısı yasak** (eski Gemini/`@google/genai` kaldırıldı; `@anthropic-ai/sdk` de kaldırıldı).

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
- **/purchase-requests**, **/vendors** — 9 statü (DRAFT→PENDING_UNIT→PENDING_PROCUREMENT→PENDING_GM→PO_ISSUED→IN_DELIVERY→INVOICED→CLOSED / REJECTED). `/approve` `/reject` `/quotes[/:qid/select]` `/delivery` `/invoice` `/close`. PO_ISSUED→ProjectCostItem (T5); invoice→Finans Invoice (T6).
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
| 4 | EKAP iskeleti (manuel İKN) + Hukuk talebi (TodoTask `relatedModule=LEGAL`) | — |
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

Her faz sonunda RBAC süiti **69/69** geçti. Detaylı tarihçe: `walkthrough.md` (§1–§27) + `memory/project_status.md`.
## Sonraki Adımlar (Planlanan)

> Tamamlanan tüm işler için bkz. yukarıdaki **Faz Geçmişi (özet)** tablosu (Faz 0–9 + bakım). Birimler-arası geçiş zinciri (T1, T3–T6) ve 8 birim agent'ı tamamlandı.

**Kalan / gelecek iyileştirmeler (zemin):**

- [x] **Enflow-Wiki — CANLI** — yazılımı hiç bilmeyene anlatan **statik how-to/referans** sayfası. `wiki/build.mjs` (bağımlılıksız üretici) `walkthrough.md §27`'den `wiki/index.html` üretir; GitHub Pages'e otomatik deploy edilir (`.github/workflows/wiki-pages.yml`) ve backend `GET /wiki` ile de sunulur (açılışta best-effort yeniden üretim). Akış değişince önce §27 güncellenir, sonra `node wiki/build.mjs` çalıştırılır.
- [x] **Uygulama-içi Yardım modülü** (2026-08-03) — `HelpModule.tsx`, `Header`'daki (önceden ölü) Yardım ikonuyla açılır; içerik `src/content/helpArticles.ts`'te NAV_ITEMS'teki her modül için son-kullanıcı diliyle yazılmış "ne işe yarar / nasıl kullanılır" makaleleri. Rol-duyarlı (kullanıcı yalnız kendi sidebar'ında gördüğü modüllerin makalelerini görür), bağlamsal açılır (o an bulunulan sekmenin makalesiyle açılır). Backend değişikliği yok. Wiki'ye link verir — iki katman birbirini tekrar etmez: Wiki = "Enflow nedir / uçtan uca akış" (dışa dönük genel tanıtım), Yardım = "bu ekranı nasıl kullanırım" (içe dönük, oturum-içi).
- [x] **ActivityLog kapsamı — TAM** (2026-06-20) — merkezi `logActivity` helper (`backend/src/services/activityLog.ts`, non-throwing, actorType HUMAN|AGENT) + `GET /api/activity-logs?entityType=&entityId=&action=&limit=` (`activityLogs.ts`); **19 router**a denetim-izi (CREATE/UPDATE/DELETE + statü geçişleri): tüm süreç zinciri + admin (users/units) + approvalChains + corporateGovernance/visits/workflows. **Denetim İzi UI** (`ActivityLogModule.tsx`, GM-only Test Ortamı, `activity-log` sekmesi) — filtreli liste, agent köken etiketi (`agentProvenance`).
- [x] **ContractWorkflow tam modüle terfi** (2026-06-20) — `ContractWorkflowTest`→`ContractWorkflowModule` rename; backend rol kapısı GM-only'den 7 yönetici role genişledi (GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL+FINANCE+İGPD; PRESALES/SALES_REP RBAC gereği deny); latent bug fix (gerçek `contract-workflow` sekmesinde opportunities/proposals yüklenmiyordu).
- [x] **Agent otonomi genişlemesi — Faz 9 (recommend→act)** (2026-06-20) — Bugüne dek AUTONOMOUS mod yalnız auto-ratify ediyordu (etki-alanı mutasyonu yapmıyordu); artık döngü kapalı. Generic `autonomousAction` altyapısı: `AgentOutput` opsiyonel `{ kind, summary, reversible, execute }` döner; `runAgent` (`backend/src/services/virtualAgentService.ts`) bunu **yalnız** mod AUTONOMOUS + eklenti AUTONOMOUS'a izinli (`plugin.allowedModes`) + eylem `reversible` ise çalıştırır. İlk somut eylem **Procurement → en ucuz teklifi otomatik seç** (`SELECT_CHEAPEST_QUOTE`; deselect-all→select, idempotent/geri-alınabilir; sadece valid+öneri-var+seçilmemişse). Eylem `AgentRun.actionTaken`'a (migration `faz9_autonomous_action`) + ayrı `AGENT_ACTION` ActivityLog'a (actorType=AGENT, agentRunId) yazılır; handoff görevi "✅ … yapıldı, incele" olur. **Güvenlik:** ADVISORY modda eylem ASLA çalışmaz; `AGENT_FINANCE`/`AGENT_LEGAL` `allowedModes:['ADVISORY']` → AUTONOMOUS'a hiç geçemez (ikinci kemer `allowedAuto` guard). Frontend: `AgentRun.actionTaken` tipi + RunCard emerald rozeti + AgentTag drill-down satırı. Diğer handler'lar (tender/project/presales/igpd/crm) `autonomousAction` tanımlamaz → davranışları değişmez. `autoSkipOrphanStages` orphan-stage otonom dalı ayrı path, dokunulmadı.
  - **Doğrulama:** curl — ADVISORY→actionTaken null/seçim yok; AUTONOMOUS→Beta seçildi+RATIFIED+AGENT_ACTION log; rerun(alreadySelected)→eylem yok; AGENT_FINANCE→AUTONOMOUS=400; yanlış tenant=404. Playwright (GM) RunCard "Otonom eylem" rozeti, 0 page-error. RBAC 69/69, tsc 0. Test verisi temizlendi.
- [x] **Agent otonomi 2 — CRM + İGPD deterministik triyaj** (2026-06-21, migration `faz9_agent_triage`) — İlke: yalnız **insan eli değmeden deterministik üretilebilen** çıktı otonom olur. CRM (kural-bazlı `recommendation` + issues) ve İGPD (`expectedValue = round(probability/100 × value)` + `valueTier` + `recommendation`) otonom modda triyajlarını yeni nullable `Opportunity.agentTriage` JSON alanına **annotation** olarak yazar — `value/probability/status/lostReason` gibi kritik alanlara **asla dokunmaz**, geri-alınabilir + idempotent (`mergeTriage` her agentın kendi bölümünü günceller, diğerini korur). `runAgent` **değişmedi** (Faz 9.1 altyapısı kullanıldı); `actionTaken` + `AGENT_ACTION` log + handoff görevi. Frontend: `Opportunity.agentTriage` tipi + CRM fırsat kartında 🤖 triyaj rozeti; `opportunities` GET parse. **Tender/Project/Presales tasarım gereği danışman** — deterministik-güvenli mutasyonları yok (checklist/devir evrakı kanıt ister; BoM/milestone insan kararı). Para/Hukuk `allowedModes:['ADVISORY']` kapsam dışı.
  - **Doğrulama:** curl — ADVISORY→agentTriage null; AUTONOMOUS İGPD→`igpd.expectedValue=360000` (0.6×600k), value/prob/status değişmedi; CRM→`crm` yazıldı + `igpd` korundu (merge); rerun idempotent; WON fırsatta NO_ACTION→eylem yok; yanlış tenant=404. AGENT_ACTION logları actorType=AGENT. Playwright (GM) CRM kartında 🤖 BD/CRM rozeti, 0 page-error. RBAC 69/69, tsc 0. Test verisi temizlendi.
- [ ] **Gerçek EKAP entegrasyonu** (şu an manuel İKN iskeleti).
- [ ] **Entegrasyon katmanı doğrulaması** — Nextcloud DMS / Exchange e-posta / WhatsApp (denetimlerde kapsanmadı).

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
src/components/settings/PersonnelTransferModal.tsx ← ../services/apiService, ../types, ../constants
src/components/settings/UserManagement.tsx ← ../types, ../constants, ../services/apiService, PersonnelTransferModal
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext, services/apiService
src/modules/ActivityLogModule.tsx ← services/apiService, lib/agentProvenance, types
src/modules/contract-workflow/DetailHeader.tsx ← types, constants, helpers
src/modules/contract-workflow/helpers.ts ← ../services/apiClient, ../types, constants, types
src/modules/contract-workflow/LegalCaseForm.tsx ← ../services/apiService, constants, types
src/modules/contract-workflow/LegalView.tsx ← ../services/apiService, ../types, constants, helpers, types
src/modules/contract-workflow/WorkflowListPanel.tsx ← ../types, types, constants, helpers
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService, contexts/AuthContext, lib/procurementCosts
src/modules/crm/NewOpportunityModal.tsx ← ../types, ../lib/procurementCosts
src/modules/crm/OpportunitiesView.tsx ← ../lib/utils, ../types, ../components/SaveButton, ../components/PermissionGate, constants
src/modules/CRMModule.tsx ← types, ProposalEditor, NegotiationModule, components/HandOffModal, services/workflowService
src/modules/ProposalEditor.tsx ← lib/utils, types, lib/procurementCosts
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, serviceTicketService
backend/src/services/activityLog.ts ← prismaClient, activityLogSummary, dashboardStream
backend/src/services/activityLogArchiveScheduler.ts ← prismaClient, activityLogArchiveService
backend/src/services/activityLogArchiveService.ts ← prismaClient, backupTargets, backupService, activityLog
backend/src/services/activityLogSummary.ts ← prismaClient, agentProvenance
backend/src/services/backupService.ts ← prismaClient, backupTargets
backend/src/services/personnelTransferService.ts ← prismaClient
backend/src/services/salesCosting.ts ← prismaClient
src/App.tsx ← utils/logger, types, layout/Sidebar, layout/Header, modules/Dashboard
src/components/HealthCards.tsx ← types, lib/format, InfoTooltip
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, types, services/apiService
src/modules/contract-workflow/AnalysisTab.tsx ← types
src/modules/contract-workflow/ContextTab.tsx ← ../types, types
src/modules/contract-workflow/DocumentsTab.tsx ← types, constants
src/modules/contract-workflow/SigningTab.tsx ← types
src/modules/contract-workflow/TransferTab.tsx ← types
src/modules/contract-workflow/types.ts ← ../types
src/modules/ContractWorkflowModule.tsx ← services/apiService, contexts/AIGateContext, contexts/AuthContext, contract-workflow/types, contract-workflow/constants
src/modules/CorporateGovernanceModule.tsx ← services/apiService, contexts/AuthContext
src/modules/crm/constants.ts ← ../types
src/modules/crm/ContactsModal.tsx ← ../types
src/modules/crm/CustomerReportModal.tsx ← ../lib/utils, ../types, helpers, constants
src/modules/crm/CustomersView.tsx ← ../lib/utils, ../types, ../components/HealthCards, ../components/PermissionGate, helpers
src/modules/crm/DashboardView.tsx ← ../types, constants, ../components/InfoTooltip
src/modules/crm/helpers.ts ← ../types
src/modules/crm/LostReasonModal.tsx ← ../lib/utils, ../types, constants
src/modules/crm/NewCustomerModal.tsx ← ../types
src/modules/crm/ProposalsView.tsx ← ../lib/utils, ../types, helpers
src/modules/dashboard/criticalAlerts.ts ← ../types, helpers
src/modules/dashboard/CriticalAlertsStrip.tsx ← ../types, criticalAlerts
src/modules/dashboard/helpers.ts ← ../lib/format
src/modules/dashboard/KpiDetailDrawer.tsx ← ../lib/format, DrawerShell
src/modules/dashboard/LayoutEditor.tsx ← widgetCatalog
src/modules/dashboard/WidgetDetailDrawer.tsx ← ../types, ../lib/format, widgetCatalog, helpers, DrawerShell
src/modules/Dashboard.tsx ← types, constants, lib/utils, lib/format, contexts/AuthContext
src/modules/ManagementReportingModule.tsx ← services/apiService, contexts/AuthContext, types, reporting/helpers, reporting/AnalyticsTab
src/modules/negotiation/AuctionBoard.tsx ← ../lib/utils, types
src/modules/negotiation/AuctionSidePanel.tsx ← ../lib/utils
src/modules/negotiation/ChatInfoPanel.tsx ← ../lib/utils, ../types
src/modules/negotiation/ChatWindow.tsx ← ../lib/utils, types
src/modules/negotiation/ModeTabBar.tsx ← ../lib/utils
src/modules/negotiation/ProposalSelectorHeader.tsx ← ../types
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, negotiation/types, negotiation/AccessDeniedPanel
src/modules/procurement/constants.tsx ← ../types
src/modules/procurement/PRDetailDrawer.tsx ← ../services/apiService, ../lib/format, ../types, constants, StatusBadge
src/modules/procurement/PRForm.tsx ← ../types, constants
src/modules/procurement/RequestsTab.tsx ← ../types, ../lib/format, constants, StatusBadge
src/modules/procurement/StatusBadge.tsx ← ../types, constants
src/modules/procurement/SummaryTab.tsx ← ../types, constants
src/modules/procurement/VendorForm.tsx ← ../types
src/modules/procurement/VendorsTab.tsx ← ../types
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, lib/format, types, procurement/constants
src/modules/project-mgmt/constants.tsx ← ../types
src/modules/project-mgmt/CostForm.tsx ← ../types, constants
src/modules/project-mgmt/helpers.ts ← ../lib/format, ../types, constants
src/modules/project-mgmt/KanbanView.tsx ← ../types, constants, helpers, MarginBadge
src/modules/project-mgmt/OpportunityPicker.tsx ← ../types, ../lib/format
src/modules/project-mgmt/OverheadPanel.tsx ← ../services/apiService, ../lib/format, ../types
src/modules/project-mgmt/ProjectDetail.tsx ← ../services/apiService, ../lib/format, ../types, constants, helpers
src/modules/project-mgmt/ProjectForm.tsx ← ../types, constants
src/modules/project-mgmt/ProjectListView.tsx ← ../types, ../lib/format, constants, helpers, StatusBadge
src/modules/project-mgmt/RiskPanel.tsx ← ../types, helpers
src/modules/project-mgmt/StatusBadge.tsx ← ../types, constants
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, components/HealthCards, lib/format, types
src/modules/reporting/AnalyticsTab.tsx ← ../services/apiService, ../components/HealthCards, ../types, BusinessHealthCard, DmoAnalyticsCard
src/modules/reporting/ArchiveCard.tsx ← ../types, ../components/InfoTooltip
src/modules/reporting/BidScorecardCard.tsx ← ../types, helpers, ../components/InfoTooltip
src/modules/reporting/BomVarianceCard.tsx ← ../types, helpers, ../lib/format, ../components/InfoTooltip
src/modules/reporting/BottleneckPanel.tsx ← ../types, ../constants, ../components/InfoTooltip
src/modules/reporting/BusinessHealthCard.tsx ← ../types, ../components/HealthCards, ../components/InfoTooltip
src/modules/reporting/ChartBlock.tsx ← ../types, helpers, ../components/InfoTooltip
src/modules/reporting/ConcentrationCard.tsx ← ../types, helpers, ../components/InfoTooltip
src/modules/reporting/ConsolidationView.tsx ← helpers
src/modules/reporting/DmoAnalyticsCard.tsx ← ../types, helpers, ../lib/format, ../components/InfoTooltip
src/modules/reporting/DocPortfolioCard.tsx ← ../types, ../components/InfoTooltip
src/modules/reporting/ForecastCard.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ../lib/format
src/modules/reporting/FunnelCard.tsx ← ../types, helpers, ../components/InfoTooltip
src/modules/reporting/helpers.ts ← ../constants, ../types
src/modules/reporting/IncomingReportCard.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ConsolidationView
src/modules/reporting/IncomingReportsTab.tsx ← ../types, IncomingReportCard
src/modules/reporting/MetricCard.tsx ← ../types, helpers
src/modules/reporting/MyReportsTab.tsx ← ../types, helpers
src/modules/reporting/OverviewTab.tsx ← ../types, ../constants, helpers, BottleneckPanel, MetricCard
src/modules/reporting/ReportForm.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ConsolidationView
src/modules/reporting/TenderCard.tsx ← ../types, helpers, ../lib/format, ../components/InfoTooltip
src/modules/reporting/UnitAbsorptionCard.tsx ← ../types, helpers, ../lib/format, ../components/InfoTooltip
src/modules/reporting/UnitDetailTab.tsx ← ../types, helpers, MetricCard, ChartBlock
src/modules/SalesSupport.tsx ← services/apiService, contexts/AuthContext, contexts/AIGateContext, lib/format, types
src/modules/todo/helpers.ts ← ../types
src/modules/todo/NewTaskModal.tsx ← ../types, helpers
src/modules/todo/PendingChainApprovals.tsx ← ../types, ../components/AgentTag, ../lib/agentProvenance, helpers
src/modules/todo/PendingDeliveryNotifications.tsx ← ../types
src/modules/todo/PendingProposalApprovals.tsx ← ../types, helpers
src/modules/todo/ProposalPreviewModal.tsx ← ../types, helpers
src/modules/todo/ResolvedApprovals.tsx ← ../types, helpers
src/modules/todo/TaskList.tsx ← ../types, helpers, icons, ../components/AgentTag, ../lib/agentProvenance
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, todo/helpers, todo/PendingChainApprovals
backend/src/services/agingReport.ts ← prismaClient
backend/src/services/analyticsService.ts ← prismaClient
backend/src/services/approvalChainService.ts ← prismaClient, pluginCatalog, agentProvenance, governance
backend/src/services/bootstrapTenant.ts ← prismaClient, licenseVerify, auth
backend/src/services/dashboardService.ts ← prismaClient, unitReportingService
backend/src/services/financeSummary.ts ← prismaClient
backend/src/services/guaranteeReminders.ts ← prismaClient, dashboardStream
backend/src/services/invoiceEngine.ts ← prismaClient
backend/src/services/tenderReminders.ts ← prismaClient, dashboardStream
backend/src/services/unitReportingService.ts ← prismaClient
backend/src/services/virtualAgentService.ts ← prismaClient, entitlementService, pluginCatalog, agentProvenance
backend/src/services/workflowTemplateService.ts ← prismaClient
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

## changes (last 10 commits — 2 days ago)
```
src/components/settings/PersonnelTransferModal.tsx +kullan  +Kullan
src/modules/ActivityLogModule.tsx             +fallbackSummary  +ArchivesTab  ~actionTone  ~ActivityLogModule
src/modules/contract-workflow/DetailHeader.tsx ~DetailHeader
src/modules/contract-workflow/helpers.ts      +computeDeadlineAlarm  ~bestProposalPrice
src/modules/contract-workflow/LegalCaseForm.tsx +LegalCaseForm  ~LegalCaseForm
src/modules/contract-workflow/LegalView.tsx   ~LegalView
src/modules/contract-workflow/WorkflowListPanel.tsx +WorkflowCard
src/modules/crm/OpportunitiesView.tsx         ~OpportunitiesView
src/services/apiService.ts                    ~ApiService
backend/src/services/activityLog.ts           ~logActivity
backend/src/services/activityLogArchiveScheduler.ts +tick  +startActivityLogArchiveScheduler
backend/src/services/activityLogArchiveService.ts +getArchiveSettings  +runArchive
backend/src/services/activityLogSummary.ts    +resolveActorName  +resolveEntityLabel  +humanizeEntityType  +resolveVerb
backend/src/services/backupService.ts         ~getBackupSettings
backend/src/services/personnelTransferService.ts +getOwnedItems  +transferOwnershipTx  +transferOwnership  +kullan
```

## backend

### backend/prisma/migrations/20260804195427_activity_log_summary_and_archive/migration.sql
```
TABLE ActivityLogArchive
INDEX ActivityLogArchive_tenantId_status_idx ON ActivityLogArchive
INDEX ActivityLogArchive_tenantId_startedAt_idx ON ActivityLogArchive
INDEX ActivityLog_tenantId_timestamp_idx ON ActivityLog
```

### backend/prisma/migrations/20260806110030_add_bom_item_vat_rate/migration.sql
```
TABLE new_BoMItem
```

### backend/src/services/activityLog.ts
```
export interface LogActivityParams  :13-22
  tenantId: string  :14-14
  userId?: string  :15-15
  action: string  :16-16
  entityType: string  :17-17
  entityId: string  :18-18
  details?: Record<string, unknown> | null  :19-19
  actorType?: 'HUMAN' | 'AGENT'  :20-20
  agentRunId?: string | null  :21-21
export async function logActivity(p) → Promise<void>  :24-52
```

### backend/src/services/activityLogArchiveScheduler.ts
```
export function startActivityLogArchiveScheduler() → void  :40-45
```

### backend/src/services/activityLogArchiveService.ts
```
export interface ArchiveModuleSettings  :19-27
  enabled?: boolean  :20-20
  intervalDays?: number  :21-21
  retentionDays?: number  :22-22
  targetType?: TargetType  :23-23
  location?: string  :24-24
  nextcloud?: { url?: string  :25-25
  s3?: { endpoint?: string  :26-26
export interface RunArchiveOpts  :46-53
  tenantId: string  :47-47
  trigger?: 'MANUAL' | 'SCHEDULED'  :48-48
  retentionDays?: number  :49-49
  targetType?: TargetType  :50-50
  location?: string | null  :51-51
  settings?: ArchiveModuleSettings | null  :52-52
export async function getArchiveSettings(tenantId) → Promise<ArchiveModuleSettings>  :38-44  # moduleSettings
export async function runArchive(opts) → Promise<  :56-56  # Bir arşivleme işini baştan sona çalıştırır; ActivityLogArchi
```

### backend/src/services/activityLogSummary.ts
```
export interface SummaryInput  :157-162
  actorName: string  :158-158
  action: string  :159-159
  entityType: string  :160-160
  entityLabel: string | null  :161-161
export async function resolveActorName(userId, actorType?) → Promise<string>  :13-24
export async function resolveEntityLabel(tenantId, entityType, entityId) → Promise<string | null>  :72-80
export function buildSummary({ actorName, action, entityType, entityLabel }) → string  :165-170  # Tek satırlık Türkçe denetim-izi özeti: "Ad: Varlık eylem (\"
```

### backend/src/services/backupService.ts
```
export interface ModelMeta  :27-31
  name: string  :28-28
  delegateKey: string  :29-29
  hasTenantId: boolean  :30-30
export interface BackupModuleSettings  :98-107
  enabled?: boolean  :99-99
  intervalHours?: number  :100-100
  scope?: BackupScope  :101-101
  kind?: BackupKind  :102-102
  targetType?: TargetType  :103-103
  location?: string  :104-104
  nextcloud?: { url?: string  :105-105
  s3?: { endpoint?: string  :106-106
export interface RunBackupOpts  :109-119
  tenantId: string  :110-110
  scope: BackupScope  :111-111
  kind: BackupKind  :112-112
  targetType: TargetType  :113-113
  location?: string | null  :114-114
  trigger?: 'MANUAL' | 'SCHEDULED'  :115-115
  startedById?: string  :116-116
  startedByName?: string  :117-117
  … +1 more members  :109-109
export type BackupScope  :17-17
export type BackupKind  :18-18
```

### backend/src/services/personnelTransferService.ts
```
export interface OwnedCategory  :23-28
  key: string  :24-24
  label: string  :25-25
  count: number  :26-26
  sample: { id: string  :27-27
export interface OwnedItemsResult  :30-40
  userId: string  :31-31
  userName: string  :32-32
  role: string  :33-33
  status: string  :34-34
  categories: OwnedCategory[]  :35-35
  totalActive: number  :36-36
  inboundDelegationCount: number  :37-37
  createdOpportunityCount: number  :38-38
  … +1 more members  :30-30
export interface TransferResult  :42-45
  transferred: Record<string, number>  :43-43
  clearedInboundDelegations: number  :44-44
export async function getOwnedItems(tenantId, userId) → Promise<OwnedItemsResult>  :153-172
export async function transferOwnership(params) → Promise<TransferResult>  :192-201
export async function deactivateUser(tenantId, userId) → Promise<void>  :203-212
export async function hardDeleteUser(tenantId, userId) → Promise<  :214-214
```

### backend/src/services/salesCosting.ts
```
export interface SalesMethodCostLine  :10-15
  label: string  :11-11
  kind: 'PERCENT' | 'FIXED'  :12-12
  value: number  :13-13
  category: string  :14-14
export interface SalesCostConfig  :17-26
  baseCurrency: string  :18-18
  spotRates?: Record<string, number>  :19-19
  forwardOverrides?: Record<string, number>  :20-20
  annualDepreciation?: number  :21-21
  collectionDate?: string  :22-22
  targetMargin?: number  :23-23
  procurementMethod?: string  :24-24
  methodCostLines?: SalesMethodCostLine[]  :25-25
export interface SalesBoMItemInput  :28-38
  partNumber?: string  :29-29
  description?: string  :30-30
  quantity: number  :31-31
  purchaseCost: number  :32-32
  currency?: string  :33-33
  vatRate?: number  :34-34
  vendor?: string  :35-35
  source?: string  :36-36
  … +1 more members  :28-28
export interface SalesManualCostItemInput  :40-45
```

### backend/prisma/migrations/migration_lock.toml
```
key provider
```

### backend/src/services/agingReport.ts
```
export interface AgingBuckets  :3-3
  notDue: number  :3-3
export interface AgingReportResult  :4-9
  buckets: AgingBuckets  :5-5
  dso: number  :6-6
  totalReceivable: number  :7-7
  byCurrency: Record<string, { totalReceivable: n  :8-8
export async function computeAgingReport(tenantId) → Promise<AgingReportResult>  :58-61
```

### backend/src/services/analyticsService.ts
```
export interface FunnelResult  :18-22
  stages: { name: string  :19-19
  lossByReason: { reason: string  :20-20
  entered: number  :21-21
export interface TenderGroup  :58-58
  key: string  :58-58
export interface TenderAnalytics  :59-63
  byAuthority: TenderGroup[]  :60-60
  byMethod: TenderGroup[]  :61-61
  overall: { winRate: number  :62-62
export interface BomVarianceLine  :114-114
  name: string  :114-114
export interface BomVarianceReport  :115-115
  lines: BomVarianceLine[]  :115-115
export interface ForecastReport  :194-198
  rawPipeline: number  :195-195
  target: number  :196-196
  byStage: { status: string  :197-197
export interface BidScoreLine  :230-236
  id: string  :231-231
  deadline: string | null  :232-232
  score: number  :233-233
  factors: { authorityWinRate: number  :234-234
  authorityWinPct: number | null  :235-235
export interface BidScorecard  :237-241
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain(tenantId, entityType, entityId, roles?, amount?,)  :22-51  # Mevcut PENDING bir zincir varsa onu döner; yoksa şablona gör
export async function completeApprovalChain(tenantId, entityType, entityId, approverId?, note?)  :59-81  # Mevcut tek-tıkla onay UI'ları (Opportunity GM onayı, Contrac
export async function autoSkipOrphanStages(tenantId, chainId)  :91-201  # Skip-logic: tenant'ta **hiçbir aktif kullanıcıya** karşılık 
export async function getDelegatedRoles(tenantId, userId) → Promise<string[]>  :209-221  # B-08 — vekalet (delegasyon): kullanıcı X izinliyken (delegat
export async function resolveEffectiveApprover(tenantId, role, userId) → Promise<boolean>  :224-230  # Bir kullanıcı bir role ait onayı yapabilir mi
export async function resetApprovalChain(tenantId, entityType, entityId)  :233-246  # Onay geri çekildiğinde (revert-approval) en güncel zinciri P
```

### backend/src/services/bomHandoff.ts
```
export interface BomQuoteInput  :5-16
  lineKey: string  :6-6
  componentName: string | null  :7-7
  vendorName: string  :8-8
  unitPrice: number  :9-9
  currency: string  :10-10
  technicalCompliance: string  :11-11
  specSummary: string | null  :12-12
  fileName: string | null  :13-13
  … +2 more members  :5-5
export interface BomEvaluationLine  :18-27
  lineKey: string  :19-19
  componentName: string | null  :20-20
  quoteCount: number  :21-21
  selected: { vendorName: string  :22-23
  specSummary: string | null  :24-24
  alternatives: { vendorName: string  :26-26
export interface BomEvaluationSnapshot  :29-33
  evaluatedAt: string  :30-30
  totalQuotes: number  :31-31
  lines: BomEvaluationLine[]  :32-32
export interface BomTotalItem  :62-62
  currency: string | null  :62-62
export function sumBomTotalsByCurrency(items) → Record<string, number>  :65-72  # BoM kalemlerinin para birimi bazında toplam maliyeti (purcha
```

### backend/src/services/bootstrapTenant.ts
```
export interface BootstrapInput  :36-43
  companyName: string  :37-37
  admin: { name: string  :38-38
  license?: string  :40-40
  tenantId?: string  :42-42
export interface BootstrapResult  :44-49
  tenantId: string  :45-45
  token: string  :46-46
  user: { id: string  :47-47
  subscription: { plan: string  :48-48
export async function bootstrapTenant(input) → Promise<BootstrapResult>  :51-127
```

### backend/src/services/contractWorkflowState.ts
```
export interface ContractAnalysisExtract  :61-61
  projectName: string | null  :61-61
export interface ContractWorkflowFallback  :62-62
  tenderName: string | null  :62-62
export type TransitionCheckResult  :25-25
export function checkStatusTransition(currentStatus, nextStatus, role, cancelReason?,) → TransitionCheckResult  :36-59  # Bir durum geçişinin izinli olup olmadığını kontrol eder — sı
export function buildAutoTitle(extracted, fallback) → string  :69-75  # AI analizinden çıkarılan proje adı/İKN + mevcut workflow bil
```

### backend/src/services/dashboardService.ts
```
export async function computeDashboard(tenantId, userId?)  :15-68
```

### backend/src/services/dashboardStream.ts
```
export function pingDashboard(tenantId) → void  :10-12
```

### backend/src/services/financeSummary.ts
```
export interface FinanceSummaryResult  :3-12
  totalReceivable: number  :4-4
  totalCollected: number  :5-5
  overdue: number  :6-6
  invoiceCount: number  :7-7
  salesCount: number  :8-8
  activeGuarantees: number  :9-9
  expiringGuarantees: number  :10-10
  pendingCostApprovals: number  :11-11
export function summarizeFinance(invoices, guarantees, pendingCostApprovals,) → FinanceSummaryResult  :26-54  # Saf hesap — DB'den zaten çekilmiş fatura/teminat listeleri ü
export async function computeFinanceSummary(tenantId) → Promise<FinanceSummaryResult>  :56-63
```

### backend/src/services/financingEffect.ts
```
export interface CashEvent  :7-13
  kind: 'PAYMENT' | 'COLLECTION'  :8-8
  label: string  :9-9
  date: string  :10-10
  amount: number  :11-11
  currency: string  :12-12
export interface FinancingResultLine  :15-17
  effect: number  :16-16
export interface FinancingResult  :19-24
  closingDate: string  :20-20
  byCurrency: Record<string, { cost: number  :21-21
  events: FinancingResultLine[]  :22-22
  cashFlowGap: { currency: string  :23-23
export interface FinancingBomInput  :72-72
  partNumber: string  :72-72
export interface FinancingCostInput  :73-73
  description: string  :73-73
export interface FinancingInstallmentInput  :74-74
  note: string | null  :74-74
export function computeFinancingEffect(events, interestRates, number>, referenceStart?,) → FinancingResult  :32-64
export function paymentDate(referenceStart, termDays) → string  :67-70  # referans tarihten gün vade ile ödeme tarihi (ISO)
export function buildFinancingEvents(boms, costs, installments, referenceStart?,) → CashEvent[]  :82-108  # BoM kalemleri (ödeme çıkışı) + CostItem'lar (ödeme çıkışı, F
```

### backend/src/services/guaranteeReminders.ts
```
export async function sweepGuaranteeReminders(tenantId) → Promise<void>  :20-63
```

### backend/src/services/invoiceEngine.ts
```
export function deriveInvoiceStatus(amount, paidAmount, dueDate, current) → string  :4-10  # Fatura statüsü tahsil edilen tutara + vadeye göre türetilir
export async function recalcInvoice(invoiceId) → Promise<void>  :13-22  # Fatura toplam tahsilatını ve türetilmiş statüsünü yeniden he
```

### backend/src/services/projectProgress.ts
```
export interface MilestoneForProgress  :1-1
  title: string  :1-1
export interface ProjectProgressResult  :3-8
  progress: number  :4-4
  phase: string  :5-5
  completed: boolean  :7-7
export function computeProjectProgress(milestones) → ProjectProgressResult  :20-28  # Projenin milestone'larından türetilen ilerleme/aşama
```

### backend/src/services/projectSummary.ts
```
export interface ProjectCostItemForSummary  :1-1
  plannedAmount: number  :1-1
export interface ProjectMilestoneForSummary  :2-2
  status: string  :2-2
export interface ProjectForSummary  :4-18
  id: string  :5-5
  name: string  :6-6
  type: string  :7-7
  status: string  :8-8
  phase: string  :9-9
  customerName: string | null  :10-10
  pmName: string | null  :11-11
  totalValue: number  :12-12
  … +5 more members  :4-4
export interface ProjectSummaryLine  :20-27
  id: string  :21-21
  customerName: string | null  :22-22
  totalValue: number  :23-23
  totalPlanned: number  :24-24
  progress: number  :25-25
  milestoneCount: number  :26-26
```

### backend/src/services/tenderReminders.ts
```
export async function sweepTenderReminders(tenantId) → Promise<void>  :21-63
```

### backend/src/services/unitReportingService.ts
```
export interface UnitDefinition  :6-10
  key: string  :7-7
  label: string  :8-8
  role: string  :9-9
export interface Period  :27-30
  start: Date  :28-28
  end: Date  :29-29
export interface Metric  :51-57
  label: string  :52-52
  value: number | string  :53-53
  unit?: string  :54-54
  hint?: string  :55-55
  tone?: 'default' | 'positive' | 'warning'   :56-56
export interface ChartSeries  :59-63
  title: string  :60-60
  type: 'bar' | 'pie' | 'line'  :61-61
  data: { name: string  :62-62
export interface UnitMetricsResult  :65-72
  unitKey: string  :66-66
  label: string  :67-67
  role: string  :68-68
  period: { start: string  :69-69
  metrics: Metric[]  :70-70
  charts: ChartSeries[]  :71-71
export interface WorkflowBottleneck  :432-436
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
export async function ratifyAgentRun(params) → Promise<  :626-632  # Devir alan gerçek kişi çıktıyı ratifiye eder veya reddeder
```

### backend/src/services/workflowTemplateService.ts
```
export async function ensureDefaultWorkflow(tenantId)  :123-184  # Tenant'ın aktif birimlerini kanonik sıraya göre dizip varsay
export function resolveNextStep(steps, currentStepId)  :194-198  # Skip-resolution motoru: verilen adımdan sonra görevin aktarı
```

## src

### src/components/settings/PersonnelTransferModal.tsx
```
props PersonnelTransferModalProps
hook useState
hook useEffect
export PersonnelTransferPayload
export PersonnelTransferModal
handler onClick
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

### src/layout/Sidebar.tsx
```
hook useUnsavedChanges
hook useAuth
hook useState
hook useEffect
export Sidebar
handler onClick
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

### src/modules/contract-workflow/DetailHeader.tsx
```
component DetailHeader
handler onClick
```

### src/modules/contract-workflow/helpers.ts
```
export interface DeadlineAlarm  :35-41
  level: 'none' | 'warning' | 'critical'  :36-36
  daysLeft: number | null  :37-37
  missingRequired: number  :38-38
  totalRequired: number  :39-39
  label: string  :40-40
export async function apiFetch(path, init?)  :8-10
export function bestProposalPrice(opportunityId, proposals) → number | null  :14-25
export function computeDeadlineAlarm(wf, 'status' | 'deadline' | 'documents'>) → DeadlineAlarm  :43-57
export const stepIndex = (status) =>  :27-41
export const isDocsComplete = (wf, 'documents'>) =>  :59-59
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

### src/modules/crm/NewOpportunityModal.tsx
```
component NewOpportunityModal
handler onClick
handler onSubmit
handler onChange
```

### src/modules/crm/OpportunitiesView.tsx
```
component OpportunitiesView
hook useState
hook useMemo
handler onClick
handler onChange
```

### src/modules/CRMModule.tsx
```
hook useAuth
hook useState
hook useEffect
hook useSearch
export CRMModule
handler onProposal
handler onOpportunity
handler onSave
handler onSaveAll
handler onProgressStatus
handler onMarkLost
handler onHandOff
handler onEdit
handler onOpenReport
handler onOpenContacts
handler onCreateProposal
handler onWonOpportunity
handler onLostOpportunity
handler onEditProposal
handler onSendForApproval
handler onGeneratePdf
handler onMarkDelivered
handler onWonProposal
handler onLostProposal
handler onImported
```

### src/modules/ProposalEditor.tsx
```
props ProposalEditorProps
hook useState
hook useMemo
hook useEffect
export ProposalEditor
handler onClick
handler onChange
```

### src/services/apiService.ts
```
class ApiService  :14-69
  setAuth(tenantId, token)  :15-17
  async login(email, password)  :19-21
  async forgotPassword(email)  :23-25
  async getSetupStatus() → Promise<  :28-28
  async runSetup(payload) → Promise<  :33-33
  async getCustomers()  :41-41
  async createCustomer(data)  :42-42
  async updateCustomer(id, data)  :43-43
  … +23 more methods  :14-14
```

### src/types/auth.ts
```
export interface User  :1-14
  id: string  :2-2
  name: string  :3-3
  email: string  :4-4
  phone?: string  :5-5
  role: string  :6-6
  permissions: string[]  :7-7
  unitId?: string  :8-8
  status: 'ACTIVE' | 'INACTIVE'  :9-9
  … +4 more members  :1-1
export interface Permission  :15-20
  id: string  :16-16
  name: string  :17-17
  code: string  :18-18
  description: string  :19-19
export interface Unit  :21-27
  id: string  :22-22
  name: string  :23-23
  description?: string  :24-24
  managerId?: string | null  :25-25
  parentId?: string | null  :26-26
export interface OwnedCategory  :29-34
  key: string  :30-30
  label: string  :31-31
  count: number  :32-32
```

### src/types/plugin.ts
```
export interface PluginDefinition  :2-15
  key: string  :3-3
  name: string  :4-4
  category: 'VIRTUAL_AGENT'  :5-5
  description: string  :6-6
  unitKey?: string  :7-7
  role?: string  :8-8
  defaultMode?: 'ADVISORY' | 'AUTONOMOUS'  :9-9
  allowedModes?: ('ADVISORY' | 'AUTONOMOUS')[]  :10-10
  … +4 more members  :2-2
export interface PluginEntitlement  :16-29
  id: string  :17-17
  tenantId: string  :18-18
  pluginKey: string  :19-19
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'D  :20-20
  licenseKey?: string | null  :21-21
  mode: 'ADVISORY' | 'AUTONOMOUS'  :22-22
  config?: string | null  :23-23
  activatedById?: string | null  :24-24
  … +4 more members  :16-16
export interface EntitlementWithCatalog  :30-34
  plugin: PluginDefinition  :31-31
  entitlement: PluginEntitlement | null  :32-32
  active: boolean  :33-33
export interface AgentRun  :35-54
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
export interface BoMItem  :11-28
  id: string  :12-12
  lineKey?: string  :13-13
  opportunityId?: string  :14-14
  projectId?: string  :15-15
  partNumber: string  :16-16
  description: string  :17-17
  quantity: number  :18-18
  purchaseCost: number  :19-19
  … +8 more members  :11-11
export interface BomHandoff  :31-44
  id: string  :32-32
  opportunityId: string  :33-33
  oppTitle: string  :34-34
  customerName?: string | null  :35-35
  handedOffById?: string | null  :36-36
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

### src/components/HealthCards.tsx
```
component ProjectHealthCard
component CustomerHealthCard
export ProjectHealthCard
export CustomerHealthCard
```

### src/components/InfoTooltip.tsx
```
component InfoTooltip
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
export const getHelpArticle = (moduleId) =>  :179-179
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

### src/modules/contract-workflow/AnalysisTab.tsx
```
component AnalysisTab
handler onChange
handler onClick
```

### src/modules/contract-workflow/CancelModal.tsx
```
component CancelModal
handler onClick
handler onChange
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

### src/modules/contract-workflow/DocumentsTab.tsx
```
component DocumentsTab
handler onClick
handler onChange
handler onBlur
```

### src/modules/contract-workflow/SigningTab.tsx
```
component SigningTab
handler onClick
handler onChange
```

### src/modules/contract-workflow/TransferTab.tsx
```
component TransferTab
handler onClick
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
  … +4 more members  :3-3
export interface ContractWorkflow  :18-39
  id: string  :19-19
  title: string  :20-20
  opportunityId?: string | null  :21-21
  contractValue: number  :22-22
  tenderName?: string | null  :23-23
  tenderNo?: string | null  :24-24
  projectName?: string | null  :25-25
  contractText?: string | null  :26-26
  … +12 more members  :18-18
export interface AiAnalysis  :41-46
  documents: { name: string  :42-42
  tasks: { order: number  :43-43
  key_clauses: { clause: string  :44-44
  contract_summary: { project_name?: string  :45-45
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
handler onSaveTexts
handler onAnalyse
handler onFileSelect
handler onAddDoc
handler onDeleteDoc
handler onDocStatusChange
handler onDocFieldUpdate
handler onMarkReadyToSign
handler onSendForApproval
handler onRejectSignature
handler onApproveSignature
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

### src/modules/crm/constants.ts
```
export const getStatusStyle = (status) =>  :11-22
```

### src/modules/crm/ContactsModal.tsx
```
component ContactsModal
export ContactFormState
handler onClick
handler onSubmit
handler onChange
```

### src/modules/crm/CustomerReportModal.tsx
```
component CustomerReportModal
handler onClick
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

### src/modules/crm/helpers.ts
```
export type CustomerStats  :29-29
export const getCustomerStats = (customerId, opportunities, proposals) =>  :11-27
```

### src/modules/crm/LostReasonModal.tsx
```
component LostReasonModal
handler onChange
handler onClick
```

### src/modules/crm/NewCustomerModal.tsx
```
component NewCustomerModal
handler onClick
handler onSubmit
handler onChange
```

### src/modules/crm/ProposalsView.tsx
```
component ProposalsView
```

### src/modules/dashboard/criticalAlerts.ts
```
export interface CriticalAlert  :4-10
  id: string  :5-5
  category: string  :6-6
  title: string  :7-7
  daysLeft: number | null  :8-8
  targetTab: string  :9-9
export function buildCriticalAlerts(d) → CriticalAlert[]  :17-29
```

### src/modules/dashboard/CriticalAlertsStrip.tsx
```
export CriticalAlertsStrip
```

### src/modules/dashboard/DrawerShell.tsx
```
props Props
export DrawerShell
handler onClick
```

### src/modules/dashboard/helpers.ts
```
export const byCurStr = (m, number>) =>  :3-4
export const dleftBadge = (d) =>  :6-12
export const severityRank = (d) =>  :15-15
```

### src/modules/dashboard/KpiDetailDrawer.tsx
```
props Props
export KpiKey
export KpiDetailDrawer
handler onClose
```

### src/modules/dashboard/LayoutEditor.tsx
```
props Props
hook useState
export LayoutEditor
handler onClick
```

### src/modules/dashboard/widgetCatalog.ts
```
export interface WidgetMeta  :14-18
  key: WK  :15-15
  philosophy: string  :16-16
  horizon: DecisionHorizon  :17-17
export interface UserDashboardLayout  :189-192
  widgets: { key: WK  :190-190
  order: WK[]  :191-191
export type WK  :6-6
export type DecisionHorizon  :12-12
export function resolveEffectiveWidgets(role, saved) → WK[]  :195-201
export function buildEditableLayout(role, saved)  :205-205
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

### src/modules/negotiation/AccessDeniedPanel.tsx
```
component AccessDeniedPanel
handler onClick
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

### src/modules/negotiation/ModeTabBar.tsx
```
component ModeTabBar
handler onClick
```

### src/modules/negotiation/ProposalSelectorHeader.tsx
```
component ProposalSelectorHeader
handler onChange
```

### src/modules/negotiation/types.ts
```
export interface Competitor  :2-9
  id: string  :3-3
  name: string  :4-4
  lastBid: number  :5-5
  isActive: boolean  :6-6
  floorPrice: number  :7-7
  avatarColor: string  :8-8
export interface Message  :11-16
  sender: 'customer' | 'manager' | 'system' |  :12-12
  text: string  :13-13
  time: string  :14-14
  price?: number  :15-15
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

### src/modules/procurement/constants.tsx
```
export STATUS_CONFIG
export URGENCY_CONFIG
export SOURCE_LABEL
export CURRENCIES
```

### src/modules/procurement/PRDetailDrawer.tsx
```
props PRDetailDrawerProps
hook useState
export PRDetailDrawer
handler onClick
handler onChange
```

### src/modules/procurement/PRForm.tsx
```
props PRFormProps
hook useState
export PRForm
handler onClick
handler onChange
```

### src/modules/procurement/RequestsTab.tsx
```
props RequestsTabProps
export RequestsTab
handler onChange
handler onClick
```

### src/modules/procurement/StatusBadge.tsx
```
export StatusBadge
```

### src/modules/procurement/SummaryTab.tsx
```
props SummaryTabProps
export SummaryTab
```

### src/modules/procurement/VendorForm.tsx
```
props VendorFormProps
hook useState
export VendorForm
handler onClick
handler onChange
handler onKeyDown
```

### src/modules/procurement/VendorsTab.tsx
```
props VendorsTabProps
export VendorsTab
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

### src/modules/project-mgmt/constants.tsx
```
export PROJECT_TYPE_LABEL
export PROJECT_TYPE_COLOR
export STATUS_CONFIG
export MS_STATUS_CONFIG
export MS_TYPE_ICON
export COST_CAT_LABEL
export COST_CAT_COLOR
export ProjectHandoverDoc
export HANDOVER_STATUS_BADGE
export HANDOVER_STATUS_LABEL
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

### src/modules/project-mgmt/KanbanView.tsx
```
component KanbanView
```

### src/modules/project-mgmt/MarginBadge.tsx
```
export MarginBadge
```

### src/modules/project-mgmt/OpportunityPicker.tsx
```
props OpportunityPickerProps
hook useState
export OpportunityPicker
handler onClick
handler onChange
```

### src/modules/project-mgmt/OverheadPanel.tsx
```
component OverheadPanel
hook useState
hook useCallback
hook useEffect
handler onClick
handler onChange
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

### src/modules/project-mgmt/ProjectForm.tsx
```
props ProjectFormProps
hook useState
export ProjectForm
handler onClick
handler onChange
```

### src/modules/project-mgmt/ProjectListView.tsx
```
component ProjectListView
handler onClick
```

### src/modules/project-mgmt/RiskPanel.tsx
```
component RiskPanel
```

### src/modules/project-mgmt/StatusBadge.tsx
```
export StatusBadge
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

### src/modules/reporting/AnalyticsTab.tsx
```
component AnalyticsTab
hook useState
hook useCallback
hook useEffect
handler onSaved
```

### src/modules/reporting/ArchiveCard.tsx
```
component ArchiveCard
```

### src/modules/reporting/BidScorecardCard.tsx
```
component BidScorecardCard
```

### src/modules/reporting/BomVarianceCard.tsx
```
component BomVarianceCard
```

### src/modules/reporting/BottleneckPanel.tsx
```
component BottleneckPanel
```

### src/modules/reporting/BusinessHealthCard.tsx
```
component BusinessHealthCard
```

### src/modules/reporting/ChartBlock.tsx
```
component ChartBlock
```

### src/modules/reporting/ConcentrationCard.tsx
```
component ConcentrationCard
```

### src/modules/reporting/ConsolidationView.tsx
```
component ConsolidationView
```

### src/modules/reporting/DmoAnalyticsCard.tsx
```
component DmoAnalyticsCard
```

### src/modules/reporting/DocPortfolioCard.tsx
```
component DocPortfolioCard
```

### src/modules/reporting/ForecastCard.tsx
```
component ForecastCard
hook useAuth
hook useState
handler onChange
handler onClick
```

### src/modules/reporting/FunnelCard.tsx
```
component FunnelCard
```

### src/modules/reporting/helpers.ts
```
export interface ConsolidationPerson  :75-75
  userId: string  :75-75
export interface ConsolidationEntry  :76-76
  date: string  :76-76
export interface ConsolidationVisit  :77-77
  date: string  :77-77
export interface ConsolidationResult  :78-86
  unitKey: string  :79-79
  managerName: string | null  :80-80
  matrix?: Record<string, Record<string, numbe  :81-81
  reportEntries?: ConsolidationEntry[]  :82-82
  visits?: ConsolidationVisit[]  :83-83
  targetRate?: number  :84-84
  visitReconciliation: { applicable: boolean  :85-85
export function fmtValue(m) → string  :35-42
export function prevRange(start, end)  :45-45
export function printReportWindow(title, body)  :55-67
export function printUnitReport(r)  :121-141
export function printOverview(overview, start, end)  :143-153
export const pct = (n) =>  :4-4
export const esc = (s) =>  :69-69
```

### src/modules/reporting/IncomingReportCard.tsx
```
component IncomingReportCard
hook useAuth
hook useState
handler onChange
```

### src/modules/reporting/IncomingReportsTab.tsx
```
component IncomingReportsTab
handler onReviewed
```

### src/modules/reporting/MetricCard.tsx
```
component MetricCard
```

### src/modules/reporting/MyReportsTab.tsx
```
component MyReportsTab
handler onClick
```

### src/modules/reporting/OverviewTab.tsx
```
component OverviewTab
```

### src/modules/reporting/ReportForm.tsx
```
component ReportForm
hook useAuth
hook useState
hook useEffect
handler onClick
handler onChange
```

### src/modules/reporting/TenderCard.tsx
```
component TenderCard
```

### src/modules/reporting/UnitAbsorptionCard.tsx
```
component UnitAbsorptionCard
```

### src/modules/reporting/UnitDetailTab.tsx
```
component UnitDetailTab
```

### src/modules/SalesSupport.tsx
```
component TenderList
component TenderCalendar
component ChecklistTab
component GuaranteesTab
component EkapTab
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
handler onSelect
handler onChanged
handler onWithdraw
handler onSelectTender
handler onChange
handler onClick
handler onKeyDown
handler onClose
```

### src/modules/todo/helpers.ts
```
export interface ProposalDetailItem  :135-143
  partNumber: string  :136-136
  description: string  :137-137
  quantity: number  :138-138
  purchaseCost?: number  :139-139
  unitSalePrice?: number  :140-140
  totalSalePrice?: number  :141-141
  marginPercentage?: number  :142-142
export interface ProposalDetail  :145-154
  price: string  :146-146
  totalPrice: number  :147-147
  totalCost: number  :148-148
  items: ProposalDetailItem[]  :149-149
  description: string  :150-150
  terms: string  :151-151
  version: number  :152-152
  opportunityTitle: string  :153-153
export const taskTargetTab = (t) =>  :49-58
export const getPriorityColor = (priority) =>  :66-73
export const composedTitle = (newTask, taskAction, ctx) =>  :86-97
export const getRelatedItemName = (todo, { projects, opportunities, proposals, contracts }) =>  :99-133
export const getProposalDetail = (todo, { proposals, opportunities, projects, contracts }) =>  :156-202
```

### src/modules/todo/icons.tsx
```
export ListTodo
```

### src/modules/todo/NewTaskModal.tsx
```
component NewTaskModal
handler onClick
handler onChange
```

### src/modules/todo/PendingChainApprovals.tsx
```
component PendingChainApprovals
```

### src/modules/todo/PendingDeliveryNotifications.tsx
```
component PendingDeliveryNotifications
```

### src/modules/todo/PendingProposalApprovals.tsx
```
component PendingProposalApprovals
```

### src/modules/todo/ProposalPreviewModal.tsx
```
component ProposalPreviewModal
handler onClick
```

### src/modules/todo/ResolvedApprovals.tsx
```
component ResolvedApprovals
```

### src/modules/todo/TaskList.tsx
```
component TaskList
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
handler onSubmit
```

### src/services/apiClient.ts
```
class ApiClient  :3-100
  setAuth(tenantId, token)  :7-10
  async fetchWithAuth(endpoint, options)  :12-44
  async login(email, password)  :72-85
  async forgotPassword(email)  :87-99
```

### src/types/backup.ts
```
export interface BackupJob  :2-24
  id: string  :3-3
  tenantId: string  :4-4
  scope: 'PLATFORM' | 'TENANT'  :5-5
  kind: 'FULL' | 'STATE' | 'DATA'  :6-6
  dbProvider: 'SQLITE' | 'POSTGRES'  :7-7
  trigger: 'MANUAL' | 'SCHEDULED'  :8-8
  targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3'  :9-9
  location?: string | null  :10-10
  … +13 more members  :2-2
export interface RestoreJob  :25-37
  id: string  :26-26
  tenantId: string  :27-27
  backupId: string  :28-28
  mode: 'LOGICAL' | 'STATE'  :29-29
  status: 'ANALYZING' | 'AWAITING_CONFIRM' |   :30-30
  diffReport?: string | null  :31-31
  preRestoreBackupId?: string | null  :32-32
  startedByName?: string | null  :33-33
  … +3 more members  :25-25
export interface BackupSettings  :38-47
  enabled: boolean  :39-39
  intervalHours: number  :40-40
  scope: 'PLATFORM' | 'TENANT'  :41-41
  kind: 'FULL' | 'STATE' | 'DATA'  :42-42
```

### src/types/dashboard.ts
```
export interface DashboardPayload  :1-24
  kpis: { winRate: number  :2-2
  timeSensitive: { tenderDeadlines: { id: string  :3-4
  guaranteeExpiries: { id: string  :5-5
  guaranteeRequests: { id: string  :6-6
  costApprovalsPending: { id: string  :7-7
  invoicesDue: { id: string  :8-8
  milestonesDue: { id: string  :9-9
  contractDeadlines: { id: string  :10-10
  … +10 more members  :1-1
```

### src/types/dmo.ts
```
export interface DmoCatalogItem  :2-8
  id: string  :3-3
  unit: string  :4-4
  unitCost: number  :5-5
  validFrom?: string | null  :6-6
  frameworkAgreementId?: string | null  :7-7
export interface DmoFrameworkAgreement  :9-12
  id: string  :10-10
  quotaTotal?: number | null  :11-11
export interface DmoExchangeRate  :13-16
  id: string  :14-14
  source?: string | null  :15-15
export interface DmoOrderItem  :17-20
  id?: string  :18-18
  unitCost: number  :19-19
export interface DmoOrder  :21-31
  id: string  :22-22
  frameworkAgreementId?: string | null  :23-23
  ownerId?: string | null  :24-24
  revenueTotal: number  :25-25
  rateValidFrom?: string | null  :26-26
  risturnRateApplied: number  :27-27
  commissionType: string  :28-28
  grossProfit: number  :29-29
  … +1 more members  :21-21
```

### src/types/overhead.ts
```
export interface OperatingCostPool  :1-6
  id: string  :2-2
  personnelCost: number  :3-3
  method: 'PCT_OF_VALUE' | 'PCT_OF_DIRECT_COS  :4-4
  status: string  :5-5
export interface UnitBudget  :7-10
  id: string  :8-8
  personnelBudget: number  :9-9
export interface UnitLoadLine  :11-11
  unitId: string  :11-11
export interface OverheadResult  :12-17
  directCost: number  :13-13
  companyAmount: number  :14-14
  unitBreakdown: UnitLoadLine[]  :15-15
  contributionMargin: number  :16-16
export interface ProjectUnitParticipation  :18-21
  id: string  :19-19
  role?: string | null  :20-20
export interface UnitAbsorptionLine  :22-25
  unitId: string  :23-23
  allocated: number  :24-24
export interface UnitAbsorptionReport  :26-30
  units: UnitAbsorptionLine[]  :27-27
  summary: { totalBudget: number  :28-28
  note: string  :29-29
```

### src/types/tender.ts
```
export interface TenderChecklistItem  :2-16
  id: string  :3-3
  tenderId: string  :4-4
  name: string  :5-5
  isRequired: boolean  :6-6
  status: 'PENDING' | 'DONE' | 'WAIVED'  :7-7
  fileUrl?: string | null  :8-8
  sortOrder: number  :9-9
  notes?: string | null  :10-10
  … +5 more members  :2-2
export interface Tender  :17-41
  id: string  :18-18
  tenantId: string  :19-19
  name: string  :20-20
  ikn?: string | null  :21-21
  authority?: string | null  :22-22
  method: 'OPEN' | 'RESTRICTED' | 'NEGOTIATED  :23-23
  status: 'DRAFT' | 'PREPARING' | 'SUBMITTED'  :24-24
  submissionDeadline?: string | null  :25-25
  … +15 more members  :17-17
```
