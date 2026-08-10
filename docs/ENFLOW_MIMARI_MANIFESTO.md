# Enflow Mimari Değişiklik Manifestosu

**Amaç:** Bu belge, mimari backlog'daki 9 değişikliği (B-01…B-09) fazlara ayırarak, her fazın "kapı koşulu" geçilmeden bir sonrakine geçilmemesini sağlayan yürütülebilir bir plana çevirir. Backlog "ne değişmeli"yi anlatıyordu; bu manifesto "hangi sırayla ve hangi kapıdan geçerek" değişmeli sorusuna cevap verir.

**Durum (2026-08-10):** Faz 0 (Keşif) tamamlandı — bkz. Bölüm 6. Faz 1 kapısı kapatılıyor (yalnız B-01/Proposal katmanı gerçek boşluktu). Faz 2-4 sıraları geldiğinde ayrı ayrı detaylandırılıp planlanacak.

---

## 0. Yürütme Kuralları

1. **Sıra bağlayıcıdır.** Fazlar bağımlılık zincirine göre sıralanmıştır (Bölüm 1). Bir sonraki fazın görevi, önceki fazın kapı koşulu geçmeden başlatılmaz.
2. **Varsayılan dosya yolları teyit edilmelidir.** Manifestteki dosya/modül adları geçmiş mimari konuşmalardan çıkarılan varsayımlardır, gerçek repo taraması değildir. Her fazın ilk adımı: ilgili gerçek dosyaları bul, varsayımla eşleşmiyorsa gerçek kod tabanını esas al, sapmayı not et.
3. **Önce oku, sonra yaz.** Mevcut implementasyonu okumadan "muhtemelen böyledir" varsayımıyla kod yazılmaz. Özellikle finansal mantık taşıyan görevlerde mevcut hesaplama tam anlaşılmadan yeniden yazılmaz.
4. **Her görev sonunda doğrulama yapılır.** İlgili testler veya en azından manuel bir smoke test çalıştırılmadan görev "tamam" işaretlenmez.
5. **Her faz sonunda commit atılır.** Fazlar arası geçişte çalışan bir checkpoint bırakılır.
6. **Sapma = durdurma sebebi değil, not sebebidir.** Gerçek kod varsayılan yapıdan farklıysa görev iptal edilmez; yaklaşım gerçek yapıya uyarlanır ve Bölüm 6'ya yazılır.
7. **Bu manifesto tek sektöre (kamu ihalesi / IT sistem entegratörü) sadıktır.**
8. **Tenant/organizasyon yapısı görev içinde hardcode edilmez.** Enflow çok kiracılı bir sistem olduğu için tenant'lar farklı RBAC rol sayısına, onay zincirine ve birim yapısına sahip olabilir; tek bir tenant'ın yapısı "genel kural" sayılmaz.

---

## 1. Bağımlılık Zinciri

```
Faz 0: Keşif
   │
   ▼
Faz 1 (P0) — Temel Katman        B-01 Fiyatlama/Marj — backend
"Diğer her şeyin üzerine kurulu"  B-02 Finance Engine (integer + FX kilit)
                                  B-03 Overhead Allocation / DMO motoru
   │
   ▼
Faz 2 (P1) — Süreç Bütünlüğü     B-04 Contract Execution state machine
                                  B-05 Onay delegasyonu & SLA eskalasyonu
   │
   ▼
Faz 3 (P2) — Karar Kalitesi      B-06 CRM/Proposal veri derinliği
                                  B-07 EKAP istihbaratı & ağırlıklı pipeline
                                  B-08 Tedarikçi/procurement entegrasyonu
   │
   ▼
Faz 4 (P3) — Kapsam Genişletme   B-09 Warranty/Service modülü
```

**Kural:** Bir fazda hem "kâr" hem "zaman" etkili görevler varsa, önce kâr sızıntısını durduran görev tamamlanır.

---

## Bölüm 6 — Faz 0 Keşif Raporu (Sapma Notları)

Aşağıdaki tablo, manifestin özgün varsayımlarını (backlog dosyasından türetilmiş, repo taraması olmadan) gerçek kod taramasıyla karşılaştırır. Keşif 4 paralel Explore agent ile yürütüldü (2026-08-10).

