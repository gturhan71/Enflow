# Enflow — Para Hassasiyeti & (Ertelenen) BigInt Göç Planı

> **Durum:** Aşama 0 (temiz-yuvarlama + Finance Engine) **TAMAM**. Tam tam-sayı
> (kuruş) depolama göçü (BigInt/Int) **yapılabilecek işler** listesinde —
> gerektiğinde devreye alınır. Bu doküman tetik koşullarını ve adımları kaydeder.

## Bağlam (neden)

Para alanları şemada `Float` (IEEE-754 double). Asıl risk **hesaplama**daki
yuvarlama/birikme hatasıdır (rapor C/Float). İki katmanlı çözüm:

- **Hesap doğruluğu:** Tüm para aritmetiği `backend/src/services/financeEngine.ts`
  (kuruş = tam sayı minor unit) üzerinden — float yuvarlama hatası yok.
- **Depolama temizliği:** `backend/src/services/moneyRounding.ts` + Prisma client
  extension (`prismaClient.ts`) — **tüm** para yazımları 2 ondalığa (kuruş)
  yuvarlanır; kirli float asla saklanmaz. Route'lar değiştirilmedi (tek nokta).

Bu, riskin ~%95'ini sıfır şema göçü + sıfır regresyon ile kapatır.

## Neden tam BigInt göçü ERTELENDİ (gerçek maliyet)

- **Prisma `BigInt` → JS `bigint`; `JSON.stringify` bigint'te HATA fırlatır.**
  Şemayı BigInt'e çevirmek, para içeren **her API yanıtını** kırar → tüm domain
  route'larında + frontend'de bigint↔number/string dönüşümü gerekir (global serializer).
- **`Int` alternatifi** 32-bit (±2.147B) → kuruşta ~**21.4M TL tavanı**; büyük
  ihale/sözleşmelerde taşar. Güvensiz.
- Kapsam: **16 modelde ~26 para alanı** + veri migration'ı (×100, yuvarla) +
  frontend tip/format. Tek seferde yüksek kırılma riski.

## Kapsam (para alanları — 16 model / ~26 alan)

`Customer.creditLimit` · `Opportunity.value` · `BoMItem.{purchaseCost,unitSalePrice,totalSalePrice}` ·
`BoMLineQuote.unitPrice` · `CostItem.amount` · `Project.{totalValue,budgetTotal}` ·
`ProjectMilestone.{budgetAmount,actualCost}` · `ProjectCostItem.{plannedAmount,actualAmount,amountTRY}` ·
`Contract.guaranteeAmount` · `ContractWorkflow.contractValue` ·
`PurchaseRequest.{budgetAmount,budgetAmountTRY,invoiceAmount}` · `PurchaseItem.{estimatedUnitPrice,actualUnitPrice}` ·
`PurchaseQuote.{totalAmount,totalAmountTRY}` · `Invoice.{amount,paidAmount}` · `Payment.amount` ·
`GuaranteeLetter.amount` · `Tender.estimatedValue` · `CollectionInstallment.amount`

> **PARA DEĞİL — dokunulmaz:** `BoMItem.marginPercentage`, `Project.avgMargin` (yüzde) ·
> `Vendor.rating` · `PurchaseItem.quantity`, `DeliveryRecord.quantity*` (miktar) ·
> `CorporateMetric.{targetValue,actualValue}` (jenerik KPI).

## Tetik koşulları (ne zaman devreye al)

Aşağıdakilerden biri olursa tam tam-sayı depolamaya geç:
- Denetim/regülasyon **bit-bazlı** para mutabakatı şart koşarsa.
- Çok yüksek hacimli mikro-tutar toplama (örn. binlerce satır kuruş) gerekirse.
- Float depolama temsil hatası gerçek bir mutabakat farkı üretirse (izleme: Integrity Monitor).

---

## Aşama 1 (Önerilen) — Tek dilim BigInt PoC: **Finans (Invoice/Payment)**

Deseni en finansal ve dar domain'de uçtan uca kanıtla:

1. **Serializer altyapısı:** Express'e global `BigInt.prototype.toJSON = function(){ return this.toString() }`
   (veya yanıt katmanında `bigint→string`); frontend `string→number/BigInt` parse.
2. **Şema (additive):** `Invoice.amountMinor BigInt?`, `paidAmountMinor BigInt?`,
   `Payment.amountMinor BigInt?` ekle (Float alanlar KALIR — çift-yaz).
3. **Çift-yaz:** moneyRounding extension'ı bu modeller için `*Minor = toMinor(float)`
   de yazsın. Veri migration script'i mevcut satırları doldursun.
4. **Okuma:** finance route'ları + FinanceModule `*Minor`'ı `fromMinor` ile göstersin.
5. **Doğrula:** curl + Playwright (fatura/tahsilat), tutar tutarlılığı; RBAC etkilenmez.
6. **Float'ı kaldır:** dilim stabilse `amount`/`paidAmount` Float alanları drop +
   migration. (Geri dönüş için bir sürüm beklet.)

## Aşama 2 — Domain-domain yay

Aynı 6 adımı sırayla: Opportunity/Proposal/BoM → ContractWorkflow → Project →
Purchase → Tender/Guarantee/Customer. Her domain **bağımsız test + commit**.

## Aşama 3 — Tam geçiş + temizlik

Tüm `*Minor` alanlar birincil olunca: Float alanları kaldır, `moneyRounding`
extension'ı kuruş-doğrulamaya çevir, `financeEngine` tek SoT.

---

## İlgili Kod

- `backend/src/services/financeEngine.ts` — kuruş tabanlı canonical hesap (SoT).
- `backend/src/services/moneyRounding.ts` — para alan haritası + 2-ondalık yuvarlama.
- `backend/src/prismaClient.ts` — `$extends` ile global yazım-yuvarlama.
- `POST /api/finance/calc` — net/KDV/brüt + döviz-bazlı önizleme.
