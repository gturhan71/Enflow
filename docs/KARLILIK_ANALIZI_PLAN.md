# Enflow — Zamana Duyarlı Kârlılık & Nakit/Hazine Analizi Planı

> Durum: **Faz A tamam** (2026-08-28) — `profitabilityLedger` + `profitabilityRollup` + `profitabilityService` + `routes/profitability.ts` (`/ledger`, `/summary`) + `PROFITABILITY_VIEW` izni + `ProfitabilityModule.tsx`. Birim testleri 18, `tsc` 0 (fe+be), `audit:roles` 0 ERROR/WARN, backend unit 148/148. **Sıradaki: Faz B** (nakit pozisyonu + hazine/faiz paneli).
> Branch: `feat/profitability-analysis`
> Tek doğruluk kaynağı bu dosyadır — değişiklik önce burada yapılır, sonra koda/CLAUDE.md'ye yansıtılır.

## 1. Amaç

Herhangi bir anda, **dört ayrımda** ve **iki bakışta** kârlılık:

| Ayrım (grain) | Bakış (kaynak) | Esas |
|---|---|---|
| Proje bazında | **Öngörü / Planlanan** (PLAN) | **Tahakkuk** (ACCRUAL) |
| Aylık | **Gerçekleşen** (ACTUAL) | **Nakit** (CASH) |
| Çeyreklik | (devam eden projede: ACTUAL + kalan PLAN = **EAC**) | *ikisi paralel kolon* |
| Yıllık | | |

Ek gereksinimler:
- **Zaman duyarlılığı:** hem gelir hem gider *ne zaman* tahakkuk/tahsil/ödeme oluyor — dönem kovaları buna göre.
- **As-of:** rapor herhangi bir geçmiş/gelecek tarihe göre hesaplanabilir ("Temmuz'daki plan Q3 için ne diyordu").
- **Nakit akışı gözlemi:** yalnız proje tutarları + giriş/çıkış zamanlamasıyla konsolide nakit pozisyonu.
- **Finansal enstrümanlarla değer yaratma gücü:** nakit açığı/fazlası üzerinden hazine katkısı (Faz 1: faiz; Faz 2: faktoring / forward FX / teminat / mevduat senaryoları).

## 2. Tasarım ilkesi: tek tarihli defter (ledger)

Her şey **tarihli olay** listesine indirgenir; tüm rollup'lar bunun üstünde `bucketBy`.

```ts
interface ProfitEvent {
  date: Date;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  basis: 'ACCRUAL' | 'CASH';
  source: 'PLAN' | 'ACTUAL';
  category: string;          // REVENUE | PROCUREMENT | COST_ITEM | OVERHEAD | GUARANTEE | FINANCING | ...
  projectId: string | null;
  opportunityId: string | null;
  ref: string;               // kaynak kayıt kimliği (idempotency + drill-down)
  confidence: 'FIRM' | 'ESTIMATED';
}
```

### Olay kaynakları

| Olay | Yön | PLAN tarihi | ACTUAL tarihi | Tutar kaynağı |
|---|---|---|---|---|
| Hakediş / sözleşme geliri | IN | `CollectionInstallment.dueDate` → yoksa `milestone.plannedEnd` → yoksa sözleşme değeri × ilerleme (eşit dağıtım) | `Invoice.issueDate` (ACCRUAL) / `Payment.paidAt` (CASH) | installment.amount / invoice.amount / payment.amount |
| BoM alımı | OUT | `referenceStart + paymentTermDays` | `ProjectCostItem.date` (kalem `bomLineKey` ile eşleşen) | `purchaseCost × quantity` |
| CostItem gideri | OUT | `referenceStart + paymentTermDays` | `ProjectCostItem.date` | `amount` |
| ProjectCostItem | OUT | ilişkili `milestone.plannedEnd` → yoksa `createdAt` | `date` | `plannedAmount` / `amountTRY` |
| Satınalma faturası (PURCHASE `Invoice`) | OUT | `dueDate` | `paidAt` | `amount` |
| Overhead dağıtımı | OUT | proje süresine eşit aylık dağıtım | aynı | `overheadService.computeProjectOverhead` |
| Teminat mektubu komisyonu | OUT | `issueDate…expiryDate` arası eşit dağıtım | aynı | `amount × komisyon%` (tenant ayarı) |
| Finansman maliyeti / getirisi | OUT / IN | nakit-açık serisinden türetilir | — | `financingEffect.eventEffect` |

**`referenceStart`:** proje `startDate` → yoksa bağlı fırsatın kazanılma tarihi → yoksa `Project.createdAt`.

## 3. Hesap katmanı (saf servisler — `projectSummary.ts` deseninde, `now`/`asOf` enjekte)

### `backend/src/services/profitabilityLedger.ts`
DB'den zaten çekilmiş kayıtlardan `ProfitEvent[]` üretir. İki üretici:
- `buildPlanEvents(project, opp, installments, boms, costs, milestones, guarantees, overhead, opts)` → `source: 'PLAN'`
- `buildActualEvents(project, invoices, payments, projectCostItems, guarantees, opts)` → `source: 'ACTUAL'`

