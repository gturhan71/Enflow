# Uçtan Uca Test Ortamı — Oracle Planı

> **Amaç:** Enflow'un iddia ettiği "tüm birimler-arası geçişler otomatik, zincir kapalı" ve "8 sanal agent boş koltuğu dolduruyor" mimari iddialarını, sentetik veri → **beklenen sonuç (oracle)** → **gerçekleşen sonuç** karşılaştırmasıyla gerçek bir QA mühendisliği disipliniyle kanıtlamak.
>
> **Durum: Faz 0-4 TAMAMLANDI + 3 bulgu DÜZELTİLDİ.** Üç oracle tablosu (§1-3) + kod olarak `tests/e2e-scenario/` (7 dosya, 12 test, hepsi yeşil) + `pnpm test:e2e-scenario` (bkz. `tests/e2e-scenario/README.md`). §6, testlerin **empirik olarak doğruladığı/çürüttüğü** iddiaları ve bunlardan 3'ünün (T4 status tutarsızlığı, PURCHASE_APPROVAL status tutarsızlığı, agent güvenlik sınırı) nasıl düzeltildiğini + hangi regresyon testinin koruduğunu listeler.

## 0. Kapsam ve Yöntem — neden "tam kombinatorik" değil

20 rol × 14 süreç × 8 agent'ı harfiyen çarpmak binlerce senaryo üretir ve sürdürülemez olur. Bunun yerine **eşdeğerlik sınıfı + sınır değer** yaklaşımı kullanılır (klasik QA mühendisliği pratiği):

- **Süreç motoru (Tablo 1):** her `processKey` için happy-path + reject-path + "boş koltuk" (orphan stage) path — 3 varyant × 14 süreç.
- **Rol × onay (Tablo 2):** mevcut `governance/role-matrix.ts` "iddia" alanı (`approvalIn`) ile `workflowTemplate.ts`'teki **gerçek** kod davranışı çapraz karşılaştırılır — kombinatorik değil, doğrudan kod-karşılaştırması.
- **Sanal agent / boş koltuk (Tablo 3, öncelikli):** 8 agent × {ADVISORY, AUTONOMOUS} × {lisans yok/ACTIVE/EXPIRED} × {koltuk dolu/boş} — bu gerçekten kombinatorik ama sınırlı (8×2×3×2=96 hücre, ama çoğu hücre `isPluginEntitled`/`allowedModes` kapısında aynı sonuca düşer, gerçek benzersiz durum sayısı ~30).

Tüm tablolar **kod okunarak** (varsayımla değil) çıkarıldı: `backend/src/services/workflowTemplate.ts` (DEFAULT_WORKFLOW_TEMPLATE, satır 29-150), `backend/src/services/processEngine.ts` (advanceProcess/walkForward), `backend/src/services/pluginCatalog.ts` (PLUGIN_CATALOG), `backend/src/services/virtualAgentService.ts` (runAgent), `backend/src/services/approvalChainService.ts` (autoSkipOrphanStages), `governance/role-matrix.ts`.

---

## 1. Tablo 1 — Süreç Motoru Oracle Tablosu (14 processKey)

Her süreç `advanceProcess(tenantId, processKey, entityType, entityId, opts)` üzerinden yürür (`processEngine.ts:794-859`). "Boş koltuk" sütunu: o stage'in rolüne `status:'ACTIVE'` hiçbir `User` yoksa (`autoSkipOrphanStages`) ne olur — **agent var mı**, agent varsa **hangi modda gerçek eyleme dönüşür**, agent yoksa **her zaman SKIPPED** (chain yine de ilerler, insan onayı sessizce atlanır — bu, her satırda ayrı ayrı test edilmesi gereken kritik bir davranıştır).