| ID | Manifest varsayımı | Gerçek durum (dosya:satır) | Kapı durumu |
|---|---|---|---|
| **B-01** Fiyatlama/marj backend'e taşınması | Sıfırdan yapılacak | **Maliyet Analizi (Opportunity/BoM) katmanı: TAMAM.** `backend/src/services/salesCosting.ts:94` `computeSalesCosting()` — `backend/src/routes/opportunities.ts:329` `POST /:id/cost-analysis` çağırıyor, sonucu doğrudan DB'ye yazıyor (`CostAnalysisVersion` snapshot dahil). Frontend (`CostAnalysisModule.tsx:155-171`) aynı formülü yalnız canlı önizleme için tekrarlıyor. **GAP: Proposal (Teklif) katmanı ayrı.** `src/modules/ProposalEditor.tsx:211-245` kendi hesabını yapıyor, `backend/src/routes/proposals.ts` `POST /` / `PUT /:id` `content`'i doğrulamadan JSON olarak kaydediyordu; ayrıca `content.items`'a operasyonel gider kalemleri hiç yazılmıyordu — kaydedilen tekliften geriye dönük gerçek marj yeniden üretilemiyordu. | ✅ Kapatıldı (bu oturum, Faz 1) |
| **B-02** Finance Engine (integer minor units + FX kilit) | Sıfırdan yapılacak | Şema hâlâ `Float` (bilinçli erteleme, `docs/MONEY_MIGRATION_PLAN.md`). `financeEngine.ts` iç hesapları kuruş-bazlı yapıyor, `moneyRounding.ts` + Prisma `$extends` ile depolama temizleniyor. FX kilidi zaten var: `POST /:id/cost-analysis` costConfig'i (spot+forward kur) kalıcı yazıyor + `CostAnalysisVersion`'a snapshot'lıyor; `POST /:id/approve-cost` yeniden hesap yapmıyor — kayıtlı tutar onay sonrası değişmiyor. | ✅ Karşılandı (BigInt storage migration kasıtlı olarak kapsam dışı) |
| **B-03** Overhead Allocation / DMO | Sıfırdan yapılacak | Tamamı zaten var (2026-07-03). İki katmanlı dağıtım, `Project.netMargin` tam-yüklü hesap, DMO tarafında net<0 → otomatik alarm. Tek fark: `Project.applyOverhead` varsayılan `false` (opt-in) — **kullanıcı kararı: opt-in kalsın** (geriye dönük marj sıçraması riski). | ✅ Karşılandı (adım-1 kullanıcı kararıyla uygulanmadı) |
| **B-04** Contract Execution state machine | Sıfırdan yapılacak | Tamam, test edilmiş. `backend/src/services/contractWorkflowState.ts:6-16` merkezi `STATUS_TRANSITIONS` guard tablosu + rol kısıtı + zorunlu gerekçe kontrolü; `contractWorkflow.ts:148-153` geçersiz geçişleri reddediyor. Test dosyası mevcut. Eski `Contract` modeli legacy, asıl akış `ContractWorkflow`. | ✅ Karşılandı |
| **B-05** Onay delegasyonu & SLA eskalasyonu | Sıfırdan yapılacak | Delegasyon: TAMAM ve çalışıyor (`approvalChainService.ts` `getDelegatedRoles`/`resolveEffectiveApprover`). SLA eskalasyonu artık `ApprovalStage.dueDate`/`escalatedAt`/`escalatedToRole` + `approvalSlaEscalation.ts` ile **gerçek yetki devri** yapıyor (bkz. Faz 2 Kapanışı). | ✅ Kapatıldı (Faz 2, bu oturum) |
| **B-06** CRM/Proposal veri derinliği | Sıfırdan yapılacak | `Customer.source` + Levenshtein-bazlı mükerrer kayıt uyarısı eklendi (bkz. Faz 3 Kapanışı). | ✅ Kapatıldı (Faz 3, bu oturum) |
| **B-07** EKAP istihbaratı & ağırlıklı pipeline | Sıfırdan yapılacak | Ağırlıklı pipeline TAMAM (`analyticsService.ts` `computeForecast()` → `weightedPipeline`/`coverage`; `ForecastCard.tsx`). EKAP gerçek entegrasyonu yok — **kullanıcı kararıyla kapsam dışı.** | ✅ Ağırlıklı pipeline karşılandı / EKAP kapsam dışı |
| **B-08** Tedarikçi/procurement entegrasyonu | Sıfırdan yapılacak | `syncProcurementMilestoneDate()` ile PO_ISSUED/teklif revizyonu/teslimat üç noktada `ProjectMilestone.plannedEnd`/`actualEnd`'e senkronize ediliyor + değişiklik/gecikme bildirimi (bkz. Faz 3 Kapanışı). | ✅ Kapatıldı (Faz 3, bu oturum) |
| **B-09** Warranty/Service modülü | Sıfırdan yapılacak | Büyük ölçüde tamam. `ServiceTicket.projectId` zorunlu; maliyet `ProjectCostItem`'a (category=SERVICE) idempotent yazılıyor → `netMargin`'e yansıyor. SLA sweep de var. Eksik (küçük/opsiyonel): garanti süresi bitişi kontrolü. | ✅ Büyük ölçüde karşılandı — Faz 4'te küçük ek |
| Ek | `rbac.config.ts` tek-kaynak mı? | `tests/rbac/rbac.config.ts` Playwright test fixture'ı; gerçek tek-kaynak `governance/role-matrix.ts`. | Bilgi notu |