Saf, yan etkisiz, tam birim test edilebilir. FX dönüşümü **yapmaz** — para birimi ayrışık kalır; dönüşüm rollup'ta, açık varsayımla.

### `backend/src/services/profitabilityRollup.ts`
- `bucketBy(events: ProfitEvent[], grain: 'PROJECT'|'MONTH'|'QUARTER'|'YEAR', opts): PeriodRow[]`
- `PeriodRow`:
  ```ts
  {
    periodKey: string;                    // '2026-08' | '2026-Q3' | '2026' | '<projectId>'
    label: string;
    currency: string;                     // rapor para birimi (TRY) — döviz kırılımı ayrı alanda
    plannedRevenue, plannedCost, plannedMarginPct;
    actualRevenue,  actualCost,  actualMarginPct;
    eacCost, eacMarginPct;                // actual-to-date + kalan plan
    variancePct;                          // planlanan − gerçekleşen marj
    cashIn, cashOut, cashNet;             // nakit-esaslı (CASH olayları)
    openingCash, closingCash, maxDeficitInPeriod;
    financingCost, financingBenefit, treasuryNet;
    byCurrency: Record<string, {...}>;    // döviz-bazlı ham kırılım (karışık kur asla toplanmaz)
    fxAssumptions: Record<string, number>;// bu satırda kullanılan TRY oranları
  }
  ```

### `backend/src/services/financingEffect.ts` (genişletme)
Mevcut fırsat-düzeyi hesabı **proje / tüm-tenant + dönem bazlı** kapsama taşınır. Nakit-açık serisinden: açık → faiz maliyeti, fazla → getiri → `treasuryNet` satırı. Mevcut `computeFinancingEffect` / `buildFinancingEvents` imzaları korunur; yeni sarmalayıcı eklenir.

### `backend/src/services/profitabilitySnapshot.ts` (Faz C)
Aylık cron (`schedulerLock` deseni) + on-demand `POST`. Planlı defterin o günkü halini `ProfitabilitySnapshot`'a yazar. İdempotent anahtar: `tenantId + scope + (projectId) + periodKey + asOf-ayı`.

## 4. Veri modeli (Faz C — MINOR mimari, migration `add_profitability_snapshot`)

Yalnız **bir yeni model**. `Project` / `ProjectMilestone` / `CollectionInstallment` / `Invoice` / `Payment` şeması **değişmez**.

```prisma
model ProfitabilitySnapshot {
  id               String   @id @default(cuid())
  tenantId         String
  scope            String   // 'ALL' | 'PROJECT'
  projectId        String?
  asOf             DateTime // snapshot anı
  periodKey        String   // '2026-08' | '2026-Q3' | '2026'
  currency         String   @default("TRY")
  plannedRevenue   Float
  plannedCost      Float
  plannedMargin    Float
  cashInPlanned    Float
  cashOutPlanned   Float
  financingCost    Float
  financingBenefit Float
  payloadJson      String   // tam defter + FX/faiz varsayımları
  createdAt        DateTime @default(now())
  tenant           Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, scope, periodKey, asOf])
}
```

**FX politikası:** PLAN → `costConfig.spotRates` / `forwardOverrides`; ACTUAL → `Invoice.issueRateToTRY` + `FxAdjustment`. Rapor TRY; her satır kullandığı oranları `fxAssumptions` / `payloadJson`'da taşır; döviz-bazlı kırılım daima sunulur (`financingEffect` kuralı — karışık kur asla tek toplama girmez).

**Faz C opsiyonel denormalizasyon:** `CollectionInstallment.projectId` eklenerek fırsat→proje devrinde taşınır (şu an proje kapsamı `opportunityId` join ile çözülüyor, devir sonrası bağ zayıf).

## 5. API — yeni router `backend/src/routes/profitability.ts`

`tenantMiddleware` + `requireRole` (veya `PROFITABILITY_VIEW` izni). Salt-okuma uçları `logActivity` çağırmaz.

```
GET  /api/profitability/ledger?scope=all|project:<id>&asOf=&from=&to=
       → { plan: ProfitEvent[], actual: ProfitEvent[], byCurrency }
GET  /api/profitability/summary?grain=project|month|quarter|year&year=&asOf=&currency=TRY
       → PeriodRow[]
GET  /api/profitability/cashflow?scope=&from=&to=&currency=
       → { series: {date, cumulative}[], deficitWindows, surplusWindows }
GET  /api/profitability/treasury?scope=&period=
       → Faz 1: { financingCost, financingBenefit, treasuryNet, byCurrency }
       → Faz 2: { scenarios: [{ instrument, baselineDelta, ... }] }
GET  /api/profitability/snapshots?periodKey=&scope=      (Faz C)
       → geçmiş snapshot'lar — plan-drift karşılaştırması
POST /api/profitability/snapshot   (GM / FINANCE_MGR)    (Faz C)
       → anlık snapshot al · ActivityLog: PROFITABILITY_SNAPSHOT
```

