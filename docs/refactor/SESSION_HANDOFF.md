# Refactor — Temiz Session Handoff

> Bu klasör (`docs/refactor/`) refactor operasyonunun **tek kaynağıdır**. Temiz bir session açıldığında
> önce bu dosya + `REFACTOR_PLAN.md` okunur, sonra Faz 0'dan başlanır.

## Durum (2026-07-04)

- Refactor planı **onaylandı** (bkz. `REFACTOR_PLAN.md`).
- Henüz **hiç refactor kodu yazılmadı** — Faz 0 (güvenlik ağı) başlamadan durduruldu.
- Karar: bu işi **ayrı/temiz bir session'da** yürüteceğiz.

## Temiz session'da ilk adımlar

1. Bu dosyayı + `docs/refactor/REFACTOR_PLAN.md`'yi oku.
2. **Temiz ağaçta başla:** alakasız bekleyen değişiklikleri (test artefaktları `tests/rbac/auth/*.json`,
   `playwright-report`, `test-results`, oturum-öncesi `CLAUDE.md`/`copilot-instructions`) refactor'a
   **karıştırma**. Yalnız refactor dosyalarını commit et.
3. **Faz 0 (ilk iş):** Vitest kur (`cd backend && pnpm add -D vitest`) → iş motorları için unit test:
   - `financeEngine`: computeCompanyOverhead · computeUnitParticipationLoad · projectMargins · lineBreakdown · applyVat · toMinor/fromMinor.
   - `dmoCosting`: effectiveRisturnRate · computeOrderCosting (kur açığı/risturn/komisyon/alarm senaryoları).
   - `overheadService`/`analyticsService` saf hesaplar (median, effectiveRisturnRate vb.).
   - `scripts/check-no-console.mjs` guard (check-no-mock deseninde) + `package.json` `verify`'a ekle + `test:unit` script'i.
4. Sonra sırayla Faz 1→2→3 (düşük-orta risk). Faz 4–5 (yüksek risk) **ayrı turlar**, modül/endpoint-başı commit.

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
