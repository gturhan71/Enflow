# Enflow — Proje Bağlamı

## Proje Nedir

Enflow, B2B satış ve iş süreçlerini yöneten çok kiracılı (multi-tenant) bir SaaS platformudur. Satış fırsatlarının CRM'den başlayıp sözleşme imzalanmasına ve proje yönetimine aktarılmasına kadar tüm yaşam döngüsünü kapsar.

**Hedef kullanıcı rolleri:** GENERAL_MANAGER, SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL, PROJECT_MANAGER, ADMIN

**Kurumsal onay swimlane rolleri (2026-06-16 eklendi):** FINANCE_MGR, IGPD_MGR (İş Geliştirme), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Birimi), LEGAL_MGR (Hukuk) — `src/constants.ts` ROLE_LABELS'ta tanımlı; karşılık gelen `Unit` kayıtları tenant-1'e eklendi.

## Versiyonlama Kuralı

**Güncel sürüm: Enflow v2.1.0** — tek kaynak `src/constants.ts` `APP_VERSION`; kök `package.json` ve `backend/package.json` `version` alanları bununla senkron tutulur (üçü aynı anda güncellenir).

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

## deps
```
backend/src/services/analyticsService.ts ← prismaClient
src/components/HealthCards.tsx ← types, lib/format
src/modules/DmoModule.tsx ← services/apiService, contexts/AuthContext, lib/format, types
src/modules/Dashboard.tsx ← types, constants, lib/utils, lib/format, contexts/AuthContext
src/modules/FinanceModule.tsx ← services/apiService, contexts/AuthContext, types, lib/format
src/modules/SalesSupport.tsx ← services/apiService, contexts/AuthContext, contexts/AIGateContext, lib/format, types
backend/src/middleware.ts ← prismaClient, services/auth, utils/logger
src/services/whatsappService.ts ← types, utils/logger
src/components/ErrorBoundary.tsx ← utils/logger
src/modules/SpecAnalysis.tsx ← lib/utils, services/apiService, contexts/AIGateContext, utils/logger, types
src/modules/ArchiveModule.tsx ← types, services/apiService, utils/logger, components/PermissionGate
src/types/crm.ts ← auth, presales
src/App.tsx ← utils/logger, types, layout/Sidebar, layout/Header, modules/Dashboard
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, types, services/apiService
backend/src/services/invoiceEngine.ts ← prismaClient
backend/src/services/financeSummary.ts ← prismaClient
backend/src/services/agingReport.ts ← prismaClient
src/modules/todo/helpers.ts ← ../types
src/modules/todo/PendingChainApprovals.tsx ← ../types, ../components/AgentTag, ../lib/agentProvenance, helpers
src/modules/todo/PendingProposalApprovals.tsx ← ../types, helpers
src/modules/todo/PendingDeliveryNotifications.tsx ← ../types
src/modules/todo/TaskList.tsx ← ../types, helpers, icons, ../components/AgentTag, ../lib/agentProvenance
src/modules/todo/ResolvedApprovals.tsx ← ../types, helpers
src/modules/todo/ProposalPreviewModal.tsx ← ../types, helpers
src/modules/todo/NewTaskModal.tsx ← ../types, helpers
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, todo/helpers, todo/PendingChainApprovals
src/modules/procurement/constants.tsx ← ../types
src/modules/procurement/StatusBadge.tsx ← ../types, constants
src/modules/procurement/VendorForm.tsx ← ../types
src/modules/procurement/PRDetailDrawer.tsx ← ../services/apiService, ../lib/format, ../types, constants, StatusBadge
src/modules/procurement/PRForm.tsx ← ../types, constants
src/modules/procurement/RequestsTab.tsx ← ../types, ../lib/format, constants, StatusBadge
src/modules/procurement/VendorsTab.tsx ← ../types
src/modules/procurement/SummaryTab.tsx ← ../types, constants
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, lib/format, types, procurement/constants
src/modules/CRMModule.tsx ← types, ProposalEditor, NegotiationModule, components/HandOffModal, services/workflowService
src/modules/ContractWorkflowModule.tsx ← services/apiService, contexts/AIGateContext, contexts/AuthContext, contract-workflow/types, contract-workflow/constants
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, negotiation/types, negotiation/AccessDeniedPanel
src/modules/ManagementReportingModule.tsx ← services/apiService, contexts/AuthContext, types, reporting/helpers, reporting/AnalyticsTab
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, components/HealthCards, lib/format, types
src/modules/contract-workflow/AnalysisTab.tsx ← types
src/modules/contract-workflow/DocumentsTab.tsx ← types, constants
src/modules/contract-workflow/DetailHeader.tsx ← types, constants, helpers
src/modules/contract-workflow/ContextTab.tsx ← ../types, types
src/modules/contract-workflow/TransferTab.tsx ← types
src/modules/contract-workflow/SigningTab.tsx ← types
src/modules/contract-workflow/LegalView.tsx ← ../services/apiService, ../types, constants, LegalCaseForm
src/modules/contract-workflow/LegalCaseForm.tsx ← ../services/apiService, constants
src/modules/contract-workflow/WorkflowListPanel.tsx ← ../types, types, constants, helpers
src/modules/contract-workflow/helpers.ts ← ../services/apiClient, ../types, constants
src/modules/crm/ContactsModal.tsx ← ../types
src/modules/contract-workflow/types.ts ← ../types
src/modules/crm/CustomerReportModal.tsx ← ../lib/utils, ../types, helpers, constants
src/modules/crm/DashboardView.tsx ← ../types, constants
src/modules/crm/CustomersView.tsx ← ../lib/utils, ../types, ../components/HealthCards, ../components/PermissionGate, helpers
src/modules/crm/NewCustomerModal.tsx ← ../types
src/modules/crm/LostReasonModal.tsx ← ../lib/utils, ../types, constants
src/modules/crm/ProposalsView.tsx ← ../lib/utils, ../types, helpers
src/modules/crm/OpportunitiesView.tsx ← ../lib/utils, ../types, ../components/SaveButton, ../components/PermissionGate, constants
src/modules/crm/NewOpportunityModal.tsx ← ../types, ../lib/procurementCosts
src/modules/negotiation/AuctionBoard.tsx ← ../lib/utils, types
src/modules/crm/constants.ts ← ../types
src/modules/crm/helpers.ts ← ../types
src/modules/negotiation/AuctionSidePanel.tsx ← ../lib/utils
src/modules/negotiation/ChatInfoPanel.tsx ← ../lib/utils, ../types
src/modules/negotiation/ChatWindow.tsx ← ../lib/utils, types
src/modules/negotiation/ModeTabBar.tsx ← ../lib/utils
src/modules/negotiation/ProposalSelectorHeader.tsx ← ../types
src/modules/project-mgmt/CostForm.tsx ← ../types, constants
src/modules/project-mgmt/KanbanView.tsx ← ../types, constants, helpers, MarginBadge
src/modules/project-mgmt/OpportunityPicker.tsx ← ../types, ../lib/format
src/modules/project-mgmt/OverheadPanel.tsx ← ../services/apiService, ../lib/format, ../types
src/modules/project-mgmt/ProjectDetail.tsx ← ../services/apiService, ../lib/format, ../types, constants, helpers
src/modules/project-mgmt/RiskPanel.tsx ← ../types, helpers
src/modules/project-mgmt/ProjectListView.tsx ← ../types, ../lib/format, constants, helpers, StatusBadge
src/modules/project-mgmt/ProjectForm.tsx ← ../types, constants
src/modules/reporting/ArchiveCard.tsx ← ../types
src/modules/reporting/AnalyticsTab.tsx ← ../services/apiService, ../components/HealthCards, ../types, BusinessHealthCard, DmoAnalyticsCard
src/modules/project-mgmt/helpers.ts ← ../lib/format, ../types, constants
src/modules/project-mgmt/StatusBadge.tsx ← ../types, constants
src/modules/project-mgmt/constants.tsx ← ../types
src/modules/reporting/ConsolidationView.tsx ← helpers
src/modules/reporting/BidScorecardCard.tsx ← ../types, helpers
src/modules/reporting/ChartBlock.tsx ← ../types, helpers
src/modules/reporting/BomVarianceCard.tsx ← ../types, helpers, ../lib/format
src/modules/reporting/BusinessHealthCard.tsx ← ../types, ../components/HealthCards
src/modules/reporting/BottleneckPanel.tsx ← ../types, ../constants
src/modules/reporting/ConcentrationCard.tsx ← ../types, helpers
src/modules/reporting/DmoAnalyticsCard.tsx ← ../types, helpers, ../lib/format
src/modules/reporting/DocPortfolioCard.tsx ← ../types
src/modules/reporting/FunnelCard.tsx ← ../types, helpers
src/modules/reporting/MyReportsTab.tsx ← ../types, helpers
src/modules/reporting/MetricCard.tsx ← ../types, helpers
src/modules/reporting/IncomingReportCard.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ConsolidationView
src/modules/reporting/ForecastCard.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ../lib/format
src/modules/reporting/IncomingReportsTab.tsx ← ../types, IncomingReportCard
src/modules/reporting/UnitDetailTab.tsx ← ../types, helpers, MetricCard, ChartBlock
src/modules/reporting/TenderCard.tsx ← ../types, helpers, ../lib/format
src/modules/reporting/UnitAbsorptionCard.tsx ← ../types, helpers, ../lib/format
src/modules/reporting/OverviewTab.tsx ← ../types, ../constants, helpers, BottleneckPanel, MetricCard
src/modules/reporting/ReportForm.tsx ← ../services/apiService, ../contexts/AuthContext, ../types, helpers, ConsolidationView
src/modules/reporting/helpers.ts ← ../constants, ../types
```

