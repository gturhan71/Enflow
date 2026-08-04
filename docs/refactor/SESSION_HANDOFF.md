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
- **Sıradaki: Faz 3** (ölü kod/legacy temizliği, orta risk) — henüz başlanmadı.

## Temiz session'da ilk adımlar

1. Bu dosyayı + `docs/refactor/REFACTOR_PLAN.md`'yi oku.
2. **Temiz ağaçta başla:** alakasız bekleyen değişiklikleri (test artefaktları `tests/rbac/auth/*.json`,
   `playwright-report`, `test-results`, oturum-öncesi `CLAUDE.md`/`copilot-instructions`) refactor'a
   **karıştırma**. Yalnız refactor dosyalarını commit et.
3. **Faz 3 (sıradaki iş):** Kullanılmayan geriye-dönük alias'ları grep-doğrula → kaldır (ör.
   `contract-workflow-test`, `cost-analysis` legacy yönlendirmeleri gerçekten kullanılmıyorsa).
   149 TODO'yu tara: önemsizleri çöz, niyetli notları koru/etiketle. 9 BE `: any` daralt.
4. Sonra Faz 4–5 (yüksek risk: fat route→service çıkarımı, god-component ayrıştırma) **ayrı turlar**,
   modül/endpoint-başı commit.

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