## 6. Frontend — yeni sidebar modülü `profitability` ("Kârlılık")

- Yeni izin **`PROFITABILITY_VIEW`**
  - `backend/src/services/roleDefaultPermissions.ts` — GENERAL_MANAGER, FINANCE_MGR, SALES_MGR, PROJECT_MGR
  - `src/lib/permissionTree.ts` yeni grup + `src/constants.ts` NAV_ITEMS + `tests/rbac/rbac.config.ts` uiMatrix
- `src/modules/ProfitabilityModule.tsx` + alt bileşenler (`src/modules/profitability/`):
  - **Kontrol çubuğu:** grain (Proje / Ay / Çeyrek / Yıl) · Plan ↔ Gerçek toggle · as-of tarih · para birimi · yıl
  - **Şelale (waterfall):** Gelir → Doğrudan maliyet → Operasyonel marj → Finansman etkisi → Net kârlılık (`recharts`)
  - **Dönem tablosu:** her kova için plan / gerçek / EAC / sapma kolonları + `MarginBadge`; proje grain'de proje bazında drill-down satırları
  - **Nakit pozisyonu grafiği:** kümülatif giriş−çıkış çizgisi, açık pencereleri kırmızı bant
  - **Hazine katkısı paneli:** faiz maliyeti / getiri / net (Faz 1); enstrüman senaryo kartları (Faz 2)
  - **xlsx dışa aktarım** (`xlsx`, kurulu): Özet sayfası + grain başına sayfa
- Opsiyonel Dashboard widget'ı `profitabilityQuarter` (`widgetCatalog.ts`): "Bu çeyrek net kârlılık — plan vs gerçek"

## 7. Fazlama

| Faz | Kapsam | Migration | Versiyon etkisi |
|---|---|---|---|
| **A — Çekirdek** | `profitabilityLedger` + `profitabilityRollup` + `/ledger` + `/summary` + `PROFITABILITY_VIEW` + modül iskeleti + dönem tablosu + waterfall. Canlı plan, ACCRUAL+CASH paralel. Birim testleri (`projectSummary.test.ts` deseni). | yok | PATCH |
| **B — Nakit & Hazine** | `/cashflow` + `/treasury` (Faz 1 faiz) + `financingEffect` genişletme + nakit grafiği + hazine paneli | yok | PATCH |
| **C — Snapshot** | `ProfitabilitySnapshot` + migration + aylık cron + `/snapshots` + plan-drift UI + (ops.) `CollectionInstallment.projectId` | `add_profitability_snapshot` | **MINOR → v2.5.0** (kullanıcı onayı ile; müşteri-hiyerarşi de aynı bump'ı bekliyor) |
| **D — Enstrüman senaryoları** | faktoring / erken-tahsilat iskontosu / forward FX kilidi / teminat maliyeti / mevduat — her biri baz duruma karşı senaryo deltası + `/treasury` Faz 2 + senaryo kartları | yok | PATCH |

Her faz sonunda: `tsc` 0 (fe+be) · `audit:roles` 0 ERROR/WARN · backend unit yeşil · RBAC uiMatrix (yeni menü için +1 satır).

## 8. Kararlar (2026-08-28 onaylandı)

1. **Esas:** ACCRUAL + CASH **paralel kolon** (man-şet marj tahakkuk; nakit ayrı kolon; finansman etkisi köprü).
2. **Geçmiş plan sadakati:** canlı hesap **+ aylık `ProfitabilitySnapshot`** (Faz C).
3. **Enstrüman kapsamı:** Faz 1 = faiz (nakit açığı/fazlası); Faz 2 = açık enstrüman senaryoları.
4. **UI:** yeni sidebar modülü "Kârlılık" + yeni `PROFITABILITY_VIEW` izni.
5. **Devam eden projede** ham "gerçekleşen marj" yanıltıcı → **EAC ana kolon**, ham gerçekleşen ikincil.
6. **Gelir tanıma fallback zinciri:** `CollectionInstallment` → `milestone.plannedEnd` → sözleşme değeri × ilerleme (eşit dağıtım).
7. **Proje kapsamı** `opportunityId` join ile; Faz C'de `CollectionInstallment.projectId` denormalize.

## 9. Riskler

- Milestone `plannedEnd` çoğu projede boş → gelir tanımada fallback zinciri kritik; test verisi hem dolu hem boş senaryoyu kapsamalı.
- Karışık kur → her `PeriodRow` TRY + döviz kırılımı; TRY dönüşüm varsayımları `fxAssumptions`'da şeffaf.
- Overhead yalnız `applyOverhead=true` projelerde → kârlılık raporu bu bayrağı satır bazında göstermeli (net vs direkt marj ayrımı).
- Snapshot `payloadJson` büyüyebilir → yalnız özet alanlar indeksli; ayrıntı JSON'da, sıkıştırma gerekirse Faz C'de değerlendirilir.
