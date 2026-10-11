# Profesyonel Hizmetler (Post-Sales) Birimi — Planlama

> **Durum: Faz 1 UYGULANDI (2026-10-11).** `WorkOrder`+`WorkSpecialty`+`UserWorkSpecialty` modelleri (migration `add_professional_services`, SQLite+Postgres), `PS_TECH` rolü + "Operasyon" biriminin `DEFAULT_UNITS`'e eklenmesi (+ tenant-1 backfill), `backend/src/routes/workOrders.ts` + `workSpecialties.ts`, `src/modules/ProfessionalServicesModule.tsx`, Ayarlar→Uzmanlık Alanları ekranı — tamamı canlı ve uçtan uca doğrulandı (oluştur→sevk et→başlat→kapanış-kanıtı-zorunluluğu→tamamla, RBAC deny/allow, tenant-izole upload guard). `pnpm audit:roles` 0 ERROR, RBAC `api` süiti 587/587. **Ek (2026-10-11, aynı gün):** Proje↔İş Emri çift yönlü görünürlük — `GET /api/projects/:id` artık `workOrders` (salt-okunur özet) döner, `ProjectDetail.tsx`'e "Profesyonel Hizmetler" sekmesi eklendi; `GET /api/work-orders/:id` artık bağlı projenin özetini (`project.status/progress`) + o projenin açık `PurchaseRequest` sayısını (`openPurchaseRequestCount`) döner, iş emri detayında proje rozeti + Proje Yönetimi/Satınalma'ya kısa linkler var. Not: `OPERATIONS_MGR` zaten önceden `PROJECT_MGMT_VIEW`+`PROCUREMENT_VIEW` iznine sahipti (ServiceTicket döneminden) — bu ekleme yeni bir izin açmadı, yalnız var olan erişimi bağlamsal hale getirdi. **Ek (aynı gün):** Yeni iş emri oluşunca tenant'taki tüm aktif `OPERATIONS_MGR` kullanıcılarına `Notification` düşer (`notifyOperationsManagers`, `routes/workOrders.ts`) — önceden (ServiceTicket'ta da) bu yoktu, birim yöneticisi modülü kendi kontrol etmek zorundaydı. Bildirime tıklayınca `ProfessionalServicesModule` artık `initialItemId` ile ilgili iş emrini otomatik açıyor (diğer modüllerdeki `initialItemId` deep-link paterniyle aynı). Uçtan uca tarayıcıda doğrulandı (bildirim→tıkla→doğru iş emri detayı açıldı). **Faz 2 UYGULANDI (2026-10-11, aynı gün — devam).** `ServiceWorkPlan` modeli (migration `add_service_work_plan`, SQLite+Postgres) + `WorkOrder.servicePlanId` gerçek FK oldu + `backend/src/routes/serviceWorkPlans.ts` (VisitPlan paterni — CRUD, `workOrders.ts` PUT'a `servicePlanId` alanı eklendi, IDOR-korumalı tenant sahiplik kontrolü) + `src/modules/professional-services/WeeklyPlanView.tsx` (haftalık takvim: hafta gezinme, lazy-create plan, plansız iş emirlerini plana ekle/çıkar, satır-bazlı teknisyen+tarih sevkiyatı, plan durumu). `ProfessionalServicesModule`'e "Liste"/"Haftalık Takvim" görünüm anahtarı eklendi. Uçtan uca tarayıcıda doğrulandı (iş emri oluştur→haftalık plana ekle→teknisyen+tarih ata→sevk et→Liste'de tutarlılık). **Bulunup düzeltilen 2 hata:** (1) var olan (benim değişikliklerimden önce oluşturulmuş) `OPERATIONS_MGR` kullanıcıları `WORK_ORDERS_VIEW` iznine sahip değildi → `backfill-work-orders-view-permission.ts` (profitability-view backfill paterni) eklendi ve çalıştırıldı; (2) Haftalık Takvim'deki mutasyonlar ana Liste state'ini güncellemiyordu → `view==='list'` olduğunda otomatik yeniden-yükleme eklendi. `pnpm audit:roles` 0 ERROR, RBAC `api` süiti 587/587, prod build (`tsc -p tsconfig.build.json`) temiz (yeni backfill script'i `tsconfig.build.json` hariç listesine eklendi — `governance/` import eden script'ler rootDir dışına çıkıyor, mevcut 2 script'le aynı desen).

**Faz 3 UYGULANDI (2026-10-11, aynı gün — devam).** `WorkOrderMaterialRequest` modeli (migration `add_work_order_material_request`, SQLite+Postgres; `Vendor` opsiyonel FK) — `PurchaseRequest`'in 9 statülü tam onay zincirinin KASITLI DIŞINDA, hafif/tek-adımlı akış: REQUESTED→APPROVED→ORDERED→RECEIVED (+REJECTED). `workOrders.ts`'e `/:id/materials` (oluştur — sahip teknisyen veya yönetici), `/:id/materials/:matId` (düzenle — REQUESTED'ta sahip/yönetici, ORDERED/RECEIVED geçişi yalnız yönetici, RECEIVED için `actualCost` zorunlu), `/:id/materials/:matId/approve|reject` (yalnız yönetici) eklendi; `GET /:id` artık `materialRequests` dizisini de döner. Talep oluşunca `notifyOperationsManagers` (Faz 1'de eklenen genel bildirim yardımcısı, artık parametrik başlık/mesaj alıyor) ile birim yöneticisine bildirim düşer. Frontend: `src/modules/professional-services/MaterialRequestsPanel.tsx` (iş emri detayında: talep listesi, durum rozetleri, yönetici için onayla/reddet/sipariş-edildi/teslim-alındı aksiyonları, teknisyen/yönetici için yeni talep formu). Uçtan uca hem curl hem tarayıcıda doğrulandı: talep oluştur→bildirim gider→teknisyen onaylayamaz (403)→yönetici onaylar→sipariş edildi→teslim alındı (tutar zorunlu, eksikse 400)→ayrı bir talep reddedilir (not ile). `pnpm audit:roles` 0 ERROR, RBAC `api` süiti 587/587, prod build temiz.

Versiyon artışı (v2.5.0→v2.6.0 adayı — üç yeni model: `WorkOrder`+`WorkSpecialty`+`UserWorkSpecialty`+`ServiceWorkPlan`+`WorkOrderMaterialRequest`, yeni rol `PS_TECH`, yeni birim "Operasyon") kullanıcı onayı bekliyor.

## Context

Enflow'a, sözleşme/kurulum sonrası (**post-sales**) saha hizmetlerini yöneten, **iş emri (ticket) bazlı** çalışan teknik bir **Profesyonel Hizmetler** birimi eklenmesi isteniyor:

- Birim yöneticisi, gelen talepleri **takvime göre** teknisyenlere yönlendirir (dispatch).
- Teknisyenler kendi **uzmanlık alanına** göre kendilerine verilen işi yapar; iş **emri bazlı** çalışırlar (kurulum + arıza müdahalesi).
- İşin yürütülmesi için zaman zaman **dış kaynaktan malzeme/hizmet** alınabilir (tedarikçi/alt yüklenici).

### Mevcut altyapıyla ilişki (2026-10-11 taraması)

Kodda bu alanı kısmen kapsayan, ama post-sales dispatch/takvim/uzmanlık ihtiyacını karşılamayan iki parça var:

- **`ServiceTicket`** (`backend/prisma/schema.prisma:520`) — "garanti/servis arıza kaydı": `category` (FAULT\|SPARE_PART\|MAINTENANCE\|OTHER), `priority`, `status` (OPEN→IN_PROGRESS→WAITING_PART→RESOLVED→CLOSED), `assignedToUserId`, `unitId`, `slaHours`/`dueAt`, maliyet alanları. **Her zaman bir `Project`e bağlı** (`projectId` NOT NULL) — kurulum (INSTALLATION) kategorisi yok, teknisyen takvimi/uzmanlık eşlemesi yok, dış kaynak satınalma bağlantısı yok. Route: `backend/src/routes/serviceTickets.ts`, rol kapısı `GENERAL_MANAGER, PROJECT_MGR, OPERATIONS_MGR`.
- **`OPERATIONS_MGR`** rolü zaten `ServiceTicket`in "birincil sahibi" olarak `governance/role-matrix.ts:174` içinde tanımlı (`SERVICE_TICKETS_VIEW`, unit: "Operasyon"). Ama **"Operasyon" birimi `DEFAULT_UNITS`'te yok** (`backend/src/services/bootstrapTenant.ts:12`) — yeni tenant'lara otomatik eklenmiyor. Teknisyen seviyesinde (STAFF) ayrı bir rol de yok.
- **`VisitPlan`/`Visit`** (`backend/prisma/schema.prisma:1114`) — haftalık ziyaret planı deseni (`weekOf`, `preparedById`, içinde `plannedDate`/`actualDate`/`status` taşıyan satırlar) — teknisyen dispatch takvimi için referans alınacak desen.
- **`PurchaseRequest`** (`backend/prisma/schema.prisma:963`) — 9 statülü tam onay zinciri (DRAFT→PENDING_UNIT→PENDING_PROCUREMENT→PENDING_GM→PO_ISSUED→...). Acil saha müdahalesinde bu zincir yavaş kalır (bkz. Kullanıcı Kararı 4).

## Kullanıcı Kararları (2026-10-11)

1. **Rol stratejisi:** `OPERATIONS_MGR` rolü **yeniden kullanılır** — rol kodu aynı kalır, sadece görünen adı "Profesyonel Hizmetler Müdürü" olarak değişir (RBAC/role-matrix/izin tablolarında minimum invazif değişiklik). Teknisyenler için **yeni bir STAFF rolü**: `PS_TECH` ("Profesyonel Hizmetler Teknisyeni").
2. **Veri modeli:** `ServiceTicket`a dokunulmaz (müşteri arıza/garanti kaydı olarak kalır). **Yeni, ayrı bir `WorkOrder` (İş Emri) modeli** açılır — `Project`e bağlı olmak zorunda değildir (kurulum dışı ücretli/garanti dışı servis de açılabilir), kendi takvim/teknisyen/uzmanlık alanlarını taşır.
3. **Takvim deseni:** `VisitPlan`/`Visit`e benzer, **haftalık plan modeli** (`ServiceWorkPlan`) — birim yöneticisi hafta başında teknisyenlerin işlerini tek ekranda dağıtır. Acil işler plan beklemeden de doğrudan bir teknisyene/tarihe atanabilir (plan **opsiyonel gruplama**, zorunlu önkoşul değil).
4. **Dış kaynak entegrasyonu:** Mevcut `PurchaseRequest` zincirine **girmez**. Ayrı, **hafif/tek-adımlı** bir `WorkOrderMaterialRequest` modeli — yalnızca birim yöneticisi (OPERATIONS_MGR) onayından geçer, GM/Satınalma onayı yok.
5. **İş emri numaralandırması:** `documentNumberService.nextDocumentNumber(tenantId, categoryCode)` kullanılır (diğer resmi evraklarla — sözleşme/ihale/hukuk — aynı tenant-yapılandırmalı numaralandırma deseni). Zorla seed edilen bir varsayılan kategori kodu YOK — `DocumentCategoryCode` diğer tüm kategoriler gibi tenant kendi Ayarlar→Doküman Kodlama ekranından ekler; eklenmemişse `nextDocumentNumber` zaten `null` döner (mevcut genel davranış) ve `workOrderNo` boş kalır — engelleyici değil.
6. **Uzmanlık alanı:** Serbest metin DEĞİL — **tenant bazlı, Ayarlar'da tanımlı sabit bir taksonomi** (`Brand`/`ProductCategory` paterni). **Her tenant kendi uzmanlık listesini yönetir — tenant'lar arası paylaşılan/global bir katalog yoktur** (diğer tüm modellerle aynı `tenantId` izolasyon kuralı).
7. **Kapanış kanıtı:** Ad+tarih yeterli DEĞİL — iş emri `COMPLETED`'a geçmeden önce **dosya yükleme zorunlu** (imzalı PDF/fotoğraf), `ContractWorkflowDoc` upload paternine benzer (multer memoryStorage → lokal + opsiyonel Nextcloud).

## Fazlama

- **Faz 1 — Temel:** `WorkOrder` modeli + CRUD + statü akışı, `PS_TECH` rolü, "Operasyon" biriminin `DEFAULT_UNITS`'e eklenmesi + tenant-1 backfill, temel liste/detay UI + teknisyenin "Bugünkü İşlerim" görünümü.
- **Faz 2 — Takvim:** `ServiceWorkPlan` modeli + haftalık dağıtım ekranı (`VisitPlanModule` paterni).
- **Faz 3 — Dış kaynak:** `WorkOrderMaterialRequest` hafif onay akışı + iş emri maliyetine yansıması.
- **Faz 4 — Opsiyonel entegrasyon/otomasyon (ayrıca onaylanacak):** `ServiceTicket`→`WorkOrder` otomatik/yarı-otomatik sevk bağlantısı, SLA hatırlatma sweep'i, Dashboard/Yönetim Raporları widget'ı, sanal agent (Procurement/Finance benzeri) ADVISORY katkısı.

Faz 1–3 bu planın kapsamındadır; Faz 4 implementasyon sırasında ayrıca değerlendirilip onaylanacaktır.

## Veri Modeli (taslak — migration adı implementasyonda kesinleşir, öneri: `add_professional_services`)

### Unit seed

`backend/src/services/bootstrapTenant.ts` `DEFAULT_UNITS`'e `{ key: 'operations', name: 'Operasyon', description: 'Profesyonel hizmetler — kurulum ve arıza müdahale saha ekibi.' }` eklenir. Var olan tenant-1 için `backend/src/scripts/backfill-*.ts` paternine uygun idempotent bir backfill script'i (birim zaten varsa atlar) — bkz. `backfill-workflow-igpd-kgd-steps.ts` örneği.

### `WorkOrder` (yeni model)

```
id                      String   @id @default(cuid())
tenantId                String
workOrderNo             String?  // documentNumberService.nextDocumentNumber(tenantId, categoryCode) — profil yoksa null (engelleyici değil)
type                    String   // INSTALLATION | REPAIR | MAINTENANCE | OTHER
title                   String
description             String?
priority                String   @default("NORMAL") // LOW | NORMAL | HIGH | URGENT
status                  String   @default("DRAFT")
// DRAFT → PENDING_SCHEDULE → SCHEDULED → IN_PROGRESS → WAITING_PART → COMPLETED → CLOSED (+ CANCELLED herhangi aşamada)
customerId              String?
customerName            String?  // Customer yoksa/silinmişse görünürlük için denormalize
projectId               String?  // opsiyonel — proje kaynaklı kurulum ise bağlanır
serviceTicketId         String?  // opsiyonel — bir ServiceTicket'tan "teknisyen sevk et" ile açıldıysa geri-bağlantı
unitId                  String?  // Operasyon birimi
requiredSpecialtyId     String?  // WorkSpecialty FK (tenant bazlı taksonomi — bkz. aşağı)
assignedTechnicianId    String?  // User.id — planlanana kadar null
scheduledDate           DateTime?
actualStartAt           DateTime?
actualEndAt             DateTime?
servicePlanId           String?  // opsiyonel — ServiceWorkPlan'a bağlıysa
completionNotes         String?
customerSignOffAt       DateTime?
customerSignOffName     String?
customerSignOffFileUrl  String?  // ZORUNLU alan — COMPLETED'a geçiş bu doluymadan reddedilir (backend validasyonu)
costAmount              Float?   // işçilik + malzeme toplam (WorkOrderMaterialRequest.actualCost toplamı + manuel işçilik)
costCurrency            String?
createdAt               DateTime @default(now())
updatedAt               DateTime @updatedAt

@@index([tenantId, status])
@@index([tenantId, assignedTechnicianId])
@@index([tenantId, projectId])
```

### `ServiceWorkPlan` (yeni model, Faz 2 — `VisitPlan` paterni)

```
id             String   @id @default(cuid())
tenantId       String
weekOf         DateTime // haftanın Pazartesi'si
unitId         String?
preparedById   String
preparedByName String?
status         String   @default("DRAFT") // DRAFT | APPROVED | COMPLETED
notes          String?
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
workOrders     WorkOrder[] // servicePlanId ters ilişki
```

### Uzmanlık Alanı Taksonomisi — tenant bazlı (`WorkSpecialty` + `UserWorkSpecialty`)

**Her tenant kendi uzmanlık listesini yönetir; tenant'lar arası paylaşılan/global bir katalog YOK** — `Brand`/`ProductCategory` ile aynı izolasyon kuralı (`tenantId` filtreli, Ayarlar→Marka & Ürün Grubu benzeri yeni bir "Uzmanlık Alanları" alt-ekranı).

```
model WorkSpecialty {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String   // örn. "Elektrik", "Mekanik", "Yazılım/Network"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, name])
}
```

`UserWorkSpecialty` (join model, teknisyen ↔ uzmanlık — çoklu uzmanlık desteklenir; `ProjectUnitParticipation` paterninde kendi `tenantId`'si yok, izolasyon `userId`/`specialtyId` üzerinden zaten tenant-scoped):

```
model UserWorkSpecialty {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  specialtyId  String
  specialty    WorkSpecialty @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  createdAt    DateTime      @default(now())

  @@unique([userId, specialtyId])
}
```

Birim yöneticisi iş emrini atarken `requiredSpecialtyId`'ye sahip (`UserWorkSpecialty` üzerinden eşleşen) teknisyenleri önceliklendirilmiş/filtrelenmiş görür (sert kısıt değil — başka teknisyene de atanabilir, sadece öneri/filtre).

### `WorkOrderMaterialRequest` (yeni model, Faz 3 — hafif/tek-adımlı)

```
id                      String   @id @default(cuid())
tenantId                String
workOrderId             String
description             String
vendorId                String?  // opsiyonel Vendor FK (tedarikçi geçmişi için)
vendorName              String?
estimatedCost           Float?
actualCost              Float?
currency                String   @default("TRY")
status                  String   @default("REQUESTED") // REQUESTED | APPROVED | ORDERED | RECEIVED | REJECTED
approvedByUnitManagerId  String?
rejectionNote           String?
notes                   String?
createdAt               DateTime @default(now())
updatedAt               DateTime @updatedAt
```

### Roller / İzinler

- `src/constants.ts` `ROLE_LABELS.OPERATIONS_MGR` → `'Profesyonel Hizmetler Müdürü'` (kod aynı kalır), yeni `PS_TECH: 'Profesyonel Hizmetler Teknisyeni'`.
- `backend/src/services/roleDefaultPermissions.ts` — `OPERATIONS_MGR`'a yeni `WORK_ORDERS_VIEW` eklenir; `PS_TECH: ['DASHBOARD_VIEW', 'WORK_ORDERS_VIEW', 'TODO_VIEW']`.
- `governance/role-matrix.ts` — `OPERATIONS_MGR` notu güncellenir ("Profesyonel Hizmetler" eklenir, `endpointDomains` içine `workOrders`), yeni `PS_TECH` satırı (`kind: 'STAFF'`, `unit: 'Operasyon'`).
- `src/components/settings/UserManagement.tsx` rol `<select>`ine `PS_TECH` seçeneği.
- Mevcut RBAC süitine (1027 test) yeni rol/izin senaryoları — **commit öncesi tek seferde** koşulur (`feedback_rbac_timing` kuralı).
- `src/modules/dashboard/widgetCatalog.ts` — `OPERATIONS_MGR`/`PS_TECH` için uygun varsayılan widget seti (ör. `PS_TECH: ['myTasks']` zaten `TECHNICAL_SPEC` için var olan paterne benzer).

### `TodoTask.relatedModule`

Yeni değer `'WORK_ORDER'` + `backend/src/routes/tasks.ts` `MODULE_TARGET` eşlemesine `professional-services` sekmesi eklenir (mevcut `targetTab` deseni).

## Backend (taslak)

- **`backend/src/routes/workOrders.ts`** (yeni router, `ServiceTicket`/`PurchaseRequest` route desenleriyle tutarlı):
  - `GET /` (filtre: `status`, `unitId`, `assignedTechnicianId`, `type`, `customerId`, `projectId`)
  - `GET /:id`
  - `POST /` (PS_MGR/GM/PROJECT_MGR oluşturur; `projectId` verilirse customer/unit otomatik doldurulur — `routes/projects.ts` POST'taki opportunity-türetme paternine benzer)
  - `PUT /:id`
  - `POST /:id/schedule` (`assignedTechnicianId` + `scheduledDate` ata → status `SCHEDULED`)
  - `POST /:id/start` (teknisyen kendi işini başlatır → `IN_PROGRESS`, `actualStartAt`)
  - `POST /:id/complete` (`completionNotes` + **`customerSignOffFileUrl` zorunlu** — dosya önceden `/:id/signoff-upload` ile yüklenmemişse `400` döner; opsiyonel `customerSignOffName`/`customerSignOffAt` → `COMPLETED`)
  - `POST /:id/signoff-upload` (multer memoryStorage → lokal `backend/uploads/work-orders/{folder}/` + opsiyonel Nextcloud WebDAV, `ContractWorkflowDoc` `/upload` paterniyle birebir aynı; `fetch` ile FormData, `apiClient` değil)
  - `POST /:id/materials`, `PUT /:id/materials/:matId/approve|reject` (Faz 3)
  - `DELETE /:id`
  - `GET /summary/all` (`/:id`'den ÖNCE — `projects.ts`'teki `/summary/all` çakışma-önleme deseniyle aynı) — birim bazlı KPI (açık iş sayısı, ortalama kapanış süresi, teknisyen yük dağılımı)
- **`backend/src/routes/serviceWorkPlans.ts`** (Faz 2, yeni router) — `VisitPlan`/`Visit` route paterniyle birebir aynı iskelet.
- **`backend/src/routes/workSpecialties.ts`** (yeni router, `Brand`/`ProductCategory` CRUD paterniyle aynı) — `GET/POST/PUT /` (tenant-scoped liste) + `User` güncellemede `specialtyIds` ataması (`UserWorkSpecialty` toplu set).
- **Opsiyonel bağlantı:** `ServiceTicket`'a "Teknisyen Sevk Et" aksiyonu (Faz 4) — var olan `ServiceTicket` kaydından `workOrderId` set edilerek bir `WorkOrder` oluşturur; `ServiceTicket.status` ile `WorkOrder.status` arasında otomatik senkron YOK (manuel, iki ayrı kayıt).
- `logActivity` çağrıları: `WORK_ORDER_CREATE/UPDATE/SCHEDULE/COMPLETE`, `WORK_ORDER_MATERIAL_REQUEST/APPROVE/REJECT`.
- `Notification`: teknisyene atama bildirimi, malzeme talebi onay/red bildirimi.

## Frontend (taslak)

- **`src/modules/ProfessionalServicesModule.tsx`** (yeni modül, sekme key: `professional-services`):
  - Liste/Kanban görünümü (durum bazlı — `ProcurementModule.tsx`/`SalesSupport.tsx` Kanban desenine benzer)
  - Haftalık Takvim (Faz 2 — `VisitPlanModule.tsx` paterni, `ServiceWorkPlan` dağıtım ekranı)
  - "Bugünkü İşlerim" (teknisyenin kendi görünümü — `TaskList.tsx` `mineOnly` filtresine benzer)
  - Detay drawer: durum geçişi, malzeme talebi ekleme/onay (Faz 3), müşteri imza/kapanış dosya yükleme (zorunlu — dosya yoksa "Tamamlandı" butonu pasif)
- `src/constants.ts` `NAV_ITEMS` — "Profesyonel Hizmetler" sekmesi (CLAUDE.md akış şemasındaki Proje→Satınalma→Garanti/Servis sırasının yanına/arasına, `requiredPermission: 'WORK_ORDERS_VIEW'`).
- **`src/components/settings/WorkSpecialtyManagement.tsx`** (yeni, Ayarlar alt-ekranı) — `ProductTaxonomyManagement.tsx` paterniyle aynı basit CRUD liste (ekle/aktif-pasif/sil); `UserManagement.tsx` kullanıcı düzenleme formuna teknisyen için çoklu-seçim "Uzmanlık Alanları" alanı eklenir.
- Yeni tipler: `src/types/workOrder.ts` (`WorkOrder`, `ServiceWorkPlan`, `WorkOrderMaterialRequest`, `WorkSpecialty` + status/union tipleri, `ServiceTicket` tipindeki union-label deseniyle tutarlı).

## Versiyon

Bu değişiklik yeni bir model+alt-sistem (katman) eklediği için **mimari değişiklik** sınıfına girer → MINOR aday (`v2.5.0` → `v2.6.0`). CLAUDE.md kuralına göre versiyon numarası **implementasyon oturumunda kullanıcıdan açık onay alınmadan değiştirilmez.**

## Kapsam Dışı (bilinçli, bu planda)

- `ServiceTicket`↔`WorkOrder` arasında otomatik/zorunlu bir geçiş halkası (T1–T6 gibi) — Faz 4'e, ayrı onaya bırakıldı.
- SLA/hatırlatma sweep'i (`tenderReminders.ts`/`deliveryDeadlineReminders.ts` paterni) — Faz 4.
- `WorkSpecialty` eşleşmesinin **sert kısıt** olması (yalnız öneri/filtre — birim yöneticisi her teknisyene atayabilir; sertifika/yeterlilik doğrulaması yok).
- Malzeme talebi için tutar eşiğine göre GM'e yükselen ikinci onay katmanı (kullanıcı kararı: tek-adımlı kalsın).
- Mobil/saha-optimize native uygulama (responsive web yeterli kabul edildi).
- Sanal agent (ADVISORY) katkısı — Faz 4'te değerlendirilecek.

## Açık Sorular

Yoktur — üçü de 2026-10-11'de çözüldü (bkz. Kullanıcı Kararları madde 5–7 ve Veri Modeli bölümü).
