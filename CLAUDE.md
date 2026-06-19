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

## Varsayılan İş Akışı Şablonu + Skip-Logic (Faz 5, 2026-06-17)

Tüm aktif birimleri kapsayan **default iş akışı şablonu**; bir birim akıştan çıkarıldığında görevler atanmamış kalmaz, otomatik bir sonraki **aktif** birime yönlenir (deadlock olmaz) + devir öncesi uyarılar.

### Veri Modeli (migration `20260617182226_add_workflow_default_and_skip_logic`)
- `Workflow.isDefault Boolean @default(false)` — tenant başına tek varsayılan şablon.
- `WorkflowStep.enabled Boolean @default(true)` — birim "çıkarılınca" step **silinmez**, `enabled=false` olur (sıra korunur, motor atlamayı bilir).
- `WorkflowStep.requiresCompletion Boolean @default(false)` + `completionNote String?` — devretmeden önce hazırlayan birimin gereklilikleri tamamlaması gerekip gerekmediği + açıklama.

### Backend
- `backend/src/services/workflowTemplateService.ts`:
  - `DEFAULT_WORKFLOW_STEPS` — kanonik birim sırası (Satış/CRM → Presales/Teknik → Finans → İGPD → Üst Yönetim → KSU → KGD → İSAB), birim adı **anahtar kelime** eşleşmesiyle (`normalize = s => s.toLocaleLowerCase('tr-TR')`).
  - `ensureDefaultWorkflow(tenantId)` — idempotent; aktif `Unit`'leri kanonik sıraya eşler, eşleşmeyen birimleri sona generic ekler, `isDefault:true` workflow oluşturur. **Üçüncü-taraf notasyonu içermez**, tamamen tenant'ın kendi birimlerinden türer.
  - `resolveNextStep(steps, currentStepId)` → `{ nextStep, fallbackUsed, removedStepId }` — `order`'dan büyük ilk `enabled` step'i döner; `nextStepId` çıkarılmış birime işaret ediyorsa `fallbackUsed:true`.