## changes (last 10 commits — 1 second ago)
```
src/modules/ContractWorkflowModule.tsx        ~apiFetch  ~bestProposalPrice  ~LegalView  ~LegalCaseForm
src/modules/ManagementReportingModule.tsx     ~fmtValue  ~prevRange  ~printReportWindow  ~consolidationHtml
src/modules/ProjectManagementModule.tsx       ~isHandoverComplete  ~OverheadPanel  ~kar
src/modules/contract-workflow/AnalysisTab.tsx +AnalysisTab
src/modules/contract-workflow/DocumentsTab.tsx +DocumentsTab
src/modules/contract-workflow/DetailHeader.tsx +DetailHeader
src/modules/contract-workflow/ContextTab.tsx  +ContextTab
src/modules/contract-workflow/CancelModal.tsx +CancelModal
src/modules/contract-workflow/TransferTab.tsx +TransferTab
src/modules/contract-workflow/SigningTab.tsx  +SigningTab
src/modules/contract-workflow/LegalView.tsx   +LegalView
src/modules/contract-workflow/LegalCaseForm.tsx +LegalCaseForm
src/modules/contract-workflow/WorkflowListPanel.tsx +WorkflowListPanel
src/modules/contract-workflow/helpers.ts      +apiFetch  +bestProposalPrice
src/modules/crm/ContactsModal.tsx             +ContactsModal
src/modules/crm/CustomerReportModal.tsx       +CustomerReportModal
src/modules/crm/DashboardView.tsx             +DashboardView
src/modules/crm/CustomersView.tsx             +CustomersView
src/modules/crm/NewCustomerModal.tsx          +NewCustomerModal
src/modules/crm/LostReasonModal.tsx           +LostReasonModal
src/modules/crm/ProposalsView.tsx             +ProposalsView
src/modules/crm/OpportunitiesView.tsx         +OpportunitiesView
src/modules/crm/NewOpportunityModal.tsx       +NewOpportunityModal
src/modules/negotiation/AuctionBoard.tsx      +AuctionBoard
src/modules/negotiation/AccessDeniedPanel.tsx +AccessDeniedPanel
src/modules/negotiation/AuctionSidePanel.tsx  +AuctionSidePanel
src/modules/negotiation/ChatInfoPanel.tsx     +ChatInfoPanel
src/modules/negotiation/ChatWindow.tsx        +ChatWindow
src/modules/negotiation/ModeTabBar.tsx        +ModeTabBar
src/modules/negotiation/ProposalSelectorHeader.tsx +ProposalSelectorHeader
src/modules/project-mgmt/KanbanView.tsx       +KanbanView
src/modules/project-mgmt/OverheadPanel.tsx    +OverheadPanel
src/modules/project-mgmt/ProjectDetail.tsx    +kar
src/modules/project-mgmt/RiskPanel.tsx        +RiskPanel
src/modules/project-mgmt/ProjectListView.tsx  +ProjectListView
src/modules/reporting/ArchiveCard.tsx         +ArchiveCard
src/modules/reporting/AnalyticsTab.tsx        +AnalyticsTab
src/modules/project-mgmt/helpers.ts           +isHandoverComplete
src/modules/reporting/ConsolidationView.tsx   +ConsolidationView
src/modules/reporting/BidScorecardCard.tsx    +BidScorecardCard
src/modules/reporting/ChartBlock.tsx          +ChartBlock
src/modules/reporting/BomVarianceCard.tsx     +BomVarianceCard
src/modules/reporting/BusinessHealthCard.tsx  +BusinessHealthCard
src/modules/reporting/BottleneckPanel.tsx     +BottleneckPanel
src/modules/reporting/ConcentrationCard.tsx   +ConcentrationCard
src/modules/reporting/DmoAnalyticsCard.tsx    +DmoAnalyticsCard
src/modules/reporting/DocPortfolioCard.tsx    +DocPortfolioCard
src/modules/reporting/FunnelCard.tsx          +FunnelCard
src/modules/reporting/MyReportsTab.tsx        +MyReportsTab
src/modules/reporting/MetricCard.tsx          +MetricCard
src/modules/reporting/IncomingReportCard.tsx  +IncomingReportCard
src/modules/reporting/ForecastCard.tsx        +ForecastCard  +Kapsama  +butonu
src/modules/reporting/IncomingReportsTab.tsx  +IncomingReportsTab
src/modules/reporting/UnitDetailTab.tsx       +UnitDetailTab
src/modules/reporting/TenderCard.tsx          +TenderCard
src/modules/reporting/UnitAbsorptionCard.tsx  +UnitAbsorptionCard
src/modules/reporting/OverviewTab.tsx         +OverviewTab
src/modules/reporting/ReportForm.tsx          +ReportForm
src/modules/reporting/helpers.ts              +fmtValue  +prevRange  +printReportWindow  +consolidationHtml
```

