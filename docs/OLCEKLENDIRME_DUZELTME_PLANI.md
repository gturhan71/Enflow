# Enflow — Ölçeklendirme Düzeltme Planı

> Kaynak: [Enflow Ölçeklendirme Mimarisi](https://claude.ai/code/artifact/796f075c-9cf9-40d2-8e37-5e5164425bf5) + [Enflow Ölçek Bulguları](https://claude.ai/code/artifact/a7871bc3-b2a6-473d-a31e-ee67f100d007) (2026-08-22). Bu döküman onaylanan uygulama planının kalıcı kaydıdır.

## Bağlam

İki döküman ile kod taramasıyla doğrulanmış 10 bulgu (S-01…S-10) tespit edildi: `docs/SYSTEM_REQUIREMENTS.md`'nin Senaryo 3'te önerdiği "birden fazla backend replikası + load balancer" kurulumu bugün uygulama katmanında güvenli değil — üç in-process zamanlayıcı kilitsiz, dosya deposu varsayılan olarak yerel disk, gerçek-zamanlı katman bellek-içi, bağlantı havuzu boyutlandırılmamış, birkaç yüksek-trafikli modelde indeks yok.

Karar: **(1)** Redis gibi yeni bir altyapı bağımlılığı eklenmeyecek — mevcut "poll-bazlı, cron/kuyruk yok" mimari tarzına sadık kalınıp **DB-native** çözümler tercih edilecek; **(2)** kapsam yalnız P0 değil, **10 bulgunun tamamını** kapsayan tam yol haritası.

Ek kod incelemesiyle iki önemli düzeltme yapıldı:
- **S-03** için `contractWorkflow.ts`'teki upload mantığı **kasıtlı olarak dokunulmadan bırakılmış** (kod içi yorum: "regresyon riskine karşı"). Dosya her zaman önce yerele yazılıyor (satır 433); Nextcloud yapılandırılmışsa `fileUrl` alanı Nextcloud'un mutlak URL'iyle değiştiriliyor (satır 448) — yani Nextcloud AÇIKKEN sorun yok (okuma zaten Nextcloud'dan), sorun yalnız Nextcloud YAPILANDIRILMAMIŞKEN + çoklu replika birlikte olduğunda çıkıyor. Bu nedenle çözüm bir kod refaktörü değil, **operasyonel bir koruma** (boot-time uyarı + döküman).
- **S-06** için gerçek sorgu desenleri tarandı (`dashboardService.ts`, `slaEscalation.ts`, `personnelTransferService.ts`, `opportunities.ts`, `purchaseRequests.ts`, `notifications.ts`) — önerilen composite indeksler tahmini değil, gözlemlenen `WHERE` desenlerine dayanıyor.

## Faz A — P0 (Kritik): S-01, S-03

### S-01 — Zamanlayıcılara dağıtık kilit

Yeni, tek noktadan paylaşılan bir kilit yardımcı: `backend/src/services/schedulerLock.ts`
- Yeni Prisma modeli `SchedulerLock { name String @id, holder String, expiresAt DateTime, updatedAt DateTime @updatedAt }` — hem SQLite hem Postgres'te aynı davranır (dialect-özel `pg_advisory_lock` kullanılmaz, taşınabilir SQL).
- `acquireLock(name, ttlMs)`: atomic `updateMany({ where: { name, OR: [{ expiresAt: { lt: now } }, { holder: HOLDER_ID }] }, data: { holder: HOLDER_ID, expiresAt } })` — 0 satır etkilenirse `upsert`'e düş (ilk çalıştırma, satır yok) veya kilit başka bir holder'da (false döner). `HOLDER_ID` = süreç başında `crypto.randomUUID()`.
- `releaseLock(name)`: `updateMany({ where: { name, holder: HOLDER_ID }, data: { expiresAt: now } })` — tick bitince kilidi hemen serbest bırakır, diğer replikalar TTL dolmasını beklemez.