| # | processKey | entityType | Aşama sırası (rol) | Happy-path bitiş | Reject-path | Boş koltuk (agent var mı) |
|---|---|---|---|---|---|---|
| 1 | `OPPORTUNITY_APPROVAL` | OPPORTUNITY | SALES_MGR→IGPD_MGR→GENERAL_MANAGER | chain COMPLETED; **DOĞRULANDI** (`opportunity-approval.spec.ts` PE-01-HAPPY) — chain COMPLETED olunca generic approve ucu (`approvalChains.ts:228-241`) `Opportunity.technicalStatus='APPROVED'` + `status='PROPOSAL'` yazıyor, motor değil çağıran uç | herhangi aşamada REJECT→chain REJECTED | SALES_MGR: AGENT_CRM var. IGPD_MGR: AGENT_IGPD var. GENERAL_MANAGER: **agent YOK→her zaman SKIPPED — DOĞRULANDI** (PE-01-ORPHAN-GM: GM koltuğu boşken chain hiç insan GM onayı olmadan COMPLETED oldu) |
| 2 | `CONTRACT_SIGNING` | CONTRACT_WORKFLOW_SIGNING | LEGAL_MGR→KSU_MGR→GENERAL_MANAGER | chain COMPLETED; route DRAFT/…→SIGNED yapar | REJECT→chain REJECTED | LEGAL_MGR: AGENT_LEGAL var ama **ADVISORY-only→asla AUTONOMOUS olamaz→her zaman SKIPPED**. KSU_MGR: agent YOK→SKIPPED. GENERAL_MANAGER: agent YOK→SKIPPED |
| 3 | `TENDER_SUBMIT_APPROVAL` | TENDER | SALES_MGR→AUTO(`SUBMIT_TENDER`) | Tender.status→SUBMITTED | REJECT→chain REJECTED, AUTO adım hiç çalışmaz | SALES_MGR: AGENT_CRM var |
| 4 | `TENDER_TO_CONTRACT` **(T3)** | TENDER | ISAB_MGR→AUTO(`CREATE_CONTRACT_FROM_TENDER`) | Tender.contractWorkflowId set + yeni ContractWorkflow(DRAFT) | REJECT→chain REJECTED | ISAB_MGR: AGENT_TENDER var |
| 5 | `CONTRACT_TO_PROJECT` **(T4)** | CONTRACT_WORKFLOW_SIGNING | KGD_MGR→PROJECT_MGR→AUTO(`CREATE_PROJECT_FROM_ENTITY`) | wf.status→TRANSFERRED + Project oluşur; **BULGU (bkz. §6.1):** PROJECT_MGR dolu ama henüz onaylamamışsa proje OLUŞMAZ ve chain PENDING kalır, AMA `/transfer` ucu `wf.status`'u yine de koşulsuz TRANSFERRED yazıyor — **DOĞRULANDI** (`contract-to-project.spec.ts` PE-05-INCONSISTENCY) | REJECT→chain REJECTED | KGD_MGR: **agent YOK→her zaman SKIPPED (kalite güvence kapısı sessizce atlanır) — DOĞRULANDI**. PROJECT_MGR: AGENT_PROJECT var |
| 6 | `CONTRACT_TO_PROCUREMENT` | CONTRACT_WORKFLOW_SIGNING | GENERAL_MANAGER→AUTO(`CREATE_PURCHASE_REQUEST_FROM_CONTRACT`, role:PROCUREMENT_MGR yalnız atıf) | PurchaseRequest(DRAFT) oluşur | REJECT→chain REJECTED | GENERAL_MANAGER: agent YOK→SKIPPED |
| 7 | `OPPORTUNITY_TO_PROJECT` **(T1)** | OPPORTUNITY | GENERAL_MANAGER→AUTO(`CREATE_PROJECT_FROM_ENTITY`) | WON opp→Project oluşur | REJECT→chain REJECTED | GENERAL_MANAGER: agent YOK→SKIPPED. **DOĞRULANDI** (`opportunity-to-project.spec.ts` PE-07-ORPHAN-GM): GM koltuğu boşken proje **tek HTTP çağrısında, hiç insan onayı olmadan** (201, `pending` değil) otomatik açıldı — SKIP gerçekten "resolved" sayılıp AUTO adımı senkron tetikliyor. |
| 8 | `PURCHASE_APPROVAL` | PURCHASE_REQUEST | (role:null, "Birim onayı")→PROCUREMENT_MGR→GENERAL_MANAGER | route DRAFT→…→PO_ISSUED yapar; **BULGU (bkz. §6.2):** DRAFT'tan `/approve` çağrısı zinciri yalnız OLUŞTURUR (stage0'ı onaylamaz) ama `PR.status`'u yine de PENDING_UNIT'e ilerletir — T4 ile aynı sınıf "status zincirden bağımsız ilerliyor" deseni | REJECT→chain REJECTED | Stage0 `role:null` orphan tespiti **DOĞRULANDI**: yalnız `unitId` (birim) üyeliğine bakıyor (`resolveEffectiveApprover`, role null ise tek koşul `user.unitId===stage.unitId`) — `role-approval-crosscheck.spec.ts`. PROCUREMENT_MGR: AGENT_PROCUREMENT var. GENERAL_MANAGER: agent YOK→SKIPPED |
| 9 | `PURCHASE_TO_COST_ITEM` **(T5)** | PURCHASE_REQUEST | AUTO(`CREATE_PURCHASE_COST_ITEM`) tek adım | ProjectCostItem/CostItem upsert | — (onay yok) | — (onay gerektirmez, her zaman çalışır) |
| 10 | `PURCHASE_TO_INVOICE` **(T6)** | PURCHASE_REQUEST | FINANCE_MGR→AUTO(`CREATE_INVOICE_FROM_PURCHASE`) | PR→INVOICED/CLOSED + Invoice(PURCHASE) | REJECT→chain REJECTED | FINANCE_MGR: AGENT_FINANCE var ama **ADVISORY-only→her zaman SKIPPED→finans onayı olmadan fatura yine de oluşur — DOĞRULANDI** (`purchase-to-invoice.spec.ts` PE-10-SKIP) + **GÜVENLİK BULGUSU** (bkz. §6.3): entitlement `mode` doğrudan (API dışı) `AUTONOMOUS` yapılırsa `autoSkipOrphanStages` bunu `allowedModes` sınırına bakmadan kabul ediyor — agent stage'i gerçekten "onaylıyor" (PE-SECURITY-01) |
| 11 | `PROJECT_TO_INVOICE` | PROJECT | FINANCE_MGR→AUTO(`CREATE_SALES_INVOICE_FOR_PROJECT`) | Invoice(SALES) oluşur | REJECT→chain REJECTED | Aynı #10 — FINANCE_MGR SKIP→yine de fatura oluşur |
| 12 | `CRM_HANDOFF` | OPPORTUNITY | PRESALES_MGR (tek adım, TodoTask devri) | devir görevi PRESALES_MGR'a düşer | — | PRESALES_MGR: AGENT_PRESALES var |
| 13 | `PRESALES_HANDOFF` | OPPORTUNITY | SALES_MGR (tek adım) | devir görevi SALES_MGR'a düşer | — | SALES_MGR: AGENT_CRM var |
| 14 | `BOM_COST_ANALYSIS_HANDOFF` | OPPORTUNITY | SALES_MGR + `recipientField:assignedToId` | çözülürse görev doğrudan fırsat sahibine; çözülemezse SALES_MGR fallback | — | recipientField çözülürse orphan mantığı devre dışı; çözülemezse AGENT_CRM devreye girebilir |