## backend

### backend/prisma/migrations/migration_lock.toml
```
key provider
```

### backend/pnpm-lock.yaml
```
keys: [lockfileVersion, settings, importers, packages, snapshots]
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

### backend/src/middleware.ts
```
export const asyncHandler  :7-9
export const requireRole  :76-84
export const requireEntitlement  :88-95
```

### backend/src/services/invoiceEngine.ts
```
export function deriveInvoiceStatus  :4-10
export async function recalcInvoice  :13-22
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
export function summarizeFinance  :26-54
export async function computeFinanceSummary  :56-63
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
export async function computeAgingReport  :58-61
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
export function computeFinancingEffect  :32-64
export function paymentDate  :67-70
export function buildFinancingEvents  :82-108
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
export function sumBomTotalsByCurrency  :65-72
```

### backend/src/services/projectProgress.ts
```
export interface MilestoneForProgress  :1-1
title: string  :1-1
export interface ProjectProgressResult  :3-8
progress: number  :4-4
phase: string  :5-5
completed: boolean  :7-7
export function computeProjectProgress  :20-28
```

### backend/src/services/contractWorkflowState.ts
```
export interface ContractAnalysisExtract  :61-61
projectName: string | null  :61-61
export interface ContractWorkflowFallback  :62-62
tenderName: string | null  :62-62
export type TransitionCheckResult  :25-25
export function checkStatusTransition  :36-59
export function buildAutoTitle  :69-75
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
export interface ProjectSummaryLine  :20-27
id: string  :21-21
customerName: string | null  :22-22
totalValue: number  :23-23
totalPlanned: number  :24-24
progress: number  :25-25
milestoneCount: number  :26-26
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
export type RoleKind  :11-11
export type Staffing  :12-12
export type RACI  :13-13
export type AgentMode  :14-14
```

## src

### src/lib/utils.ts
```
export function cn  :4-6
```

### src/lib/format.ts
```
export const fmtCurrency  :10-11
export const fmtCurrencyExact  :13-14
export const fmtCurrencyOrDash  :16-19
```

### src/components/HealthCards.tsx
```
component ProjectHealthCard
component CustomerHealthCard
export ProjectHealthCard
export CustomerHealthCard
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