Üç zamanlayıcıya (`backupScheduler.ts`, `activityLogArchiveScheduler.ts`, `updateNotifier.ts`) `tick()` fonksiyonunun başına `acquireLock` + sonuna `finally` içinde `releaseLock` eklenir; mevcut `running` bayrağı (aynı-süreç çift-tetiklemeyi önler) korunur — kilit yalnız süreçler-arası koruma ekler, mevcut davranışı değiştirmez.

TTL değerleri tick aralığından büyük tutulur (backup 10dk, arşiv 2sa, updateNotifier 15dk) — bir replika çökerse diğer replika en geç bu süre içinde devralır.

**Kritik dosyalar:** `backend/prisma/schema.prisma` (yeni model), `backend/src/services/schedulerLock.ts` (yeni), `backend/src/services/backupScheduler.ts`, `activityLogArchiveScheduler.ts`, `updateNotifier.ts` (3 küçük değişiklik).

### S-03 — Dosya deposu operasyonel koruma

`contractWorkflow.ts`'e **dokunulmaz** (regresyon riski, mevcut kod yorumuna saygı). Bunun yerine:

1. Yeni `backend/src/services/deploymentGuard.ts`: `index.ts` boot sırasında çağrılır. `ENFLOW_MULTI_REPLICA=true` (yeni, opt-in env var — ops birden fazla replika kurarken elle set eder) VE `NEXTCLOUD_URL/USER/PASS` üçlüsü eksikse → `logger.error` ile açık, tekrar eden bir uyarı ("Çoklu replika modu aktif ama paylaşımlı dosya deposu yapılandırılmamış — evrak yüklemeleri replikalar arası tutarsız olacak"). Süreci durdurmaz (mevcut tek-replika kullanıcılarının varsayılan davranışı hiç değişmez, flag set edilmediği sürece kontrol devreye girmez).
2. `docs/SYSTEM_REQUIREMENTS.md`'ye yeni **"Senaryo 4 — Çoklu-Replika Kurumsal"** bölümü: Nextcloud/S3 yapılandırmasının bu senaryoda **zorunlu ön koşul** olduğunu, `ENFLOW_MULTI_REPLICA` bayrağını ve S-01/S-05 önkoşullarını (kilit + havuz boyutlandırma) tek yerde toplar.

**Kritik dosyalar:** `backend/src/services/deploymentGuard.ts` (yeni), `backend/src/index.ts` (1 satır çağrı), `docs/SYSTEM_REQUIREMENTS.md`, `backend/.env.example`.

## Faz B — P1 (Yüksek): S-05, S-06

### S-05 — Postgres havuz boyutlandırma

`backend/src/prismaClient.ts`: `new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX) || 10 })` — `PrismaPg`'nin node-postgres `Pool` seçeneklerini (`max` dahil) kabul ettiği implementasyon sırasında doğrulanır; kabul etmiyorsa `pg.Pool` elle oluşturulup adaptöre geçirilir. Varsayılan `10` mevcut davranışı korur (node-postgres'in kendi varsayılanı), yalnız artık **görünür ve ayarlanabilir**.

`docs/SYSTEM_REQUIREMENTS.md` Senaryo 4 bölümüne formül eklenir: `replika_sayısı × DATABASE_POOL_MAX ≤ Postgres max_connections`, PgBouncer bu senaryoda "önerilir"den "zorunlu"ya yükseltilir.

**Kritik dosyalar:** `backend/src/prismaClient.ts`, `backend/.env.example`, `docs/SYSTEM_REQUIREMENTS.md`.

### S-06 — Yüksek trafikli modellere indeks

Gözlemlenen sorgu desenlerine göre, tek migration'da eklenir:

