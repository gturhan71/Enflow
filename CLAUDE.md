# Enflow — Proje Bağlamı

## Proje Nedir

Enflow, B2B satış ve iş süreçlerini yöneten çok kiracılı (multi-tenant) bir SaaS platformudur. Satış fırsatlarının CRM'den başlayıp sözleşme imzalanmasına ve proje yönetimine aktarılmasına kadar tüm yaşam döngüsünü kapsar.

**Hedef kullanıcı rolleri:** GENERAL_MANAGER, SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL, PROJECT_MANAGER, ADMIN

**Kurumsal onay swimlane rolleri (2026-06-16 eklendi):** FINANCE_MGR, IGPD_MGR (İş Geliştirme & Pazarlama), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Satın Alma), LEGAL_MGR (Hukuk) — `src/constants.ts` ROLE_LABELS'ta tanımlı; karşılık gelen `Unit` kayıtları tenant-1'e eklendi.

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

> 📚 **Sistemi sıfırdan anlamak / tek-kaynak akış referansı:** `walkthrough.md §27` (Bileşen Envanteri & Uçtan Uca Akış — gelecek enflow-wiki kaynağı). Bu CLAUDE.md mimari/karar referansı; §27 anlatısal akış kaynağı.

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

- [ ] **Enflow-Wiki** — yazılımı hiç bilmeyene anlatan **statik how-to/referans** sayfası. Kaynağı hazır: `walkthrough.md §27` (Bileşen Envanteri & Uçtan Uca Akış). *Planlı bir sonraki iş.* (memory: [[enflow-wiki-plan]])
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
backend/src/services/backupVerifyService.ts ← prismaClient, backupTargets, backupService
backend/src/services/backupService.ts ← prismaClient, backupTargets
backend/src/services/backupScheduler.ts ← prismaClient, backupService, backupVerifyService, activityLog
src/components/settings/TenantSettings.tsx ← ../lib/utils, ../types, ../services/apiService
backend/src/services/restoreService.ts ← prismaClient, backupTargets, backupService
src/modules/BackupModule.tsx ← services/apiService, types
backend/src/services/governance.ts ← prismaClient
backend/src/services/approvalChainService.ts ← prismaClient, pluginCatalog, agentProvenance, governance
backend/src/services/moneyRounding.ts ← financeEngine
backend/src/services/licenseVerify.ts ← config/licensePublicKey
backend/src/services/entitlementService.ts ← prismaClient, pluginCatalog, licenseVerify
src/modules/VirtualAgentsTestModule.tsx ← services/apiService, contexts/AuthContext, types, lib/agentProvenance
license-tool/server.mjs ← core
src/contexts/AuthContext.tsx ← types
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, components/AgentTag, lib/agentProvenance
src/modules/PresalesModule.tsx ← types, SpecAnalysis, services/workflowService, contexts/AuthContext, components/PermissionGate
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService, contexts/AuthContext, lib/procurementCosts
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ContractWorkflowModule.tsx ← services/apiClient, services/apiService, contexts/AIGateContext, types
src/lib/permissionTree.ts ← constants
src/components/settings/PermissionSettings.tsx ← ../lib/utils, ../types, ../constants, ../lib/permissionTree, ../services/apiService
upgrade-tool/cli.mjs ← core
upgrade-tool/server.mjs ← core
backend/src/services/updateNotifier.ts ← prismaClient
src/modules/SettingsModule.tsx ← types, IntegrationWizard, WorkflowBuilder, components/settings/TenantSettings, components/settings/UnitManagement
src/components/settings/SubscriptionSettings.tsx ← ../services/apiService, ../types
src/components/settings/UnitManagement.tsx ← ../lib/utils, ../types, ../services/apiService
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, types, services/apiService
src/components/HandOffModal.tsx ← services/apiService
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, lib/utils
src/modules/IntegrationWizard.tsx ← constants, types, services/nextcloudService, services/exchangeService, services/whatsappService
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, services/apiService, contexts/UnsavedChangesContext
src/modules/LicenseTypesModule.tsx ← lib/utils, contexts/AuthContext, services/apiService
src/components/HealthCards.tsx ← types
src/modules/CRMModule.tsx ← lib/utils, types, components/HealthCards, ProposalEditor, NegotiationModule
backend/src/services/dmoCosting.ts ← prismaClient, moneyRounding
backend/src/services/analyticsService.ts ← prismaClient
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext, services/apiService
src/modules/DmoModule.tsx ← services/apiService, contexts/AuthContext, types
src/App.tsx ← utils/logger, types, layout/Sidebar, layout/Header, modules/Dashboard
src/modules/FinanceModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/Login.tsx ← constants, services/apiService, types
src/modules/ManagementReportingModule.tsx ← services/apiService, components/HealthCards, contexts/AuthContext, constants, types
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, components/HealthCards, types
src/modules/SetupWizard.tsx ← services/apiService, types
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, documentService
backend/src/middleware.ts ← prismaClient, services/auth
backend/src/services/aiClient.ts ← prismaClient
backend/src/services/bootstrapTenant.ts ← prismaClient, licenseVerify, auth
backend/src/services/overheadService.ts ← prismaClient, financeEngine, moneyRounding
```

## changes (last 10 commits — 1 second ago)
```
src/modules/FinanceModule.tsx                 +OverheadPoolTab
src/modules/ManagementReportingModule.tsx     +UnitAbsorptionCard  ~DmoAnalyticsCard  ~AnalyticsTab
src/modules/ProjectManagementModule.tsx       +OverheadPanel  ~isHandoverComplete
src/services/apiClient.ts                     ~ApiClient
src/services/apiService.ts                    ~ApiService
backend/src/middleware.ts                     +bearerToken
backend/src/services/aiClient.ts              +assertSafeAiUrl  ~joinUrl  ~chatJSON
backend/src/services/auth.ts                  +jwtSecret  +hashPassword  +verifyPassword  +signAuthToken
backend/src/services/bootstrapTenant.ts       ~bootstrapTenant
backend/src/services/financeEngine.ts         +computeCompanyOverhead  +computeUnitParticipationLoad  +projectMargins  ~convertMinor
backend/src/services/overheadService.ts       +unitPeriodCostMap  +directCostOf  +getActivePool  +computeProjectOverhead
backend/src/utils/secureUpload.ts             +fileFilter  +documentUpload
```

## backend

### backend/src/services/backupVerifyService.ts
```
export async function verifyBackup  :46-46
export async function drainVerifyQueue  :125-136
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
export type BackupScope  :17-17
export type BackupKind  :18-18
export type TargetType  :19-19
```

### backend/src/services/backupScheduler.ts
```
export function startBackupScheduler  :53-57
```

### backend/src/services/restoreService.ts
```
export async function analyzeRestore  :59-63
export async function applyLogicalRestore  :138-138
export async function stageStateRestore  :193-193
```

### backend/src/services/governance.ts
```
export interface ApprovalTier  :13-13
maxAmount: number  :13-13
export async function getApprovalMatrix  :22-32
export async function resolveApproverRoles  :37-46
export async function isSoDEnabled  :48-54
export async function resolveEntityCreator  :57-73
export async function sodViolation  :79-92
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain  :22-51
export async function completeApprovalChain  :59-81
export async function autoSkipOrphanStages  :91-201
export async function resetApprovalChain  :204-217
```

### backend/src/services/moneyRounding.ts
```
export function roundMoneyData  :48-56
export const round2  :33-45
```

### backend/src/services/licenseVerify.ts
```
export interface LicensePayload  :11-20
v: number  :12-12
tenantId: string  :13-13
sku: string  :14-14
plugins: string[]  :15-15
limits: { users?: number  :16-16
issuedAt: number  :17-17
expiresAt: number | null  :18-18
nonce: string  :19-19
export type VerifyResult  :22-22
export function verifyLicenseToken  :32-47
```

### backend/src/services/entitlementService.ts
```
export async function isPluginEntitled  :18-26
export async function listEntitlementsWithCatalog  :29-45
export async function activatePluginLicense  :53-57
export async function updateEntitlement  :93-97
```

### backend/src/services/updateNotifier.ts
```
export interface UpdateStatus  :11-26
checkedAt?: string  :12-12
current?: { shortSha?: string | null  :13-13
update?: { available?: boolean  :14-15
applied?: boolean  :16-16
failed?: boolean  :17-17
kind?: 'tag' | 'commit'  :18-18
target?: string | null  :19-19
ref?: string | null  :20-20
export function enflowHome  :29-31
export function readUpdateStatus  :33-39
export function startUpdateNotifier  :110-114
```

### backend/prisma/migrations/20260702095851_dmo_module/migration.sql
```
TABLE DmoCatalogItem
TABLE DmoFrameworkAgreement
TABLE DmoExchangeRate
TABLE DmoOrder
TABLE DmoOrderItem
INDEX DmoCatalogItem_tenantId_status_idx ON DmoCatalogItem
INDEX DmoFrameworkAgreement_tenantId_status_idx ON DmoFrameworkAgreement
INDEX DmoExchangeRate_tenantId_currency_idx ON DmoExchangeRate
INDEX DmoOrder_tenantId_status_idx ON DmoOrder
INDEX DmoOrderItem_orderId_idx ON DmoOrderItem
```

### backend/prisma/migrations/20260702142626_dmo_item_sell_currency/migration.sql
```
TABLE new_DmoOrderItem
INDEX DmoOrderItem_orderId_idx ON DmoOrderItem
```

### backend/src/services/dmoCosting.ts
```
export interface RisturnTier  :10-10
thresholdMin: number  :10-10
export interface DmoCommission  :11-11
type: 'PERCENT' | 'FIXED'  :11-11
export interface DmoCostParams  :12-17
risturnTiers: RisturnTier[]  :13-13
minMarginPct: number  :14-14
defaultCommission: DmoCommission  :15-15
costFxRates: Record<string, number>  :16-16
export interface CostingResult  :89-96
revenueTotal: number  :90-90
dmoRateSnapshot: number | null  :91-91
risturnRateApplied: number  :92-92
commissionType: string  :93-93
netProfit: number  :94-94
costedAt: Date  :95-95
export async function getDmoParams  :26-36
export async function setDmoParams  :38-52
export function effectiveRisturnRate  :55-60
export async function getPeriodTurnover  :63-75
export async function getActiveDmoRate  :78-78
export function computeOrderCosting  :107-155
export async function recomputeOrderCosting  :158-187
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
export interface BomVarianceLine  :112-112
name: string  :112-112
export interface BomVarianceReport  :113-113
lines: BomVarianceLine[]  :113-113
export interface ForecastReport  :159-163
rawPipeline: number  :160-160
target: number  :161-161
byStage: { status: string  :162-162
export interface BidScoreLine  :195-201
id: string  :196-196
deadline: string | null  :197-197
score: number  :198-198
factors: { authorityWinRate: number  :199-199
authorityWinPct: number | null  :200-200
export interface BidScorecard  :202-206
```

### backend/src/services/pluginCatalog.ts
```
export interface PluginDefinition  :13-27
key: string  :14-14
name: string  :15-15
category: PluginCategory  :16-16
description: string  :17-17
unitKey?: string  :19-19
role?: string  :20-20
defaultMode?: AgentMode  :21-21
allowedModes?: AgentMode[]  :22-22
export type PluginCategory  :10-10
export type AgentMode  :11-11
export function getPlugin  :154-156
export function getAgentPluginForRole  :160-164
```

### backend/prisma/migrations/migration_lock.toml
```
key provider
```

### backend/pnpm-lock.yaml
```
keys: [lockfileVersion, settings, importers, packages, snapshots]
```

### backend/prisma/migrations/20260702170248_overhead_faz1/migration.sql
```
TABLE OperatingCostPool
TABLE UnitBudget
TABLE new_Project
INDEX Project_opportunityId_key ON Project
INDEX OperatingCostPool_tenantId_status_idx ON OperatingCostPool
INDEX UnitBudget_tenantId_unitId_idx ON UnitBudget
```

### backend/prisma/migrations/20260702172407_overhead_faz2/migration.sql
```
TABLE ProjectUnitParticipation
INDEX ProjectUnitParticipation_projectId_idx ON ProjectUnitParticipation
INDEX ProjectUnitParticipation_projectId_unitId_key ON ProjectUnitParticipation
```

### backend/src/middleware.ts
```
export const asyncHandler  :6-8
export const requireRole  :75-83
export const requireEntitlement  :87-94
```

### backend/src/services/aiClient.ts
```
export interface TenantAIConfig  :13-18
baseUrl: string  :14-14
apiKey: string  :15-15
model: string  :16-16
label?: string  :17-17
export async function getTenantAIConfig  :21-41
export async function isAIConfigured  :43-45
export function assertSafeAiUrl  :56-71
export async function chatJSON  :77-126
```

### backend/src/services/auth.ts
```
export interface AuthTokenPayload  :25-29
sub: string  :26-26
tid: string  :27-27
role: string  :28-28
export async function hashPassword  :31-33
export async function verifyPassword  :35-42
export function signAuthToken  :44-47
export function verifyAuthToken  :49-59
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
export async function bootstrapTenant  :51-127
```

### backend/src/services/financeEngine.ts
```
export interface MoneyBreakdown  :13-18
netMinor: number  :14-14
vatMinor: number  :15-15
grossMinor: number  :16-16
currency: Currency  :17-17
export interface LineInput  :20-26
qty: number  :21-21
unitPrice: number  :22-22
vatRate?: number  :23-23
currency?: Currency  :24-24
discountPct?: number  :25-25
export type Currency  :11-11
export type OverheadMethod  :88-88
export function toMinor  :29-31
export function fromMinor  :33-35
export function roundMinor  :37-39
export function applyVat  :42-42
export function lineBreakdown  :49-58
export function sumByCurrency  :64-75
export function convertMinor  :78-80
export function presentBreakdown  :83-83
export function computeCompanyOverhead  :95-99
export function computeUnitParticipationLoad  :106-109
export function projectMargins  :120-120
```

### backend/src/services/overheadService.ts
```
export interface UnitLoadLine  :8-8
unitId: string  :8-8
export interface OverheadResult  :9-16
directCost: number  :10-10
method: OverheadMethod | null  :11-11
companyAmount: number  :12-12
unitBreakdown: UnitLoadLine[]  :13-13
contributionMargin: number  :14-14
applyOverhead: boolean  :15-15
export interface UnitAbsorptionLine  :90-94
unitId: string  :91-91
allocated: number  :92-92
coeffSum: number  :93-93
export interface UnitAbsorptionReport  :95-99
units: UnitAbsorptionLine[]  :96-96
summary: { totalBudget: number  :97-97
note: string  :98-98
export async function getActivePool  :35-37
export async function computeProjectOverhead  :40-69
export async function applyProjectOverhead  :72-85
export async function computeUnitBudgetAbsorption  :101-144
```

### backend/src/utils/secureUpload.ts
```
export function documentUpload  :47-53
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

## license-poc

### license-poc/lib.mjs
```
export function makePayload  :14-27
export function issue  :30-35
export function verifyToken  :41-56
```

### license-poc/README.md
```
h1 Enflow Lisans PoC (Ed25519, tenant-bağlı, yalnız-doğrula)
h2 Çalıştır
h2 Dosyalar
h2 İlke
code-fence bash
code-fence plain
```

## license-tool

### license-tool/core.mjs
```
export function keygen  :13-19
export function makePayload  :22-35
export function issue  :38-42
export function publicFromPrivate  :45-47
```

### license-tool/README.md
```
h1 Enflow Lisans Üreteci (Vendor — yerel web GUI)
h2 Çalıştır
h2 Güvenlik
h2 Dosyalar
code-fence bash
code-fence plain
```

### license-tool/server.mjs
```
function ensurePublic  :12-16
```

### license-tool/public/index.html
```
title: Enflow Lisans Üreteci (Vendor)
div#keyStatus
button#genBtn
textarea#pub
input#tenantId
select#sku
input#users
input#days
div#plugins
button#issueBtn
div#issueStatus
textarea#token
button#copyBtn
p#payloadInfo
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

### src/contexts/AuthContext.tsx
```
hook useState
hook useEffect
hook useContext
export AuthProvider
```

### src/modules/TodoModule.tsx
```
hook useAuth
hook useState
hook useCallback
hook useEffect
export TodoModule
handler onClick
handler onChange
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

### src/modules/ProcurementModule.tsx
```
props VendorFormProps
props PRDetailDrawerProps
props PRFormProps
props ProcurementModuleProps
hook useState
hook useAuth
hook useCallback
hook useEffect
export ProcurementModule
handler onClick
handler onChange
handler onKeyDown
handler onRefresh
handler onSave
```

### src/modules/ContractWorkflowModule.tsx
```
component ContractWorkflowModule
component LegalView
component LegalCaseForm
props Props
hook useState
hook useAIGate
hook useCallback
hook useEffect
export ContractWorkflowModule
handler onChange
handler onClick
handler onBlur
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
export function buildPermissionGroups  :38-54
```

### src/components/settings/PermissionSettings.tsx
```
props PermissionSettingsProps
hook useState
export PermissionSettings
handler onClick
handler onChange
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

### src/components/settings/SubscriptionSettings.tsx
```
props SubscriptionSettingsProps
export SubscriptionSettings
handler onChange
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

### src/components/HandOffModal.tsx
```
props HandOffModalProps
hook useState
hook useEffect
export HandOffModal
handler onClick
handler onChange
```

### src/modules/NegotiationModule.tsx
```
hook useAuth
hook useState
hook useMemo
hook useEffect
hook useRef
export NegotiationModule
handler onDeal
handler onChange
handler onClick
handler onSubmit
```

### src/modules/IntegrationWizard.tsx
```
hook useState
export IntegrationWizard
handler onClick
handler onChange
```

### src/modules/WorkflowBuilder.tsx
```
hook useUnsavedChanges
hook useState
hook useMemo
hook useEffect
export WorkflowBuilder
handler onChange
handler onClick
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

### src/components/HealthCards.tsx
```
component ProjectHealthCard
component CustomerHealthCard
export ProjectHealthCard
export CustomerHealthCard
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
handler onClick
handler onOpps
handler onValue
handler onChange
handler onSave
handler onImported
handler onConfirm
handler onSubmit
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

### src/modules/Login.tsx
```
props LoginProps
hook useState
export Login
handler onSubmit
handler onChange
```

### src/modules/ManagementReportingModule.tsx
```
component MetricCard
component ChartBlock
component BottleneckPanel
component ConsolidationView
component ReportForm
component IncomingReportCard
component FunnelCard
component TenderCard
component BomVarianceCard
component ConcentrationCard
component ForecastCard
component BidScorecardCard
component DocPortfolioCard
component BusinessHealthCard
component DmoAnalyticsCard
component UnitAbsorptionCard
component AnalyticsTab
component ManagementReportingModule
hook useAuth
hook useState
hook useEffect
hook useCallback
handler onClick
handler onChange
handler onSaved
```

### src/modules/ProjectManagementModule.tsx
```
component OverheadPanel
props OpportunityPickerProps
props ProjectFormProps
props CostFormProps
props ProjectDetailProps
props ProjectManagementModuleProps
hook useState
hook useCallback
hook useEffect
hook useMemo
hook useAuth
export ProjectManagementModule
handler onClick
handler onChange
handler onApplied
handler onSave
handler onOpportunities
handler onRefresh
handler onPrintReport
handler onSelect
```

### src/modules/SetupWizard.tsx
```
props SetupWizardProps
hook useState
hook useEffect
export SetupWizard
handler onChange
handler onClick
```

### src/services/apiClient.ts
```
class ApiClient  :3-74
setAuth  :7-10
async fetchWithAuth  :12-44
async login  :46-59
async forgotPassword  :61-73
```

### src/services/apiService.ts
```
class ApiService  :13-70
setAuth  :14-16
async login  :18-20
async forgotPassword  :22-24
async getSetupStatus  :27-27
async runSetup  :32-32
async getCustomers  :40-40
async createCustomer  :41-41
async updateCustomer  :42-42
```

### src/types.ts
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
export interface ApprovalStage  :14-23
id: string  :15-15
role: string  :16-16
status: 'PENDING' | 'APPROVED' | 'REJECTED'  :17-17
approverId?: string  :18-18
note?: string  :19-19
order?: number  :20-20
approvedAt?: string  :21-21
agentRunId?: string | null  :22-22
export interface Workflow  :25-32
id: string  :26-26
name: string  :27-27
description: string  :28-28
isDefault?: boolean  :29-29
steps: WorkflowStep[]  :30-30
stages: ApprovalStage[]  :31-31
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
export async function runUpgrade  :198-256
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

### upgrade-tool/cli.mjs
```
async function main  :14-47
```

### upgrade-tool/server.mjs
```
function loadConfig  :27-29
function saveConfig  :30-30
function inMaintenanceWindow  :41-45
async function performUpgrade  :47-54
async function tick  :57-66
```

### upgrade-tool/public/index.html
```
title: Enflow Upgrade Tool
span#home
div#cur
div#curDate
div#lat
div#latDate
div#state
div#notes
button#btnCheck
button#btnUpgrade
select#channel
input#autoCheckHours
input#autoUpgrade
input#maintenanceFrom
input#maintenanceTo
input#restartCommand
button#btnSave
span#saved
pre#log
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
```