### src/modules/Dashboard.tsx
```
hook useAuth
hook useState
hook useEffect
hook useMemo
export Dashboard
handler onClick
handler onOpps
handler onValue
handler onCount
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

### src/services/whatsappService.ts
```
class WhatsAppService  :4-37
getConfig  :13-15
updateConfig  :17-20
testConnection  :22-26
async sendMessage  :28-36
```

### src/components/ErrorBoundary.tsx
```
props Props
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

### src/modules/ArchiveModule.tsx
```
hook useState
hook useEffect
export ArchiveModule
handler onChange
handler onSubmit
```

### src/types/workflow.ts
```
export interface WorkflowStep  :1-12
id: string  :2-2
workflowId?: string  :3-3
unitId: string  :4-4
type: 'AUTO' | 'MANUAL'  :5-5
description: string  :6-6
order: number  :7-7
nextStepId: string | null  :8-8
enabled?: boolean  :9-9
export interface ApprovalStage  :13-22
id: string  :14-14
role: string  :15-15
status: 'PENDING' | 'APPROVED' | 'REJECTED'  :16-16
approverId?: string  :17-17
note?: string  :18-18
order?: number  :19-19
approvedAt?: string  :20-20
agentRunId?: string | null  :21-21
export interface Workflow  :23-30
id: string  :24-24
name: string  :25-25
description: string  :26-26
isDefault?: boolean  :27-27
steps: WorkflowStep[]  :28-28
stages: ApprovalStage[]  :29-29
```

### src/types/auth.ts
```
export interface User  :1-13
id: string  :2-2
name: string  :3-3
email: string  :4-4
phone?: string  :5-5
role: string  :6-6
permissions: string[]  :7-7
unitId?: string  :8-8
status: 'ACTIVE' | 'INACTIVE'  :9-9
export interface Permission  :14-19
id: string  :15-15
name: string  :16-16
code: string  :17-17
description: string  :18-18
export interface Unit  :20-26
id: string  :21-21
name: string  :22-22
description?: string  :23-23
managerId?: string | null  :24-24
parentId?: string | null  :25-25
```

