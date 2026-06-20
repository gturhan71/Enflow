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
2. **Analiz** — Sözleşme metni + idari şartname; AI ile analiz (Claude claude-sonnet-4-6 / mock fallback)
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

POST   /:id/analyze                → AI analiz (claude-sonnet-4-6); evrak listesi oluştur
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

Boş birim koltuğunu dolduran **deterministik (LLM'siz)** vekiller — `virtualAgentService.HANDLERS`. Çıktı → handoff TodoTask (`assignedBy=AGENT:<key>`) + AgentRun (ADVISORY→PENDING_RATIFICATION / AUTONOMOUS→auto-RATIFIED). **8 agent:** Tender (checklist/deadline) · Project (devir/milestone) · Presales (BoM tutarlılık) · Procurement (en ucuz teklif/deadline) · **Finance (ADVISORY-only)** · **Legal (ADVISORY-only)** · CRM (fırsat hijyeni) · İGPD (BD/beklenen değer). Lisans kapısı `entitlementService`; orphan-stage otonom dalı `getAgentPluginForRole`. ⚠️ Canlıda `PLUGIN_LICENSE_SECRET` değiştirilmeli.

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
- [ ] **Agent otonomi — kalan eylemler** — CRM/İGPD/Tender/Project/Presales için güvenli otonom mutasyonlar (altyapı hazır; her biri ayrı reversibility değerlendirmesi).
- [ ] **Gerçek EKAP entegrasyonu** (şu an manuel İKN iskeleti).
- [ ] **Entegrasyon katmanı doğrulaması** — Nextcloud DMS / Exchange e-posta / WhatsApp (denetimlerde kapsanmadı).

---

## Auto-generated signatures
<!-- Updated by gen-context.js -->
# Code signatures

## deps
```
backend/src/services/unitReportingService.ts ← prismaClient
backend/src/services/entitlementService.ts ← prismaClient, pluginCatalog
backend/src/services/agentProvenance.ts ← pluginCatalog
backend/src/services/approvalChainService.ts ← prismaClient, pluginCatalog, agentProvenance
src/components/AgentTag.tsx ← services/apiService, lib/agentProvenance, types
src/modules/VirtualAgentsTestModule.tsx ← services/apiService, contexts/AuthContext, types, lib/agentProvenance
src/App.tsx ← utils/logger, constants, types, layout/Sidebar, layout/Header
src/components/settings/SubscriptionSettings.tsx ← ../services/apiService, ../types
src/components/settings/UserManagement.tsx ← ../types, ../constants, ../services/apiService
src/hooks/useBoM.ts ← constants, services/apiService, contexts/UnsavedChangesContext, types
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, constants, types
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext
src/modules/ActivityLogModule.tsx ← services/apiService, lib/agentProvenance, types
src/modules/CRMModule.tsx ← lib/utils, types, ProposalEditor, NegotiationModule, components/HandOffModal
src/modules/ContractModule.tsx ← constants, types, components/TaskProgressTracker, services/workflowService, contexts/AuthContext
src/modules/ContractWorkflowModule.tsx ← services/apiClient, services/apiService, types
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService
src/modules/Dashboard.tsx ← types, lib/utils, contexts/AuthContext, services/apiService
src/modules/DocumentsModule.tsx ← lib/utils, types, services/apiService
src/modules/LicenseTypesModule.tsx ← lib/utils, contexts/AuthContext, services/apiService
src/modules/ManagementReportingModule.tsx ← services/apiService, contexts/AuthContext, constants, types
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, lib/utils
src/modules/PresalesModule.tsx ← components/CostAnalysisModule, types, SpecAnalysis, services/workflowService, contexts/AuthContext
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProposalEditor.tsx ← lib/utils, types
src/modules/SecurityTestModule.tsx ← services/apiClient
src/modules/SettingsModule.tsx ← types, IntegrationWizard, WorkflowBuilder, components/settings/TenantSettings, components/settings/UnitManagement
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, components/AgentTag, lib/agentProvenance
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, services/apiService, contexts/UnsavedChangesContext
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, documentService
src/services/workflowService.ts ← apiService, whatsappService, exchangeService, types, utils/logger
backend/src/services/activityLog.ts ← prismaClient
backend/src/services/projectFactory.ts ← prismaClient, projectCodeService
backend/src/services/virtualAgentService.ts ← prismaClient, entitlementService, pluginCatalog, agentProvenance
```

## changes (last 10 commits — 1 second ago)
```
src/components/ErrorBoundary.tsx              ~ErrorBoundary
src/modules/ActivityLogModule.tsx             +actionTone  +ActivityLogModule
src/modules/ContractWorkflowModule.tsx        +apiFetch  +bestProposalPrice  +ContractWorkflowModule  +LegalView
src/modules/ManagementReportingModule.tsx     +prevRange  +printReportWindow  +printUnitReport  +printOverview
src/services/apiService.ts                    ~ApiService
src/services/workflowService.ts               ~WorkflowService
backend/src/services/activityLog.ts           +logActivity
backend/src/services/projectFactory.ts        +getMilestoneTemplate  +createProjectWithMilestones
backend/src/services/virtualAgentService.ts   ~hasHandler
.github/copilot-instructions.md               +ensureApprovalChain  +completeApprovalChain  +autoSkipOrphanStages  +resetApprovalChain
```

## .github

### .github/copilot-instructions.md
```
h2 Auto-generated signatures
h2 SigMap commands
h1 Code signatures
h2 deps
h2 changes (last 10 commits — 1 second ago)
h2 .github
h3 .github/copilot-instructions.md
h2 backend
h3 backend/pnpm-lock.yaml
h3 backend/prisma/migrations/20260617182226_add_workflow_default_and_skip_logic/migration.sql
h3 backend/prisma/migrations/20260617203010_faz6a_finance/migration.sql
h3 backend/prisma/migrations/20260617204307_faz6b_legal/migration.sql
h3 backend/prisma/migrations/20260618080234_faz7_unit_report/migration.sql
h3 backend/prisma/migrations/20260617210532_faz6c_tender/migration.sql
h3 backend/prisma/migrations/20260618095753_faz8_plugin_entitlement_agent_run/migration.sql
h3 backend/src/services/approvalChainService.ts
h3 backend/src/services/agentProvenance.ts
h3 backend/src/services/activityLog.ts
h3 backend/src/services/entitlementService.ts
h3 backend/src/services/pluginCatalog.ts
h3 backend/src/services/projectFactory.ts
h3 backend/src/services/unitReportingService.ts
h3 backend/src/services/workflowTemplateService.ts
h3 backend/src/services/virtualAgentService.ts
h2 src
```

## backend

### backend/src/services/unitReportingService.ts
```
export interface UnitDefinition  :6-10
key: string  :7-7
label: string  :8-8
role: string  :9-9
export interface Period  :27-30
start: Date  :28-28
end: Date  :29-29
export interface Metric  :41-47
label: string  :42-42
value: number | string  :43-43
unit?: string  :44-44
hint?: string  :45-45
tone?: 'default' | 'positive' | 'warning'  :46-46
export interface ChartSeries  :49-53
title: string  :50-50
type: 'bar' | 'pie' | 'line'  :51-51
data: { name: string  :52-52
export interface UnitMetricsResult  :55-62
unitKey: string  :56-56
label: string  :57-57
role: string  :58-58
period: { start: string  :59-59
metrics: Metric[]  :60-60
charts: ChartSeries[]  :61-61
export interface WorkflowBottleneck  :404-408
```

### backend/prisma/migrations/20260618080234_faz7_unit_report/migration.sql
```
TABLE UnitReport
INDEX UnitReport_tenantId_unitKey_idx ON UnitReport
INDEX UnitReport_tenantId_status_idx ON UnitReport
```

### backend/prisma/migrations/20260618095753_faz8_plugin_entitlement_agent_run/migration.sql
```
TABLE PluginEntitlement
TABLE AgentRun
INDEX PluginEntitlement_tenantId_status_idx ON PluginEntitlement
INDEX PluginEntitlement_tenantId_pluginKey_key ON PluginEntitlement
INDEX AgentRun_tenantId_status_idx ON AgentRun
INDEX AgentRun_tenantId_pluginKey_idx ON AgentRun
```

### backend/src/services/entitlementService.ts
```
export function generateLicenseKey  :26-26
export async function isPluginEntitled  :43-51
export async function listEntitlementsWithCatalog  :54-70
export async function activatePluginLicense  :78-82
export async function updateEntitlement  :118-122
```

### backend/src/services/agentProvenance.ts
```
export function agentActorId  :17-19
export function isAgentActor  :22-25
export function parseAgentActor  :28-28
export function actorType  :40-42
export function agentDisplayLabel  :45-52
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain  :21-44
export async function completeApprovalChain  :52-74
export async function autoSkipOrphanStages  :84-194
export async function resetApprovalChain  :197-210
```

### backend/prisma/migrations/migration_lock.toml
```
key provider
```

### backend/pnpm-lock.yaml
```
keys: [lockfileVersion, settings, importers, packages, snapshots]
```

### backend/src/services/activityLog.ts
```
export interface LogActivityParams  :8-17
tenantId: string  :9-9
userId?: string  :10-10
action: string  :11-11
entityType: string  :12-12
entityId: string  :13-13
details?: Record<string, unknown> | null  :14-14
actorType?: 'HUMAN' | 'AGENT'  :15-15
agentRunId?: string | null  :16-16
export async function logActivity  :19-36
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
export function getPlugin  :144-146
export function getAgentPluginForRole  :150-154
```

### backend/src/services/projectFactory.ts
```
export interface ProjectFactoryInput  :58-79
name?: string  :59-59
type?: string  :60-60
description?: string  :61-61
customerId?: string  :62-62
customerName?: string  :63-63
opportunityId?: string  :64-64
contractId?: string  :65-65
pmId?: string  :66-66
export function getMilestoneTemplate  :14-56
export async function createProjectWithMilestones  :81-150
```

### backend/src/services/virtualAgentService.ts
```
export interface AgentOutput  :13-18
rationale: string  :14-14
output: Record<string, unknown>  :15-15
taskTitle: string  :17-17
export function hasHandler  :401-403
export async function runAgent  :409-414
export async function ratifyAgentRun  :496-502
```

## src

### src/lib/agentProvenance.ts
```
export function isAgentActor  :19-22
export function parseAgentActor  :24-24
export function agentDisplayLabel  :34-41
```

### src/components/AgentTag.tsx
```
component AgentTag
props AgentTagProps
hook useState
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

### src/App.tsx
```
hook useState
hook useRef
hook useEffect
hook useAuth
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
handler onLogout
handler onLogin
```

### src/components/ErrorBoundary.tsx
```
props Props
```

### src/components/settings/SubscriptionSettings.tsx
```
props SubscriptionSettingsProps
export SubscriptionSettings
handler onChange
```

### src/components/settings/UserManagement.tsx
```
props UserManagementProps
hook useState
export UserManagement
handler onSubmit
```

### src/hooks/useBoM.ts
```
export interface AbbreviatedBoMItem  :8-15
id?: string  :9-9
pn: string  :10-10
desc: string  :11-11
qty: number  :12-12
cost: number  :13-13
margin: number  :14-14
export const useBoM  :17-100
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

### src/layout/Sidebar.tsx
```
hook useUnsavedChanges
hook useAuth
hook useState
export Sidebar
handler onClick
```

### src/modules/ActivityLogModule.tsx
```
component ActivityLogModule
hook useState
hook useCallback
hook useEffect
export ActivityLogModule
handler onClick
handler onChange
```

### src/modules/CRMModule.tsx
```
hook useAuth
hook useState
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

### src/modules/ContractModule.tsx
```
hook useAuth
hook useState
hook useEffect
export ContractModule
handler onChange
handler onClick
```

### src/modules/ContractWorkflowModule.tsx
```
component ContractWorkflowModule
component LegalView
component LegalCaseForm
props Props
hook useState
hook useCallback
hook useEffect
export ContractWorkflowModule
handler onChange
handler onClick
handler onBlur
```

### src/modules/CostAnalysisModule.tsx
```
hook useState
hook useMemo
hook useEffect
export CostAnalysisModule
handler onChange
handler onClick
```

### src/modules/Dashboard.tsx
```
hook useAuth
hook useState
hook useEffect
hook useMemo
export Dashboard
handler onOpps
handler onValue
handler onCount
```

### src/modules/DocumentsModule.tsx
```
props DocumentsModuleProps
hook useState
hook useMemo
export DocumentsModule
handler onChange
handler onSubmit
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
component MetricCard
component ChartBlock
component BottleneckPanel
component ReportForm
component IncomingReportCard
component ManagementReportingModule
hook useAuth
hook useState
hook useEffect
hook useCallback
handler onClick
handler onChange
handler onReviewed
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

### src/modules/PresalesModule.tsx
```
props PresalesModuleProps
hook useAuth
hook useRef
hook useState
hook useBoM
export PresalesModule
handler onChange
handler onClick
handler onTransferToBoM
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

### src/modules/ProjectManagementModule.tsx
```
props OpportunityPickerProps
props ProjectFormProps
props CostFormProps
props ProjectDetailProps
props ProjectManagementModuleProps
hook useState
hook useEffect
hook useMemo
hook useAuth
hook useCallback
export ProjectManagementModule
handler onClick
handler onChange
handler onSave
handler onOpportunities
handler onRefresh
handler onPrintReport
handler onSelect
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

### src/modules/SecurityTestModule.tsx
```
props ReportProps
props Props
hook useState
hook useEffect
hook useCallback
export SecurityTestModule
handler onSec
handler onClick
handler onDone
```

### src/modules/SettingsModule.tsx
```
props SettingsModuleProps
hook useQueryClient
hook useModuleSettings
hook useState
hook useAuth
hook useEffect
export SettingsModule
handler onData
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

### src/modules/WorkflowBuilder.tsx
```
hook useUnsavedChanges
hook useState
hook useEffect
hook useMemo
export WorkflowBuilder
handler onChange
handler onClick
handler onPath
```

### src/services/apiService.ts
```
class ApiService  :13-87
setAuth  :14-16
async login  :18-20
async forgotPassword  :22-24
async getCustomers  :27-27
async createCustomer  :28-28
async updateCustomer  :29-29
async deleteCustomer  :30-30
async getOpportunities  :33-33
```

### src/services/workflowService.ts
```
class WorkflowService  :14-101
async createApprovalChain  :20-22
async getChainForEntity  :24-26
async approveStage  :28-30
async rejectStage  :32-34
async triggerHandOff  :36-92
getLogsForItem  :94-96
getNotificationsForUser  :98-100
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