**Not (T1/T6/T4 özel önemi):** #5, #7, #10, #11 satırları, "skip-logic zinciri asla kilitlemez" tasarım kararının (Faz 5, CLAUDE.md) **finansal/kalite onayını sessizce atlayabileceği** anlamına gelip gelmediğini doğrudan test eder — bu, mevcut hiçbir test paketinde kanıtlanmamış, doğrulanması gereken en yüksek riskli iddia.

---

## 2. Tablo 2 — Rol × Onay Çapraz Doğrulama (governance/role-matrix.ts iddiası vs. gerçek kod)

`governance/role-matrix.ts`'teki `approvalIn: string[]` alanı **"tanımlayıcıdır" (descriptive)**, koddan otomatik türetilmez (dosyanın kendi yorumu, satır 7-9) ve `pnpm audit:roles` yalnız statik/regex tutarlılık denetler — çalışma zamanı davranışını doğrulamaz. Kod okuması, iddia ile gerçek arasında somut sapmalar ortaya çıkardı:

| Rol | role-matrix.ts `approvalIn` iddiası | Gerçek runtime onay kapıları (workflowTemplate.ts) | Sapma |
|---|---|---|---|
| GENERAL_MANAGER | `[OPPORTUNITY, PROPOSAL, CONTRACT_WORKFLOW_SIGNING]` | OPPORTUNITY_APPROVAL#2, CONTRACT_SIGNING#2, CONTRACT_TO_PROCUREMENT#0, OPPORTUNITY_TO_PROJECT#0, PURCHASE_APPROVAL#2 | **PROPOSAL iddiası doğrulanamıyor** (14 processKey'de PROPOSAL entityType'lı süreç yok); **PURCHASE_REQUEST eksik** (2 stage'de gate ediyor ama iddiada yok) |
| FINANCE_MGR | `[OPPORTUNITY, PROPOSAL]` | PURCHASE_TO_INVOICE#0, PROJECT_TO_INVOICE#0 | **Tamamen yanlış entityType'lar** — gerçekte OPPORTUNITY/PROPOSAL'da hiç yer almıyor, PURCHASE_REQUEST/PROJECT'te yer alıyor |
| IGPD_MGR | `[OPPORTUNITY, PROPOSAL]` | OPPORTUNITY_APPROVAL#1 | OPPORTUNITY doğru; PROPOSAL doğrulanamıyor |
| KSU_MGR | `[OPPORTUNITY, PROPOSAL, CONTRACT_WORKFLOW_SIGNING]` | CONTRACT_SIGNING#1 | CONTRACT_WORKFLOW_SIGNING doğru; **OPPORTUNITY/PROPOSAL'da KSU_MGR hiç yok** |
| SALES_MGR | `[]` | OPPORTUNITY_APPROVAL#0, TENDER_SUBMIT_APPROVAL#0, PRESALES_HANDOFF#0, BOM_COST_ANALYSIS_HANDOFF#0 | **4 stage'de gate ediyor, iddia tamamen boş** |
| LEGAL_MGR | `[]` | CONTRACT_SIGNING#0 | **Boş, ama gerçekte gate ediyor** |
| ISAB_MGR | `[]` | TENDER_TO_CONTRACT#0 | **Boş, ama gerçekte gate ediyor** |
| KGD_MGR | `[]` | CONTRACT_TO_PROJECT#0 | **Boş, ama gerçekte gate ediyor** |
| PROJECT_MGR | `[]` | CONTRACT_TO_PROJECT#1 | **Boş, ama gerçekte gate ediyor** |
| PROCUREMENT_MGR | `[]` | PURCHASE_APPROVAL#1 | **Boş, ama gerçekte gate ediyor** |
| PRESALES_MGR | `[]` | CRM_HANDOFF#0 | **Boş, ama gerçekte gate ediyor** |

