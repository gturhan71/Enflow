# Enflow — Veritabanı Güvenliği Planı (Adım 0)

**Tetikleyici:** Harici bir "Adım 0 — Veritabanı Güvenliği" kontrol listesi (Prisma Studio
gibi bir araçla uygulama yetkilendirmesi atlanarak DB'ye erişilmesini engellemek). Doküman
**konteynerli bir deploy'u** (3-stage Dockerfile, docker-compose+Traefik, GHCR+SSH GitHub
Actions) varsayıyordu — bu repoda **yok**. Enflow `install/install.sh` + `install/wizard.mjs`
ile çalışan **bare-metal Node kurulumu**: backend prod'da bile derlenmemiş, doğrudan
`ts-node src/index.ts` ile çalışır (`backend/package.json` `start` script'i). Bu doküman,
orijinal checklist'in 7 maddesini Enflow'un gerçek mimarisine göre yeniden yorumlar.

Tek-kaynak: bu dosya. İlgili dosyalar: `install/wizard.mjs`, `install/README.md`,
`install/ILK_KURULUM_KILAVUZU.md`, `install/POSTGRES_MIGRATION_PLAN.md`,
`docs/SYSTEM_REQUIREMENTS.md`.

---

## Durum Özeti

| Faz | Konu | Durum |
|---|---|---|
| 1 | Ağ erişimi sertleştirmesi + dokümantasyon | ✅ Tamamlandı (2026-09-13) |
| 2 | Postgres en-az-yetki — iki-rol ayrımı (migrator/runtime) | ✅ Tamamlandı (2026-09-13) |
| 3 | PostgreSQL Row-Level Security (RLS) | 🔧 Kod TAMAM (2026-09-13) — `tsc --noEmit` 0 hata, backend unit 176/176 geçti, SQLite yolunda canlı curl testi (login/create/read) sorunsuz. **Gerçek bir Postgres örneğine karşı hiç çalıştırılmadı** (`verify:postgres-rls` + RBAC E2E bu ortamda mevcut değil) — production'a alınmadan önce ZORUNLU. Versiyon artışı (v2.6.0 adayı) kullanıcı onayı bekliyor. |

---

## Checklist Maddesi → Enflow Karşılığı

### 1. Ortamları kesin olarak ayır
- ✅ Dev/staging/prod her biri kendi `backend/.env`'ine sahip; `wizard.mjs` her kurulumda
  sırları (`AUTH_JWT_SECRET`, `DATA_ENCRYPTION_MASTER_KEY`, DB şifreleri) yeniden rastgele üretir.
- ✅ `.env*` kök `.gitignore`'da (`!.env.example` hariç) — kontrol edildi, git geçmişinde
  gerçek `DATABASE_URL`/sır **yok**. `.env.backend_backup` (kök dizinde, yerel) de `.env*`
  deseniyle gitignore'lu, hiçbir zaman takip edilmemiş.
- ✅ `install/.env.example`, `backend/.env.example`, kök `.env.example` yalnız placeholder
  içerir.
- Prod `DATABASE_URL` yalnız `wizard.mjs` tarafından interaktif olarak (veya `--yes` ile
  otomatik üretilerek) `backend/.env`'e yazılır — hiçbir CI/deploy pipeline'ı henüz yok
  (Docker/GHCR yok), bu madde bugünkü mimaride "secret manager'dan enjeksiyon" değil
  "kurulum sihirbazının yerel olarak ürettiği .env" şeklinde karşılanıyor.

### 2. Prisma Studio'yu prod build'inden çıkar
- ✅ `prisma` zaten `backend/package.json` → `devDependencies`'te (prod dependency değil).
- ✅ Kök/backend `package.json`'da çalıştırılabilir bir `studio` script'i yok.
- ⚠️ **Kısmi/bilinçli sınır:** Prod Docker imajı yok (checklist'in "prisma CLI imajda
  kurulu değil" doğrulaması burada anlamsız). Backend `pnpm start` = `ts-node
  src/index.ts` — derlenmemiş TS çalışma zamanında derleniyor, bu nedenle
  `devDependencies` (ts-node dahil) **prod host'ta da kurulu kalmak zorunda**;
  `pnpm install --prod` yapılamaz, `prisma` CLI hiçbir zaman prod sunucudan silinemez.
  **Gerçek mitigasyon CLI'yi kaldırmak değil, madde 3'teki ağ izolasyonu.**

### 3. Prod veritabanına ağ erişimini kapat — ✅ Faz 1 (uygulandı)
- `install/wizard.mjs`: Postgres host `localhost`/`127.0.0.1` değilse "UZAK sunucu" uyarısı
  + `nmap -p <port> <host>` doğrulama komutu ekrana yazılır.
- Kurulum sonunda **opsiyonel** (varsayılan HAYIR, açık onay gerektiren) ağ sertleştirme
  adımı: Linux'ta `ufw` (varsa) yalnız SSH(22) + backend portuna izin verip diğer her şeyi
  reddeder; Windows'ta eşdeğer `New-NetFirewallRule`. Hiçbir durumda kullanıcı onaylamadan
  hiçbir firewall komutu çalıştırılmaz, mevcut kurallar silinmez (yalnız eklenir).
  Kod: `offerFirewallHardening()` (`install/wizard.mjs`).
- `docs/SYSTEM_REQUIREMENTS.md` "Ağ" tablosuna DB portunun asla internete açık olmaması
  gerektiği satırı eklendi.
- SQLite kullanılıyorsa: DB bir dosyadır (`backend/dev.db`), ağ portu yok — bu madde
  yalnız Postgres dağıtımlarını ilgilendiriyor.

### 4. Tenant izolasyonunu veritabanı seviyesine indir (RLS) — 🔧 Faz 3 (tasarım tamam, kod bekliyor)
Bkz. aşağıdaki "Faz 3 — RLS Tasarımı" bölümü. **Yalnız PostgreSQL.** SQLite dağıtımlarında
tenant izolasyonu bilinçli olarak yalnız uygulama katmanındadır (bkz. CLAUDE.md, "SQLite
kullanan dağıtımlarda tenant izolasyonunun yalnızca uygulama katmanında olduğu bilinçli
olarak kabul edildi").

### 5. Veritabanı kullanıcısına en az yetkiyi ver — ✅ Faz 2 (uygulandı)
`install/wizard.mjs` `provisionPostgresDb()` artık **iki rol** oluşturur:
- `<appUser>_migrator` — DB **owner** (DDL). Yalnız kurulum/şema güncellemesi (`db push`)
  sırasında kullanılır; `backend/.env`'e **yazılmaz**, kurulum özetinde bir kez gösterilir.
- `<appUser>` (runtime) — `backend/.env` → `DATABASE_URL` bunu kullanır. `NOSUPERUSER
  NOCREATEDB NOCREATEROLE`; `db push` sonrası `grantRuntimePrivileges()` ile yalnız
  `SELECT, INSERT, UPDATE, DELETE` + `ALTER DEFAULT PRIVILEGES` (gelecekteki tablolar
  için otomatik) verilir. **DROP/ALTER/CREATE ROLE yetkisi yok.**
- Ayrı "debug/readonly" kullanıcısı (checklist'in istediği) şimdilik ayrı bir iş —
  gerekirse aynı `grantRuntimePrivileges` deseniyle (`GRANT SELECT` yalnız) eklenebilir.
- **Bilinen takip işi:** `backend/src/scripts/migrateToPostgres.ts` ve ileride
  `upgrade-tool`'un olası bir Postgres şema-güncelleme akışı, bu iki-rol ayrımından
  bağımsız olarak operatörün verdiği `DATABASE_URL`'i kullanıyor — bu araçların migrator
  kimlik bilgileriyle çalıştırılması gerektiği not edildi (`install/POSTGRES_MIGRATION_PLAN.md`),
  araçların kendisi bu turda değiştirilmedi.

### 6. Erişimi logla ve izle
- ✅ Uygulama-seviyesi denetim izi zaten var: `ActivityLog` + `logActivity()` (19 router,
  CREATE/UPDATE/DELETE + statü geçişleri) — bkz. CLAUDE.md "ActivityLog kapsamı — TAM".
- ⚠️ **Kapsam dışı (altyapı sorumluluğu):** Postgres connection/query logları (pgAudit) +
  "beklenmeyen bağlantı denemesi" alarmı, işletim sistemi/hosting sağlayıcısı seviyesinde
  kurulmalı — Enflow kod tabanının kapsamı dışında (bu doküman bunu netleştiriyor, kod
  değişikliği yapılmadı).

### 7. Ekip için güvenli bir alternatif tanımla
- ✅ Zaten var: rol-bazlı, audit-trail'li admin ekranları (`ActivityLogModule`, GM-only
  Denetim İzi görüntüleyici) + `BACKUP_ADMIN` salt-okunur rolü. Ham DB erişimi ihtiyacı
  yapısal olarak zaten minimize edilmiş durumda; ek bir onay süreci gerekmiyor.

---

## Faz 3 — PostgreSQL Row-Level Security (RLS) — UYGULANDI (kod), Postgres'te DOĞRULANMADI

**Neden mimari değişiklik sayılıyor:** Keşifte en az **4 kasıtlı cross-tenant/tenant-öncesi
kod yolu** ve **4 tüm-tenant döngüsü kuran scheduler** RLS'den doğrudan etkileniyor bulundu.
CLAUDE.md'nin **mimari değişiklik → MINOR versiyon artışı, kullanıcı onayı zorunlu** kuralına
giriyor (v2.5.0 → v2.6.0 adayı — **versiyon HENÜZ artırılmadı, onay bekliyor**).

### Uygulanan bileşenler
1. **`backend/src/services/tenantContext.ts` (yeni)** — `AsyncLocalStorage<{ tenantId?:
   string; bypassRls?: boolean }>` + `runWithTenant(tenantId, fn)` / `runWithRlsBypass(fn)`.
2. **`backend/src/middleware.ts` `tenantMiddleware`** — `req.tenantId` set edildikten sonra
   `next()` `runWithTenant(user.tenantId, next)` içinde çağrılır. Middleware'in kendi
   `prisma.user.findUnique` sorgusu (tenant henüz context'te değilken) `runWithRlsBypass`
   içine alındı. `platformApiKeyMiddleware` (`/api/platform-tickets-admin` — tasarım gereği
   cross-tenant) da `next()`'i `runWithRlsBypass` içinde çağırıyor.
3. **`backend/src/prismaClient.ts` — İKİ KATMANLI mimari** (tek katmanda `$transaction`
   çağrısı TypeScript'te `prisma`'nın kendi initializer'ında döngüsel tip çıkarımına
   [TS7022] yol açtığı keşfedildi, çözüm iki ayrı `$extends` katmanı):
   - `basePrisma` — para yuvarlama + TodoTask atama çözümü (eski davranış, değişmedi).
   - `prisma` (export edilen, = `basePrisma.$extends(...)`) — Postgres'te tenant-context
     VARSA operasyonu `basePrisma.$transaction` ile sarıp `SELECT set_config('app.tenant_id'|
     'app.bypass_rls', ..., true)` uygular; `tx` `basePrisma`'dan geldiği için RLS katmanını
     TAŞIMAZ → iç `tx.model.op()` çağrıları hook'u yeniden tetiklemez (double-wrap/atomiklik
     kırılması riski **yapısal olarak yok**, ek "zaten sarılı" bayrağına gerek kalmadı).
   - `runManagedTransaction(callback, options?)` (export edilen) — kod tabanındaki **12
     mevcut `prisma.$transaction(...)` çağrı yeri** bu yardımcıya geçirildi (aşağıda liste).
     SQLite'ta davranış birebir eskisiyle aynı (`if (!isPostgres) return basePrisma.$transaction(...)`).
4. **`backend/src/scripts/apply-postgres-rls.ts` (yeni)** — Prisma DMMF'den (`Prisma.dmmf.datamodel.models`)
   79 modeli programatik okur: `tenantId` alanı DOĞRUDAN olan **64 model** basit politika,
   olmayan **13 model** (BoMItem, WorkflowLog, ProjectMilestone, ProjectCostItem, WorkflowStep,
   PurchaseItem, PurchaseQuote, PurchaseQuoteItem, ApprovalStage, DeliveryRecord,
   TenderChecklistItem, DmoOrderItem, ProjectUnitParticipation) hard-code'lu `INDIRECT`
   FK-haritasından EXISTS/JOIN politikası (PurchaseQuoteItem iki-seviyeli: →PurchaseQuote→PurchaseRequest);
   `Tenant` + `SchedulerLock` **istisna** (tenant'tan bağımsız). `--check` bayrağı SQL çalıştırmadan
   yalnız haritayı DMMF'e karşı doğrular (`schema.prisma` yeni model eklerse burada patlar —
   ✅ şu an 64+13+2=79, eksik yok). `pnpm apply:postgres-rls` (backend/, migrator kimlik
   bilgileriyle) — idempotent (`DROP POLICY IF EXISTS` + yeniden `CREATE`).
5. **`backend/src/scripts/verify-postgres-rls.ts` (yeni)** — iki geçici test tenant'ı +
   birer Customer satırı oluşturur (bypass), tenant A context'inde tenant B'nin satırı →
   0 satır beklenir, tenant A kendi satırı → 1 satır beklenir (yanlış-pozitif kontrolü),
   context YOKKEN → 0 satır (fail-closed), sonunda temizlik (bypass). `pnpm verify:postgres-rls`.
6. **`install/wizard.mjs`** — Postgres kurulumunda, runtime GRANT'ten sonra **opt-in**
   (varsayılan HAYIR, açıkça "henüz Postgres'e karşı doğrulanmadı" uyarısıyla) RLS uygulama
   sorusu; kabul edilirse `pnpm apply:postgres-rls` migrator `DATABASE_URL`'iyle çalıştırılır.
7. **Bypass gereken yollar (kod değişti):**
   - `backend/src/routes/auth.ts` login (email ile tenant-öncesi arama).
   - `backend/src/services/bootstrapTenant.ts` (yeni tenant + ilk kullanıcı transaction'ı).
   - `backend/src/routes/tenants.ts` `POST /` (GM başka bir tenant oluşturuyor — kendi
     context'inden bağımsız bir Subscription satırı yazıyor; keşifte bulunan 4. bypass yolu,
     ilk tasarımda öngörülmemişti).
   - `backend/src/middleware.ts` `platformApiKeyMiddleware` (madde 2'de).
   - `backend/src/services/restoreService.ts` `applyLogicalRestore` (idari, potansiyel
     çoklu-tenant geri yükleme).
   - `backend/src/services/backupVerifyService.ts` `drainVerifyQueue` (tüm tenant'ların
     bekleyen doğrulama işlerini okur — cross-tenant okuma bypass'lı, her iş kendi
     `runWithTenant(job.tenantId, ...)` ile işlenir).
8. **Tüm-tenant döngüsü kuran 4 scheduler** `runWithTenant(t.id, ...)` ile güncellendi:
   `activityLogArchiveScheduler.ts`, `backupScheduler.ts`, `profitabilitySnapshotScheduler.ts`,
   `updateNotifier.ts`. **Doğrulanan bulgu:** `tenderReminders.ts`/`guaranteeReminders.ts`/
   `serviceTicketReminders.ts`/`deliveryDeadlineReminders.ts`/`opportunityProgressReminders.ts`/
   `corporateDocumentReminders.ts`/`slaEscalation.ts`/`approvalSlaEscalation.ts` gibi
   `tenantId`-parametreli sweep'ler **standalone scheduler değil — hepsi mevcut bir HTTP
   isteğinin (route handler) İÇİNDEN** çağrılıyor; `tenantMiddleware` zaten context'i kurmuş
   oluyor, EK sarmalama gerekmedi (ilk tasarımdaki varsayım hatalıydı, kod okuyarak düzeltildi).
9. **İki-rol ayrımından ETKİLENEN 12 `$transaction` çağrı yeri** `runManagedTransaction`'a
   geçirildi: `routes/{opportunities,purchaseRequests,sync,tenants,units,workflows}.ts`,
   `services/{bootstrapTenant,documentNumberService,personnelTransferService,restoreService}.ts`
   (`personnelTransferService.ts`'in ÖNCEDEN VAR OLAN kendi türetilmiş `Tx` tipi artık
   `prismaClient.ts`'in export ettiği `ManagedTx`'e işaret ediyor). `workflows.ts`'teki tek
   ARRAY-form (`prisma.$transaction([...])`) callback-form'a çevrildi (array-form
   `runManagedTransaction` ile uyumsuz). `scripts/backfill-workflow-igpd-kgd-steps.ts` ve
   `scripts/_migrateLoadTarget.ts` **kendi bağımsız/ham PrismaClient'larını** kullanıyor —
   bu katmandan hiç etkilenmiyor, değiştirilmedi.
10. **⚠️ Bilinen operasyonel sınır (dokümante, kod DEĞİŞTİRİLMEDİ):** `scripts/backfill-tenant-encryption.ts`
    ve `scripts/backfill-bom-cost-analysis-handoff-step.ts` paylaşılan `prisma`'yı kullanır
    ama standalone (ts-node ile elle) çalıştırılır — hiçbir context kurulmaz. RLS **etkinleştirildikten
    SONRA** (Postgres + `apply:postgres-rls` uygulanmış) bu scriptler koşulursa **sessizce 0
    satır işlerler** (fail-closed, hata FIRLATMAZ). Postgres+RLS ortamında yeniden çalıştırılmaları
    gerekirse gövdelerini `runWithRlsBypass(...)` ile sarmak gerekir — **henüz yapılmadı**, bu
    dokümanla not düşülüyor. Aynı kısıt gelecekte yazılacak her yeni standalone script için geçerli.
11. **PgBouncer uyumluluğu:** `set_config(..., true)` transaction-scoped (`SET LOCAL` eşdeğeri)
    olduğundan PgBouncer'ın **transaction pooling** modu ile uyumlu, **statement pooling** ile
    KULLANILAMAZ (`docs/SYSTEM_REQUIREMENTS.md` zaten yüksek eşzamanlılıkta PgBouncer öneriyor/
    zorunlu kılıyor — mod seçimi bu kısıtı dikkate almalı).

### Doğrulama durumu (bu oturumda yapılan — Postgres HARİÇ)
- ✅ `cd backend && pnpm exec tsc --noEmit` → 0 hata.
- ✅ `cd backend && pnpm test:unit` → 176/176 geçti (vitest, SQLite/mantık testleri).
- ✅ `apply-postgres-rls.ts --check` → 64+13+2=79, haritalanmamış model yok.
- ✅ SQLite üzerinde canlı curl testi: login, GET /api/opportunities, GET /api/tasks,
  POST /api/opportunities (→ `nextOpportunityTrackingCode` → `incrementDocumentSequence` →
  `runManagedTransaction`) — hepsi sorunsuz, test verisi temizlendi.
- ✅ `node scripts/check-no-console.mjs` / `check-tenant-scope.mjs` / `check-no-mock.mjs` → hepsi geçti.
- ✅ RBAC E2E süiti (`tests/rbac`, Playwright, artık 1027 test) SQLite'a karşı koşuldu: **1000 geçti, 26 başarısız**. Regresyon şüphesiyle `git stash` ile değişiklikler tamamen geri alınıp AYNI 26 test tekrar koşuldu — **birebir aynı 26 test, birebir aynı hata mesajlarıyla** yine başarısız oldu (ör. "Beklenen 403/404 ama 401 döndü" — tenant-isolation IDOR testleri + 1 api-permissions + 1 ui-access). **Bu 26 başarısızlık önceden var, bu oturumun değişiklikleriyle İLGİSİZ** (muhtemelen CLAUDE.md'nin zaten not ettiği "Faz 14 hariç... sonraki genel RBAC koşusuna dahil edilmeli" bakiyesi) — Faz 1-3 **sıfır regresyon** doğrulandı. Bu 26 test kendi başına ayrı bir güvenlik takip işi (tenant-isolation IDOR'ları 401 değil 403/404 dönmeli — muhtemelen ilgili route'larda tenantMiddleware'den önce/sonra farklı bir kontrol sırası sorunu).
- ❌ **Gerçek bir PostgreSQL örneğine karşı HİÇ çalıştırılmadı** — `verify-postgres-rls.ts`,
  `apply-postgres-rls.ts` (SQL uygulama modu), ve tüm RLS/bypass mantığının canlı Postgres
  davranışı **doğrulanmadı**. Production'a alınmadan önce ZORUNLU: gerçek Postgres'e karşı
  `apply:postgres-rls` → `verify:postgres-rls` → tam RBAC süiti (Postgres provider'ıyla).

### Sıradaki adımlar (kullanıcı onayı gereken)
1. Gerçek bir Postgres örneğine karşı yukarıdaki doğrulamaları tamamla.
2. Onaylanırsa versiyon artışı v2.5.0 → v2.6.0 (mimari değişiklik).
3. CLAUDE.md Faz Geçmişi'ne Faz 3'ün nihai durumu işlenir.

---

## Doğrulama Komutları (checklist'ten uyarlanmış)

```bash
# Postgres portu internetten erişilemez olmalı (kendi bilgisayarınızdan çalıştırın)
nmap -p 5432 <sunucu-ip-varsa>
# Beklenen: closed / filtered

# Runtime rolü DDL çalıştıramamalı
PGPASSWORD=<runtime-şifre> psql -h <host> -U <runtime-kullanıcı> -d <db> -c 'DROP TABLE "Tenant";'
# Beklenen: permission denied

# git geçmişinde gerçek DATABASE_URL taraması (zaten kontrol edildi, temiz)
git log --all -p -S "DATABASE_URL=postgresql" | grep "DATABASE_URL"
# Beklenen: eşleşme yok (yalnız .env.example placeholder'ları hariç)
```

Faz 3 sonrası ek doğrulama: `verify-postgres-rls.ts` + `pnpm audit:roles` (Postgres provider'ıyla).