### Revize Faz Durumu

- **Faz 1 (P0):** B-01 ✅ · B-02 ✅ · B-03 ✅ — **kapı geçildi** (2026-08-10).
- **Faz 2 (P1):** B-04 ✅ · B-05 ✅ — **kapı geçildi** (2026-08-10).
- **Faz 3 (P2):** B-06 ✅ · B-07 ✅ (EKAP hariç) · B-08 ✅ — **kapı geçildi** (2026-08-10).
- **Faz 4 (P3):** B-09 büyük ölçüde ✅, küçük ek opsiyonel — sırada.

Faz 4, sırası geldiğinde bu manifestoya yeni bir bölüm olarak eklenip detaylandırılacak.

---

## Faz 1 Kapanışı — B-01 Proposal Katmanı (2026-08-10)

`ProposalEditor.tsx`'in kasıtlı esnekliği (kalem/proje-geneli marj modu, pazarlık için manuel toplam fiyat override) korunarak backend'e bir **doğrulama/alarm otoritesi** eklendi (Maliyet Analizi'ndeki `getSalesMarginFloor`/`belowFloor` deseniyle aynı):

- `ProposalEditor.tsx` `onSave` artık `totalBoMCostBase`/`totalOpsCostBase`/`totalCostBase`'i de `content`'e yazıyor (önceden yalnız `items` yazılıyordu, operasyonel giderler kayıptan tamamen düşüyordu).
- `salesCosting.ts`'e `evaluateProposalMargin()` eklendi — `computeSalesCosting`'deki `belowFloor`/`alarmReason` formatıyla tutarlı.
- `proposals.ts` `POST /` ve `PUT /:id`, `content.totalCostBase` mevcutsa marjı tenant'ın `marginFloorPct`'ine karşı değerlendiriyor; eşik altındaysa GM/SALES_MGR'a `Notification` + `logActivity` detayına `marginPct`/`belowFloor` yazıyor + response'a `marginWarning` ekliyor. **Kayıt reddedilmiyor** — yalnız görünür ve denetlenebilir hâle geliyor (DMO alarm deseniyle aynı ruh: engelleme değil, bilgilendirme + audit).
- `CRMModule.tsx`, `creditWarning` ile aynı desende `marginWarning`'i okuyup uyarı gösteriyor.

**Kapsam dışı bırakılan:** Proposal `content`'in tamamen backend-hesaplı hale getirilmesi (ham girdi → backend hesapla → UI sadece göster) — bu, mevcut manuel-override/pazarlık UX'ini kaldırır, ayrı bir UX kararı gerektirir.

---

## Faz 2 Kapanışı — B-05 Onay-SLA Eskalasyonu (2026-08-10)

Delegasyon (B-05 adım 3) zaten çalışıyordu; eksik olan SLA süresi tanımlama + süre dolunca **gerçek yetki devri** (yalnız bildirim değil) eklendi — `slaEscalation.ts`'in (TodoTask) desenini `ApprovalStage`'e taşıyan yeni bir servis:

- Migration `approval_stage_sla`: `ApprovalStage.dueDate`/`escalatedAt`/`escalatedToRole` eklendi.
- Yeni `backend/src/services/approvalSlaEscalation.ts` — `sweepApprovalSlaEscalations()`: tenant-başına 60sn throttle, PENDING zincirlerin "current" (sıradaki ilk PENDING) stage'ine `dueDate` atar (tenant-yapılandırmalı `moduleSettings.approvals.slaBusinessDays`, varsayılan 2 iş günü); süresi geçip `escalatedAt` boşsa `escalatedToRole='GENERAL_MANAGER'` yazar + rol sahibi ve GM'e `Notification` üretir. `GET /api/approval-chains`'in başında tetiklenir (`tasks.ts`'teki `sweepSlaEscalations` çağrısıyla birebir aynı desen).
- `approve`/`reject` endpoint'lerinde yetki kontrolü genişledi: orijinal rol sahibi **veya** `escalatedToRole` sahibi onaylayabilir/reddedebilir — orijinal yetki kaldırılmıyor, ilk işlem yapan geçerli oluyor (optimistic locking zaten vardı). `pendingForRole` "sırası gelmiş" filtresi de `escalatedToRole`'ü kapsayacak şekilde genişledi.
- **Önemli düzeltme (test sırasında bulundu):** SLA saatinin başlangıcı `stage.createdAt` değil `now` olmalı — bir zincirin tüm aşamaları aynı anda create edildiği için `createdAt` yalnızca "zincir ne zaman açıldı"yı gösteriyor, "bu aşama ne zaman sıraya girdi"yi değil. `createdAt` kullanılsaydı, özellik ilk devreye girdiğinde haftalarca bekleyen eski zincirler anında "aşılmış" sayılıp toplu eskalasyon/bildirim patlaması yaratıyordu (test sırasında gözlendi, düzeltildi — artık her stage "ilk görüldüğü an"dan itibaren taze bir pencere alıyor).

