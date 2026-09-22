# Enflow — Uçtan Uca Oracle Test Ortamı

**Tek kaynak doküman:** [`docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md`](../../docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md) — üç tablo (süreç motoru / rol×onay / sanal agent) buradaki senaryoların oracle'ıdır.

## Bu paket ne test ediyor, `tests/rbac` ne test ediyor

- **`tests/rbac`** (Playwright) — yalnız **erişim izni**: 401/403 doğru mu, menü doğru rol için görünür/gizli mi.
- **`tests/e2e-scenario`** (bu paket, Vitest) — **iş akışının sonucu**: bir süreç gerçekten belgelenen durumu üretiyor mu, boş koltukta (insan atanmamış rol) zincir doğru davranıyor mu, sanal agent'lar iddia edildiği gibi çalışıyor mu.

İkisi birbirini tekrar etmez; ikisi birlikte "erişim doğru + sonuç doğru" garantisini verir.

## Nasıl çalışıyor

Her senaryo dosyası (`tests/*.spec.ts`):
1. **İzole bir SQLite dosyası** kurar (`helpers/testDb.ts`) — dev tenant-1 verisine (`backend/dev.db`) **asla dokunulmaz**.
2. Backend'i **ayrı bir process olarak, ayrı bir portta** başlatır (`helpers/backendProcess.ts`) — dev sunucusuyla (3002) çakışmaz.
3. Gerçek `POST /api/setup/init` ile tenant kurar + `POST /api/workflows/apply-default-template` ile 14 sürecin tümünü kurgular (`helpers/scenarioSetup.ts`).
4. **Arrange** (ön-koşul) adımları backend'in kendi Prisma client'ıyla (`helpers/prisma.ts`) doğrudan DB'ye yazar — `fixtures/*.ts`.
5. **Act** (test edilen adım) HER ZAMAN gerçek bir HTTP çağrısıdır (`helpers/apiClient.ts`) — gerçek bir kullanıcının/agent'ın yapacağı çağrı.
6. **Assert** hem HTTP yanıtını hem DB durumunu oracle ile karşılaştırır.
7. Test sonunda backend süreci durdurulur, izole DB dosyası silinir.

## Çalıştırma

```bash
pnpm test:e2e-scenario
```

veya doğrudan:

```bash
cd tests/e2e-scenario && pnpm install && pnpm test
```

## Neden `pnpm verify`'ye dahil değil

Her senaryo dosyası kendi backend sürecini + `prisma db push`'unu ayağa kaldırdığından tüm paket ~30-40 saniye sürüyor — `pnpm verify`'nin commit-öncesi hızlı geri bildirim amacına uymuyor (`tests/rbac` de aynı gerekçeyle ayrı tutulur). Bunun yerine: yeni bir süreç/agent davranışı eklerken veya bir "iddia"yı doğrulamadan önce elle çalıştırın; CI'a nightly/manuel bir adım olarak eklenmesi ayrı bir karar.

## Senaryo → dosya haritası

| Senaryo ID (oracle dokümanı) | Dosya | Doğrulanan iddia |
|---|---|---|
| AGENT-PROCUREMENT-AUTONOMOUS-ACTIVE-EMPTY | `tests/agent-orphan-seat.spec.ts` | Boş koltuk + AUTONOMOUS agent → ağırlıklı skora göre doğru tedarikçi otomatik seçilir, insan onayı beklenmez |
| PE-01-HAPPY / PE-01-ORPHAN-GM | `tests/opportunity-approval.spec.ts` | OPPORTUNITY_APPROVAL happy-path + GM koltuğu boşken (agent yok) zincirin sessizce tamamlanması |
| PE-07-ORPHAN-GM (T1) | `tests/opportunity-to-project.spec.ts` | WON fırsat + boş GM koltuğu → proje hiç insan onayı olmadan tek çağrıda açılır |
| PE-05-FIX-PENDING / PE-05-FIX-COMPLETED (T4) | `tests/contract-to-project.spec.ts` | **Düzeltildi:** `ContractWorkflow.status` artık yalnız zincir gerçekten `COMPLETED` olunca `TRANSFERRED` oluyor |
| PE-10-SKIP / PE-SECURITY-01 (T6) | `tests/purchase-to-invoice.spec.ts` | Finans onayı olmadan fatura oluşabiliyor (tasarım-gereği) + **düzeltildi:** `autoSkipOrphanStages` artık `AGENT_FINANCE`'in `allowedModes` sınırını kontrol ediyor |
| PE-08-ALL-ORPHAN | `tests/purchase-approval-status-consistency.spec.ts` | **Düzeltildi:** `PurchaseRequest.status` artık zincirin gerçek durumundan türetiliyor (sabit "+1 adım" değil) |
| ROLE-*-XCHECK | `tests/role-approval-crosscheck.spec.ts` | Doğru rol onaylayabiliyor, yanlış rol 403 alıyor (role-matrix.ts'in statik iddiasından bağımsız, çalışma-zamanı kanıtı) |

Bulguların tam açıklaması, düzeltme detayı ve hangi testin regresyonu koruduğu için oracle dokümanının "§6 Faz 1-3 Bulguları" bölümüne bakın.
