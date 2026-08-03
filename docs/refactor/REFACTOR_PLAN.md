# Enflow — Kapsamlı Refactor Planı (davranış-koruyan, fazlı)

## Context (Neden)

Yazılım hızla büyüdü (~56k satır TS/TSX; 18 modül, 30+ router, iş motorları). Kod tabanı
**sağlıklı** (0 `as any`, 0 `@ts-ignore` FE, tenant izolasyonu, `check-no-mock`/`check-tenant-scope`
guard'ları, RBAC+IDOR test süiti). Yani bu bir *kurtarma* değil, **teknik borç azaltma + sürdürülebilirlik**
refactor'üdür. Amaç: **davranışı değiştirmeden** bakım kolaylığı, tekrar azaltma, test güvencesi.

> **İlke:** Big-bang YOK. Her faz davranış-koruyan, kalem-kalem commit, her adımda tsc 0 + `pnpm verify`
> yeşil + tenant-izolasyon 46/46 + dokunulan UI için Playwright render. Güvenli→riskli sırayla.

## Tespit Edilen Borç (envanter)

| Alan | Bulgu | Etki |
|------|-------|------|
| **God-component (FE)** | CRMModule 1883, ContractWorkflow 1570, ProjectMgmt 1323, Negotiation 1319, ManagementReporting 1219, Procurement 1161, Todo 1083 satır — çoğu tek dosyada iç içe | Bakım/test zor |
| **Tekrar** | `fmt`/para formatı **8 dosyada** kopya (`Intl.NumberFormat('tr-TR')`); pct/date benzer | Tutarsızlık riski |
| **console.log** | 51 çağrı (FE 10, BE 41) — `utils/logger` var ama benimsenmemiş | Prod kuralı ihlali |
| **Fat route** | finance 604, contractWorkflow 515, projects 508, opportunities 481 — iş mantığı route'ta | Test/yeniden-kullanım zor |
| **types.ts monolit** | 1213 satır tüm domain'ler tek dosyada | Navigasyon/çakışma |
| **Legacy/dead** | 14 "legacy" + 6 "geriye dönük" alias; **149 TODO** | Kafa karışıklığı |
| **Test boşluğu** | Yalnız RBAC/IDOR Playwright; **deterministik iş motorları (financeEngine/dmoCosting/overheadService/analyticsService) için 0 unit test** | Refactor'da sessiz kırılma riski |
| **BE `: any`** | 9 adet (üretilen hariç) | Küçük tip borcu |

## Fazlar (güvenli → riskli)

### Faz 0 — Güvenlik ağı (ÖNCE; her şeyi mümkün kılar) · risk: DÜŞÜK
- **Vitest** kur (backend) + iş motorları için **unit test**: `financeEngine` (computeCompanyOverhead,
  computeUnitParticipationLoad, projectMargins, lineBreakdown, VAT…), `dmoCosting` (efektif risturn,
  komisyon, kur açığı, alarm), `overheadService`/`analyticsService` saf hesaplar. → Mevcut davranışı
  **kilitler**; sonraki refactor'lar matematiği bozamaz.
- `scripts/check-no-console.mjs` guard'ı (check-no-mock deseninde) + `pnpm verify`'a ekle → yeni
  console.* engellenir.
- *Katkı-only; prod kod değişmez.*

### Faz 1 — Tekrar + logger (mekanik) · risk: DÜŞÜK-ORTA
- `src/lib/format.ts` (fmt/pct/fmtDate) çıkar → 8 kopyayı buradan import ettir.
- 51 `console.*` → `logger` (FE `utils/logger`; BE için `backend/src/utils/logger.ts` ekle).
- *Mekanik; tsc + verify + dokunulan modüllerde render.*

### Faz 2 — types.ts bölünmesi (mekanik) · risk: DÜŞÜK
- `src/types.ts` → `src/types/` domain dosyaları (crm/finance/dmo/overhead/analytics/project/…)
  + barrel `src/types/index.ts` re-export → **import yolları değişmez** (`from '../types'`).

### Faz 3 — Ölü kod / legacy temizliği · risk: ORTA
- Kullanılmayan geriye-dönük alias'ları grep-doğrula → kaldır (ör. `contract-workflow-test`,
  `cost-analysis` legacy yönlendirmeleri gerçekten kullanılmıyorsa).