**Kapsam dışı bırakılan:** Stage'in `role` alanının kalıcı olarak değiştirilmesi (yalnız ek yetki tanımlanıyor); per-stage/per-role farklı SLA süreleri (tek tenant-geneli değer).

---

## Faz 3 Kapanışı — B-06 CRM Derinliği + B-08 Tedarikçi/Proje Senkronu (2026-08-10)

**B-06:** `Customer.source` (lead kaynağı) eklendi + mükerrer kurum kaydı uyarısı. Yeni `backend/src/utils/textSimilarity.ts` (harici bağımlılık yok — `normalizeCompanyName` şirket eki kelimelerini temizler, `levenshteinDistance`/`similarityRatio` standart DP). `customers.ts` `POST /`: create öncesi tenant'ın mevcut adlarıyla ≥0.82 benzerlik olanları bulur, **kayıt reddedilmez** (Faz 1/2'deki "uyar, engelleme" felsefesi), response'a `duplicateWarning` eklenir. `NewCustomerModal.tsx`'e `source` select'i, `CRMModule.tsx`'e `creditWarning`/`marginWarning` ile aynı desende uyarı gösterimi eklendi.

**B-08:** `PurchaseQuote.deliveryDays` artık gerçekten kullanılıyor. `purchaseRequests.ts`'e yeni `syncProcurementMilestoneDate()` — Proje'nin `PROCUREMENT` milestone'unun `plannedEnd`'ini günceller, **ilk atama değilse** (taahhüt gerçekten değiştiyse) PM/proje yöneticisine `Notification` düşürür. Üç tetik noktası: PO_ISSUED anında (seçili teklifin `deliveryDays`'inden), teklif sonradan revize edildiğinde (`PUT /:id/quotes/:qid`, PO zaten kesilmişse), ve tam teslim alındığında (`actualEnd` doldurulur, plandan geç kalınmışsa "gecikti" uyarısı). Milestone'un `status`/`progress`'üne dokunulmuyor — insan kararı olarak kalıyor.

**Test sırasında bulunan, kapsam dışı bırakılan ön-var-olan hata:** `PUT /:id/quotes/:qid` yalnız `deliveryDays` (totalAmount olmadan) gönderilirse `resolvedTotal = Number(undefined) = NaN` oluşup SQLite yazımı 500 ile patlıyor — gerçek UI her zaman tam teklif formu gönderdiği için üretimde tetiklenmiyor, ama API doğrudan çağrılırsa kırılgan. Bu Faz 3'ün kapsamı dışında (B-08 ile ilgisiz, ayrı bir düzeltme).

**Kapsam dışı bırakılan:** Milestone `status`/`progress` otomasyonu (insan kararı olarak kalıyor).