**Sonuç:** `role-matrix.ts.approvalIn` bugün itibarıyla stale/eksik — 7 rol için tamamen boş, 4 rol için yanlış/eksik entityType. Bu doküman onaylandıktan sonra Faz 3'te hem (a) çalışma-zamanı davranışı test kodunda doğrulanacak hem de (b) `role-matrix.ts`'in bu tabloya göre güncellenmesi ayrı bir maddeye alınacak (Faz 0 kapsamı dışı — kullanıcı onayı gerekir).

---

## 3. Tablo 3 — Sanal Agent / Boş Koltuk Matrisi (öncelikli)

### 3.1 Agent↔rol eşlemesi (pluginCatalog.ts, kod-doğrulanmış)

| Agent key | Doldurduğu rol | unitKey | allowedModes | Devreye girebileceği stage'ler (Tablo 1'den) |
|---|---|---|---|---|
| `AGENT_TENDER` | ISAB_MGR | TENDER | ADVISORY, AUTONOMOUS | TENDER_TO_CONTRACT#0 |
| `AGENT_PROJECT` | PROJECT_MGR | PROJECT | ADVISORY, AUTONOMOUS | CONTRACT_TO_PROJECT#1 |
| `AGENT_FINANCE` | FINANCE_MGR | FINANCE | **ADVISORY-only** | PURCHASE_TO_INVOICE#0, PROJECT_TO_INVOICE#0 (asla AUTONOMOUS onaylayamaz) |
| `AGENT_LEGAL` | LEGAL_MGR | LEGAL | **ADVISORY-only** | CONTRACT_SIGNING#0 (asla AUTONOMOUS onaylayamaz) |
| `AGENT_CRM` | SALES_MGR | CRM | ADVISORY, AUTONOMOUS | OPPORTUNITY_APPROVAL#0, TENDER_SUBMIT_APPROVAL#0, PRESALES_HANDOFF#0, BOM_COST_ANALYSIS_HANDOFF#0 |
| `AGENT_IGPD` | IGPD_MGR | IGPD | ADVISORY, AUTONOMOUS | OPPORTUNITY_APPROVAL#1 |
| `AGENT_PRESALES` | PRESALES_MGR | PRESALES | ADVISORY, AUTONOMOUS | CRM_HANDOFF#0 |
| `AGENT_PROCUREMENT` | PROCUREMENT_MGR | PROCUREMENT | ADVISORY, AUTONOMOUS | PURCHASE_APPROVAL#1 |