- 149 TODO'yu tara: önemsizleri çöz, niyetli notları koru/etiketle. 9 BE `: any` daralt.

### Faz 4 — Fat route → service çıkarımı · risk: ORTA-YÜKSEK
- finance/contractWorkflow/projects/opportunities route'larındaki iş mantığını **service**'e taşı
  (mevcut `projectFactory`/`overheadService`/`analyticsService` deseni). Route'lar incelir.
- Faz 0 unit testleri + curl before/after ile davranış korunur.

### Faz 5 — God-component ayrıştırma (en riskli; SON) · risk: YÜKSEK
- CRMModule/ContractWorkflow/ProjectMgmt/Negotiation → alt bileşen + hook'lara böl (sekme/form/modal
  çıkar). **Prop/state birebir korunur** (davranış değişmez). Modül-başına ayrı commit.

## Kritik Yeniden Kullanım (mevcut)
- `src/utils/logger.ts` (FE logger) · `src/components/HealthCards.tsx` (paylaşımlı kart deseni) ·
  `src/lib/utils.ts` · `backend/src/services/*` (service çıkarım deseni: `projectFactory`,
  `overheadService`) · `scripts/check-no-mock.mjs` (guard deseni) · `tests/rbac/*` (verify deseni).

## ⚠️ RİSKLER ve AZALTIMLARI

| # | Risk | Olasılık/Etki | Azaltım |
|---|------|---------------|---------|
| 1 | **Canlı endpoint davranış regresyonu** (Faz 4) | Orta / Yüksek | Faz 0 unit testleri; curl before/after; her endpoint ayrı commit; IDOR+RBAC yeşil |
| 2 | **UI etkileşim kırılması** (Faz 5) — god-component split state/prop kablolamasını bozabilir | Orta / Yüksek | Playwright render+etkileşim (her modül); prop'ları birebir koru; artımlı, modül-başı commit |
| 3 | **Import-yolu churn** (Faz 1/2) | Orta / Düşük | Barrel re-export `from '../types'`'ı korur; tsc tümünü yakalar |
| 4 | **Hâlâ kullanılan alias'ı silmek** (Faz 3) | Düşük / Orta | Silmeden önce grep ile 0-referans doğrula + tam süit |
| 5 | **Para-yuvarlama / dual-adapter (libsql\|pg) hassasiyeti** | Düşük / Yüksek | `prismaClient` mantığına DOKUNMA; motor unit testleri para matematiğini korur |
| 6 | **Kapsam kayması ("bitmeyen refactor")** | Yüksek / Orta | Sabit faz sınırları + ölçülebilir çıkış (satır azalması, 0 console, N test); mutabık kapsamda dur |
| 7 | **Test süiti maliyeti** (RBAC ~dk) | Orta / Düşük | Commit başına izolasyon alt-süiti; faz kapanışında tam RBAC ([[feedback-rbac-timing]]) |
| 8 | **Bekleyen/izlenmeyen değişiklik driftı** (auth json artefaktları, CLAUDE.md) | Düşük / Orta | Refactor'a temiz ağaçta başla; alakasız değişiklikleri süpürme |
| 9 | **Backend plain ts-node — restart gereği** | Düşük / Düşük | Route/service değişiminde backend restart (nodemon yok) |

## Doğrulama (her faz)
- `tsc` FE+BE 0 · `pnpm verify` yeşil (tsc + check-no-mock + check-tenant-scope + **check-no-console** + build).
- `pnpm test:isolation` 46/46; faz kapanışında tam RBAC.
- **Faz 0:** `pnpm test:unit` (vitest) yeşil — motor matematiği referans.
- Dokunulan UI: Playwright render (0 page-error) + kritik etkileşim.
- Refactor **davranış-koruyan**: before/after çıktı (curl/screenshot) eşleşir.

## Önerilen kapsam
Faz 0–3 (**düşük-orta risk, yüksek değer**: test ağı + dedup + logger + types + ölü kod) tek turda
yapılabilir. Faz 4–5 (**yüksek risk**: route/service + god-component) ayrı, dikkatli turlar — her modül/
endpoint kendi commit'i. Kapsamı fazlarda durdurmak mümkün.
