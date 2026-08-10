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
| **B-05** Onay delegasyonu & SLA eskalasyonu | Sıfırdan yapılacak | Delegasyon: TAMAM ve çalışıyor (`approvalChainService.ts` `getDelegatedRoles`/`resolveEffectiveApprover`). SLA eskalasyonu KISMİ: `slaEscalation.ts` süresi geçen TodoTask'ları bulup bildirim gönderiyor ama görevi devretmiyor; `ApprovalStage`'de SLA alanı yok. | ⚠️ Kısmi — Faz 2'de detaylandırılacak |
| **B-06** CRM/Proposal veri derinliği | Sıfırdan yapılacak | Customer modeli zengin ama "kaynak" (lead source) alanı yok, mükerrer kayıt uyarısı yok. | ❌ Açık — Faz 3'te |
| **B-07** EKAP istihbaratı & ağırlıklı pipeline | Sıfırdan yapılacak | Ağırlıklı pipeline TAMAM (`analyticsService.ts` `computeForecast()` → `weightedPipeline`/`coverage`; `ForecastCard.tsx`). EKAP gerçek entegrasyonu yok — **kullanıcı kararıyla kapsam dışı.** | ✅ Ağırlıklı pipeline karşılandı / EKAP kapsam dışı |
| **B-08** Tedarikçi/procurement entegrasyonu | Sıfırdan yapılacak | `PurchaseQuote.deliveryDays` yalnız teklif skorlamasında kullanılıyor, senkronize edilmiyor. `ProjectCostItem.purchaseRequestId` yalnız maliyet senkronize ediyor; `ProjectMilestone`'a teslim tarihi/takvim bağı yok. | ❌ Açık — Faz 3'te |
| **B-09** Warranty/Service modülü | Sıfırdan yapılacak | Büyük ölçüde tamam. `ServiceTicket.projectId` zorunlu; maliyet `ProjectCostItem`'a (category=SERVICE) idempotent yazılıyor → `netMargin`'e yansıyor. SLA sweep de var. Eksik (küçük/opsiyonel): garanti süresi bitişi kontrolü. | ✅ Büyük ölçüde karşılandı — Faz 4'te küçük ek |
| Ek | `rbac.config.ts` tek-kaynak mı? | `tests/rbac/rbac.config.ts` Playwright test fixture'ı; gerçek tek-kaynak `governance/role-matrix.ts`. | Bilgi notu |

### Revize Faz Durumu

- **Faz 1 (P0):** B-01 ✅ (bu oturum) · B-02 ✅ · B-03 ✅ — **kapı geçildi.**
- **Faz 2 (P1):** B-04 ✅ · B-05 ⚠️ kısmi (onay-SLA otomatik devri eksik) — sırada.
- **Faz 3 (P2):** B-06 ❌ · B-07 ✅ (EKAP hariç) · B-08 ❌ — sırada.
- **Faz 4 (P3):** B-09 büyük ölçüde ✅, küçük ek opsiyonel — sırada.

Faz 2-4, sıraları geldiğinde bu manifestoya yeni bölümler olarak eklenip ayrı ayrı detaylandırılacak.

---

## Faz 1 Kapanışı — B-01 Proposal Katmanı (2026-08-10)

`ProposalEditor.tsx`'in kasıtlı esnekliği (kalem/proje-geneli marj modu, pazarlık için manuel toplam fiyat override) korunarak backend'e bir **doğrulama/alarm otoritesi** eklendi (Maliyet Analizi'ndeki `getSalesMarginFloor`/`belowFloor` deseniyle aynı):

- `ProposalEditor.tsx` `onSave` artık `totalBoMCostBase`/`totalOpsCostBase`/`totalCostBase`'i de `content`'e yazıyor (önceden yalnız `items` yazılıyordu, operasyonel giderler kayıptan tamamen düşüyordu).
- `salesCosting.ts`'e `evaluateProposalMargin()` eklendi — `computeSalesCosting`'deki `belowFloor`/`alarmReason` formatıyla tutarlı.
- `proposals.ts` `POST /` ve `PUT /:id`, `content.totalCostBase` mevcutsa marjı tenant'ın `marginFloorPct`'ine karşı değerlendiriyor; eşik altındaysa GM/SALES_MGR'a `Notification` + `logActivity` detayına `marginPct`/`belowFloor` yazıyor + response'a `marginWarning` ekliyor. **Kayıt reddedilmiyor** — yalnız görünür ve denetlenebilir hâle geliyor (DMO alarm deseniyle aynı ruh: engelleme değil, bilgilendirme + audit).
- `CRMModule.tsx`, `creditWarning` ile aynı desende `marginWarning`'i okuyup uyarı gösteriyor.

**Kapsam dışı bırakılan:** Proposal `content`'in tamamen backend-hesaplı hale getirilmesi (ham girdi → backend hesapla → UI sadece göster) — bu, mevcut manuel-override/pazarlık UX'ini kaldırır, ayrı bir UX kararı gerektirir.