### src/types/crm.ts
```
export interface Opportunity  :4-36
id: string  :5-5
title: string  :6-6
value: number  :7-7
probability: number  :8-8
expectedCloseDate?: string  :9-9
status: 'NEW' | 'CONTACTED' | 'QUALIFIED' |  :10-10
description?: string  :11-11
lostReason?: string  :12-12
export interface Customer  :37-65
id: string  :38-38
name: string  :39-39
shortName?: string  :40-40
industry?: string  :41-41
website?: string  :42-42
logo?: string  :43-43
email?: string  :44-44
phone?: string  :45-45
export interface Contact  :72-85
id: string  :73-73
tenantId?: string  :74-74
customerId: string  :75-75
name: string  :76-76
role: ContactRole  :77-77
title?: string | null  :78-78
```

### src/types/presales.ts
```
export interface CostRequirement  :1-10
id: string  :2-2
projectId: string  :3-3
description: string  :4-4
category: 'LABOR' | 'LOGISTICS' | 'TRAVEL' |  :5-5
identifiedBy: string  :6-6
costedBy?: string  :7-7
estimatedCost?: number  :8-8
status: 'IDENTIFIED' | 'COSTED' | 'APPROVED  :9-9
export interface BoMItem  :11-27
id: string  :12-12
lineKey?: string  :13-13
opportunityId?: string  :14-14
projectId?: string  :15-15
partNumber: string  :16-16
description: string  :17-17
quantity: number  :18-18
purchaseCost: number  :19-19
export interface BomHandoff  :30-43
id: string  :31-31
opportunityId: string  :32-32
oppTitle: string  :33-33
customerName?: string | null  :34-34
handedOffById?: string | null  :35-35
handedOffByName?: string | null  :36-36
```

### src/types/dashboard.ts
```
export interface DashboardPayload  :1-20
kpis: { winRate: number  :2-2
timeSensitive: { tenderDeadlines: { id: string  :3-4
guaranteeExpiries: { id: string  :5-5
guaranteeRequests: { id: string  :6-6
costApprovalsPending: { id: string  :7-7
invoicesDue: { id: string  :8-8
milestonesDue: { id: string  :9-9
management: { bottlenecks: { role: string  :11-12
```

### src/types/settings.ts
```
export interface SalesSettings  :2-4
marginFloorPct: number  :3-3
export interface Subscription  :7-17
id: string  :8-8
plan: SubscriptionPlanType  :9-9
tenantId: string  :10-10
licenseModel?: string | null  :11-11
licenseExpiryDate?: string | null  :12-12
licensedUserLimit?: number | null  :13-13
licensedStorageLimit?: number | null  :14-14
createdAt?: string  :15-15
export interface ProcurementNote  :18-23
id: string  :19-19
date: string  :20-20
note: string  :21-21
author: string  :22-22
export interface Tenant  :24-27
id: string  :25-25
name: string  :26-26
export interface NextcloudConfig  :28-36
url: string  :29-29
adminUser?: string  :30-30
adminPass?: string  :31-31
username?: string  :32-32
appPassword?: string  :33-33
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
export interface ProjectCostItem  :35-52
id: string  :36-36
projectId: string  :37-37
category: CostCategory  :38-38
description: string  :39-39
plannedAmount: number  :40-40
actualAmount: number  :41-41
currency: string  :42-42
amountTRY: number  :43-43
export interface Project  :53-83
id: string  :54-54
code?: string | null  :55-55
name: string  :56-56
type: ProjectType  :57-57
description?: string | null  :58-58
status: ProjectStatus  :59-59
```

### src/types/documents.ts
```
export interface CorporateDocument  :1-8
id: string  :2-2
name: string  :3-3
category: 'LEGAL' | 'ISO' | 'CERTIFICATE' | '  :4-4
expiryDate: string  :5-5
fileUrl: string  :6-6
tags: string[]  :7-7
export interface Notification  :9-20
id: string  :10-10
userId: string  :11-11
title: string  :12-12
message: string  :13-13
type: 'SYSTEM' | 'URGENT' | 'SUCCESS' | '  :14-14
isRead: boolean  :15-15
timestamp: string  :16-16
scheduledAt?: string  :17-17
export interface ArchiveItem  :21-34
id: string  :22-22
boxNo: string  :23-23
shelfNo: string  :24-24
category: string  :25-25
description?: string  :26-26
owner: string  :27-27
date: string  :28-28
status: string  :29-29
```

