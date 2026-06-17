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
| `VisitPlan` / `Visit` | Haftalık müşteri ziyaret planı (DEMO/TECHNICAL_MEETING/PRESENTATION/OTHER) |
| `DailyReport` | Günlük saha raporu (yöneticiyle paylaşım flag'i) |
| `ProjectHandoverDoc` | Proje devir paketi evrakları (ContractWorkflowDoc klonu, 11 zorunlu evrak) |

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

## Ziyaret Planı & Günlük Rapor Modülü (Faz 2, 2026-06-16)

`visit-plan` sekmesi — diyagramdaki "süreç öncesi" katman. `src/modules/VisitPlanModule.tsx` (ContractWorkflowDoc konvansiyonuna uyarak `VisitPlan`/`Visit`/`DailyReport` tipleri lokal tanımlı, `types.ts`'e taşınmadı).

- **Backend:** `/api/visits` — `visits.ts` (`/plans`, `/plans/:id`, `/plans/:id/visits`, `/visits/:visitId`, `/daily-reports`)
- **Model:** `VisitPlan { weekOf, preparedById, status, visits[] }`, `Visit { type: DEMO|TECHNICAL_MEETING|PRESENTATION|OTHER, plannedDate, actualDate, status, needsCaptured }`, `DailyReport { date, content, sharedWithManager }`
- **Önemli:** `customers` verisi App.tsx'te sadece `isCrmActive` aktifken çekiliyordu (`useCustomers` `enabled` koşulu) — `isVisitPlanActive` de eklendi, aksi halde müşteri seçici boş kalır

## Proje Devir Paketi (Faz 2, 2026-06-16)

`ProjectManagementModule.tsx` proje detayına 5. sekme: **Devir Paketi** — `ContractWorkflowDoc` pattern'inin doğrudan klonu.

- **Model:** `ProjectHandoverDoc { projectId, name, docType, status, fileUrl, isRequired, sortOrder }`
- **Backend:** `projects.ts`'e eklendi — `GET/POST /:id/handover-docs` (boşsa 11 zorunlu evrakı otomatik seed eder), `PUT/DELETE /:id/handover-docs/:docId`, `POST /:id/handover-docs/:docId/upload` (multer + opsiyonel Nextcloud — `backend/src/utils/fileUpload.ts`'teki paylaşılan yardımcılarla, **`contractWorkflow.ts`'e dokunulmadı**, regresyon riskine karşı kasıtlı kod tekrarı)
- **11 zorunlu evrak:** Fizibilite, İhale Dokümanları, Sözleşme+Ekleri, Birim Fiyat Teklif Cetveli, Maliyet Tablosu, Kitlist Ağacı, Alınan Teklifler, İhale Kararı, Teminat Mektupları, Proje Devir Formu, Personel Listesi
- **UI:** Header'da `!handoverComplete` ise amber "Devir Bekliyor" rozeti (tıklayınca Devir Paketi sekmesine gider); tüm `isRequired` evraklar `UPLOADED/VERIFIED/WAIVED` olunca tamamlanmış sayılır
- Yüklenen dosyalar: `backend/uploads/project-handovers/{proje_kodu}/`

## Özgün Doküman Kodlama + Genel Hususlar (Faz 3, 2026-06-17)

> ⚠️ **Kritik kısıtlama:** Referans alınan ISO 9001 diyagramı üçüncü bir şirkete aitti. O şirketin adı veya doküman kod notasyonu Enflow'un **hiçbir yerinde** (kod, migration, UI, docs) kullanılmaz. Doküman kodlama tamamen özgün ve **tenant-bazlı yapılandırılabilir**; sabit gömülü kategori/önek kodu yoktur.

### Doküman Kodlama Sistemi (tenant-yapılandırılabilir)

- **Modeller:** `DocumentCodingProfile { tenantId @unique, companyCode, separator (default "-"), includeYear, sequenceDigits (default 5), isActive }`, `DocumentCategoryCode { tenantId, code, label, @@unique([tenantId, code]) }` (tenant'ın kendi tanımladığı kategori sözlüğü), `DocumentSequence { tenantId, categoryCode, year, lastNumber, @@unique([tenantId, categoryCode, year]) }` (atomik artan sayaç)
- **Servis:** `backend/src/services/documentNumberService.ts` → `nextDocumentNumber(tenantId, categoryCode)` (profil yoksa `null`; format `{companyCode}{sep}{categoryCode}[{sep}{year}]{sep}{paddedSeq}`, `prisma.$transaction` ile atomik artırır) + `previewDocumentNumber`
- **Backend route:** `/api/document-coding` — `GET/PUT /profile` (separator default '-', sequenceDigits 1-10 clamp), `GET/POST/PUT/DELETE /categories` (409 dup code)
- **UI:** Ayarlar → Şirket Profili → "Doküman Kodlama Notasyonu" bölümü (`TenantSettings.tsx` içindeki self-contained `DocumentCodingSettings` komponenti) — şirket kodu, ayraç, hane sayısı, yıl/aktif toggle, canlı önizleme, kategori sözlüğü CRUD
- `ContractWorkflowDoc`, `ProjectHandoverDoc`, `CorporateDocument` ve aşağıdaki kurumsal modellere opsiyonel `docNumber` alanı eklendi; profil tanımlı değilse boş kalır (zorunlu değil)

### Genel Hususlar Modülü (`corporate-governance` sekmesi)

`src/modules/CorporateGovernanceModule.tsx` — tek modül, 4 sekme; kendi verisini apiService ile çeker. Sidebar'da `requiredPermission: 'CORPORATE_GOV_VIEW'` (GM superuser).

- **Modeller:** `LessonsLearned { projectId? nullable, title, category, situation, rootCause, action, impact, status, docNumber? }`, `RiskOpportunity { type RISK|OPPORTUNITY, probability 1-5, impact 1-5, score (=p*i), response, owner, status, docNumber? }`, `CorporateMetric { name, period, targetValue?, actualValue?, unit, category, @@unique([tenantId, name, period]) }`, `ExternalDocumentRegister { name, source, externalRef, version, status ACTIVE|SUPERSEDED|WITHDRAWN, docNumber? }`
- **Backend route:** `/api/corporate-governance` — `/lessons`, `/risks` (score otomatik p*i, 1-5 clamp), `/metrics` (409 dup name+period), `/external-docs`; her POST opsiyonel `categoryCode` ile docNumber üretir
- **UI:** Risk sekmesinde skor matris rengi (1-7 yeşil / 8-14 amber / 15-25 kırmızı); KPI sekmesinde hedef/gerçekleşen yüzde; "Yeni Kayıt" formu aktif sekmeye göre alan değiştirir
- **Migration:** `20260617142420_faz3_doc_coding_corporate_governance`

## EKAP İskeleti + Hukuk Talebi (Faz 4, 2026-06-17)

Faz 4 "opsiyonel/bölgesel" katman — iki küçük iş. Deskfor kapsam dışı bırakıldı.

### EKAP — Kamu İhale Platformu entegrasyon iskeleti
- `IntegrationWizard.tsx` `INTEGRATIONS` dizisine `ekap` kartı eklendi (`Gavel` ikonu, amber tema). **Gerçek EKAP web servisi bağlantısı YOK** — yalnızca manuel İKN takibi için yer tutucu.
- Tek ekranlı özel sihirbaz bloğu (`selectedIntegration === 'ekap'`): opsiyonel "Varsayılan İKN Öneki" girişi (`ekapPrefix` local state, kalıcılık yok) + iskelet notu. EKAP için "Adım X / 3" stepper'ı ve adım göstergesi gizli; footer butonu "Tamam" diyerek kapatır.
- İKN değerleri zaten ContractWorkflow kayıtlarında manuel tutuluyor; bu kart ileride otomatik senkronizasyon için zemin.

### Hukuk / Şirket Avukatı talebi (ayrı tablo YOK)
- Karar gereği yeni Prisma tablosu açılmadı — `TodoTask.relatedModule = 'LEGAL'` yeterli (`backend/src/routes/tasks.ts` POST `relatedModule`'ü passthrough kabul ediyor).
- `TodoModule.tsx` "Yeni Görev Ata" modalındaki "İlgili Modül" dropdown'ına **"Hukuk / Şirket Avukatı"** seçeneği (`LEGAL`); görev kartında `relatedModule === 'LEGAL'` için "Hukuk Talebi" etiketi (ayrıca `PROCUREMENT` etiketi de eklendi).

### Yan düzeltmeler (önceden var olan bug'lar — Görevler sekmesi)
- `App.tsx` `case 'todo'` TodoModule'e **`units` prop'unu hiç geçmiyordu** → birim dropdown'ı/filtre çipleri boştu, hiçbir görev oluşturulamıyordu. `units={units}` eklendi.
- `useUnits` `enabled` koşulu Görevler sekmesini kapsamıyordu → `|| isTodoActive` eklendi (sekmeye doğrudan girişte birimler yüklensin).

## Sonraki Adımlar (Planlanan)

Detaylı yol haritası: `~/.claude/plans/flickering-toasting-leaf.md` (kurumsal süreç boşluk analizi planı).

- [x] ApprovalChain/ApprovalStage kalıcı altyapı + Opportunity/ContractWorkflow onay akışlarına bağlandı (Faz 0)
- [x] Aşama-bazlı onay swimlane UI'sı — TodoModule "Bekleyen Onaylarım" sekmesi (Faz 1)
- [x] Kayıp fırsat nedeni (`Opportunity.lostReason`) + otomatik arşivleme (Faz 1)
- [x] İş günü SLA mekanizması (Faz 1)
- [x] Proje kod üreticisi (Faz 1)
- [x] Ziyaret Planı + Günlük Rapor modülü (Faz 2)
- [x] Proje Devir Paketi — 11 zorunlu evrak (Faz 2)
- [x] Özgün, tenant-bazlı doküman kodlama sistemi + Genel Hususlar modülü (Faz 3 — **üçüncü taraf notasyonu ASLA kullanılmaz**, bkz. aşağıdaki bölüm)
- [x] EKAP entegrasyon iskeleti (manuel İKN) + Hukuk talebi (`TodoTask.relatedModule='LEGAL'`) (Faz 4 — Deskfor kapsam dışı)
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
src/components/settings/UserManagement.tsx ← ../types, ../constants, ../services/apiService
src/modules/DocumentsModule.tsx ← lib/utils, types, services/apiService
src/components/settings/PermissionSettings.tsx ← ../lib/utils, ../types, ../constants, ../services/apiService
src/modules/IntegrationWizard.tsx ← constants, types, services/nextcloudService, services/exchangeService, services/whatsappService
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, services/apiService, contexts/UnsavedChangesContext
src/modules/SpecAnalysis.tsx ← lib/utils, types
src/modules/Login.tsx ← constants, services/apiService
src/components/CustomerImportWizard.tsx ← lib/utils, types, services/apiService
src/hooks/useBoM.ts ← constants, services/apiService, contexts/UnsavedChangesContext, types
src/App.tsx ← utils/logger, constants, types, layout/Sidebar, layout/Header
src/components/FinalProposalGenerator.tsx ← services/workflowService, types
src/components/settings/TenantSettings.tsx ← ../lib/utils, ../types, ../services/apiService
src/hooks/useEnflowQueries.ts ← services/apiService
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext
src/modules/CRMModule.tsx ← lib/utils, types, ProposalEditor, NegotiationModule, components/HandOffModal
src/modules/ContractModule.tsx ← constants, types, components/TaskProgressTracker, services/workflowService, contexts/AuthContext
src/modules/ContractWorkflowTest.tsx ← services/apiClient, types
src/modules/CorporateGovernanceModule.tsx ← services/apiService, contexts/AuthContext
src/modules/CostAnalysisModule.tsx ← lib/utils, types, services/apiService
src/modules/Dashboard.tsx ← types, lib/utils, contexts/AuthContext, services/apiService
src/modules/LicenseGeneratorModule.tsx ← types, contexts/AuthContext, services/apiService
src/modules/LicenseTypesModule.tsx ← lib/utils, contexts/AuthContext, services/apiService
src/modules/NegotiationModule.tsx ← types, contexts/AuthContext, services/apiService, lib/utils
src/modules/PresalesModule.tsx ← components/CostAnalysisModule, types, SpecAnalysis, services/workflowService, contexts/AuthContext
src/modules/ProcurementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ProposalEditor.tsx ← lib/utils, types
src/modules/SecurityTestModule.tsx ← services/apiClient
src/modules/SettingsModule.tsx ← types, IntegrationWizard, WorkflowBuilder, components/settings/TenantSettings, components/settings/UnitManagement
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext
src/modules/VisitPlanModule.tsx ← lib/utils, services/apiService, contexts/AuthContext
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, documentService
src/services/workflowService.ts ← apiService, whatsappService, exchangeService, types, utils/logger
backend/src/middleware.ts ← prismaClient
backend/src/services/documentNumberService.ts ← prismaClient
backend/src/services/approvalChainService.ts ← prismaClient
backend/src/services/projectCodeService.ts ← prismaClient
```

## changes (last 10 commits — 0 seconds ago)
```
src/modules/ContractWorkflowTest.tsx          +apiFetch  +bestProposalPrice  +ContractWorkflowTest
src/modules/ProjectManagementModule.tsx       +isHandoverComplete  +kar
src/modules/SecurityTestModule.tsx            +flattenSuite  +parseResults
src/modules/VisitPlanModule.tsx               +mondayOf
src/services/apiService.ts                    ~ApiService
src/services/workflowService.ts               ~WorkflowService
backend/src/services/documentNumberService.ts +nextDocumentNumber  +previewDocumentNumber
backend/src/services/approvalChainService.ts  +ensureApprovalChain  +completeApprovalChain  +resetApprovalChain
backend/src/services/projectCodeService.ts    +nextProjectCode
backend/src/utils/businessDays.ts             +addBusinessDays  +computeSlaDueDate
backend/src/utils/fileUpload.ts               +slugify  +getUploadDir  +uploadToNextcloud
.github/copilot-instructions.md               +ensureApprovalChain  +completeApprovalChain  +resetApprovalChain  +nextProjectCode
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
h3 backend/prisma/migrations/20260616183730_add_approval_chain/migration.sql
h3 backend/prisma/migrations/20260616200836_faz2_visit_plan_daily_report_project_handover/migration.sql
h3 backend/src/middleware.ts
h3 backend/src/services/approvalChainService.ts
h3 backend/src/services/projectCodeService.ts
h3 backend/src/utils/businessDays.ts
h3 backend/src/utils/fileUpload.ts
h2 src
h3 src/components/settings/TenantSettings.tsx
h3 src/contexts/AuthContext.tsx
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

### backend/prisma/migrations/20260613000000_add_contract_workflow/migration.sql
```
TABLE ContractWorkflow
TABLE ContractWorkflowDoc
```

### backend/prisma/migrations/20260614202029_add_module_settings/migration.sql
```
TABLE new_ContractWorkflowDoc
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

### backend/prisma/migrations/20260614202051_add_tenant_module_settings/migration.sql
```
TABLE new_Tenant
```

### backend/prisma/migrations/20260616183730_add_approval_chain/migration.sql
```
TABLE ApprovalChain
TABLE ApprovalStage
INDEX ApprovalChain_entityType_entityId_idx ON ApprovalChain
```

### backend/prisma/migrations/20260616200836_faz2_visit_plan_daily_report_project_handover/migration.sql
```
TABLE VisitPlan
TABLE Visit
TABLE DailyReport
TABLE ProjectHandoverDoc
```

### backend/prisma/migrations/20260617142420_faz3_doc_coding_corporate_governance/migration.sql
```
TABLE DocumentCodingProfile
TABLE DocumentCategoryCode
TABLE DocumentSequence
TABLE LessonsLearned
TABLE RiskOpportunity
TABLE CorporateMetric
TABLE ExternalDocumentRegister
INDEX DocumentCodingProfile_tenantId_key ON DocumentCodingProfile
INDEX DocumentCategoryCode_tenantId_code_key ON DocumentCategoryCode
INDEX DocumentSequence_tenantId_categoryCode_year_key ON DocumentSequence
INDEX CorporateMetric_tenantId_name_period_key ON CorporateMetric
```

### backend/src/middleware.ts
```
export const asyncHandler  :5-7
export const requireRole  :40-48
```

### backend/src/services/documentNumberService.ts
```
export async function nextDocumentNumber  :18-57
export async function previewDocumentNumber  :63-81
```

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain  :19-42
export async function completeApprovalChain  :50-72
export async function resetApprovalChain  :75-88
```

### backend/src/services/projectCodeService.ts
```
export async function nextProjectCode  :16-28
```

### backend/src/utils/businessDays.ts
```
export function addBusinessDays  :5-22
```

### backend/src/utils/fileUpload.ts
```
export function slugify  :11-16
export function getUploadDir  :18-22
export async function uploadToNextcloud  :24-70
```

## src

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

### src/hooks/useBoM.ts
```
export const useBoM  :7-90
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

### src/components/settings/TenantSettings.tsx
```
props TenantSettingsProps
hook useState
hook useCallback
hook useEffect
export TenantSettings
handler onChange
handler onClick
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

### src/modules/LicenseGeneratorModule.tsx
```
hook useAuth
hook useState
hook useEffect
export LicenseGeneratorModule
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
