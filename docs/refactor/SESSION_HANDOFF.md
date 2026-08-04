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
- **Faz 4 DEVAM EDİYOR (4/N tamamlandı)** — kullanıcı kararı: "tek bir endpoint ile başla, dikkatlice
  doğrula" (65 endpoint'i tek oturumda zorlamak yerine).
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
    bağımlı) BİLİNÇLİ OLARAK route'ta bırakıldı — tam ayrıştırma riski değere değmezdi.
  Beş parça da tsc 0, pnpm verify yeşil, RBAC temiz, canlı curl gerçek verilerle doğrulandı.
  **Yan bulgu (düzeltilmedi, kapsam dışı):** adminTest.ts RBAC cleanup endpoint'i Opportunity'yi
  silmeden önce BoMItem/BomHandoff/BoMLineQuote'u silmiyor → FK ihlali (mevcut RBAC senaryoları bu
  kombinasyonu hiç üretmediği için şimdiye kadar yakalanmamıştı).
  **Kalan (henüz yapılmadı):** finance.ts'in geri kalanı (guarantees/cost-approvals/operating-cost-
  pool/fx-adjustments — muhtemelen çoğu zaten ince CRUD, hızlı tara) + contractWorkflow.ts (515
  satır, 12 endpoint — henüz hiç bakılmadı) + projects.ts (509 satır, 20+ endpoint) +
  opportunities.ts'in kalan endpoint'leri (cost-analysis zaten salesCosting.ts'e delege ediyor
  muhtemelen ince; request-approval/submit-cost-approval/approve-cost/approve/revert-approval
  henüz incelenmedi). Her biri ayrı commit, curl before/after zorunlu.

## Temiz session'da ilk adımlar

1. Bu dosyayı + `docs/refactor/REFACTOR_PLAN.md`'yi oku.
2. **Temiz ağaçta başla:** alakasız bekleyen değişiklikleri (test artefaktları `tests/rbac/auth/*.json`,
   `playwright-report`, `test-results`, oturum-öncesi `CLAUDE.md`/`copilot-instructions`) refactor'a
   **karıştırma**. Yalnız refactor dosyalarını commit et.
3. **Faz 4 (devam, YÜKSEK RİSK — dikkatli, tek endpoint/parça ilerle):** finance.ts'in kalanı →
   contractWorkflow.ts → projects.ts → opportunities.ts sırasıyla, her parça kendi commit'i +
   Faz 0 unit test deseni + curl before/after ile davranış korunduğu kanıtlanmalı. Kullanıcı
   "tek endpoint ile başla" tercihini belirtmişti — aynı temponun sürdürülmesi önerilir.
4. Sonra Faz 5 (en riskli, en son: god-component ayrıştırma — CRMModule 2030/ContractWorkflowModule
   1677/ProjectManagementModule 1322 satır) **ayrı turlar**, modül-başı commit.

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
