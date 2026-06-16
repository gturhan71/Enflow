# Enflow — Proje Bağlamı

## Proje Nedir

Enflow, B2B satış ve iş süreçlerini yöneten çok kiracılı (multi-tenant) bir SaaS platformudur. Satış fırsatlarının CRM'den başlayıp sözleşme imzalanmasına ve proje yönetimine aktarılmasına kadar tüm yaşam döngüsünü kapsar.

**Hedef kullanıcı rolleri:** GENERAL_MANAGER, SALES_MANAGER, PRESALES, PROCUREMENT, LEGAL, PROJECT_MANAGER, ADMIN

**Kurumsal onay swimlane rolleri (2026-06-16 eklendi):** FINANCE_MGR, IGPD_MGR (İş Geliştirme & Pazarlama), KGD_MGR (Kalite Güvence), KSU_MGR (Kontrat & Sözleşme), ISAB_MGR (İhale Satın Alma) — `src/constants.ts` ROLE_LABELS'ta tanımlı; karşılık gelen `Unit` kayıtları tenant-1'e eklendi.

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + TypeScript (strict), Vite, TanStack Query v5 |
| UI | Tailwind CSS, glass-morphism design (`glass-card`, `input-glass`, `btn-primary`, `btn-secondary`), `motion/react` (paket adı `motion`, **framer-motion değil**) |
| Backend | Express.js v5, TypeScript, Prisma ORM |
| DB | SQLite (dev), geçiş için Prisma migrations |
| İconlar | `lucide-react` |
| Package manager | **pnpm** |

## Çalıştırma

```bash
# Frontend (port 5173)
pnpm dev

# Backend (port 3002)
cd backend && pnpm dev
```

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

## Veritabanı Modelleri (Prisma)

Tüm modeller `tenantId` ile izole edilmiş.

| Model | Amaç |
|-------|------|
| `Tenant` | Kiracı |
| `User` | Kullanıcı (rol + izin JSON) |
| `Customer` | Müşteri |
| `Opportunity` | Satış fırsatı |
| `Proposal` | Teklif (versiyonlu, durum akışı) |
| `BoMItem` | Malzeme listesi kalemi |
| `CostItem` | Maliyet kalemi (LABOR/LOGISTICS/TRAVEL/OTHER) |
| `Contract` | Sözleşme (eski basit model) |
| `ContractWorkflow` | Sözleşme süreç yönetimi |
| `ContractWorkflowDoc` | Sözleşme evrakları |
| `TodoTask` | Görev (birim bazlı, relatedModule + relatedItemId) |
| `Workflow` / `WorkflowStep` | Onay akışı şablonları |
| `Project` | Proje (type, phase, milestone/cost relations) |
| `ProjectMilestone` | Aşama takibi (paralel, onay gerektiren, ilerleme) |
| `ProjectCostItem` | Proje maliyet kalemi (PROCUREMENT/TRAVEL/EXTERNAL_SERVICE/OTHER) |
| `Vendor` | Tedarikçi kaydı |
| `PurchaseRequest` | Satınalma talebi (9 statü, tam akış) |
| `PurchaseItem` | Talep satır kalemleri |
| `PurchaseQuote` | Tedarikçi teklifleri |
| `DeliveryRecord` | Teslimat kaydı |
| `ActivityLog` | Değişiklik logu |
| `Notification` | Kullanıcı bildirimi |
| `ApprovalChain` / `ApprovalStage` | Kalıcı çok-aşamalı onay zinciri (Finans→İGPD→GM→KSU vb.) |

## Modüller ve Sidebar Menüsü

| Sekme key | Bileşen | Açıklama |
|-----------|---------|----------|
| `dashboard` | `Dashboard` | Özet metrikler |
| `crm-dashboard` | `CRMModule` | CRM Genel Bakış — alt modüllere kart üzerinden erişim |
| `crm-opportunities` | `CRMModule` | Fırsatlar |
| `crm-customers` | `CRMModule` | Müşteriler |
| `crm-proposals` | `CRMModule` | Teklifler |
| `crm-negotiation` | `CRMModule` | Canlı Pazarlıklar |
| `presales` | `PresalesModule` | BoM (malzeme listesi) + maliyet analizi |
| `negotiation` | `NegotiationModule` | Müzakere + anlaşma |
| `contract` | `ContractModule` | Eski sözleşme modülü |
| `project-mgmt` | `ProjectManagementModule` | Tam proje yaşam döngüsü — milestone, maliyet, karlılık |
| `procurement` | `ProcurementModule` | Satınalma talebi → tedarikçi → PO → teslimat → fatura |
| `sales-support` | `SalesSupport` | İhale desteği |
| `todo` | `TodoModule` | Görev yönetimi |
| `documents` | `DocumentsModule` | Kurumsal dokümanlar |
| `archive` | `ArchiveModule` | Fiziksel arşiv |
| `settings` | `SettingsModule` | Ayarlar (kullanıcı, birim, entegrasyon) |
| `contract-workflow-test` | `ContractWorkflowTest` | **TEST** — Sözleşme süreç yönetimi (sadece GENERAL_MANAGER görür) |

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
- **No `any`** — TypeScript strict mode

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

