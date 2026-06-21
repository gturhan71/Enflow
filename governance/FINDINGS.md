# Enflow — Rol/Birim Uygunluk Denetimi: Bulgular & Karar Kütüğü

> `pnpm audit:roles` ile üretilen bulguların kalıcı denetim izi.
> Karar etiketleri: **SHOWN-OK** (mevcut doğru) · **ADDED** (matrise eklendi) ·
> **FIXED** (kaynak düzeltildi → commit) · **ACCEPTED** (gerekçeli kabul, değişiklik yok).

## Faz 0 — İskele temel çizgisi (2026-06-21)

İlk `pnpm audit:roles`: **6 ERROR · 0 WARN · 68 INFO**. INFO'ların tamamı matris
iskeleti boş olduğu için (Faz 1'de doldurulacak). ERROR'lar gerçek tutarsızlıklar:

| # | Kat | Bulgu | Durum |
|---|-----|-------|-------|
| E1 | C1 | `requireRole 'SALES_MANAGER'` (contractWorkflow.ts) ROLE_LABELS'ta yok → **ölü kapı** | OPEN → Faz 1 Satış turu |
| E2 | C1 | `requireRole 'PROJECT_MANAGER'` (contractWorkflow.ts) ROLE_LABELS'ta yok → **ölü kapı** | OPEN → Faz 1 Proje turu |
| E3 | C6 | agent `AGENT_PROJECT` role `'PROJECT_MANAGER'` ROLE_LABELS'ta yok | OPEN → Faz 1 Proje turu |
| E4 | C6 | agent `AGENT_CRM` role `'SALES_MANAGER'` ROLE_LABELS'ta yok | OPEN → Faz 1 Satış turu |
| E5 | C6 | agent `AGENT_PRESALES` role `'PRESALES'` ROLE_LABELS'ta yok | OPEN → Faz 1 Presales turu |
| E6 | C6 | agent `AGENT_PROCUREMENT` role `'PROCUREMENT'` ROLE_LABELS'ta yok | OPEN → Faz 1 Satın Alma turu |

**Gözlem (göster modu):** `SALES_MGR` rolünün hiçbir endpoint kapısı yok — çünkü
contractWorkflow kapısı `SALES_MANAGER` (yazım hatası) içeriyor; gerçek `SALES_MGR`
kullanıcısı (nur.becerikli) sözleşme modülünden backend'de reddediliyor olabilir.

**Karar:** ERROR'lar ilgili Faz 1 personel turunda FIXED edilecek (kaynak rol
adlarını ROLE_LABELS kanonik anahtarlarına hizala), RBAC 69/69 korunarak.

## Faz 1 — Personel turları

### Tur 1 — GM / Admin (Üst Yönetim · Sistem) — 2026-06-21
**Göster özeti:**
- `GENERAL_MANAGER`: DB'de var (gokhan); AuthContext'te **superuser** (hasPermission her zaman true → tüm modüller). 9 endpoint kapısında (adminTest/archive/contractWorkflow/customers/opportunities/plugins/tenants/units/users). Onay zincirlerinde: OPPORTUNITY, PROPOSAL, CONTRACT_WORKFLOW_SIGNING (= karar mekanizması). Agent ikamesi yok (doğru).
- `ADMIN`: DB kullanıcısı yok, hiçbir kapı/onay/agent kullanmıyor. ROLE_LABELS'ta var ('Sistem Yöneticisi').