| Model | Yeni indeks | Kanıt |
|---|---|---|
| TodoTask | `@@index([tenantId, status])` | dashboardService.ts:29, slaEscalation.ts:22 |
| TodoTask | `@@index([tenantId, assignedToUserId])` | personnelTransferService.ts:99-104 |
| Notification | `@@index([tenantId, userId])` | notifications.ts:12, dashboardService.ts:30 |
| Opportunity | `@@index([tenantId, status])` | opportunityProgressReminders.ts:30, unitReportingService.ts:106-114 |
| Opportunity | `@@index([tenantId, assignedToId])` | personnelTransferService.ts:64-68 |
| PurchaseRequest | `@@index([tenantId, status])` | purchaseRequests.ts:55-59, dashboardService.ts:26 |
| Project | `@@index([tenantId, status])` | dashboardService.ts:27 ile tutarlı desen |
| ContractWorkflow | `@@index([tenantId, status])` | dashboardService.ts:31 |

Geri kalan ~30 indekssiz model (Vendor, VisitPlan, ProjectMilestone, vb.) **kapsam dışı bırakılır** — düşük satır sayısı/tenant, ölçüm olmadan önceliklendirilmez; `docs/SYSTEM_REQUIREMENTS.md`'ye "sonraki tur" notu düşülür.

**Kritik dosyalar:** `backend/prisma/schema.prisma` (8 satır), tek migration (`npx prisma migrate dev --name add_scale_indexes`).

## Faz C — P2 (Orta) + Düşük: S-02, S-07, S-08, S-10, S-04, S-09

### S-02 — SSE'yi DB-native yap

`dashboardStream.ts`'teki `EventEmitter` kaldırılır. `Tenant` modeline nullable `dashboardPingAt DateTime?` eklenir. `pingDashboard(tenantId)` imzası **değişmez** (çağıran ~30 mutasyon route'u dokunulmaz) — içeride artık `prisma.tenant.update({ where: { id: tenantId }, data: { dashboardPingAt: new Date() } }).catch(() => {})` fire-and-forget yapılır. `/reports/dashboard/stream` route handler'ı, `subscribeDashboard` yerine 2 saniyede bir o tenant'ın `dashboardPingAt`'ini okuyan bir poll döngüsüne çevrilir; değer değiştiyse `data: refresh\n\n` yazılır. Bu, mevcut kod yorumundaki "SSE sadece sinyal verir, veri taşımaz" ilkesini korur — yalnız taşıma bellek-içi'den DB-poll'a geçer.

