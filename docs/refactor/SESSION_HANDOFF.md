# Refactor — Temiz Session Handoff

> Bu klasör (`docs/refactor/`) refactor operasyonunun **tek kaynağıdır**. Temiz bir session açıldığında
> önce bu dosya + `REFACTOR_PLAN.md` okunur, sonra Faz 0'dan başlanır.

## Durum (2026-08-04 — güncel)

- Refactor planı **onaylandı** (bkz. `REFACTOR_PLAN.md`).
- **Faz 0 TAMAMLANDI** (commit `fce5f23`): Vitest kuruldu (`backend/vitest.config.mts`), 54 unit test
  (financeEngine tam kapsam, dmoCosting effectiveRisturnRate+computeOrderCosting, moneyRounding.round2,
  analyticsService.median) + `scripts/check-no-console.mjs` (o zaman baseline-tolerans) + `pnpm verify`
  zincirine + `test:unit`'e eklendi. Yan bulgu: check-tenant-scope guard'ı `serviceTickets.ts`'te
  savunma-derinliği eksikliği yakaladı, düzeltildi (relation-filter'lı updateMany).
- **Faz 1 TAMAMLANDI** (commit `7d81590` + `abb1c4d`):
  - **1a — dedup:** `src/lib/format.ts` — para formatlayıcı 8 dosyada kopyaydı, kod incelemesi 3 FARKLI
    davranış ortaya çıkardı (fmtCurrency/fmtCurrencyExact/fmtCurrencyOrDash), hiçbiri "düzeltilmedi",
    her dosya kendi orijinal davranışına aynen bağlandı. pct/date'e KASITLI dokunulmadı (pct 2 gerçek
    paylaşımlı tanımda zaten tutarsız/ters biçimliydi — %50 vs 50%; date 25+ yerde farklı seçeneklerle
    kullanılıyor, "8 dosya" iddiası özellikle para formatlayıcısınaydı).
  - **1b — logger:** `backend/src/utils/logger.ts` (yeni, dev-gate YOK — sunucu logu ops-görünürlüğü
    için her zaman basılır) + BE 10 dosya (middleware/index/8 route) + FE 6 dosya → console.* → logger.
    `backend/src/scripts/` (CLI araçları) kasıtlı dokunulmadı. `check-no-console.mjs` BASELINE={} —
    artık sıfır-tolerans (yeni HİÇBİR console.* eklenemez, logger/scripts hariç).
  - Doğrulama (her iki alt-faz + kapanış): tsc FE+BE 0 · `pnpm verify` yeşil · tam RBAC (api-permissions+
    tenant-isolation) 487/487 · Playwright (GM, gerçek login) 7 ekran, 0 console/page error.
- **Faz 2 TAMAMLANDI** (commit `c2b009d`): `src/types.ts` (1309 satır, 129 export) → `src/types/`
  18 domain dosyası + barrel `src/types/index.ts`. Python script ile satır-satır kesildi (0 eksik/
  çakışma önceden doğrulandı), tek bir çağıran dosya bile düzenlenmedi (`from '../types'` barrel'a
  çözülüyor). Cross-domain import yalnız `crm.ts`'te gerekti (User + BoMItem/CostItem). tsc 0 (ilk
  denemede) · export kümesi 129/129 eşleşti · pnpm verify yeşil · Playwright 7 ekran 0 hata.