**Kararlar:**
- **ADDED** `GENERAL_MANAGER` → matris: `modules:['*']` (superuser), endpointDomains (9), decisionRights (3 onay + admin yönetimi/lisans/arşiv), approvalIn (3). `reviewed: DONE`.
- **ACCEPTED** `ADMIN` → rezerve/kullanılmıyor; fiilen GM superuser. `reviewed: ACCEPTED`, değişiklik yok.
- Kaynak FIX yok (bu turda). Denetim sonrası: **6 ERROR · 0 WARN · 51 INFO** (GM/Admin C4/C5 boş-INFO'ları kalktı). tsc 0.

### Tur 2 — Satış (SALES_MGR · SALES_REP · SALES_SUPPORT) — 2026-06-21
**Göster özeti:**
- `SALES_MGR` (HUMAN, nur.becerikli): **hiçbir endpoint kapısında yok** — çünkü contractWorkflow kapısı `SALES_MANAGER` (yazım hatası); kullanıcı `CONTRACTS_VIEW` izinli olduğundan FE'de Sözleşme nav'ını görüyor ama BE reddediyor. Onay zincirinde değil. CRM agent (`AGENT_CRM`) bu koltuğu doldurmalı ama role `'SALES_MANAGER'` (eşleşmiyor).
- `SALES_REP` (HUMAN): customers + opportunities kapıları (GM_OR_SALES). Front-line.
- `SALES_SUPPORT` (HUMAN, nesrin): backend kapısı yok; FE SALES_SUPPORT_VIEW (İhale/İSAB).
- Gözlem: kullanıcı izin-JSON'ları tutarsız (manuel atanmış; CRM_VIEW var ama alt-izinler CRM_OPPS_VIEW vb. yok → alt-menü görünmeyebilir). **Veri tutarsızlığı** — ileride ayrı veri temizliği (kod değil).

**Kararlar:**
- **FIXED** `SALES_MANAGER` → `SALES_MGR` 4 yerde (hepsi gerçek rolle eşleşmediği için ölüydü):
  `contractWorkflow.ts` requireRole (E1) · `pluginCatalog.ts` AGENT_CRM role (E4) · `unitReportingService.ts` CRM unit role · `ProcurementModule.tsx:186` PENDING_UNIT onay kontrolü (4. ölü kontrol). RBAC 69/69, tsc 0.
- **ADDED** SALES_MGR (decisionRights: PR birim onayı + sözleşme erişimi; agentSubstitute AGENT_CRM), SALES_REP (tasks: fırsat/müşteri/teklif/ziyaret), SALES_SUPPORT (tasks: İhale-İSAB/doküman). Hepsi `reviewed: DONE`.
- Denetim sonrası: **4 ERROR · 0 WARN · 34 INFO** (kalan ERROR: PROJECT_MANAGER×2 → Proje turu, PRESALES → Presales turu, PROCUREMENT → Satın Alma turu).
- Açık veri-temizliği notu: satış kullanıcılarının izin-JSON'larını matris `modules` ile hizalama (ileride).

### Tur 3 — Presales (PRESALES_MGR · PRESALES_ENG · TECHNICAL_SPEC) — 2026-06-21
**Göster özeti:**
- `PRESALES_MGR` (UNSTAFFED): kapı/onay/agent yok; Presales agent (`AGENT_PRESALES`) role `'PRESALES'` (phantom) ile bu koltuğu dolduramıyordu.
- `PRESALES_ENG` (HUMAN, aliveli/goktug): `units.ts` GET kapısında (GM_OR_PRESALES) — **read-only liste**; POST/DELETE GM-only.
- `TECHNICAL_SPEC` (UNSTAFFED): tanımlı, kullanımda değil.

**Kararlar:**
- **ACCEPTED** `PRESALES_ENG` units.ts GET erişimi — read-only, güvenlik sorunu değil (UI birim listesi). endpointDomains'a `units` (GET) olarak eklendi.
- **FIXED** `PRESALES` → `PRESALES_MGR` 2 yerde (agent'lar daima birim yöneticisi rolüne maplanır deseni): `pluginCatalog.ts` AGENT_PRESALES role (E5) · `unitReportingService.ts` PRESALES unit role. tsc 0, RBAC 69/69.
- **ADDED** PRESALES_MGR (decisionRights: teknik/BoM onayı; agentSubstitute AGENT_PRESALES), PRESALES_ENG (tasks: BoM/maliyet/şartname/teklif), TECHNICAL_SPEC (tasks: teknik uzmanlık/çözüm tasarımı). Hepsi `reviewed: DONE`.
- Denetim sonrası: **3 ERROR · 0 WARN · 30 INFO** (kalan ERROR: PROJECT_MANAGER×2 → Proje, PROCUREMENT → Satın Alma).

### Tur 4 — İSAB/İhale (ISAB_MGR) · Satın Alma (PROCUREMENT_MGR) — 2026-06-21
**Göster özeti:**
- `ISAB_MGR` (UNSTAFFED): kapı/onay yok ama `AGENT_TENDER` (role ISAB_MGR ✓) bu koltuğu dolduruyor.
- `PROCUREMENT_MGR` (UNSTAFFED): kapı/onay/agent yok — çünkü AGENT_PROCUREMENT role `'PROCUREMENT'` (phantom).
- `'PROCUREMENT'` 8 kullanımdan yalnız 3'ü ROL: unitReporting:15, pluginCatalog:135, ProcurementModule:187 (diğerleri category/relatedModule/milestoneType/unitKey — dokunulmadı).

**Kararlar:**
- **FIXED** `PROCUREMENT` → `PROCUREMENT_MGR` 3 rol-kullanımı: `pluginCatalog.ts` AGENT_PROCUREMENT role (E6) · `unitReportingService.ts` · `ProcurementModule.tsx:187` PENDING_PROCUREMENT onay kontrolü (ölüydü). tsc 0, RBAC 69/69.
- **ADDED** ISAB_MGR (decisionRights: ihale checklist/teminat + WON→Sözleşme T3; agent AGENT_TENDER), PROCUREMENT_MGR (decisionRights: PR satınalma aşaması onayı + tedarikçi/PO; agent AGENT_PROCUREMENT). `reviewed: DONE`.
- Denetim sonrası: **2 ERROR · 0 WARN · 28 INFO** (kalan ERROR: PROJECT_MANAGER×2 → Proje turu).

### Tur 5 — Finans (FINANCE_MGR) · İGPD (IGPD_MGR) — 2026-06-21
**Göster özeti:** Her ikisi de tutarlı — roller ∈ labels, contractWorkflow kapısında, OPPORTUNITY+PROPOSAL swimlane'inde, doğru agent (AGENT_FINANCE **ADVISORY-only** ✓ para; AGENT_IGPD advisory/autonomous). DB personeli yok → AGENT_ONLY.

**Kararlar:**
- **Kaynak FIX yok** (zaten tutarlı).
- **ADDED** FINANCE_MGR (decisionRights: swimlane finansal onay + maliyet onayı + fatura/teminat; approvalIn OPPORTUNITY/PROPOSAL; agent ADVISORY-only), IGPD_MGR (decisionRights: swimlane İGPD onayı + BD triyajı agentTriage; agent advisory/autonomous). `reviewed: DONE`.
- Bu tur **yalnız matris** değişti (app kodu yok) → RBAC etkilenmez. Denetim sonrası: **2 ERROR · 0 WARN · 20 INFO**. tsc 0.

### Tur 6 — KSU/Sözleşme · KGD/Kalite · Proje (PROJECT_MGR) — 2026-06-21
**Göster özeti:**
- `KSU_MGR` (UNSTAFFED): contractWorkflow kapısı + 3 onay zinciri (OPPORTUNITY/PROPOSAL son aşama + CONTRACT_WORKFLOW_SIGNING 1. aşama). **Agent ikamesi YOK.**
- `KGD_MGR` (UNSTAFFED): kapı/onay/agent yok; workflow adımı "Kalite güvence ve proje devri".
- `PROJECT_MGR` (UNSTAFFED): kapı/onay yok; AGENT_PROJECT role `'PROJECT_MANAGER'` (phantom) → koltuğu dolduramıyordu.

**Kararlar:**
- **FIXED** `PROJECT_MANAGER` → `PROJECT_MGR` 3 yerde: `contractWorkflow.ts` requireRole (E2) · `pluginCatalog.ts` AGENT_PROJECT role (E3) · `unitReportingService.ts`. RBAC 69/69, tsc 0.
- **ADDED** KSU_MGR (decisionRights: sözleşme imza + swimlane KSU onayı + evrak; 3 approvalIn), KGD_MGR (decisionRights: kalite/proje devri workflow adımı), PROJECT_MGR (decisionRights: milestone/devir/maliyet; agent AGENT_PROJECT). `reviewed: DONE`.
- **⚠️ ACCEPTED-gözlem (KSU_MGR):** kritik sözleşme onay rolü hem **personelsiz hem agentsiz** → `autoSkipOrphanStages` ile imza/onay aşamaları SKIPPED oluyor. Risk notu matrise yazıldı (ileride personel/agent kararı — bu turun kapsamı dışı).
- **Denetim sonrası: 0 ERROR · 0 WARN · 13 INFO** 🎯 — tüm deterministik tutarsızlıklar giderildi. tsc 0 (backend+root), RBAC 69/69.

### Tur 7 — Hukuk (LEGAL_MGR) + kalan roller (ADMIN/OPERATIONS_MGR/HR_MGR/AUDITOR) — 2026-06-21
**Göster özeti:** LEGAL_MGR tutarlı (contractWorkflow kapısı + AGENT_LEGAL ADVISORY-only ✓ hukuk; onay zincirinde değil — danışman). ADMIN/OPERATIONS/HR/AUDITOR: DB personeli + somut mekanizma yok.

**Kararlar:**
- **Kaynak FIX yok** (hepsi tutarlı).
- **ADDED** LEGAL_MGR (decisionRights: hukuki görüş/vaka + sözleşme incelemesi + hukuki talep; agent ADVISORY-only) → `reviewed: DONE`.
- **ADDED/ACCEPTED** ADMIN (Ayarlar SETTINGS_* sahibi → C2 settings INFO'ları kalktı), OPERATIONS_MGR + HR_MGR (tanımlı ama sistemde somut akış/modül yok → ACCEPTED), AUDITOR (salt-okunur denetim izi → ACCEPTED).
- **Denetim sonrası: 0 ERROR · 0 WARN · 3 INFO.** tsc 0 (backend+root). RBAC etkilenmez (Tur 7 yalnız matris).

## Faz 1 Kapanış — Kalan 3 INFO (ACCEPTED, kapsam dışı)
1. **C2** `NAV requiredPermission 'GENERAL_MANAGER'` — `settings-license-generate` + `settings-modules` izin yerine **rol adı** kullanıyor. Çalışıyor (GM superuser true) ama stil tutarsızlığı. ACCEPTED → ileride `SETTINGS_ADMIN` gibi gerçek izne çevrilebilir.
2. **C7** `SALES_MGR` RBAC süitinde yok — test kapsam boşluğu. ACCEPTED → opsiyonel test genişlemesi.
3. **C7** `SALES_SUPPORT` RBAC süitinde yok — aynı. ACCEPTED.

**Faz 1 SONUÇ:** 9 personel tipi turu + iskelet. Toplam **9 kaynak FIX** (4× SALES_MANAGER, 2× PRESALES, 3× PROCUREMENT, 3× PROJECT_MANAGER — hepsi phantom rol → kanonik anahtar; not: bazıları aynı dosyada). 6 ERROR → **0 ERROR**. 19 rol matriste tanımlı (`reviewed: DONE`/`ACCEPTED`). RBAC 69/69 her FIX turunda korundu; tsc 0.
- **Açık gözlemler (kod değil, ileride):** (a) satış kullanıcı izin-JSON drift'i — veri temizliği; (b) **KSU_MGR kritik sözleşme onay rolü personelsiz+agentsiz** → imza aşamaları auto-skip; (c) NAV GENERAL_MANAGER-as-perm.

## Faz 2 — RBAC süiti rol kapsamı genişletme (2026-06-21)
**Talep:** cross-tenant izolasyonu korunsun + diğer roller de teste dahil edilsin.
- **9 yeni test rolü:** `sales_mgr`, `sales_support` (gerçek DB kullanıcıları) + `finance_mgr`, `igpd_mgr`, `ksu_mgr`, `project_mgr`, `legal_mgr`, `procurement_mgr`, `isab_mgr` (global-setup ile `rbac-test-*` email'li **seed**; teardown cleanup otomatik siler).
- **apiMatrix (14) + uiMatrix (4)** expect'leri her yeni rol için **route guard'larından deterministik türetildi** (ND/NA/NCW + UH/UPRES/UCRM spread'leri). Kilit: contract-workflows 7-rol gate → sales_mgr/finance/igpd/ksu/project/legal **allow**, sales_support/procurement/isab **deny** (Tur 2+6 fix'lerini kilitler).
- Seed izinleri = governance matris `modules` (UI görünürlüğü buradan türedi).
- **Sonuç: RBAC 69 → 258 passed** (12 rol + cross-tenant izolasyonu). Seed kullanıcılar temizlendi. Bu, denetimdeki **C7 kapsam boşluğunu kapattı** → `audit:roles` artık **0 ERROR · 0 WARN · 1 INFO** (tek kalan: NAV GENERAL_MANAGER-as-perm, ACCEPTED).
- Yeni dosyalar: `tests/rbac/global-setup.ts` + `playwright.config.ts` globalSetup; `rbac.config.ts` RoleName/ROLE_NAMES/roles/SEED_ROLES + matris expect'leri.