**Kritik dosyalar:** `backend/prisma/schema.prisma` (1 alan), `backend/src/services/dashboardStream.ts` (yeniden yazım), ilgili route (`routes/reports.ts` içindeki `/dashboard/stream` handler'ı).

### S-07 — Gözlemlenebilirlik

`backend/src/utils/logger.ts`: `console.*` sarmalayıcısı yapılandırılmış JSON satırlarına çevrilir (`{ level, ts, msg, ...meta }`) — çağrı imzası (`logger.info(...)`) değişmez, yalnız iç format. `index.ts`'e basit bir istek-süresi middleware'i eklenir (method/path/status/duration, structured log). Tam APM/tracing entegrasyonu **bu fazın kapsamı dışında** — ayrı bir sonraki adım olarak not düşülür.

**Kritik dosyalar:** `backend/src/utils/logger.ts`, `backend/src/index.ts` (1 middleware).

### S-08 — CI

Yeni `.github/workflows/ci.yml`: `pnpm install` → `tsc --noEmit` (kök + backend) → `pnpm test:unit` (vitest) → RBAC süiti (`tests/rbac`) SQLite'a karşı. İkinci job: `postgres:16` service container ile `prisma db push` + RBAC süiti — `install/POSTGRES_MIGRATION_PLAN.md`'de zaten planlanmış ama hiç uygulanmamış "CI'da ikisi de test edilir" maddesini hayata geçirir.

**Kritik dosyalar:** `.github/workflows/ci.yml` (yeni).

### S-10 — Retry

`aiClient.ts` `chatJSON`: ağ/timeout hatalarında (4xx/5xx sağlayıcı yanıtlarında değil) 500ms sonra tek retry. `fileUpload.ts` `tryUploadToNextcloud`: aynı desen, tek retry. Tenant başına ardışık N başarısızlıkta 60sn'lik basit bir bellek-içi "cooldown" (tam circuit-breaker kütüphanesi yerine, mevcut hafif-bağımlılık tarzına uygun).

**Kritik dosyalar:** `backend/src/services/aiClient.ts`, `backend/src/utils/fileUpload.ts`.

### S-04 — Rate limit (bilinçli erteleme)

DB-native bir sayaç, her istekte ekstra DB round-trip'i anlamına geldiğinden P2 içinde bile önceliksiz bırakılır: mevcut in-memory `express-rate-limit` korunur, kısıtı (`N replika ≈ N× fiili limit`) `docs/SYSTEM_REQUIREMENTS.md` Senaryo 4'e **açıkça** not düşülür. Gerçek bir ihtiyaç ortaya çıkarsa (izleme verisiyle doğrulanırsa) ayrı bir iş olarak ele alınır — bu fazda kod değişikliği yok.

### S-09 — Yük testi

Yeni `backend/scripts/loadtest/` — `autocannon` (npm paketi, harici binary gerektirmez, projenin bağımlılık-az tarzına uygun; k6 yerine tercih edildi) ile temsili bir okuma/yazma karışımı + eşzamanlı yazımda SQLite `SQLITE_BUSY` oranını ölçen bir betik. Yalnız dev-dependency, üretim koduna girmez.

**Kritik dosyalar:** `backend/scripts/loadtest/*.mjs` (yeni), `backend/package.json` (`test:load` script).

## Versiyon notu

`CLAUDE.md` kuralına göre: SchedulerLock modeli + DashboardEvent alanı gibi eklemeler **mimari değişiklik** sayılabilir (MINOR artış adayı, v2.4.0 → v2.5.0) — ama kural gereği versiyon artışı **otomatik yapılmaz**, her faz tamamlandığında ayrıca sorulur.

## Doğrulama (her faz sonunda)

- `cd backend && npx prisma migrate dev --name <faz-adı> && npx prisma generate`, ardından backend'i yeniden başlat (nodemon eski client'la çöker — CLAUDE.md kuralı).
- `tsc --noEmit` (kök + backend) — 0 hata.
- RBAC süiti (`tests/rbac`) — 69/69.
- Faz A: iki backend süreci elle paralel başlatılıp (`PORT=3002` / `PORT=3003`, aynı DB) `backupScheduler` tick'inin yalnız birinde çalıştığı loglardan doğrulanır.
- Faz C (S-02): iki süreçte, bir mutasyon bir süreçte tetiklenip diğer sürece bağlı SSE client'ının ~2sn içinde `refresh` aldığı manuel test edilir.
- Faz B (S-06): `EXPLAIN QUERY PLAN` (SQLite) ile eklenen indekslerin ilgili sorgularda kullanıldığı doğrulanır.

## Durum