### src/types/procurement.ts
```
export interface Vendor  :3-20
id: string  :4-4
tenantId: string  :5-5
name: string  :6-6
taxNo?: string | null  :7-7
address?: string | null  :8-8
phone?: string | null  :9-9
email?: string | null  :10-10
contactName?: string | null  :11-11
export interface PurchaseItem  :33-46
id: string  :34-34
purchaseRequestId: string  :35-35
name: string  :36-36
description?: string | null  :37-37
quantity: number  :38-38
unit: string  :39-39
estimatedUnitPrice?: number | null  :40-40
currency: string  :41-41
export interface PurchaseQuote  :47-63
id: string  :48-48
purchaseRequestId: string  :49-49
vendorId?: string | null  :50-50
vendor?: Vendor | null  :51-51
vendorName: string  :52-52
totalAmount: number  :53-53
```

### src/types/finance.ts
```
export interface Payment  :2-12
id: string  :3-3
invoiceId: string  :4-4
amount: number  :5-5
currency: string  :6-6
paidAt: string  :7-7
method?: string | null  :8-8
reference?: string | null  :9-9
notes?: string | null  :10-10
export interface Invoice  :13-37
id: string  :14-14
type: 'SALES' | 'PURCHASE'  :15-15
invoiceNo?: string | null  :16-16
amount: number  :17-17
currency: string  :18-18
issueDate?: string | null  :19-19
dueDate?: string | null  :20-20
status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PART  :21-21
export interface FxAdjustment  :39-50
id: string  :40-40
invoiceId: string  :41-41
invoice?: { id: string  :42-42
paymentId: string  :43-43
currency: string  :44-44
amountFx: number  :45-45
```

### src/types/legal.ts
```
export interface LegalCase  :2-21
id: string  :3-3
type: 'CONTRACT_REVIEW' | 'LEGAL_OPINION'  :4-4
title: string  :5-5
status: 'OPEN' | 'IN_REVIEW' | 'RESPONDED'  :6-6
priority: 'LOW' | 'MEDIUM' | 'HIGH'  :7-7
relatedEntityType?: string | null  :8-8
relatedEntityId?: string | null  :9-9
summary?: string | null  :10-10
export interface LegalRequest  :22-31
id: string  :23-23
title: string  :24-24
description?: string | null  :25-25
status: string  :26-26
priority: string  :27-27
relatedItemId?: string | null  :28-28
converted: boolean  :29-29
createdAt: string  :30-30
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
export interface Tender  :17-41
id: string  :18-18
tenantId: string  :19-19
name: string  :20-20
ikn?: string | null  :21-21
authority?: string | null  :22-22
method: 'OPEN' | 'RESTRICTED' | 'NEGOTIATED  :23-23
status: 'DRAFT' | 'PREPARING' | 'SUBMITTED'  :24-24
submissionDeadline?: string | null  :25-25
```