### 3.2 "Agent'sız roller" — kritik tekil arıza noktaları

`GENERAL_MANAGER`, `KSU_MGR`, `KGD_MGR` için `PLUGIN_CATALOG`'da **hiçbir VIRTUAL_AGENT tanımı yok**. Bu üç rol Tablo 1'de toplam **7 stage'i** gate ediyor (GENERAL_MANAGER tek başına 5 farklı süreçte). Koltuk boşsa bu stage'ler **her zaman SKIPPED** olur, agent hiçbir zaman devreye giremez — chain yine de "resolved" sayılıp ilerler. **Bu, kullanıcının orijinal sorusunun kanıtlanması gereken en kritik bulgusu**: GM/KSU/KGD koltuğu boşken zincirin insan onayı olmadan sessizce ilerlemesi, sistemin "kapalı zincir" iddiasının bir istisnası mı yoksa kasıtlı tasarım mı — test sonucu bunu netleştirecek.

### 3.3 Hücre matrisi (her agent için tekrarlanan şablon)

| Mod | Entitlement | Koltuk | Beklenen `ApprovalStage.status` | Beklenen `AgentRun.status` | `autonomousAction.execute()` tetiklenir mi | `ActivityLog` |
|---|---|---|---|---|---|---|
| — | yok/DISABLED/EXPIRED | boş | SKIPPED | — (agent hiç çalışmaz) | Hayır | yok |
| ADVISORY | ACTIVE/TRIAL | boş | SKIPPED (approval-chain akışında) | `PENDING_RATIFICATION` (`POST /agents/:key/run` doğrudan çağrılırsa) | Hayır | `AGENT_RUN` (actorType=AGENT) |
| AUTONOMOUS (yalnız allowedModes içeriyorsa) | ACTIVE/TRIAL | boş | **APPROVED** (agent-imzalı, `approverId=agentActorId`) | `RATIFIED` (auto) | **Evet**, ancak yalnız üç şart birden: `mode===AUTONOMOUS && allowedModes.includes('AUTONOMOUS') && result.autonomousAction.reversible` | `AGENT_RUN` + (eylem varsa) `AGENT_ACTION` (actorType=AGENT) |
| herhangi | herhangi | **dolu** (ACTIVE insan var) | normal PENDING, insan onaylar | agent hiç tetiklenmez (orphan değil) | Hayır | normal `PROCESS_STAGE_APPROVE` (actorType=HUMAN) |