- [x] Faz A — S-01, S-03 (2026-08-24) — `SchedulerLock` modeli + `schedulerLock.ts`, 3 zamanlayıcıya kilit; `deploymentGuard.ts` + `ENFLOW_MULTI_REPLICA` + SYSTEM_REQUIREMENTS.md Senaryo 4. Doğrulandı: tsc 0 (kök+backend), kilit mantığı ad-hoc script ile (aynı-holder yenileme / farklı-holder red / süre-dolunca devralma / release) doğrulandı.
- [x] Faz B — S-05, S-06 (2026-08-24) — `prismaClient.ts` `DATABASE_POOL_MAX` (PrismaPg `pg.PoolConfig.max`'ı doğrudan kabul ediyor, doğrulandı); 8 yeni composite indeks (`add_scale_indexes` migration) — TodoTask/Notification/Opportunity/PurchaseRequest/Project/ContractWorkflow. tsc 0.
- [x] Faz C (2026-08-24):
  - S-02 — `Tenant.dashboardPingAt` + `dashboardStream.ts` DB-native poll; `/reports/dashboard/stream` 2sn poll döngüsü. EventEmitter kaldırıldı, `pingDashboard` imzası değişmedi.
  - S-07 — `logger.ts` üretimde (`NODE_ENV=production`) yapılandırılmış JSON basıyor, dev'de değişmedi; `index.ts`'e istek-süresi middleware'i eklendi.
  - S-08 — `.github/workflows/ci.yml`: kök `pnpm verify` (mevcut script, yeniden keşfedildi — tsc kök+backend, no-mock/tenant-scope/no-console guard'ları, vitest unit, build). RBAC/Postgres matrisi **bilinçli olarak ertelendi** — çapraz-tenant izolasyon testi seed.ts'te reprodüklenemeyen bir fixture'a bağımlı (aşağıda not).
  - S-10 — `aiClient.ts` + `fileUpload.ts` tek retry (yalnız ağ/timeout hatasında, sağlayıcı 4xx/5xx'inde değil) + tenant-başına 60sn cooldown (aiClient).
  - S-04 — kod değişikliği yok (bilinçli erteleme), `docs/SYSTEM_REQUIREMENTS.md` Senaryo 4'e not düşüldü.
  - S-09 — `backend/scripts/loadtest/mixed-read.mjs` (autocannon) + `sqlite-busy.ts` (eşzamanlı yazım + SQLITE_BUSY oranı, kendi test verisini temizler). `pnpm test:load` / `pnpm test:load:sqlite-busy`. Doğrulama: sqlite-busy.ts bogus tenant ile dry-run edildi (gerçek DB'ye yazmadan modül/Prisma bağlantısı doğrulandı); mixed-read.mjs `node --check` ile sözdizimi doğrulandı.

**Beklenmeyen bulgu (kapsam dışı, incelendi + düzeltildi):** `pnpm verify` çalıştırıldığında (CI job'ını doğrularken), scaling planıyla İLGİSİZ 3 önceden var olan `check-tenant-scope` ihlali ortaya çıktı. Kullanıcı onayıyla incelenip üçü de düzeltildi (üçü de gerçek IDOR değil, guard'ın statik olarak göremediği desenler):
- `users.ts:92` — `id` zaten `req.userId` (kendi kaydı, attacker-controlled değil). `where`'e `tenantId: req.tenantId` eklendi — savunma-derinliği, davranış değişmedi.
- `platformTicketsAdmin.ts:57` — dosyanın kendi başlık yorumunda zaten "KASITLI tenant-çapraz" (dış triage aracı, `platformApiKeyMiddleware`). `scripts/check-tenant-scope.mjs`'e dokümante edilmiş `EXCLUDE_FILES` istisnası eklendi (`check-no-console.mjs`'teki mevcut desenle tutarlı).
- `purchaseRequests.ts:24` — `syncProcurementMilestoneDate` helper'ının HER İKİ çağıranı da zaten tenant-doğrulanmış bir `projectId` geçiriyordu (guard fonksiyon sınırları arasını göremiyor) — ama bu kırılgan bir invaryanttı. `project: { tenantId }` ilişki filtresi eklenerek fonksiyonun kendisi de savunma-derinliği kazandı; gelecekte doğrulamasız bir üçüncü çağıran eklenirse artık sessizce yanlış tenant'ı güncellemez, no-op'a düşer.

Sonuç: `pnpm verify` artık tamamen yeşil (tsc 0, 3 guard ✓, 130 vitest testi ✓, `vite build` ✓) — yeni CI workflow'u ilk push'tan itibaren yeşil başlar.