## Onay Zinciri (ApprovalChain) — Faz 0 (2026-06-16)

Kurumsal süreç boşluk analizine göre eklendi: `src/services/workflowService.ts`'teki eski in-memory (sayfa yenilenince kaybolan) yapı, kalıcı Prisma modeline taşındı.

### Model
```
ApprovalChain  { entityType, entityId, status: PENDING|COMPLETED|REJECTED, stages[] }
ApprovalStage  { chainId, role, order, status: PENDING|APPROVED|REJECTED, approverId, note, approvedAt }
```

### Varsayılan Şablonlar (`backend/src/services/approvalChainService.ts`)
```
OPPORTUNITY / PROPOSAL          → FINANCE_MGR → IGPD_MGR → GENERAL_MANAGER → KSU_MGR
CONTRACT_WORKFLOW_SIGNING       → KSU_MGR → GENERAL_MANAGER
```

### Bağlandığı Yerler (mevcut statü alanları korunarak, paralel kayıt)
- `opportunities.ts` `/request-approval` → `ensureApprovalChain` (chain oluşturur)
- `opportunities.ts` `/approve` → `completeApprovalChain` (tüm aşamaları onaylanmış işaretler — tek-tık GM onayı geriye uyumlu)
- `opportunities.ts` `/revert-approval` → `resetApprovalChain`
- `contractWorkflow.ts` `PUT /:id` — `status: 'PENDING_SIGNATURE_APPROVAL'` → chain oluşturur; `status: 'SIGNED'` → chain tamamlar

### Backend Endpoint'leri (`/api/approval-chains`)
```
GET    /?entityType=&entityId=     → zincir(leri) listele
GET    /:id                         → tek zincir (stages dahil)
POST   /                            → { entityType, entityId, stages: [{role, order?}] }
POST   /:id/stages/:stageId/approve → { approverId, note? }
POST   /:id/stages/:stageId/reject  → { approverId, note? }
DELETE /:id
```

Aşama-bazlı (Finans→İGPD→GM→KSU tek tek onay) UI **Faz 1'de eklendi** — bkz. aşağıdaki bölüm.

## Bekleyen Onaylarım — Onay Zinciri Swimlane (Faz 1, 2026-06-16)

`TodoModule.tsx`'e generic bir sekme eklendi: `currentUser.role` zincirin hangi aşamasındaysa (FINANCE_MGR/IGPD_MGR/GENERAL_MANAGER/KSU_MGR), o role ait sırası gelmiş onaylar burada listelenir. Finans'a özel sabit bir sayfa değil — `APPROVAL_CHAIN_TEMPLATES`'teki her rol için otomatik çalışır.

- Backend: `GET /api/approval-chains?pendingForRole=<ROLE>` — "sırası gelmiş" = kendinden önceki tüm aşamalar `APPROVED` olan ilk `PENDING` aşama bu role ait
- Frontend: `apiService.getPendingApprovalChainsForRole(role)`, `approveApprovalStage`, `rejectApprovalStage`
- Test edilirken `GENERAL_MANAGER` rolü zincirin 3. aşaması olduğu için mevcut GM test hesabıyla da görünür/test edilebilir

## Kayıp Fırsat Yönetimi (Faz 1)

- `Opportunity.lostReason: String?` — CRM'de "Kaybedildi" işaretlenirken `LOST_REASON_OPTIONS` listesinden seçim yapan bir modal açılır (`CRMModule.tsx` — `lostReasonModal` state)
- `status: 'LOST'`'a yeni geçişte (`oldOpp.status !== 'LOST'`) backend otomatik bir `ArchiveItem` kaydı oluşturur (`opportunities.ts` PUT handler) — `boxNo/shelfNo: 'DİJİTAL'`, `category: 'Kaybedilen Fırsat'`

