# Sözleşmeye Bağlı Teslim Süresi Takibi — Uçtan Uca

> Onaylanan plan, uygulama tamamlandıktan sonra buraya kalıcı olarak taşındı (bkz. `feat(contract/tender/project): sözleşmeye bağlı teslim süresi takibi uçtan uca` commit'i, v2.5.0).

## Context

Şu anki sistemde `ContractWorkflow.deadline` yalnız **imza öncesi hazırlık/evrak son tarihi**dir — sözleşmenin kendi geçerlilik/hazırlık süresini temsil eder. Sözleşmeye göre **malın/işin fiili teslim tarihi** (imza gününden itibaren başlayan, aşılması cezai şart doğuran, sözleşme geçerlilik süresinden bağımsız bir tarih) hiçbir yerde modellenmiyordu. Ayrıca:

- İhale (Tender) aşamasında tedarikçi teslim süresi teyidi olmadan teklif verilmesini işaretleyen bir mekanizma yoktu.
- Sözleşme→Proje otomatik aktarımında (`/transfer`, T4) oluşturulan milestone şablonlarının hiçbirinde `plannedEnd` hiç set edilmiyordu (proje türünden bağımsız genel bir boşluk) — teslim tarihi projeye hiç taşınmıyordu.
- Proje/Satınalma/Satış/Hukuk birimlerine bu tarihe yaklaşırken veya geçtiğinde çapraz bir uyarı düşen bir akış yoktu.

Zincir: **İhale (tahmini) → Sözleşme (bağlayıcı, imza+gün sayısı) → Proje (gerçek, izlenebilir milestone)**, alt-kırılımlı bir tahmini takvim (sipariş/üretim/sevkiyat/teslim) üretir, geciktiğinde otomatik ceza tutarı hesaplar, PROJECT_MGR+PROCUREMENT_MGR+SALES_MGR+LEGAL_MGR (+atanmış PM) birimlerine bildirim düşürür. Kullanıcı onayıyla belirlenen kapsam: gün-sayısı bazlı süre girişi, otomatik ceza tutarı hesabı, alt-kırılımlı zaman çizelgesi. Bu, yeni veri modeli + 3 modül arası bağlantı içerdiğinden **mimari değişiklik** niteliğinde — `APP_VERSION` v2.4.0→**v2.5.0**'a çıkarıldı (kullanıcı onayı, 2026-09-13).

## Veri Modeli Değişiklikleri (migration: `add_delivery_deadline_tracking`)

**`Tender`** — yeni alanlar: `expectedDeliveryDays Int?` (teklif hazırlığında girilen tahmini teslim süresi, gün), `vendorDeliveryConfirmed Boolean @default(false)`, `vendorDeliveryConfirmedNote String?`.

**`ContractWorkflow`** — yeni alanlar: `deliveryPeriodDays Int?` (sözleşmedeki teslim süresi, gün — WON'da Tender'dan kopyalanır, ContextTab'da düzenlenebilir), `deliveryDueDate DateTime?` (denormalize: `(signedDate ?? bugün) + deliveryPeriodDays`, her değişiklikte yeniden hesaplanır), `penaltyClauseText String?`, `penaltyDailyRatePct Float?`, `penaltyCapPct Float?`, `remindersSent String?` (Tender/GuaranteeLetter ile aynı desen). `@@index([tenantId, projectId])` eklendi (Project→ContractWorkflow ters lookup, ceza hesabı için).

**`ProjectMilestone`** — yeni alan: `remindersSent String?`; `milestoneType` yorumuna `DELIVERY` eklendi (kod tarafı string, migration'a ek gerektirmedi).

**Yeni model `DeliveryTimelineStep`** (GuaranteeLetter'ın çoklu-nullable-FK deseni — ApprovalChain'in generic entityType/entityId deseni DEĞİL, yalnız 2 sabit tip olduğu için gereksiz): `tenderId`/`contractWorkflowId` (ikisi de nullable, cascade), `title`, `sortOrder`, `plannedDate`. `GET /tenders/:id` ve `GET /contract-workflows/:id` mevcut `include` deseniyle okur — ayrı sub-route yok. **Kapsam kararı:** Tender/Contract aşamasında salt-okunur, sistem-üretimi tahmin; gerçek etkileşimli takip (actualEnd, status) yalnız T4'te üretilen `ProjectMilestone(DELIVERY)` satırlarında — var olan milestone PUT/Kanban altyapısı yeniden kullanıldı, ikinci bir CRUD yüzeyi icat edilmedi.

## Backend

- **`backend/src/services/deliveryTimeline.ts`** (saf fonksiyon, `profitabilityLedger.ts` `spreadDates` idiomuyla aynı stil) — `buildDeliveryTimeline(referenceStart, totalDays)`: Sipariş Onayı (%10) → Üretim/Tedarik (%60) → Sevkiyat (%85) → Teslim/Kabul (%100). Son fazın tarihi `deliveryDueDate` ile birebir aynı.
- **`backend/src/services/deliveryPenalty.ts`** (saf fonksiyon, `financingEffect.ts` stiliyle) — `computePenaltyExposure`: gecikme yoksa/oran yoksa `null`; `rawPenalty = contractValue × (dailyRatePct/100) × overdueDays`; `capPct` varsa `cappedPenalty` ile sınırlanır, `isCapped` işaretlenir.
- **`backend/src/services/deliveryDeadlineReminders.ts`** — `tenderReminders.ts`/`guaranteeReminders.ts` ile birebir aynı iskelet (per-tenant 60sn debounce, non-throwing, `remindersSent` merge). Eşikler `30d/15d/7d/1d` + tek seferlik `overdue` (spam yok — kalıcı görünürlük UI rozetleriyle). İki alt-sweep: ContractWorkflow (`deliveryDueDate` set, `TRANSFERRED/CANCELLED/TERMINATED` hariç) ve ProjectMilestone (`milestoneType:'DELIVERY'`, `COMPLETED/CANCELLED` hariç). Hedef: `PROJECT_MGR+PROCUREMENT_MGR+SALES_MGR+LEGAL_MGR` (role-wide) + proje varsa `project.pmId` (dedupe `Set`). `routes/notifications.ts` GET'te `sweepTenderReminders`'ın yanına eklendi.
- **`processEngine.ts` `createContractFromTender`** (T3) — `deliveryPeriodDays`/`deliveryDueDate` kopyalanır, `DeliveryTimelineStep` (contractWorkflowId) üretilir (referans: şimdi, henüz `signedDate` yok).
- **`processEngine.ts` `createProjectFromEntity`/`CONTRACT_WORKFLOW_SIGNING`** (T4) — plandan farklı olarak, milestone materyalizasyonu `/transfer` route'unda değil **burada**, `createProjectWithMilestones` çağrısının hemen ardından yapıldı (wf ve `project.milestones` zaten yüklü, `projectFactory.ts`'e dokunulmadı): `wf.deliveryDueDate` set ise `DeliveryTimelineStep` satırları gerçek `ProjectMilestone(DELIVERY)` satırlarına dönüştürülüp mevcut şablon milestone'larının sonuna eklenir.
- **`routes/tenders.ts`** POST + PUT `/:id` — `expectedDeliveryDays` set/değiştiğinde `DeliveryTimelineStep` (tenderId) sil-yeniden-yaz ile üretilir; liste + detay GET'e `deliveryTimeline` include edildi (liste GET'e de eklenmesi gerekti — TenderForm'un `tender` prop'u liste satırından geliyor, ayrı bir detay-fetch yok).
- **`routes/contractWorkflow.ts`** PUT `/:id` — `deliveryPeriodDays`/`signedDate` değişince `deliveryDueDate` + `DeliveryTimelineStep` yeniden hesaplanır. GET `/`, GET `/:id`, PUT `/:id` üçünde de `withPenaltyExposure()` helper'ı ile hesaplanan `penaltyExposure` response'a eklendi (liste GET'e de gerekti — `ContractWorkflowModule.tsx` seçim anında ayrı bir detay-fetch yapmıyor, liste satırını doğrudan kullanıyor).
- **`routes/contractWorkflow.ts`** `/transfer` — davranış değişmedi (milestone üretimi processEngine.ts'e taşındı, yukarı bkz.).
- **`routes/projects.ts`** milestone PUT — DELIVERY tipi milestone için `penaltyExposure` hesaplanıp response'a eklenir (`ContractWorkflow.findFirst({tenantId, projectId})` ters lookup). **Teslimat teyidi** (kullanıcı ek talebi, plan sonrası eklendi): DELIVERY milestone `COMPLETED`'a YENİ geçtiyse (önceki durum `COMPLETED` değilken) → 4 role + `project.pmId`'ye "Teslimat teyit edildi" bilgilendirme `Notification`'ı + `logActivity('DELIVERY_CONFIRMED')`. Milestone `COMPLETED` olunca sweep filtresine takılmayacağı için hatırlatmalar kendiliğinden durur — ayrı durdurma mantığı yok. PM'in sonraki aşamaya geçirmesi var olan Kanban akışıyla elle yapılır, otomatik ilerletme eklenmedi.

## Frontend

- **`src/modules/DeliveryTimelinePanel.tsx`** (yeni, paylaşılan) — salt-okunur adım listesi; Tender detayında (`SalesSupport.tsx`) ve ContractWorkflow `ContextTab.tsx`'te kullanılıyor.
- **`SalesSupport.tsx`** `TenderForm` — "Tahmini Teslim Süresi (gün)" + "Tedarikçi teslim süresini teyit etti" checkbox. `submitBid` — teyit yoksa `window.confirm` ile yumuşak uyarı (engelleyici değil).
- **`contract-workflow/ContextTab.tsx`** — "Teslim Süresi ve Cezai Şart" bölümü: gün girişi + hesaplanan tarih (salt-okunur) + cezai şart maddesi/oran/tavan + `penaltyExposure` varsa kırmızı özet + `DeliveryTimelinePanel`.
- **`contract-workflow/SigningTab.tsx`** — `penaltyExposure` varsa üstte kırmızı "Cezai Şart Riski" banner'ı.
- **`project-mgmt/ProjectDetail.tsx`** (plandaki `KanbanView.tsx` değil — gerçek milestone listesi/detayı bu dosyada) — `milestoneType==='DELIVERY'` için indigo "Teslim" rozeti; genel `overdue` mantığı zaten kırmızı kart+"Gecikmiş" veriyordu, DELIVERY için metin "Gecikmiş — Cezai Şart Riski"ne özelleştirildi.
- **Tipler** — `contract-workflow/types.ts` (`DeliveryTimelineStep`, `PenaltyExposure`, `ContractWorkflow` yeni alanlar), `types/tender.ts` (aynı desende), `types/project.ts` `MilestoneType` union'ına `'DELIVERY'` eklendi.

## Doğrulama (yapıldı)

- Backend birim testleri: `deliveryTimeline.test.ts` (4 faz, son faz = `deliveryDueDate`, oranlı ölçekleme, negatif gün clamp), `deliveryPenalty.test.ts` (null durumları, ham/tavanlı hesap) — toplam 176/176 (166 mevcut + 10 yeni), `tsc --noEmit` 0 hata (backend+frontend).
- **Uçtan uca tarayıcı + API testi** (GM + ilgili rollerin gerçek token'larıyla): İhale oluştur (90 gün) → WON (ISAB_MGR onayı → T3) → ContractWorkflow'da `deliveryPeriodDays=90` + 4 fazlı timeline doğrulandı → `signedDate`+kısa süre ile geriye tarihli senaryo (`overdueDays=245`, `rawPenalty=₺122.500`, `cappedPenalty=₺50.000`, `isCapped=true`) ContextTab+SigningTab'da doğru render edildi → bildirim sweep'i 4 role (PROJECT_MGR/PROCUREMENT_MGR/SALES_MGR/LEGAL_MGR) tam olarak bir kez bildirim düşürdü (tekrar çağrıda duplicate yok) → imza onay zinciri (LEGAL_MGR→KSU_MGR→GM) → SIGNED → transfer onay zinciri (KGD_MGR→PROJECT_MGR) → Proje'de 8 şablon + 4 DELIVERY milestone (doğru `plannedEnd` tarihleriyle) oluştu → "Teslim/Kabul" milestone'u COMPLETED işaretlenince `penaltyExposure` + "Teslimat teyit edildi" bildirimi + `DELIVERY_CONFIRMED` denetim izi doğrulandı. Test verisi temizlendi.
- RBAC süiti bu PR'da ayrıca koşulmadı (yeni alanlar var olan rol-korumalı endpoint gövdelerine eklendi, yeni izin/rol yok) — sonraki commit öncesi genel RBAC koşusuna dahil edilmeli (bkz. `feedback_rbac_timing.md`).

## Kapsam Dışı (bilinçli)

- Ceza tutarının otomatik Finans/Invoice'a yansıtılması (yalnız bilgilendirici hesaplama).
- Tenant-bazlı özelleştirilebilir faz şablonu (oranlar hardcoded, `projectFactory.ts`'teki proje-tipi şablonları gibi).
- Tender/Contract aşamasındaki `DeliveryTimelineStep` satırlarının elle düzenlenmesi (salt-okunur tahmin; gerçek düzenlenebilir takip yalnız Proje milestone'larında).