- **Faz 3 TAMAMLANDI** (commit `ee99978`): Legacy alias temizliği (cost-analysis/presales-cost/
  contract-workflow-test/bare-subscription kaldırıldı, hepsi FE+BE 0-referans doğrulanarak;
  `contracts` bilinçli olarak korundu — eski veri/bookmark riski tam doğrulanamadı) + orphan
  `SubscriptionModule.tsx` (480 satır) silindi + `walkthrough.md`/wiki güncellendi. 149 TODO
  taraması → 0 gerçek TODO (rakam Temmuz'dan beri zaten kapanmış). Backend 8 gerçek `: any`
  (generated/prisma hariç) → `AuditContext` tipleri + Prisma otomatik-çıkarım. tsc 0 · verify
  yeşil · RBAC 147/147 · canlı audit:roles + curl doğrulaması.
- **Faz 4 TAMAMLANDI (9/N)** — kullanıcı kararı: önce "tek bir endpoint ile başla, dikkatlice
  doğrula" (65 endpoint'i tek oturumda zorlamak yerine), sonra 8/N sonrası "kalan ince parçaları
  da hiçbir şey atlamadan tara" (durup Faz 5'e geçmek yerine).
  - **1/N (`dba45fd`):** finance.ts'teki `deriveInvoiceStatus`/`recalcInvoice` → `invoiceEngine.ts`.
  - **2/N (`864151f`):** finance.ts GET /summary agregasyonu → `financeSummary.ts`. Belgelenen
    bulgu: bu endpoint zaten `status==='OVERDUE'`'a değil dueDate/paidAmount'a bakıyordu —
    [[invoice-status-partial-before-overdue]] tuzağına baştan düşmüyordu.
  - **3/N (`48054d1`):** finance.ts GET /aging (vade-kovaları + DSO) → `agingReport.ts`.
  - **4/N (`dd0a171`):** finance.ts'in yerel `buildFinancing()` yardımcısındaki nakit-akış olay
    kurgusu (BoM/CostItem/CollectionInstallment → CashEvent[]) → zaten var olan
    `financingEffect.ts`'e yeni `buildFinancingEvents()` olarak eklendi. finance.ts'in "fat" kısmı
    büyük ölçüde temizlendi.
  - **5/N (`22fcaa8`):** opportunities.ts POST /:id/bom (116 satır, BoM Presales→Satış devri) —
    TAMAMI değil, İÇİNDEKİ 2 SAF hesap (`buildBomEvaluationSnapshot`, `sumBomTotalsByCurrency`) →
    yeni `bomHandoff.ts`. Geri kalanı (transaction+upsert+notification+archive sırası birbirine
    bağımlı) BİLİNÇLİ OLARAK route'ta bırakıldı.
  - **6/N (`b370e45`):** contractWorkflow.ts PUT /:id'deki durum-geçişi doğrulaması
    (STATUS_TRANSITIONS+TRANSITION_ROLES+cancelReason zorunluluğu, sıralı 3 kontrol) →
    `contractWorkflowState.ts` `checkStatusTransition()`. contractWorkflow.ts'e dokunulan İLK
    parça — dosyanın üstündeki slugify/getUploadDir/uploadToNextcloud'a KASITLI dokunulmadı
    (fileUpload.ts'in kendi yorumu bunun önceki bir session'da "regresyon riskine karşı kasıtlı
    bırakıldığını" söylüyor — o karara saygı gösterildi).
  - **7/N (`914b3ff`):** projects.ts PUT /:id/milestones/:msId'deki milestone→proje progress/phase
    türetme mantığı → `projectProgress.ts` `computeProjectProgress()`. projects.ts'e dokunulan İLK
    parça (dosya zaten paylaşımlı fileUpload.ts kullanıyor, kopya yok). Belgelenen kasıtlı davranış:
    boş milestone listesi → `[].every()` vacuous-truth → completed=true/phase='Tamamlandı' (aynen
    korundu, "düzeltilmedi").
  - **8/N (`3ebaedb`):** contractWorkflow.ts POST /:id/analyze'deki otomatik başlık üretimi →
    `contractWorkflowState.ts` `buildAutoTitle()`. **Yan bulgu (kapsam dışı, düzeltilmedi):** canlı
    testte, POST / (create, kendi title="{tenderName}—İKN:{tenderNo}" üretiyor) ile POST /:id/analyze
    zincirlendiğinde ve mock YZ fallback'i (zaten İKN ekli) title'ı project_name olarak yankıladığında
    başlıkta İKN eki İKİ KEZ görünüyor — matematiksel olarak ÖNCEDEN VAR OLAN bir etkileşim olduğu
    doğrulandı (buildAutoTitle orijinal ifadenin birebir kopyası), YENİ bir regresyon değil.
  - **9/N (`c06c455`):** projects.ts GET /summary/all'daki inline özet `.map()`'i (totalPlanned/
    totalActual/plannedMargin/actualMargin/delayedMs) → `projectSummary.ts` `summarizeProject()`.
    Sıfıra-bölme guard'ı (totalValue=0 → margin=0, NaN/Infinity değil) korunup teste bağlandı.
    Canlı curl gerçek 2 projeyle doğrulandı (SASE ALIMII: totalValue=48.2M/cost yok→margin=100;
    2. proje: totalValue=0→margin=0).
  Dokuz parça da tsc 0, pnpm verify yeşil, RBAC temiz, canlı curl gerçek verilerle doğrulandı —
  7/N GERÇEK bir üretim projesi (SASE ALIMII) üzerinde test edilip birebir eski haline döndürüldü.
  **Yan bulgu (düzeltilmedi, kapsam dışı):** adminTest.ts RBAC cleanup endpoint'i Opportunity'yi
  silmeden önce BoMItem/BomHandoff/BoMLineQuote'u silmiyor → FK ihlali (mevcut RBAC senaryoları bu
  kombinasyonu hiç üretmediği için şimdiye kadar yakalanmamıştı).
  **Tarama TAMAMLANDI — kullanıcının "kalan ince parçaları atlamadan tara" talimatı yerine
  getirildi.** finance.ts, contractWorkflow.ts, projects.ts, opportunities.ts uçtan uca satır
  satır okundu. Geri kalan tüm endpoint'ler (finance.ts guarantees/cost-approvals/operating-
  cost-pool/fx-adjustments; contractWorkflow.ts documents CRUD/upload/transfer/handoff-
  procurement; projects.ts overhead/handover-docs/participations; opportunities.ts cost-analysis/
  request-approval/submit-cost-approval/approve-cost/approve/revert-approval) **gerçekten ince** —
  ya doğrudan DB CRUD/orkestrasyon ya da zaten var olan bir servise (projectFactory/salesCosting/
  overheadService) delege ediyor; saf/test edilebilir hesap mantığı barındırmıyorlar. Faz 4'te
  başka çıkarım YOK — 9 parça nihai sayı.
  **NOT/DERS:** contractWorkflow.ts'in üst kısmındaki (satır 1-115) yerel upload yardımcıları
  fileUpload.ts'te zaten var ama kasıtlı dokunulmamış — bu dosyada BAŞKA fat-route parçası
  ararken bu bölgeyi "kolay kazanç" sanıp dokunma, önce o yorumu oku.