AGENT_FINANCE ve AGENT_LEGAL için "AUTONOMOUS" satırı **hiçbir zaman gerçekleşemez** (entitlement set edilirken `entitlementService` reddeder) — bu iki agent için matris yalnız ilk iki satırla sınırlı, üçüncü satır **negatif test** olarak doğrulanmalı (AUTONOMOUS'a geçirme denemesi 400 dönmeli).

---

## 4. Senaryo ID şeması (Faz 1-3 kod izlenebilirliği için)

| Önek | Anlamı | Örnek |
|---|---|---|
| `PE-<no>-HAPPY` | Tablo 1 satırı, happy-path | `PE-07-HAPPY` (OPPORTUNITY_TO_PROJECT) |
| `PE-<no>-REJECT` | Tablo 1 satırı, reject-path | `PE-07-REJECT` |
| `PE-<no>-ORPHAN` | Tablo 1 satırı, boş koltuk (agent yok/var) | `PE-07-ORPHAN` |
| `AGENT-<key>-<mod>-<ent>-<koltuk>` | Tablo 3 hücresi | `AGENT-PROCUREMENT-AUTONOMOUS-ACTIVE-EMPTY` |
| `ROLE-<rol>-XCHECK` | Tablo 2 satırı, çalışma-zamanı doğrulaması | `ROLE-FINANCE_MGR-XCHECK` |

---

## 5. Uygulama — `tests/e2e-scenario/`

Katman 2-3 (fixture factory + runner), plandaki `tests/e2e-flows/` yerine mevcut projede zaten `.gitignore`'da anılan (daha önce yarım bırakılmış) `tests/e2e-scenario/` altında kuruldu — isimlendirme projenin kendi izini takip ediyor. Mimari, izole DB+port+process + gerçek HTTP "act" + Prisma "arrange" ayrımı: tam detay `tests/e2e-scenario/README.md`.

7 dosya, 12 test, hepsi yeşil (`pnpm test:e2e-scenario`, ~50sn, dev tenant-1'e dokunmaz):
`agent-orphan-seat.spec.ts` · `opportunity-approval.spec.ts` · `opportunity-to-project.spec.ts` · `contract-to-project.spec.ts` · `purchase-to-invoice.spec.ts` · `role-approval-crosscheck.spec.ts` · `purchase-approval-status-consistency.spec.ts` (§6.2 fix'i için eklendi).

**Kapsam notu:** 14 süreç × happy/reject/orphan tam kombinatoriği (42 senaryo) DEĞİL — §0'daki risk-bazlı yönteme göre en kritik/şüpheli iddiaları hedefleyen 10 senaryo seçildi (agent boş-koltuk önceliği + T1/T4/T6'nın "sessiz atlama" riski + 3 role×onay çapraz-kontrolü). Kalan süreçlerin (CONTRACT_SIGNING, TENDER_SUBMIT_APPROVAL, TENDER_TO_CONTRACT, CONTRACT_TO_PROCUREMENT, PROJECT_TO_INVOICE, CRM_HANDOFF, PRESALES_HANDOFF, BOM_COST_ANALYSIS_HANDOFF) happy/reject/orphan varyantları ve kalan 8 rolün (LEGAL_MGR, ISAB_MGR, KGD_MGR, PROJECT_MGR, PRESALES_MGR dahil) çapraz-doğrulaması **backlog** — mevcut fixture'lar (`fixtures/*.ts`, `helpers/scenarioSetup.ts`, `helpers/approvalDriver.ts`) üzerine doğrudan eklenebilir, yeni altyapı gerekmez.

---

## 6. Faz 1-3 Bulguları — Doğrulandı VE Düzeltildi

Üçü de test-doğrulanmış, kod satırıyla belgelenmiş **ve artık düzeltilmiş**. Her biri için hem "bug'lı hali kanıtlayan" hem "düzeltmeyi doğrulayan" test kalıcı olarak `tests/e2e-scenario/`'da duruyor (regresyon koruması).

### 6.1 — `ContractWorkflow.status` proje hiç oluşmamışken `TRANSFERRED` olabiliyordu (T4) — ✅ DÜZELTİLDİ

**Konum:** `backend/src/routes/contractWorkflow.ts:596-606` (`/:id/transfer` ucu).
**Sorun (buydu):** `advanceProcess('CONTRACT_TO_PROJECT', ...)` çağrısından sonra, zincirin gerçekten `COMPLETED` olup olmadığına hiç bakılmadan `status: 'TRANSFERRED'` koşulsuz yazılıyordu. KGD_MGR boş koltuk (skip) ama PROJECT_MGR dolu+henüz onaylamamışken (chain PENDING, proje oluşmaz) bile sözleşme "TRANSFERRED" görünüyordu.
**Düzeltme:** status artık yalnız `result.chain.status === 'COMPLETED'` iken yazılıyor — hem AUTO adımın projeyi oluşturduğu normal akışı (kendi status'unu zaten `processEngine.ts` `createProjectFromEntity` içinde TRANSFERRED yapıyor) hem tenant'ın proje-otomasyonu hiç kurgulamadığı "yalnız görev aktarımı" akışını (tüm insan onayları COMPLETED, AUTO adım yok) doğru kapsıyor.
**Kanıt:** `tests/e2e-scenario/tests/contract-to-project.spec.ts` — `PE-05-FIX-PENDING` (zincir PENDING'ken status artık SIGNED'da kalıyor) + `PE-05-FIX-COMPLETED` (zincir gerçekten COMPLETED olunca status doğru şekilde TRANSFERRED oluyor, proje gerçekten var).

### 6.2 — `PurchaseRequest.status` ilk `/approve` çağrısında zincirden bağımsız ilerliyordu — ✅ DÜZELTİLDİ

**Konum:** `backend/src/routes/purchaseRequests.ts:181-260` (`/:id/approve`).
**Sorun (buydu):** Statü, `pr.status`'a göre sabit "+1 adım" (`nextStatus` map) ile ilerletiliyordu — bir aşama (orphan-skip veya AUTONOMOUS agent onayı ile) `advanceProcess` çağrısı SIRASINDA kendiliğinden atlanırsa (ör. tüm koltuklar boşsa zincir TEK çağrıda tamamen COMPLETED olabiliyor, bkz. §6.4/T1/T6 deseni) `PurchaseRequest.status` bunu yansıtmıyor, bir adım geride kalıyordu.
**Düzeltme:** `status` artık `advanceProcess` sonrası zincirin **gerçek** durumundan türetiliyor (`freshChain.status==='COMPLETED'` → `PO_ISSUED`, aksi halde en küçük `PENDING` `order`'a göre `PENDING_UNIT`/`PENDING_PROCUREMENT`/`PENDING_GM`); onay-alanı atıfları (`approvedByUnit` vb.) de `pr.status`'un ÖNCEKİ değeri yerine gerçekten onaylanan `stage.order`'a göre yazılıyor.
**Kanıt:** `tests/e2e-scenario/tests/purchase-approval-status-consistency.spec.ts` (`PE-08-ALL-ORPHAN`) — tüm 3 aşama da boş koltukken tek `/approve` çağrısı `DRAFT`'tan doğrudan `PO_ISSUED`'a (poNumber üretilmiş halde) atlıyor; eski kodda yanlışlıkla `PENDING_UNIT`'te kalırdı.

### 6.3 — GÜVENLİK: `autoSkipOrphanStages`, `AGENT_FINANCE`/`AGENT_LEGAL`'in `allowedModes:['ADVISORY']` sınırını kontrol etmiyordu — ✅ DÜZELTİLDİ

**Konum:** `backend/src/services/approvalChainService.ts` (`autonomousAgent` hesabı, `autoSkipOrphanStages` içinde).
**Sorun (buydu):** `runAgent()` (manuel agent çalıştırma) `allowedAuto = plugin.allowedModes.includes('AUTONOMOUS')` ile **çift kilit** uyguluyordu (`virtualAgentService.ts`); `autoSkipOrphanStages` (onay-zinciri boş-koltuk yolu) bu ikinci kilidi UYGULAMIYORDU, yalnız `PluginEntitlement.mode` alanına bakıyordu. Bugün API'den (`PUT /entitlements/:key`, `activatePluginLicense`) `AGENT_FINANCE`/`AGENT_LEGAL` için `mode=AUTONOMOUS` yazmak mümkün değil (entitlementService reddediyor) — yani **sömürülebilir bir açık değildi**, ama garanti yalnız YAZMA kapısında duruyordu, KULLANIM kapısında değil (savunma-derinliği eksikti).
**Düzeltme:** `autonomousAgent` hesabına `&& allowedAuto` (`plugin.allowedModes ?? ['ADVISORY','AUTONOMOUS']).includes('AUTONOMOUS')`) eklendi — `runAgent()`'teki kilitle simetrik.
**Kanıt:** `tests/e2e-scenario/tests/purchase-to-invoice.spec.ts` (`PE-SECURITY-01`) — entitlement doğrudan Prisma ile (API'yi bypass ederek) `mode:'AUTONOMOUS'` yapılsa bile FINANCE_MGR aşaması artık `SKIPPED` kalıyor, hiçbir `AgentRun` oluşmuyor.

### 6.4 — Diğer doğrulanan (bug OLMAYAN, tasarım-gereği) davranışlar

- GM/KSU/KGD için hiç sanal agent tanımlı değil (§3.2) → boş koltukta bu üç rolün onayı **her zaman ve sessizce** atlanıyor. Bu bir kod hatası değil ama **iş riski** olarak GM'e raporlanmalı: özellikle `GENERAL_MANAGER` 5 farklı süreçte (OPPORTUNITY_APPROVAL#2, CONTRACT_SIGNING#2, CONTRACT_TO_PROCUREMENT#0, OPPORTUNITY_TO_PROJECT#0, PURCHASE_APPROVAL#2) tek başına bu şekilde atlanabiliyor — **DOĞRULANDI** (PE-01-ORPHAN-GM, PE-07-ORPHAN-GM).
- Doğru rol onaylayabiliyor, yanlış rol 403 alıyor — **DOĞRULANDI** 3 örnekte (`role-approval-crosscheck.spec.ts`).
- `PURCHASE_APPROVAL` stage0 (`role:null`) orphan/onay tespiti birim-üyeliği (`unitId`) bazlı — **DOĞRULANDI**.