- `backend/src/routes/workflows.ts`: `GET /default` (ensureDefaultWorkflow, **`/:id`'den ÖNCE**), `GET /:id/steps/:stepId/resolve-next`, POST/PUT yeni alanları `mapStep` ile passthrough.

### Frontend (`src/modules/WorkflowBuilder.tsx`)
- Mount'ta `getWorkflows()`; **varsa `isDefault` workflow öne çıkar** (`safeData.find(w => w.isDefault) ?? safeData[0]` — seçici UI yok), hiç workflow yoksa `getDefaultWorkflow()`. "Varsayılan Şablon" rozeti `activeWorkflow?.isDefault` ile.
- `handleToggleEnabled` (eski `handleRemoveStep` yerine) — Power butonu step'i silmez, `enabled` toggle'lar; devre dışı kart soluk/grayscale + amber "Birim akıştan çıkarıldı" notu.
- Her kartta `getNextInfo` (backend `resolveNextStep` lokal aynası) → "Sıradaki: {birim}" + fallback amber uyarısı.
- "Sonraki birime aktar" → `handoffModal`: `requiresCompletion && !simCompleted` ise "Hazırlayan birim gereklilikleri tamamlamadı" uyarısı, hedef birim, "Vazgeç"/"Aktar"/"Yine de Aktar".

### ApprovalChain Swimlane Deadlock Fix (paralel ilke)
- `backend/src/services/approvalChainService.ts` → `autoSkipOrphanStages(tenantId, chainId)`: tenant'ta **aktif kullanıcısı olmayan** role ait PENDING aşamaları `SKIPPED` işaretler; PENDING kalmazsa zinciri COMPLETED (reddedilen varsa REJECTED) yapar. Idempotent.
- `backend/src/routes/approvalChains.ts`: `pendingForRole` GET kendini iyileştirir (`autoSkipOrphanStages` çağırır sonra filtreler); approve route eski buggy `every(s=>APPROVED)` yerine `autoSkipOrphanStages` döner → SKIPPED aşamalar zinciri bloklamaz.

### Doğrulama (2026-06-17, çalışan uygulama)
- Tarayıcı (Playwright): "Varsayılan Şablon" rozeti görünür, 17 adım (16 devir + akış sonu), Power devre-dışı notu, gereklilik uyarı modalı + hedef birim — tümü ✓.
- Skip-logic API: İGPD `enabled=false` → Finans'ın `resolve-next` çözümü KSU'ya kayar (orphan/deadlock yok).
- ApprovalChain: aktif kullanıcısı olmayan 3 rollü 4-aşamalı zincir → o aşamalar SKIPPED, GM yüzeye çıkar, GM onayıyla COMPLETED.
- Tenant izolasyonu: `resolve-next` yanlış tenant → 404. RBAC regresyon süiti **69/69 geçti**.

## Finans Modülü (Faz 6a, 2026-06-17)

Eksik operasyonel birimlerden ilki: **Finans (FINANCE_MGR)** için ayrı üst-seviye `finance` sekmesi. Onay zincirinde sadece onay verebiliyordu; artık faturalama/tahsilat/teminat/maliyet-onayı operasyonu yapabiliyor. (Karma plan: Finans=yeni modül, Hukuk=Sözleşme sekmesi (Faz 6b), İhale=SalesSupport evrimi (Faz 6c).)

### Modeller (`schema.prisma`, migration `20260617203010_faz6a_finance`)
- **`Invoice`** `{ type SALES|PURCHASE, invoiceNo?, amount, currency, issueDate?, dueDate?, status DRAFT|ISSUED|SENT|PARTIAL|PAID|OVERDUE|CANCELLED, paidAmount, paidAt?, projectId?, contractId?, milestoneId?, customerName?, vendorName?, docNumber?, payments[] }`
- **`Payment`** `{ invoiceId, amount, currency, paidAt, method?, reference? }` — kısmi ödeme destekli; `Invoice.paidAmount`/`status` bunlardan **otomatik türetilir** (`recalcInvoice`).
- **`GuaranteeLetter`** `{ type BID_BOND|PERFORMANCE|ADVANCE|WARRANTY, bankName?, amount, currency, issueDate?, expiryDate?, status ACTIVE|RELEASED|EXPIRED|CALLED, refNo?, projectId?/contractId?/tenderId?, fileUrl? }` — **Faz 6c İhale `type=BID_BOND`+`tenderId` ile paylaşır**.
- **`ProjectCostItem`** += `approvalStatus PENDING|APPROVED|REJECTED @default("APPROVED")` (geriye uyumlu), `approvedById?`, `approvedAt?`, `approvalNote?`.

### Backend (`backend/src/routes/finance.ts` → `/api/finance`)
```
GET/POST/PUT/DELETE /invoices          (filtre ?projectId=&status=&type=)
GET/POST            /invoices/:id/payments   + DELETE /payments/:id  → recalcInvoice
GET/POST/PUT/DELETE /guarantees         (filtre ?status=&type=&projectId=&tenderId=)
POST                /guarantees/:id/upload    (multer + fileUpload.ts → uploads/guarantees/{slug})
GET                 /cost-approvals     (approvalStatus=PENDING proje maliyet kalemleri)
PUT                 /costs/:id/approve  ({ decision: APPROVE|REJECT, approvedById, approvalNote })
GET                 /summary            (alacak/tahsilat/vadesi-geçen/teminat/bekleyen-onay)
```
POST'lar opsiyonel `categoryCode` ile `nextDocumentNumber` → `docNumber`. `tenantMiddleware` izolasyonu (yanlış tenant → "Tenant bulunamadı").

### Frontend
- **`src/modules/FinanceModule.tsx`** (self-contained, CorporateGovernanceModule pattern'i) — 5 sekme: Faturalar, Tahsilat (aging/kısmi), Teminat Mektupları (yaklaşan/geçmiş renk kodu), Maliyet Onayı (onayla/reddet), Özet (kart metrikleri).
- `apiService.ts`'e finance metodları **inline** eklendi (ayrı financeService.ts yok — corporate-governance konvansiyonu).
- `types.ts`: `Invoice`, `Payment`, `GuaranteeLetter`, `FinanceSummary`.
- `constants.ts`: NAV_ITEMS `{ id:'finance', label:'Finans', icon: Banknote, requiredPermission:'FINANCE_VIEW' }` (Proje Yönetimi'nden sonra). GM superuser görür; FINANCE_MGR'a izin kullanıcı `permissions` JSON'undan verilir (kod-seviyesi rol→izin haritası yok).
- `App.tsx`: `case 'finance': return <FinanceModule />`.

**Doğrulama:** curl ile fatura→kısmi tahsilat→status PARTIAL, teminat→özet, tenant izolasyonu; tarayıcıda (Playwright) 5 sekme render + fatura oluşturma akışı + özet tutarlılığı (alacak=kalan bakiyeler, vadesi geçen). Tümü geçti.

## Hukuk Görünümü (Faz 6b, 2026-06-17)

İkinci operasyonel birim: **Hukuk** — ayrı modül yerine **Sözleşme Yönetimi modülüne** (`ContractWorkflowTest.tsx`) mod geçişiyle eklendi (Sözleşmeler ↔ Hukuk). Önceden sadece `TodoTask.relatedModule='LEGAL'` passthrough'u (Faz 4) vardı; artık hukuki vaka takibi + talep→vaka dönüşümü yapılabiliyor.

### Model (`schema.prisma`, migration `20260617204307_faz6b_legal`)
- **`LegalCase`** `{ type CONTRACT_REVIEW|LEGAL_OPINION|DISPUTE|LITIGATION|OTHER, title, status OPEN|IN_REVIEW|RESPONDED|ESCALATED|CLOSED, priority LOW|MEDIUM|HIGH, relatedEntityType?/relatedEntityId?, summary?, opinion?, assignedToId?/assignedToName?, requestedById?/requestedByName?, sourceTaskId? (dönüştürülen TodoTask), dueDate?, docNumber?, fileUrl?, closedAt? }` — `@@index([tenantId, status])`.

### Rol
- `constants.ts` ROLE_LABELS'a `LEGAL_MGR: 'Hukuk Müdürü / Şirket Avukatı'` eklendi.

### Backend (`backend/src/routes/legal.ts` → `/api/legal`)
```
GET/POST/PUT/DELETE /cases      (filtre ?status=&type=&relatedEntityId=); PUT status→CLOSED → closedAt set
POST                /cases/:id/upload   (multer + fileUpload.ts → uploads/legal/{slug})
GET                 /requests   (TodoTask relatedModule='LEGAL'; LegalCase.sourceTaskId set ise converted=true)
```
POST opsiyonel `categoryCode` ile `docNumber` (vars. 'HUK' → ENF-HUK-YYYY-NNNNN). `tenantMiddleware` izolasyonu.

### Frontend (`ContractWorkflowTest.tsx`)
- Modül üstüne `mode: 'contracts'|'legal'` geçiş çubuğu; `mode==='legal'` → `<LegalView />`.
- **`LegalView`** (iki alt görünüm): **Hukuki Vakalar** (liste, tip/durum/öncelik rozetleri, Kapat/Sil) + **Gelen Talepler** (LEGAL TodoTask'lar; "Vakaya Dönüştür" → `createLegalCase` sourceTaskId+categoryCode 'HUK'). **`LegalCaseForm`** modal.
- `apiService.ts`'e legal metodları **inline** (getLegalCases/createLegalCase/updateLegalCase/deleteLegalCase/getLegalRequests). `types.ts`: `LegalCase`, `LegalRequest`.
- **Stil notu:** ContractWorkflowTest tarihsel olarak koyu-tema sınıfları kullanıyor ama uygulama kabuğu **açık tema** (`:root` açık, `--foreground-glass` koyu metin). Hukuk görünümü açık-tema konvansiyonuna uyarlandı: aktif sekme `bg-primary text-white`, pasif `bg-white text-slate-500 border border-slate-100`, başlık `text-slate-900`, gövde `text-slate-600`, rozetler `bg-*-100 text-*-700`.

**Doğrulama:** curl ile LEGAL TodoTask→/requests→vakaya dönüştür (docNumber ENF-HUK-2026-00001)→kapat→tenant izolasyonu; tarayıcıda (Playwright) mod geçişi + iki sekme + talep dönüşümü + yeni vaka formu render + kontrast (ekran görüntüleriyle doğrulandı, açık-tema düzeltmesi sonrası okunur). Test verisi temizlendi.

> ✅ **Repo-geneli CSS düzeltmesi (2026-06-18):** `btn-primary`, `btn-secondary`, `input-glass` sınıfları `index.css`'te **tanımlı değildi** (sadece `glass-card`, `glass-input`, `glass-button-primary` vardı) — tüm modüllerde (CorporateGov, Finance, CRM, İhale, vb.) kullanılıyordu ama transparan arka plan + 0 padding ile render oluyordu. `src/index.css` `@layer components`'e üç sınıf eklendi: `.btn-primary` (bg-primary yeşil + beyaz metin + shadow), `.btn-secondary` (card-bg + glass-border), `.input-glass` (input-bg + backdrop-blur). Computed-style probe + ekran görüntüleriyle doğrulandı.

## İhale / İSAB Modülü (Faz 6c, 2026-06-18)

Üçüncü ve son operasyonel birim: **İhale / İSAB (ISAB_MGR)**. `src/modules/SalesSupport.tsx` mock/frontend-only (402 satır) idi; backend destekli, kendi verisini çeken (self-contained, FinanceModule/CorporateGovernance pattern'i) bir modüle **tamamen yeniden yazıldı**. Nav öğesi `sales-support` (label "Satış Destek") korundu.

### Model (`schema.prisma`, migration `20260617210532_faz6c_tender`)
- **`Tender`** `{ name, ikn? (İKN), authority? (idare), method OPEN|RESTRICTED|NEGOTIATED|DIRECT, status DRAFT|PREPARING|SUBMITTED|EVALUATING|WON|LOST|CANCELLED, submissionDeadline?, estimatedValue, currency, opportunityId?/contractWorkflowId? (bağlama), ekapRef?, ownerId?/ownerName?, docNumber?, notes? }` — `@@index([tenantId, status])`.
- **`TenderChecklistItem`** `{ tenderId, name, isRequired, status PENDING|DONE|WAIVED, fileUrl?, sortOrder, notes? }` — idari uygunluk/evrak denetimi.
- **Geçici teminat:** Faz 6a `GuaranteeLetter` (`type=BID_BOND` + `tenderId`) yeniden kullanılır — yeni model yok. Finans modülüyle paylaşımlı veri.

### Backend (`backend/src/routes/tenders.ts` → `/api/tenders`)
```
GET/POST/PUT/DELETE /                        (filtre ?status=&method=; include checklist); POST opsiyonel categoryCode → docNumber (vars. 'IHL' → ENF-IHL-YYYY-NNNNN)
GET                 /:id/checklist           (boşsa DEFAULT_CHECKLIST 10 kalem seed: 9 zorunlu + İş Deneyim opsiyonel)
POST/PUT/DELETE     /:id/checklist[/:itemId]
POST                /:id/checklist/:itemId/upload   (multer + fileUpload.ts → uploads/tenders/{slug}; Nextcloud /ENFLOW_DMS/Ihale; status→DONE)
```
`tenantMiddleware` izolasyonu (yanlış tenant → 404). DEFAULT_CHECKLIST tamamen **özgün** ihale evrak listesi (üçüncü-taraf notasyonu yok).

### Frontend (`SalesSupport.tsx`, 5 sekme — açık-tema)
1. **İhale Listesi** — Tender CRUD, durum/yöntem rozetleri, İKN/idare, deadline + kalan gün (amber ≤7 / kırmızı geçmiş), docNumber chip.
2. **İhale Takvimi** — aktif ihaleler `submissionDeadline` sıralı, SLA renk tonu.
3. **Uygunluk Denetimi** — seçili ihalenin checklist'i (auto-seed), zorunlu sayaç + progress bar, Tamam/Muaf/Geri Al, FormData ile dosya yükleme (apiClient değil — manuel `x-tenant-id`+`Authorization` header).
4. **Teminat** — seçili ihalenin `getGuarantees({tenderId, type:'BID_BOND'})` listesi + `createGuarantee` (Finans ile paylaşımlı).
5. **EKAP** — Faz 4 iskeleti; manuel İKN öneki yer tutucu (kalıcılık yok).
- `apiService.ts`'e tender metodları **inline** (getTenders/getTender/createTender/updateTender/deleteTender + checklist CRUD). `types.ts`: `Tender`, `TenderChecklistItem`. `App.tsx` `case 'sales-support'` `opportunities` prop'u (opsiyonel) korundu.

**Doğrulama:** curl ile tender create (docNumber ENF-IHL-2026-00001) + 10-kalem checklist auto-seed + DONE update + BID_BOND teminat bağlama/paylaşım + tenant izolasyonu (404). Tarayıcıda (Playwright) İSAB modülü 5 sekme render + ihale oluşturma (ENF-IHL-2026-00002) + checklist auto-seed (0/9 zorunlu) + kalem DONE + Teminat/EKAP sekmeleri — ekran görüntüleriyle açık-tema doğrulandı. Test verisi temizlendi.

## Yönetim Raporlama Sistemi (Faz 7, 2026-06-18)

Her operasyonel birimin (CRM/Satış, Presales, Satınalma, Finans, Hukuk, İhale/İSAB, Proje Yönetimi) dönemsel performansını mevcut veriden otomatik hesaplayıp yönetime sunan konsolide raporlama katmanı. **Hibrit model** (sistem metrikleri otomatik üretir, birim yöneticisi Faz 3'te yorum ekleyip sunar), **esnek dönem** (serbest başlangıç–bitiş), **yeni üst-seviye `management-reports` sekmesi**. Plan: `~/.claude/plans/flickering-toasting-leaf.md`.

### Faz 1 — Birim Metrik Servisi + Endpoint'ler (backend)
- **`backend/src/services/unitReportingService.ts`** (yeni):
  - `UNIT_DEFINITIONS` — `{ key, label, role }`: CRM→SALES_MANAGER, PRESALES, PROCUREMENT, FINANCE→FINANCE_MGR, LEGAL→LEGAL_MGR, TENDER→ISAB_MGR, PROJECT→PROJECT_MANAGER.
  - `computeUnitMetrics(tenantId, unitKey, start?, end?)` → `{ unitKey, label, role, period, metrics: Metric[], charts: ChartSeries[] }`. Her birim için `[start,end]` aralığında agregasyon. Tarih verilmezse **varsayılan = içinde bulunulan ay** (`resolvePeriod`). `Metric { label, value, unit?, hint?, tone? }`, `ChartSeries { title, type: bar|pie|line, data:[{name,value}] }`.
  - `computeWorkflowBottlenecks(tenantId)` → açık `ApprovalChain`'lerin **sırası gelmiş ilk PENDING aşamasını** role göre grupla → `{ role, pendingCount, oldestWaitingDays }[]` (sistemin ayırt edici değeri — iş akışı hangi birimde bekliyor).
  - `computeOverview(tenantId, start?, end?)` → `{ period, units: [{...headline: ilk 3 metrik, charts}], bottlenecks }`.
  - Finans metrikleri `finance.ts /summary`, proje metrikleri `projects.ts /summary/all` mantığı genelleştirilerek türetildi.
- **`backend/src/routes/reports.ts`** (yeni) → `/api/reports`, `tenantMiddleware` izolasyonu:
  ```
  GET /units                              → UNIT_DEFINITIONS
  GET /unit-metrics?unitKey=&start=&end=  → tek birim (400 unitKey yoksa, 404 bilinmeyen birim)
  GET /bottlenecks                        → iş akışı darboğazı
  GET /overview?start=&end=               → konsolide
  ```
  `index.ts`'e `app.use('/api/reports', reportsRouter)` (tenders'tan sonra).
- **Doğrulama:** curl ile 7 birimin metrikleri tenant-1 verisiyle (CRM 6 açılan/3 kazanılan/33.33% oran, Presales 102 teklif, Finans 31.000₺ alacak/6.000₺ vadesi geçen); tenant izolasyonu (yanlış tenant→404, header yok→400, bilinmeyen unitKey→404); tarih aralığı filtresi (2020→0). ✓

### Faz 2 — Yönetim Dashboard'u (frontend, konsolide read-only)
- **`src/modules/ManagementReportingModule.tsx`** (yeni, self-contained, açık tema; FinanceModule pattern'i): üstte tarih aralığı seçici (vars. bu ay) + Yenile; 2 sekme:
  - **Genel Bakış** — `BottleneckPanel` (amber border-l-4, rol bazlı bekleyen sayısı + en eski gün) + her birimin başlık metrik kartları.
  - **Birim Detayı** — birim seçici butonları → seçili birimin tüm metrik kartları + recharts grafikleri (`bar`/`pie`/`line`, `ChartBlock` jenerik renderer, `PIE_COLORS` paleti). Metrik `tone` → renk (positive=emerald, warning=amber, danger=red).
  - `MetricCard` etiketleri `uppercase` CSS sınıfı kullanır (Playwright `innerText` bunu büyük harf döner — test asserti büyük harfe göre yapılmalı).
- **Entegrasyon:** `apiService.ts` inline `getReportUnits/getReportOverview/getUnitMetrics/getWorkflowBottlenecks`; `types.ts` `ReportMetric/ReportChartSeries/UnitMetrics/WorkflowBottleneck/OverviewUnit/ReportOverview/UnitDefinition`; `constants.ts` NAV_ITEMS `{ id:'management-reports', label:'Yönetim Raporları', icon: BarChart3, requiredPermission:'MANAGEMENT_REPORTS_VIEW' }` (Dashboard'dan sonra; GM superuser görür); `App.tsx` `case 'management-reports'`.
- **Doğrulama:** Tarayıcıda (Playwright) nav görünür, Genel Bakış (darboğaz paneli + 7 birim kartları), Birim Detayı (CRM metrik gridi + bar "Fırsat Sonuçları" + pie "Kayıp Nedenleri", birim geçişi Finans), tarih aralığı değişimi — ekran görüntüleriyle açık-tema, page-error yok. ✓

### Faz 3 (tamamlandı 2026-06-18) — UnitReport: yönetici-yazımı + gönderim/inceleme akışı
- **Model** (`schema.prisma`, migration `20260618080234_faz7_unit_report`): `UnitReport { unitKey, unitLabel, periodStart/End DateTime, periodLabel?, status DRAFT|SUBMITTED|REVIEWED|RETURNED, authorId?/authorName?, metricsSnapshot? (gönderim anı computeUnitMetrics JSON), highlights/issues/plannedActions/risks/summary?, submittedAt?, reviewedById?/reviewedByName?/reviewedAt?/reviewNote?, docNumber? }`, `@@index([tenantId, unitKey])` + `@@index([tenantId, status])`; `Tenant.unitReports` back-relation. **Migration sonrası `npx prisma generate` zorunlu** (backend dizininde).
- **`reports.ts` genişletme:** `GET /unit-reports?unitKey=&status=`, `GET /unit-reports/:id` (404), `POST /unit-reports` (400 bad unitKey/eksik period; opsiyonel `categoryCode` → docNumber; unitLabel def'ten), `PUT /unit-reports/:id` (sadece DRAFT/RETURNED, aksi 409), `DELETE`, `POST /:id/submit` (computeUnitMetrics → metricsSnapshot JSON, status→SUBMITTED), `POST /:id/review` ({decision APPROVE|RETURN, reviewedById/Name, reviewNote} → REVIEWED|RETURNED; sadece SUBMITTED).
- **Frontend (`ManagementReportingModule.tsx`):** 2 yeni sekme — **Raporlarım** (`ReportForm` modal: birim+dönem seç → salt-okunur "Otomatik Metrikler" ön-izleme `getUnitMetrics` ile döneme göre, 5 narrative textarea, Kaydet/Düzenle, kart üzerinden Sun/Sil; DRAFT/RETURNED dışı kilitli) ve **Gelen Raporlar** (GM-only, `incoming.length` rozeti; `IncomingReportCard` genişleyince metricsSnapshot + narrative + İade Et/Onayla + not). `apiService` inline `getUnitReports/getUnitReport/createUnitReport/updateUnitReport/deleteUnitReport/submitUnitReport/reviewUnitReport`; `types.ts` `UnitReport`.
- **Doğrulama:** curl tam yaşam döngüsü — DRAFT→SUBMITTED (7-metrik snapshot)→PUT 409→RETURN (editable yeniden 200)→APPROVE; docNumber ENF-RPR-2026-0000X; tenant izolasyonu 404. Tarayıcıda (Playwright) Raporlarım→Yeni Rapor→ön-dolu metrik→narrative→Kaydet→Sun→Gelen Raporlar→genişlet (snapshot Açılan 6/Kazanım 33.33%/Kaybedilen Değer 1.935.400₺ + Öne Çıkanlar)→Onayla→listeden düşer; page-error yok, RBAC süiti 69/69. Test verisi temizlendi.

### Faz 4 (planlanan) — Çıktı + dönem karşılaştırma
- Tek UnitReport + konsolide `window.print()` HTML çıktısı; dönem-delta (↑/↓); docNumber categoryCode 'RPR' → ENF-RPR-YYYY-NNNNN.

## Sanal Agent Eklentileri (Faz 8, 2026-06-18)

Boş birim koltuğunu dolduran **sanal agent** altyapısı. İhtiyaç: bir birimde personel yoksa, iş akışının o birimin işini yapacak birine ihtiyacı var; sanal agent gereken çıktıyı üretip **gerçek kişiye devreder** (handoff) ki akış sağlıklı devam etsin. Kullanıcı kararları: (1) **önce test modülü**, (2) **ticari sürüm DIŞINDA eklenti/plugin** — ayrı satılabilir upsell, (3) **her rol için altyapı şimdiden hazır**, (4) **onay mekanizmasının içinde ayrı lisansla** devreye alınır. Varsayılan mod: **Danışman/Taslak (ADVISORY)** — çıktı insan ratifikasyonu bekler. Pilot agentlar: İhale/İSAB + Proje Yönetimi.

### Faz 8.0 — Plugin/Entitlement altyapısı (migration `20260618095753_faz8_plugin_entitlement_agent_run`)
- **Modeller:** `PluginEntitlement { tenantId, pluginKey, status DISABLED|ACTIVE|TRIAL|EXPIRED, licenseKey?, mode ADVISORY|AUTONOMOUS, config?, activatedById?/At?, expiresAt?, @@unique([tenantId,pluginKey]) }` (eklenti-bazlı lisans kapısı, çekirdek `Subscription`'dan bağımsız), `AgentRun { pluginKey, unitKey, entityType, entityId, mode, status PENDING_RATIFICATION|RATIFIED|REJECTED, rationale?, outputJson?, triggeredById?, handoffTaskId?, ratifiedById?/At?, ratifyNote? }`. `Tenant`'a `pluginEntitlements`/`agentRuns` back-relation.
- **`backend/src/services/pluginCatalog.ts`** — KOD-SEVİYESİ katalog (UNIT_DEFINITIONS gibi). `PLUGIN_CATALOG` 7 agent: AGENT_TENDER (ISAB_MGR, AVAILABLE), AGENT_PROJECT (PROJECT_MANAGER, AVAILABLE), AGENT_FINANCE/AGENT_LEGAL (COMING_SOON, **`allowedModes:['ADVISORY']` — para/hukuk asla otonom değil**), AGENT_CRM/PRESALES/PROCUREMENT (COMING_SOON). `getPlugin(key)`, `getAgentPluginForRole(role)`.
- **`backend/src/services/entitlementService.ts`** — `isPluginEntitled(tenantId,pluginKey)` (tek lisans doğruluk kaynağı: ACTIVE/TRIAL + süresi geçmemiş), `listEntitlementsWithCatalog`, `activatePluginLicense`, `updateEntitlement` (mode `allowedModes`'a karşı doğrulanır), `parseLicenseKey`. **Lisans anahtarı formatı: `ENF-PLUGIN-<PLUGINKEY>[-<gün>]`** örn. `ENF-PLUGIN-AGENT_TENDER-365`.
- **`backend/src/services/virtualAgentService.ts`** — `HANDLERS` registry (deterministik, LLM gerekmez): `tenderHandler` (checklist eksiksizliği + deadline riski), `projectHandler` (devir paketi eksik evrak + geciken milestone). `runAgent` lisans kapısını geçer → handler çalışır → **handoff TodoTask** (`assignedBy:'VIRTUAL_AGENT'`, priority HIGH) + `AgentRun` (ADVISORY→PENDING_RATIFICATION, AUTONOMOUS→auto-RATIFIED) + `ActivityLog`. `ratifyAgentRun` (gerçek kişi devralır).
- **Route `backend/src/routes/plugins.ts` → `/api/plugins`:** `GET /catalog` (hasHandler flag ekler), `GET /entitlements`, `POST /activate`, `PUT/DELETE /entitlements/:pluginKey`, `POST /agents/:pluginKey/run` (**lisans yoksa 402 — upsell sinyali**), `GET /runs`, `POST /runs/:id/ratify` (409 if not pending). `tenantMiddleware` izolasyonu.
- **Frontend:** `src/modules/VirtualAgentsTestModule.tsx` (self-contained, açık tema, GM-only) — 2 sekme: **Eklenti Kataloğu** (lisans aktivasyonu + 7 plugin kartı, aktif olanlarda mod toggle Danışman/Otonom + `allowedModes` dışı mod disabled + devre dışı) ve **Çalıştırmalar** (agent çalıştır formu + run kartları rationale/çıktı + Onayla&Devral/Reddet). `apiService` inline plugin metodları; `types.ts` `PluginDefinition/PluginEntitlement/EntitlementWithCatalog/AgentRun`. **Sidebar Test Ortamı'na `virtual-agents-test`** (GM-only, amber TEST rozeti, `Bot` ikonu); `App.tsx case 'virtual-agents-test'`.
  - ⚠️ **Not:** `/entitlements` endpoint'inin döndürdüğü `plugin` objesi `hasHandler` taşımaz (sadece `/catalog` ekler); UI'da "çalıştırılabilir eklenti" filtresi `plugin.status === 'AVAILABLE'` ile çözülür (handler-hazır küme = AVAILABLE).

### Faz 8.1 — Lisans Anahtarı Üretimi + Aktivasyon (2026-06-18)
Eklenti aktivasyonu (anahtar parse + entitlement upsert) zaten vardı; bu adımda **anahtar ÜRETİMİ** (satıcı/yönetici konsolu) ve **imza doğrulaması** eklendi.
- **`entitlementService.ts`:** `generateLicenseKey(pluginKey, days?)` (parse'ın tersi) + `signaturePart()` (HMAC-SHA256, sır `process.env.PLUGIN_LICENSE_SECRET` ya da geliştirme sabiti, ilk 10 hex). **İmzalı format:** `ENF-PLUGIN-<PLUGINKEY>[-D<gün>]-<İMZA>` (örn. `ENF-PLUGIN-AGENT_TENDER-D365-E57903F928`); gün atlanırsa süresiz. `parseLicenseKey` yeniden yazıldı: imzalı + **eski imzasız** (`ENF-PLUGIN-AGENT_TENDER-365`) formatı **geriye uyumlu** parse eder, `{ pluginKey, days, signed, valid }` döner. `activatePluginLicense` → `signed && !valid` ise "Lisans imzası doğrulanamadı" reddi; imzasız anahtarlar (legacy) kabul edilmeye devam eder.
- **Route:** `POST /api/plugins/generate-key` — **`requireRole(['GENERAL_MANAGER'])`** (tek GM-korumalı plugin endpoint'i; gerisi tenantMiddleware). Body `{ pluginKey, days? }` → `{ ok, licenseKey, pluginKey, days }`. 400 bad/eksik pluginKey, 401 auth yok, 403 non-GM.
- **Frontend:** `apiService.generatePluginLicenseKey(pluginKey, days?)`; `VirtualAgentsTestModule` katalog sekmesine **"Lisans Anahtarı Üret"** kartı (GM Only rozeti, eklenti seçici + gün input + Üret → koyu kod bloğunda anahtar + Kopyala + "Aktivasyona aktar" → mevcut aktivasyon input'unu doldurur). Aktivasyon kartı zaten vardı.
- **Doğrulama:** curl — üret(365)→imzalı anahtar, süresiz(gün yok)→D segmentsiz, activate→ok, **tampered imza→reddi, tampered gün→imza uyuşmazlığı reddi, legacy imzasız→hâlâ çalışır**, no-auth→401, bad plugin→400, eksik field→400, non-GM(SALES_REP)→403. Tarayıcıda (Playwright) üret→"Aktivasyona aktar"→Etkinleştir→AKTİF rozeti, page-error yok. Test verisi temizlendi.

### Faz 8.2 — ApprovalChain orphan-stage sanal agent dalı
- `approvalChainService.ts` `autoSkipOrphanStages` genişletildi: aktif kullanıcısı olmayan (boş koltuk) PENDING aşama için `getAgentPluginForRole(role)` lisanslı **ve OTONOM** ise aşama SKIPPED yerine **APPROVED** (`approverId:'VIRTUAL_AGENT'`, "Boş koltuk — sanal agent (otonom) onayladı") olur; agent yoksa veya ADVISORY ise eski skip davranışı (deadlock önleme) korunur.

**Doğrulama:** curl tam yaşam döngüsü — lisanssız run→**402**, activate→ACTIVE, run→PENDING_RATIFICATION (9/9 eksik checklist rationale) + handoff TodoTask + ActivityLog, ratify→RATIFIED, re-ratify→409, tenant izolasyonu→404, bad decision→400, AUTONOMOUS→auto-RATIFIED, **AGENT_FINANCE AUTONOMOUS reddi→400** (para asla otonom). Faz 8.2: lisanssız→2 SKIPPED/COMPLETED, otonom AGENT_TENDER→ISAB_MGR APPROVED-by-agent + KSU_MGR SKIPPED, ADVISORY→SKIPPED (auto-approve yok). Tarayıcıda (Playwright) sidebar girişi + katalog 7 kart + UI'dan lisans aktivasyonu (Aktif rozet) + agent çalıştırma + run kartı rationale + Onayla&Devral→Onaylandı; ekran görüntüsüyle açık-tema doğrulandı. RBAC süiti **69/69** (yeni GM-only modül sızıntı yok). Tüm test verisi temizlendi.

### Faz 8.3 — Agent Köken Etiketi (Provenance, 2026-06-18)

İhtiyaç: "bu işlem XXX agentı tarafından yapılmıştır" etiketi — bir sonraki adım işlemin hangi agent tarafından yapıldığını **BİLİR, GÖRÜR ve KONTROL EDER**. Kullanıcı kararı: **tam sistem** (kanonik etiket + drill-down + insan kontrolü).

#### Kanonik aktör etiketi
- **Backend `agentProvenance.ts`** + **frontend `src/lib/agentProvenance.ts`** (ayna): biçim **`AGENT:<pluginKey>`** (örn. `AGENT:AGENT_TENDER`). Helper'lar: `agentActorId`, `isAgentActor`, `parseAgentActor`, `actorType`, `agentDisplayLabel`. Legacy düz `'VIRTUAL_AGENT'` geriye uyumlu tanınır (pluginKey null).
- Tüm çıplak `'VIRTUAL_AGENT'` string'leri kanonik `agentActorId(pluginKey)` ile değiştirildi: `virtualAgentService.ts` (task `assignedBy`, run `ratifiedById`, ActivityLog), `approvalChainService.ts` (orphan-stage approverId), `VirtualAgentsTestModule.tsx` (display `isAgentActor`).

#### Model (migration `20260618171646_faz8_3_agent_provenance`)
- `ActivityLog` += `actorType String?` (HUMAN|AGENT) + `agentRunId String?`
- `ApprovalStage` += `agentRunId String?` (aşamayı onaylayan run)
- `TodoTask` += `agentRunId String?` (görevi üreten run)

#### Davranış
- `runAgent`: **önce AgentRun oluşturur** (köken kaydı), sonra handoff TodoTask'ı `agentRunId` ile bağlar (assignedBy=`AGENT:<key>`), ActivityLog `actorType:'AGENT'` + `agentRunId`. Dönen run nesnesi `handoffTaskId` güncel.
- `autoSkipOrphanStages` (otonom dal): boş koltuğu dolduran her agent-onaylı aşama için **ayrı bir AgentRun (RATIFIED, entityType=APPROVAL_STAGE)** oluşturur, aşamayı `agentRunId` + `approverId:'AGENT:<key>'` ile damgalar, `APPROVAL_STAGE_APPROVE` ActivityLog (actorType=AGENT) yazar. ADVISORY/agent-yok → eski SKIPPED davranışı korunur (deadlock önleme).
- Yeni endpoint: `GET /api/plugins/runs/:id` — köken etiketi drill-down (badge → detay).

#### Frontend
- **`src/components/AgentTag.tsx`** (yeniden kullanılabilir): "🤖 {agent adı} tarafından yapıldı" rozeti; tıklanınca AgentRun detay popover'ı (mod/durum rozetleri + gerekçe + çıktı tablosu + opsiyonel `onContest` insan-itirazı). Lazy fetch `getAgentRun`.
- Bağlandığı yerler: **TodoModule** onay zinciri swimlane (önceki aşamalardan agent-onaylı olanlar rol etiketiyle gösterilir — sonraki onaylayan görür) + görev kartları (`isAgentActor(assignedBy)`). `apiService.getAgentRun(id)`; `types.ts` `ApprovalStage.agentRunId?`, `TodoTask.agentRunId?`.

**Doğrulama:** curl — run→task `assignedBy=AGENT:AGENT_TENDER`+`agentRunId`, ActivityLog `actorType=AGENT`, drill-down `GET /runs/:id`, tenant izolasyonu 404; otonom orphan-stage→ISAB_MGR `APPROVED by AGENT:AGENT_TENDER`+`agentRunId`, ayrı AgentRun RATIFIED, `APPROVAL_STAGE_APPROVE` log. Tarayıcıda (Playwright) swimlane'de "ISAB_MGR aşaması: 🤖 Sanal İhale Asistanı tarafından yapıldı" rozeti + tıkla→popover (OTONOM/ONAYLANDI + gerekçe + çıktı) açık-tema, page-error yok. RBAC **69/69**. Test verisi temizlendi.

> ⚠️ **Not (kontrol katmanı):** Sonraki onaylayan (GM) agent-onaylı önceki aşamayı görür ve kendi aşamasında zinciri **Reddet** ile kontrol edebilir; `AgentTag.onContest` prop'u ileride varlık-bazlı per-aşama geri-al için hazır (şu an swimlane'de Reddet butonu yeterli olduğundan ayrı bağlanmadı).

### Faz 8.4 — Presales / Satınalma / Finans Agent Handler'ları (2026-06-18)

Üç `COMING_SOON` yer tutucu agent, önceki agentların (tender/project) **aynı deterministik kural seti ve mantığıyla** çalışır handler'a dönüştürüldü. Şema/route değişmedi — yalnızca `pluginCatalog.ts` statü + `virtualAgentService.ts` handler eklendi. Hiçbiri LLM gerektirmez; mevcut veriden tutarlılık/risk denetimi türetir, handoff `TodoTask` + `AgentRun` (köken etiketli, Faz 8.3) üretir.

- **`pluginCatalog.ts`:** `AGENT_PRESALES`, `AGENT_PROCUREMENT`, `AGENT_FINANCE` → `status: 'AVAILABLE'`. **`AGENT_FINANCE` `allowedModes: ['ADVISORY']` korunur** (para asla otonom). `AGENT_LEGAL` + `AGENT_CRM` hâlâ `COMING_SOON`.
- **`virtualAgentService.ts` `HANDLERS`:**
  - **`presalesHandler`** (entityType PROPOSAL) — teklifin `opportunityId`'sinden BoM + CostItem çeker; tutarsızlık listesi (boş BoM / satış fiyatı yok / alış maliyeti 0 / marj %10 altı), ortalama marj, ek maliyet toplamı; `consistent` flag. Çıktı `{ proposalVersion, bomCount, avgMargin, additionalCostItems, additionalCostTotal, issues, consistent }`.
  - **`procurementHandler`** (entityType PURCHASE_REQUEST) — PR'ı items+quotes ile çeker; tutarsızlık (kalem yok / tahmini fiyat yok / teklif yok); **en ucuz teklifi öner** (`totalAmountTRY ?? totalAmount`), `neededBy` deadline riski (OVERDUE / WARNING ≤7 gün / NONE). Çıktı `{ recommendedVendor, recommendedAmount, alreadySelected, neededRisk, issues }`.
  - **`financeHandler`** (entityType PROJECT_COST, **ADVISORY-only**) — `ProjectCostItem`'ı `project` relation üzerinden tenant-scope çeker; `FINANCE_AUTO_APPROVE_THRESHOLD_TRY = 50000`; öneri `NO_ACTION` (PENDING değilse) / `APPROVE_SUGGESTED` (≤eşik) / `REVIEW_NEEDED` (>eşik). Çıktı `{ description, category, amountTRY, threshold, currentStatus, recommendation }`.

**Doğrulama:** curl — Presales 20 BoM/2 tutarsızlık/ort. marj %15; Procurement en ucuz "Beta Teknoloji" (91.000 ₺) + WARNING deadline; Finans LOW(12.000)→APPROVE_SUGGESTED, HIGH(120.000)→REVIEW_NEEDED; `AGENT_FINANCE` AUTONOMOUS→**400** (para asla otonom); tenant izolasyonu→404; 3 handoff TodoTask `assignedBy=AGENT:<key>`+`agentRunId` (Faz 8.3 köken). Tarayıcıda (Playwright) katalogda 3 agent render, 0 page-error. RBAC **69/69**. Tüm test verisi temizlendi.

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
- [x] Tüm birimleri kapsayan varsayılan iş akışı şablonu + skip-logic + devir uyarıları + ApprovalChain deadlock fix (Faz 5)
- [x] Finans operasyonel modülü — fatura/tahsilat/teminat/maliyet onayı (Faz 6a)
- [x] Hukuk görünümü — Sözleşme Yönetimi modülüne sekme + LegalCase modeli (Faz 6b)
- [x] İhale/İSAB — SalesSupport'un backend destekli Tender modülüne evriltilmesi (Faz 6c)
- [x] Yönetim Raporlama — birim metrik servisi + konsolide dashboard + iş akışı darboğazı (Faz 7.1 + 7.2)
- [x] Yönetim Raporlama — UnitReport yönetici-yazımı/gönderim/inceleme akışı (Faz 7.3)
- [ ] Yönetim Raporlama — UnitReport + konsolide PDF/yazdırma çıktısı + dönem karşılaştırma (Faz 7.4)
- [x] Sanal Agent eklenti/lisans altyapısı (PluginEntitlement/AgentRun) + GM-only test modülü + ApprovalChain orphan-stage agent dalı (Faz 8.0 + 8.2 — ticari sürüm dışı upsell, ADVISORY varsayılan)
- [x] Sanal Agent lisans anahtarı üretimi (imzalı, GM-only `/generate-key`) + aktivasyon UI'si (Faz 8.1)
- [x] Sanal Agent köken etiketi (provenance) — `AGENT:<pluginKey>` kanonik etiket + AgentRun/ActivityLog/ApprovalStage/TodoTask bağı + AgentTag rozeti/drill-down (Faz 8.3)
- [x] Sanal Agent — Presales/Procurement/Finance handler'ları (önceki agent kural setiyle aynı; Finans ADVISORY-only) (Faz 8.4)
- [ ] Sanal Agent — kalan handler'lar (CRM/Hukuk) + İGPD danışman çıktıları (Faz 8.x)
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
src/layout/Sidebar.tsx ← lib/utils, contexts/UnsavedChangesContext, constants, contexts/AuthContext
src/modules/CRMModule.tsx ← lib/utils, types, ProposalEditor, NegotiationModule, components/HandOffModal
src/modules/ContractWorkflowTest.tsx ← services/apiClient, services/apiService, types
src/modules/CorporateGovernanceModule.tsx ← services/apiService, contexts/AuthContext
src/modules/IntegrationWizard.tsx ← constants, types, services/nextcloudService, services/exchangeService, services/whatsappService
src/modules/FinanceModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/ManagementReportingModule.tsx ← services/apiService, contexts/AuthContext, constants, types
src/modules/PresalesModule.tsx ← components/CostAnalysisModule, types, SpecAnalysis, services/workflowService, contexts/AuthContext
src/modules/ProjectManagementModule.tsx ← services/apiService, contexts/AuthContext, types
src/modules/SalesSupport.tsx ← services/apiService, contexts/AuthContext, types
src/modules/TodoModule.tsx ← types, services/apiService, contexts/AuthContext, components/AgentTag, lib/agentProvenance
src/modules/VirtualAgentsTestModule.tsx ← services/apiService, contexts/AuthContext, types, lib/agentProvenance
src/modules/VisitPlanModule.tsx ← lib/utils, services/apiService, contexts/AuthContext
src/modules/WorkflowBuilder.tsx ← utils/logger, lib/utils, types, services/apiService, contexts/UnsavedChangesContext
src/services/apiService.ts ← apiClient, crmService, projectService, taskService, documentService
src/services/workflowService.ts ← apiService, whatsappService, exchangeService, types, utils/logger
backend/src/services/approvalChainService.ts ← prismaClient, pluginCatalog, agentProvenance
backend/src/services/documentNumberService.ts ← prismaClient
backend/src/services/agentProvenance.ts ← pluginCatalog
backend/src/services/entitlementService.ts ← prismaClient, pluginCatalog
backend/src/services/projectCodeService.ts ← prismaClient
backend/src/services/virtualAgentService.ts ← prismaClient, entitlementService, pluginCatalog, agentProvenance
backend/src/services/unitReportingService.ts ← prismaClient
backend/src/services/workflowTemplateService.ts ← prismaClient
```

## changes (last 10 commits — 0 seconds ago)
```
src/lib/agentProvenance.ts                    +isAgentActor  +parseAgentActor  +agentDisplayLabel
src/modules/ContractWorkflowTest.tsx          +LegalView  +LegalCaseForm  ~bestProposalPrice  ~ContractWorkflowTest
src/modules/ManagementReportingModule.tsx     +fmtValue  +MetricCard  +ChartBlock  +BottleneckPanel
src/modules/ProjectManagementModule.tsx       +isHandoverComplete
src/modules/SalesSupport.tsx                  +TenderList  +TenderCalendar  +ChecklistTab  +GuaranteesTab
src/modules/VisitPlanModule.tsx               +mondayOf
src/services/apiService.ts                    ~ApiService
src/services/workflowService.ts               ~WorkflowService
backend/src/services/approvalChainService.ts  +ensureApprovalChain  +completeApprovalChain  +autoSkipOrphanStages  +resetApprovalChain
backend/src/services/documentNumberService.ts +nextDocumentNumber  +previewDocumentNumber
backend/src/services/agentProvenance.ts       +agentActorId  +isAgentActor  +parseAgentActor  +actorType
backend/src/services/entitlementService.ts    +signaturePart  +generateLicenseKey  +isPluginEntitled  +listEntitlementsWithCatalog
backend/src/services/projectCodeService.ts    +nextProjectCode
backend/src/services/pluginCatalog.ts         +getPlugin  +getAgentPluginForRole
backend/src/services/virtualAgentService.ts   +hasHandler  +runAgent  +ratifyAgentRun
backend/src/services/unitReportingService.ts  +getUnitDefinition  +resolvePeriod  +crmMetrics  +presalesMetrics
backend/src/services/workflowTemplateService.ts +ensureDefaultWorkflow  +resolveNextStep
backend/src/utils/businessDays.ts             +addBusinessDays  +computeSlaDueDate
backend/src/utils/fileUpload.ts               +slugify  +getUploadDir  +uploadToNextcloud
.github/copilot-instructions.md               +nextDocumentNumber  +previewDocumentNumber  +ensureApprovalChain  +completeApprovalChain
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
h3 backend/prisma/migrations/20260613000000_add_contract_workflow/migration.sql
h3 backend/pnpm-lock.yaml
h3 backend/src/middleware.ts
h3 backend/prisma/migrations/20260614202029_add_module_settings/migration.sql
h3 backend/prisma/migrations/20260614202051_add_tenant_module_settings/migration.sql
h3 backend/prisma/migrations/migration_lock.toml
h3 backend/prisma/migrations/20260615143052_add_project_milestones_and_costs/migration.sql
h3 backend/prisma/migrations/20260615121855_add_procurement_module/migration.sql
h3 backend/prisma/migrations/20260616200836_faz2_visit_plan_daily_report_project_handover/migration.sql
h3 backend/prisma/migrations/20260616183730_add_approval_chain/migration.sql
h3 backend/prisma/migrations/20260617142420_faz3_doc_coding_corporate_governance/migration.sql
h3 backend/src/services/documentNumberService.ts
h3 backend/src/services/approvalChainService.ts
h3 backend/src/services/projectCodeService.ts
h3 backend/src/utils/businessDays.ts
h3 backend/src/utils/fileUpload.ts
h2 src
```

## backend

### backend/prisma/migrations/20260616183730_add_approval_chain/migration.sql
```
TABLE ApprovalChain
TABLE ApprovalStage
INDEX ApprovalChain_entityType_entityId_idx ON ApprovalChain
```

### backend/prisma/migrations/20260617182226_add_workflow_default_and_skip_logic/migration.sql
```
TABLE new_Workflow
TABLE new_WorkflowStep
```

### backend/prisma/migrations/20260616200836_faz2_visit_plan_daily_report_project_handover/migration.sql
```
TABLE VisitPlan
TABLE Visit
TABLE DailyReport
TABLE ProjectHandoverDoc
```

### backend/prisma/migrations/20260617203010_faz6a_finance/migration.sql
```
TABLE Invoice
TABLE Payment
TABLE GuaranteeLetter
TABLE new_ProjectCostItem
INDEX Invoice_tenantId_status_idx ON Invoice
INDEX Payment_tenantId_idx ON Payment
INDEX GuaranteeLetter_tenantId_status_idx ON GuaranteeLetter
```

### backend/prisma/migrations/20260617204307_faz6b_legal/migration.sql
```
TABLE LegalCase
INDEX LegalCase_tenantId_status_idx ON LegalCase
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

### backend/prisma/migrations/20260618080234_faz7_unit_report/migration.sql
```
TABLE UnitReport
INDEX UnitReport_tenantId_unitKey_idx ON UnitReport
INDEX UnitReport_tenantId_status_idx ON UnitReport
```

### backend/prisma/migrations/20260617210532_faz6c_tender/migration.sql
```
TABLE Tender
TABLE TenderChecklistItem
INDEX Tender_tenantId_status_idx ON Tender
INDEX TenderChecklistItem_tenderId_idx ON TenderChecklistItem
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

### backend/src/services/approvalChainService.ts
```
export async function ensureApprovalChain  :21-44
export async function completeApprovalChain  :52-74
export async function autoSkipOrphanStages  :84-194
export async function resetApprovalChain  :197-210
```

### backend/src/services/documentNumberService.ts
```
export async function nextDocumentNumber  :18-57
export async function previewDocumentNumber  :63-81
```

### backend/src/services/agentProvenance.ts
```
export function agentActorId  :17-19
export function isAgentActor  :22-25
export function parseAgentActor  :28-28
export function actorType  :40-42
export function agentDisplayLabel  :45-52
```

### backend/src/services/entitlementService.ts
```
export function generateLicenseKey  :26-26
export async function isPluginEntitled  :43-51
export async function listEntitlementsWithCatalog  :54-70
export async function activatePluginLicense  :78-82
export async function updateEntitlement  :118-122
```

### backend/src/services/projectCodeService.ts
```
export async function nextProjectCode  :16-28
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
export function getPlugin  :131-133
export function getAgentPluginForRole  :137-141
```

### backend/src/services/virtualAgentService.ts
```
export interface AgentOutput  :13-18
rationale: string  :14-14
output: Record<string, unknown>  :15-15
taskTitle: string  :17-17
export function hasHandler  :284-286
export async function runAgent  :292-297
export async function ratifyAgentRun  :379-385
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

### backend/src/services/workflowTemplateService.ts
```
export async function ensureDefaultWorkflow  :92-150
export function resolveNextStep  :160-164
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

### src/index.css
```
var --background
var --foreground
var --primary
var --primary-foreground
var --glass-bg
var --glass-border
var --sidebar-bg
var --header-bg
var --card-bg
var --input-bg
var --foreground-glass
```

### src/layout/Sidebar.tsx
```
hook useUnsavedChanges
hook useAuth
hook useState
export Sidebar
handler onClick
```

### src/lib/agentProvenance.ts
```
export function isAgentActor  :19-22
export function parseAgentActor  :24-24
export function agentDisplayLabel  :34-41
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

### src/modules/ContractWorkflowTest.tsx
```
component ContractWorkflowTest
component LegalView
component LegalCaseForm
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

### src/modules/IntegrationWizard.tsx
```
hook useState
export IntegrationWizard
handler onClick
handler onChange
```

### src/modules/FinanceModule.tsx
```
hook useAuth
hook useState
hook useCallback
hook useEffect
export FinanceModule
handler onPay
handler onDelete
handler onDecide
handler onClick
handler onClose
handler onChange
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

### src/modules/SalesSupport.tsx
```
component TenderList
component TenderCalendar
component ChecklistTab
component GuaranteesTab
component EkapTab
component TenderSelectorEmpty
component Modal
component TenderForm
props SalesSupportProps
hook useAuth
hook useState
hook useCallback
hook useEffect
hook useMemo
export SalesSupport
handler onSelect
handler onChanged
handler onSelectTender
handler onClick
handler onChange
handler onClose
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