- **Faz 5 BAŞLADI (1/7)** — kullanıcı kararı: "sen seç, sırayla en küçükten en büyüğe ilerle".
  Sıra: TodoModule(1084)→ProcurementModule(1188)→ManagementReportingModule(1263)→
  NegotiationModule(1319)→ProjectManagementModule(1322)→ContractWorkflowModule(1677)→
  CRMModule(2030). **Desen (bu turda oturdu, sonraki modüllere aynen uygulanacak):** her
  modül için `src/modules/<kebab-modül-adı>/` alt klasörü — `helpers.ts` (SAF fonksiyonlar,
  props yerine açık parametre alır, test edilebilir), gerekiyorsa `icons.tsx` (JSX döndüren
  küçük saf yardımcılar), sonra her ana JSX bloğu kendi adında bir `.tsx` alt bileşeni (props
  ile veri + callback alır, KENDİ state'i yok). Ana modül dosyası TÜM state + async handler'ları
  tutan ince bir orkestratöre dönüşür. **Prop/state birebir korunur** — davranış değişmez.
  - **1/7 (`51e56ff`):** TodoModule.tsx (1084→248 satır ana dosya, %77 küçülme) →
    `src/modules/todo/` (helpers.ts, icons.tsx, 7 alt bileşen: PendingChainApprovals,
    PendingProposalApprovals, PendingDeliveryNotifications, TaskList, ResolvedApprovals,
    ProposalPreviewModal, NewTaskModal). Tek davranış detayı: teklif onay/red 3-adımlı mantığı
    (handleStatusChange+apiService.updateProposal+setProposals) liste satırı VE önizleme modali
    footer'ında birebir tekrar ediyordu → ortak `approveProposalTask`/`rejectProposalTask`'a
    çıkarıldı (modal versiyonu ek olarak `setPreviewTask(null)` çağırıyor, orijinaldeki gibi) —
    mantık değişmedi, yalnız tekrar kaldırıldı. Doğrulama: tsc 0 · pnpm verify yeşil (test:unit
    128/128 + vite build) · canlı Playwright (GM login→Görevler render, Yeni Görev Ata modali,
    modül=Fırsat seçilince İşlevsel Görev seçici koşullu render, birim filtre butonu) — 0
    console/page error. `taskTargetTab` export'u grep ile TodoModule.tsx dışında hiç
    kullanılmadığı doğrulanıp helpers.ts'e taşındı (dışa dönük import kırılmadı).
  - **2/7 (`0431417`):** ProcurementModule.tsx (1188→247 satır ana dosya, %79 küçülme) →
    `src/modules/procurement/` (constants.tsx — STATUS_CONFIG JSX ikon içerdiği için .ts değil
    .tsx —, StatusBadge/VendorForm/PRDetailDrawer/PRForm — dosya zaten bunları ayrı fonksiyon
    olarak tanımlıyordu, birebir taşındı — + yeni çıkarılan RequestsTab/VendorsTab/SummaryTab).
    Davranış değişikliği YOK (bu dosyada TodoModule'deki gibi tekrarlı 3-adım mantık yoktu).
    Doğrulama: tsc 0 · pnpm verify yeşil · canlı Playwright (Satın Alma render, PR kartı→drawer,
    Teklifler sekmesi geçişi, Tedarikçiler/Özet sekmeleri, Yeni Talep modali) — 0 console/page
    error.
  - **3/7 (`6ff4058`):** ManagementReportingModule.tsx (1263→185 satır ana dosya, %85 küçülme,
    şimdiye dek en büyük Faz 5 çıkarımı) → `src/modules/reporting/` (helpers.ts — JSX-siz HTML
    üretici print fonksiyonları .ts olarak — + 17 zaten-ayrı JSX bileşeni birebir taşındı +
    yeni çıkarılan 4 sekme gövdesi: OverviewTab/UnitDetailTab/MyReportsTab/IncomingReportsTab).
    23 dosya toplam. Davranış değişikliği YOK. Doğrulama: tsc 0 (ilk denemede) · pnpm verify
    yeşil · canlı Playwright (Genel Bakış/Büyüme Analitiği 13 kart/Birim Detayı/Raporlarım+Yeni
    Rapor modali/Gelen Raporlar) — 0 console/page error.
  - **4/7 (`a0dad44`):** NegotiationModule.tsx (1319→624 satır ana dosya, %53 küçülme — diğerlerinden
    düşük çünkü bu dosya öncekilerin aksine HİÇ ayrı alt bileşene bölünmemişti, tek dev fonksiyon +
    2 büyük render modu; simülasyon mantığı state'e derinden bağlı, ayrıştırılan JSX kısmı sınırlı) →
    `src/modules/negotiation/` (types.ts, AccessDeniedPanel, ProposalSelectorHeader, ModeTabBar,
    ChatInfoPanel+ChatWindow — 1v1 sohbet modu, AuctionSidePanel+AuctionBoard — açık eksiltme modu).
    Ana bileşen TÜM state (sohbet 7 + eksiltme 13 değişken) + async handler'ları tutuyor.
    **Davranış notu:** `roundCalculated` state'i orijinalde yazılıyor ama hiç okunmuyordu (etkisiz
    "ölü" state) — davranış-koruyan kapsam gereği KASITLI korundu, temizlenmedi (Faz 3 kararı,
    Faz 5 değil). Doğrulama: tsc 0 (1 RefObject<T|null> tip düzeltmesi hariç ilk denemede) · pnpm
    verify yeşil · canlı Playwright GERÇEK uçtan-uca akış — API üzerinden (raw SQL değil) geçici
    fırsat+"pazarlığa açık" teklif oluşturuldu → seçildi → 1v1 sohbet başlatıldı+mesaj aktı → mod
    sekmesi NEGOTIATING sırasında doğru devre dışı kaldı (guard doğrulandı) → eksiltme kurulum
    formu+katılımcı tablosu+tur kontrolü render edildi — 0 console/page error. Test verisi
    adminTest.ts "RBAC Test*" ucuyla temizlendi.
  **Kalan (3/7):** ProjectManagementModule/ContractWorkflowModule/CRMModule — aynı desenle, her
  biri ayrı tur+commit.

## Temiz session'da ilk adımlar

1. Bu dosyayı + `docs/refactor/REFACTOR_PLAN.md`'yi oku.
2. **Temiz ağaçta başla:** alakasız bekleyen değişiklikleri (test artefaktları `tests/rbac/auth/*.json`,
   `playwright-report`, `test-results`, oturum-öncesi `CLAUDE.md`/`copilot-instructions`) refactor'a
   **karıştırma**. Yalnız refactor dosyalarını commit et.
3. **Faz 4 TAMAMLANDI** (9/N, bkz. yukarı) — dört hedef dosya da uçtan uca tarandı, geri kalan
   her şey ince orkestrasyon/CRUD olarak doğrulandı. Bu fazda ek çıkarım aranmasına gerek yok.
4. **Faz 5 DEVAM EDİYOR (4/7 tamam)** — sıradaki: ProjectManagementModule.tsx (1322 satır).
   Oturan deseni (`src/modules/<modül>/` altında helpers/constants + alt bileşenler, ana dosya
   ince orkestratör) aynen uygula. Her modül ayrı tur + commit + canlı Playwright doğrulama.

## Değişmez kurallar (refactor boyunca)

- **Davranış-koruyan:** hiçbir özellik değişmez; before/after çıktı (curl/screenshot) eşleşir.
- **Her kalem ayrı commit.** Her adımda: `tsc` FE+BE 0 · `pnpm verify` yeşil · `pnpm test:isolation` 46/46 ·
  Faz 0 sonrası `pnpm test:unit` yeşil · dokunulan UI'da Playwright render (0 page-error).
- **DOKUNMA:** `backend/src/prismaClient.ts` (dual-adapter + para-yuvarlama extension hassas) ·
  `backend/prisma/schema.prisma` provider (kurulum sihirbazı yönetir).
- Backend plain ts-node → route/service değişiminde **restart** (nodemon yok).
- RBAC tam süiti yalnız faz kapanışında (commit-başı izolasyon alt-süiti yeterli — [[feedback-rbac-timing]]).

## Borç envanteri (özet — detay REFACTOR_PLAN.md)

- God-component: CRMModule 1883 · ContractWorkflow 1570 · ProjectMgmt 1323 · Negotiation 1319 · ManagementReporting 1219 · Procurement 1161 · Todo 1083.
- Tekrar: `fmt` para formatı **8 dosyada** kopya → `src/lib/format.ts`.
- console.*: 51 (FE 10 / BE 41) → logger (`src/utils/logger.ts` var; BE logger eklenecek).
- Fat route: finance 604 · contractWorkflow 515 · projects 508 · opportunities 481 → service çıkarımı.
- types.ts 1213 satır monolit → `src/types/` domain + barrel.
- Legacy: 14 "legacy" + 6 "geriye dönük" alias · 149 TODO.
- Test boşluğu: iş motorları için **0 unit test** (Faz 0 kapatır).
- Sağlam yanlar: 0 `as any`/`@ts-ignore` (FE), tenant izolasyonu, guard'lar, RBAC+IDOR süiti.

## Ölçülebilir çıkış kriterleri

- 0 `console.*` (guard aktif) · `fmt` tek kaynak · types domain-bölünmüş · ölü alias yok ·
  iş motorları unit-testli · en büyük FE modülleri belirgin küçülmüş (Faz 5) · RBAC+IDOR+verify yeşil.

İlgili: `REFACTOR_PLAN.md` · memory [[refactor-plan]]