### src/types/reports.ts
```
export interface ReportMetric  :2-8
label: string  :3-3
value: number | string  :4-4
unit?: string  :5-5
hint?: string  :6-6
tone?: 'default' | 'positive' | 'warning'  :7-7
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

### src/types/analytics.ts
```
export interface AgingBuckets  :2-2
notDue: number  :2-2
export interface AgingReport  :3-8
buckets: AgingBuckets  :4-4
dso: number  :5-5
totalReceivable: number  :6-6
byCurrency: Record<string, { totalReceivable: n  :7-7
export interface FunnelReport  :9-13
stages: { name: string  :10-10
lossByReason: { reason: string  :11-11
entered: number  :12-12
export interface TenderGroup  :14-14
key: string  :14-14
export interface TenderAnalytics  :15-19
byAuthority: TenderGroup[]  :16-16
byMethod: TenderGroup[]  :17-17
overall: { winRate: number  :18-18
export interface BomVarianceLine  :20-20
name: string  :20-20
export interface BomVarianceReport  :21-21
lines: BomVarianceLine[]  :21-21
export interface ConcentrationReport  :22-26
topCustomers: { name: string  :23-23
hhi: number  :24-24
totalRevenue: number  :25-25
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
allowedModes?:  :10-10
export interface PluginEntitlement  :16-29
id: string  :17-17
tenantId: string  :18-18
pluginKey: string  :19-19
status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'D  :20-20
licenseKey?: string | null  :21-21
mode: 'ADVISORY' | 'AUTONOMOUS'  :22-22
config?: string | null  :23-23
activatedById?: string | null  :24-24
export interface EntitlementWithCatalog  :30-34
plugin: PluginDefinition  :31-31
entitlement: PluginEntitlement | null  :32-32
active: boolean  :33-33
export interface AgentRun  :35-54
id: string  :36-36
tenantId: string  :37-37
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
export interface RestoreJob  :25-37
id: string  :26-26
tenantId: string  :27-27
backupId: string  :28-28
mode: 'LOGICAL' | 'STATE'  :29-29
status: 'ANALYZING' | 'AWAITING_CONFIRM' |  :30-30
diffReport?: string | null  :31-31
preRestoreBackupId?: string | null  :32-32
startedByName?: string | null  :33-33
export interface BackupSettings  :38-47
enabled: boolean  :39-39
intervalHours: number  :40-40
scope: 'PLATFORM' | 'TENANT'  :41-41
kind: 'FULL' | 'STATE' | 'DATA'  :42-42
targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3'  :43-43
location: string  :44-44
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
export interface DmoCommission  :32-32
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

### src/layout/Header.tsx
```
hook useAuth
hook useTheme
hook useState
hook useRef
hook useEffect
export Header
handler onAccess
handler onClick
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
export const taskTargetTab  :49-58
export const getPriorityColor  :66-73
export const composedTitle  :86-97
export const getRelatedItemName  :99-133
export const getProposalDetail  :156-202
```

### src/modules/todo/icons.tsx
```
export ListTodo
```

### src/modules/todo/PendingChainApprovals.tsx
```
component PendingChainApprovals
```

### src/modules/todo/PendingProposalApprovals.tsx
```
component PendingProposalApprovals
```

### src/modules/todo/PendingDeliveryNotifications.tsx
```
component PendingDeliveryNotifications
```

### src/modules/todo/TaskList.tsx
```
component TaskList
```

### src/modules/todo/ResolvedApprovals.tsx
```
component ResolvedApprovals
```

### src/modules/todo/ProposalPreviewModal.tsx
```
component ProposalPreviewModal
handler onClick
```

### src/modules/todo/NewTaskModal.tsx
```
component NewTaskModal
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
handler onSubmit
```

### src/modules/procurement/constants.tsx
```
export STATUS_CONFIG
export URGENCY_CONFIG
export SOURCE_LABEL
export CURRENCIES
```

### src/modules/procurement/StatusBadge.tsx
```
export StatusBadge
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

### src/modules/procurement/VendorsTab.tsx
```
props VendorsTabProps
export VendorsTab
```

### src/modules/procurement/SummaryTab.tsx
```
props SummaryTabProps
export SummaryTab
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

### src/modules/contract-workflow/AnalysisTab.tsx
```
component AnalysisTab
handler onChange
handler onClick
```

### src/modules/contract-workflow/DocumentsTab.tsx
```
component DocumentsTab
handler onClick
handler onChange
handler onBlur
```

### src/modules/contract-workflow/DetailHeader.tsx
```
component DetailHeader
handler onClick
```

### src/modules/contract-workflow/ContextTab.tsx
```
component ContextTab
handler onBlur
handler onClick
```

### src/modules/contract-workflow/CancelModal.tsx
```
component CancelModal
handler onClick
handler onChange
```

### src/modules/contract-workflow/TransferTab.tsx
```
component TransferTab
handler onClick
```

### src/modules/contract-workflow/SigningTab.tsx
```
component SigningTab
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

### src/modules/contract-workflow/LegalCaseForm.tsx
```
component LegalCaseForm
hook useState
handler onClick
handler onChange
```

### src/modules/contract-workflow/constants.ts
```
export type TabId  :15-15
```

### src/modules/contract-workflow/WorkflowListPanel.tsx
```
component WorkflowListPanel
export WorkflowFormState
handler onChange
handler onClick
```

### src/modules/contract-workflow/helpers.ts
```
export async function apiFetch  :7-9
export function bestProposalPrice  :13-24
export const stepIndex  :26-26
```

### src/modules/crm/ContactsModal.tsx
```
component ContactsModal
export ContactFormState
handler onClick
handler onSubmit
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
export interface ContractWorkflow  :18-39
id: string  :19-19
title: string  :20-20
opportunityId?: string | null  :21-21
contractValue: number  :22-22
tenderName?: string | null  :23-23
tenderNo?: string | null  :24-24
projectName?: string | null  :25-25
contractText?: string | null  :26-26
export interface AiAnalysis  :41-46
documents: { name: string  :42-42
tasks: { order: number  :43-43
key_clauses: { clause: string  :44-44
contract_summary: { project_name?: string  :45-45
export interface Props  :48-52
opportunities?: Opportunity[]  :49-49
```

### src/modules/crm/CustomerReportModal.tsx
```
component CustomerReportModal
handler onClick
```

### src/modules/crm/DashboardView.tsx
```
component DashboardView
handler onOpps
handler onValue
```

### src/modules/crm/CustomersView.tsx
```
component CustomersView
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

### src/modules/crm/LostReasonModal.tsx
```
component LostReasonModal
handler onChange
handler onClick
```

### src/modules/crm/ProposalsView.tsx
```
component ProposalsView
```

### src/modules/crm/OpportunitiesView.tsx
```
component OpportunitiesView
handler onClick
```

### src/modules/crm/NewOpportunityModal.tsx
```
component NewOpportunityModal
handler onClick
handler onSubmit
handler onChange
```

### src/modules/negotiation/AuctionBoard.tsx
```
component AuctionBoard
handler onChange
handler onClick
```

### src/modules/crm/constants.ts
```
export const getStatusStyle  :11-22
```

### src/modules/negotiation/AccessDeniedPanel.tsx
```
component AccessDeniedPanel
handler onClick
```

### src/modules/crm/helpers.ts
```
export type CustomerStats  :29-29
export const getCustomerStats  :11-27
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

### src/modules/project-mgmt/CostForm.tsx
```
props CostFormProps
hook useState
export CostForm
handler onClick
handler onChange
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

### src/modules/project-mgmt/RiskPanel.tsx
```
component RiskPanel
```

### src/modules/project-mgmt/ProjectListView.tsx
```
component ProjectListView
handler onClick
```

### src/modules/project-mgmt/ProjectForm.tsx
```
props ProjectFormProps
hook useState
export ProjectForm
handler onClick
handler onChange
```

### src/modules/reporting/ArchiveCard.tsx
```
component ArchiveCard
```

### src/modules/reporting/AnalyticsTab.tsx
```
component AnalyticsTab
hook useState
hook useCallback
hook useEffect
handler onSaved
```

### src/modules/project-mgmt/helpers.ts
```
export function isHandoverComplete  :27-30
export const fmtDate  :5-6
export const fmtShort  :7-8
export const isOverdue  :9-25
export const calcFinancials  :13-25
export const printProjectReport  :34-80
```

### src/modules/project-mgmt/StatusBadge.tsx
```
export StatusBadge
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

### src/modules/reporting/ConsolidationView.tsx
```
component ConsolidationView
```

### src/modules/reporting/BidScorecardCard.tsx
```
component BidScorecardCard
```

### src/modules/reporting/ChartBlock.tsx
```
component ChartBlock
```

### src/modules/reporting/BomVarianceCard.tsx
```
component BomVarianceCard
```

### src/modules/reporting/BusinessHealthCard.tsx
```
component BusinessHealthCard
```

### src/modules/reporting/BottleneckPanel.tsx
```
component BottleneckPanel
```

### src/modules/reporting/ConcentrationCard.tsx
```
component ConcentrationCard
```

### src/modules/reporting/DmoAnalyticsCard.tsx
```
component DmoAnalyticsCard
```

### src/modules/reporting/DocPortfolioCard.tsx
```
component DocPortfolioCard
```

### src/modules/reporting/FunnelCard.tsx
```
component FunnelCard
```

### src/modules/reporting/MyReportsTab.tsx
```
component MyReportsTab
handler onClick
```

### src/modules/reporting/MetricCard.tsx
```
component MetricCard
```

### src/modules/reporting/IncomingReportCard.tsx
```
component IncomingReportCard
hook useAuth
hook useState
handler onChange
```

### src/modules/reporting/ForecastCard.tsx
```
component ForecastCard
hook useAuth
hook useState
handler onChange
handler onClick
```

### src/modules/reporting/IncomingReportsTab.tsx
```
component IncomingReportsTab
handler onReviewed
```

### src/modules/reporting/UnitDetailTab.tsx
```
component UnitDetailTab
```

### src/modules/reporting/TenderCard.tsx
```
component TenderCard
```

### src/modules/reporting/UnitAbsorptionCard.tsx
```
component UnitAbsorptionCard
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

### src/modules/reporting/helpers.ts
```
export interface ConsolidationPerson  :62-62
userId: string  :62-62
export interface ConsolidationEntry  :63-63
date: string  :63-63
export interface ConsolidationVisit  :64-64
date: string  :64-64
export interface ConsolidationResult  :65-73
unitKey: string  :66-66
managerName: string | null  :67-67
matrix?: Record<string, Record<string, numbe  :68-68
reportEntries?: ConsolidationEntry[]  :69-69
visits?: ConsolidationVisit[]  :70-70
targetRate?: number  :71-71
visitReconciliation: { applicable: boolean  :72-72
export function fmtValue  :22-29
export function prevRange  :32-32
export function printReportWindow  :42-54
export function printUnitReport  :108-128
export function printOverview  :130-140
export const pct  :4-4
export const esc  :56-56
```