## İş Günü SLA Mekanizması (Faz 1)

- `backend/src/utils/businessDays.ts` — `date-fns` **kullanılmıyor** (backend'in node_modules'unda yok, sadece frontend'de) — saf `Date` aritmetiği ile hafta sonu hariç gün hesabı
- `TodoTask.slaBusinessDays: Int?` — `tasks.ts` POST'ta `dueDate` verilmemişse bu alandan otomatik hesaplanır
- Presales "Onaya Gönder" akışı (`PresalesModule.tsx`) → `slaBusinessDays: 3` (diyagramdaki "en az 3 iş günü" kuralı)

## Proje Kod Üreticisi (Faz 1)

- `Project.code: String?` — format `{YIL}-{TİP_KISALTMA}-{SIRA}` örn. `2026-HW-00012`
- `backend/src/services/projectCodeService.ts` → `nextProjectCode(tenantId, type)` — tenant+yıl bazında proje sayısından sıra no türetir
- UI: `ProjectManagementModule.tsx` Kanban/Liste kartlarında proje adının yanında gösterilir

## Sonraki Adımlar (Planlanan)

Detaylı yol haritası: `~/.claude/plans/flickering-toasting-leaf.md` (kurumsal süreç boşluk analizi planı).

- [x] ApprovalChain/ApprovalStage kalıcı altyapı + Opportunity/ContractWorkflow onay akışlarına bağlandı (Faz 0)
- [x] Aşama-bazlı onay swimlane UI'sı — TodoModule "Bekleyen Onaylarım" sekmesi (Faz 1)
- [x] Kayıp fırsat nedeni (`Opportunity.lostReason`) + otomatik arşivleme (Faz 1)
- [x] İş günü SLA mekanizması (Faz 1)
- [x] Proje kod üreticisi (Faz 1)
- [ ] Ziyaret Planı + Günlük Rapor modülü (VisitPlan/Visit/DailyReport) (Faz 2)
- [ ] Proje Devir Paketi (11 zorunlu evrak — ContractWorkflowDoc pattern'inin klonu) (Faz 2)
- [ ] Özgün, tenant-bazlı doküman kodlama sistemi + Genel Hususlar modülü (Faz 3 — **üçüncü taraf notasyonu ASLA kullanılmaz**, bkz. plan dosyası)
- [ ] ContractWorkflow'u test modülünden çıkarıp tam modül haline getirme
- [ ] Sözleşme → Proje otomatik bağlantısı (Project kaydı oluşturma)
- [ ] İhale yönetimi (SalesSupport → ContractWorkflow bağlantısı)
- [ ] Proje → Satınalma otomatik bağlantısı (purchaseRequestId ↔ ProjectCostItem)


---

## Auto-generated signatures
<!-- Updated by gen-context.js -->
# Code signatures

## deps
```
src/services/whatsappService.ts ← types, utils/logger
src/services/nextcloudService.ts ← types, utils/logger
src/services/exchangeService.ts ← types, utils/logger
src/modules/SalesSupport.tsx ← constants, types, services/nextcloudService, services/exchangeService, services/whatsappService
src/modules/SubscriptionModule.tsx ← types
src/components/settings/TenantSettings.tsx ← ../lib/utils, ../types
src/contexts/AuthContext.tsx ← constants, types
src/components/settings/SubscriptionSettings.tsx ← ../services/apiService, ../types
src/components/settings/UnitManagement.tsx ← ../lib/utils, ../types, ../services/apiService
src/layout/Header.tsx ← lib/utils, contexts/AuthContext, contexts/ThemeContext, constants, types
src/components/settings/UserManagement.tsx ← ../types, ../constants, ../services/apiService
src/modules/DocumentsModule.tsx ← lib/utils, types, services/apiService
src/components/settings/PermissionSettings.tsx ← ../lib/utils, ../types, ../constants, ../services/apiService
src/modules/IntegrationWizard.tsx ← constants, types, services/nextcloudService, services/exchangeService, services/whatsappService
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, services/apiService, contexts/UnsavedChangesContext
src/modules/SpecAnalysis.tsx ← lib/utils, types
src/modules/Login.tsx ← constants, services/apiService
src/components/CustomerImportWizard.tsx ← lib/utils, types, services/apiService
src/App.tsx ← utils/logger, constants, types, layout/Sidebar, layout/Header
src/components/FinalProposalGenerator.tsx ← services/workflowService, types
src/hooks/useBoM.ts ← constants, services/apiService, contexts/UnsavedChangesContext, types
src/hooks/useEnflowQueries.ts ← services/apiService
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext
src/modules/CRMModule.tsx ← lib/utils, types, ProposalEditor, NegotiationModule, components/HandOffModal
src/modules/ContractModule.tsx ← constants, types, components/TaskProgressTracker, services/workflowService, contexts/AuthContext
src/modules/ContractWorkflowTest.tsx ← services/apiClient, types
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService
src/modules/Dashboard.tsx ← types, lib/utils, contexts/AuthContext, services/apiService
src/modules/LicenseTypesModule.tsx ← lib/utils, contexts/AuthContext, services/apiService
src/modules/LicenseGeneratorModule.tsx ← types, contexts/AuthContext, services/apiService
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, lib/utils
src/modules/PresalesModule.tsx ← components/CostAnalysisModule, types, SpecAnalysis, services/workflowService, contexts/AuthContext
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProposalEditor.tsx ← lib/utils, types
src/modules/SecurityTestModule.tsx ← services/apiClient
src/modules/SettingsModule.tsx ← types, IntegrationWizard, WorkflowBuilder, components/settings/TenantSettings, components/settings/UnitManagement
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, documentService
src/services/workflowService.ts ← apiService, whatsappService, exchangeService, types, utils/logger
backend/src/middleware.ts ← prismaClient
backend/src/services/approvalChainService.ts ← prismaClient
```

## changes (last 10 commits — 1 second ago)
```
src/modules/ContractWorkflowTest.tsx          +apiFetch  +bestProposalPrice  +ContractWorkflowTest
src/modules/ProjectManagementModule.tsx       +kar
src/modules/SecurityTestModule.tsx            +flattenSuite  +parseResults
src/services/apiService.ts                    ~ApiService
src/services/workflowService.ts               ~WorkflowService
backend/src/services/approvalChainService.ts  +ensureApprovalChain  +completeApprovalChain  +resetApprovalChain
.github/copilot-instructions.md               +ApiClient  +WhatsAppService  +NextcloudService  +ExchangeService
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
h3 backend/prisma/migrations/migration_lock.toml
h3 backend/pnpm-lock.yaml
h3 backend/prisma/migrations/20260613000000_add_contract_workflow/migration.sql
h3 backend/prisma/migrations/20260614202029_add_module_settings/migration.sql
h3 backend/prisma/migrations/20260615143052_add_project_milestones_and_costs/migration.sql
h3 backend/prisma/migrations/20260615121855_add_procurement_module/migration.sql
h3 backend/prisma/migrations/20260614202051_add_tenant_module_settings/migration.sql
h3 backend/src/middleware.ts
h2 src
h3 src/components/WorkflowSimulation.tsx
h3 src/components/SaveButton.tsx
h3 src/contexts/UnsavedChangesContext.tsx
h3 src/services/apiClient.ts
h3 src/services/whatsappService.ts
h3 src/services/nextcloudService.ts
h3 src/services/exchangeService.ts
h3 src/modules/SalesSupport.tsx
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

### backend/prisma/migrations/20260614202029_add_module_settings/migration.sql
```
TABLE new_ContractWorkflowDoc
```

### backend/prisma/migrations/20260613000000_add_contract_workflow/migration.sql
```
TABLE ContractWorkflow
TABLE ContractWorkflowDoc
```

### backend/prisma/migrations/20260614202051_add_tenant_module_settings/migration.sql
```
TABLE new_Tenant
```

### backend/prisma/migrations/20260615143052_add_project_milestones_and_costs/migration.sql
```
TABLE ProjectMilestone
TABLE ProjectCostItem
TABLE new_Project
INDEX Project_opportunityId_key ON Project
```

### backend/prisma/migrations/20260615121855_add_procurement_module/migration.sql
```
TABLE Vendor
TABLE PurchaseRequest
TABLE PurchaseItem
TABLE PurchaseQuote
TABLE DeliveryRecord
```

### backend/prisma/migrations/20260616183730_add_approval_chain/migration.sql
```
TABLE ApprovalChain
TABLE ApprovalStage
INDEX ApprovalChain_entityType_entityId_idx ON ApprovalChain
```

### backend/src/middleware.ts
```
export const asyncHandler  :5-7
export const requireRole  :40-48
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain  :19-42
export async function completeApprovalChain  :50-72
export async function resetApprovalChain  :75-88
```

## src

### src/services/apiClient.ts
```
class ApiClient  :3-70
setAuth  :7-10
async fetchWithAuth  :12-44
async login  :46-55
async forgotPassword  :57-69
```

### src/services/whatsappService.ts
```
class WhatsAppService  :4-37
getConfig  :13-15
updateConfig  :17-20
testConnection  :22-26
async sendMessage  :28-36
```

### src/services/nextcloudService.ts
```
class NextcloudService  :8-66
async syncUser  :21-26
async uploadFile  :44-53
updateConfig  :58-61
getConfig  :63-65
```

### src/services/exchangeService.ts
```
class ExchangeService  :4-42
getConfig  :15-17
updateConfig  :19-23
testConnection  :25-29
async sendEmail  :31-35
async syncCalendar  :37-41
```

### src/modules/SalesSupport.tsx
```
hook useState
export SalesSupport
handler onChange
handler onClick
```

### src/modules/SubscriptionModule.tsx
```
hook useState
export SubscriptionModule
handler onChange
handler onClick
```

### src/components/settings/TenantSettings.tsx
```
props TenantSettingsProps
export TenantSettings
handler onChange
handler onClick
```

### src/contexts/AuthContext.tsx
```
hook useState
hook useEffect
hook useContext
export AuthProvider
```

### src/components/settings/SubscriptionSettings.tsx
```
props SubscriptionSettingsProps
export SubscriptionSettings
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

### src/components/settings/UnitManagement.tsx
```
props UnitManagementProps
hook useState
export UnitManagement
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

### src/components/settings/UserManagement.tsx
```
props UserManagementProps
hook useState
export UserManagement
handler onSubmit
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

### src/components/settings/PermissionSettings.tsx
```
props PermissionSettingsProps
hook useState
export PermissionSettings
handler onChange
handler onClick
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
hook useEffect
hook useMemo
export WorkflowBuilder
handler onChange
handler onClick
handler onPath
```

### src/modules/SpecAnalysis.tsx
```
props SpecAnalysisProps
hook useState
export SpecAnalysis
handler onChange
handler onClick
```

### src/modules/Login.tsx
```
props LoginProps
hook useState
export Login
handler onSubmit
handler onChange
```

### src/components/CustomerImportWizard.tsx
```
props Props
hook useState
hook useRef
hook useCallback
export CustomerImportWizard
handler onClick
handler onDragOver
handler onDrop
handler onChange
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

### src/components/FinalProposalGenerator.tsx
```
props Props
hook useState
hook useEffect
export FinalProposalGenerator
handler onClick
```

### src/hooks/useBoM.ts
```
export const useBoM  :7-90
```

### src/hooks/useEnflowQueries.ts
```
export const useOpportunities  :6-14
export const useCustomers  :16-24
export const useProjects  :26-34
export const useContracts  :36-44
export const useTasks  :46-54
export const useUnits  :56-64
export const useUsers  :66-74
export const useDocuments  :76-84
export const useProposals  :86-94
export const useModuleSettings  :96-103
export const useApproveProposalMutation  :107-116
```

### src/layout/Sidebar.tsx
```
hook useUnsavedChanges
hook useAuth
hook useState
export Sidebar
handler onClick
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

### src/modules/ContractWorkflowTest.tsx
```
component ContractWorkflowTest
props Props
hook useState
hook useCallback
hook useEffect
export ContractWorkflowTest
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

### src/modules/LicenseTypesModule.tsx
```
hook useAuth
hook useState
hook useEffect
export LicenseTypesModule
handler onChange
handler onClick
```

### src/modules/LicenseGeneratorModule.tsx
```
hook useAuth
hook useState
hook useEffect
export LicenseGeneratorModule
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
export TodoModule
handler onClick
handler onChange
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
export interface WorkflowStep  :1-9
id: string  :2-2
workflowId?: string  :3-3
unitId: string  :4-4
type: 'AUTO' | 'MANUAL'  :5-5
description: string  :6-6
order: number  :7-7
nextStepId: string | null  :8-8
export interface ApprovalStage  :11-19
id: string  :12-12
role: string  :13-13
status: 'PENDING' | 'APPROVED' | 'REJECTED'  :14-14
approverId?: string  :15-15
note?: string  :16-16
order?: number  :17-17
approvedAt?: string  :18-18
export interface Workflow  :21-27
id: string  :22-22
name: string  :23-23
description: string  :24-24
steps: WorkflowStep[]  :25-25
stages: ApprovalStage[]  :26-26
export interface User  :29-39
id: string  :30-30
name: string  :31-31
```
