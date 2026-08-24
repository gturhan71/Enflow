# Enflow — Kurulum Senaryolarına Göre Sistem Gereksinimleri

Bu belge, `install/wizard.mjs` ile yapılan kendi-barındırma (self-hosted) kurulumları için
**tek kaynak** gereksinim referansıdır. Üç senaryo — hangisini seçeceğiniz `install/wizard.mjs`
kurulum sihirbazının artık sorduğu **kapasite teyidi** sorularına (beklenen kullanıcı sayısı +
yıllık veri hacmi) göre kendiliğinden önerilir.

> Kurulum mekaniği (adım adım komutlar, sorun giderme) için: [`install/README.md`](../install/README.md).
> SQLite→PostgreSQL geçişi: [`POSTGRES_MIGRATION_PLAN.md`](../install/POSTGRES_MIGRATION_PLAN.md).

---

## Senaryo seçimi — karar tablosu

| Beklenen ölçek | Senaryo | Veritabanı |
|---|---|---|
| ≤ 5 kullanıcı, deneme/pilot | **1 — Geliştirme / Pilot** | SQLite |
| ≤ 20 kullanıcı, ~5 GB/yıl'a kadar veri | **2 — Küçük Ölçek Üretim** | SQLite |
| > 20 kullanıcı **veya** > 5 GB/yıl veri **veya** yoğun eşzamanlı yazım | **3 — Kurumsal Üretim** | PostgreSQL |

Eşikler (`SQLITE_MAX_USERS=20`, `SQLITE_MAX_STORAGE_GB=5`) `install/wizard.mjs`'te
kod-seviyesinde tanımlıdır ve kurulum sihirbazı bunları otomatik uygular (aşıldığında
PostgreSQL sorusunun varsayılanı `Evet`'e döner). **Asıl sınır ham veri boyutu değil,
SQLite'ın tek-dosya/tek-yazar mimarisinin eşzamanlı YAZMA kapasitesidir** — depolama GB'ı
ikincil bir sinyaldir.

Senaryo 1/2'den 3'e geçiş **tersine çevrilebilir bir kesinti gerektirmez**: mevcut çalışan
kurulum `cd backend && pnpm migrate:to-postgres` ile kaynağa dokunmadan (yalnız okur),
satır-sayısı doğrulaması geçmeden yapılandırmayı değiştirmeden PostgreSQL'e taşınır.

---

## Ortak gereksinimler (tüm senaryolar)

| Bileşen | Minimum | Önerilen |
|---|---|---|
| İşletim sistemi | Windows 10 / Ubuntu 20.04 / macOS 12 | Windows 11 / Ubuntu 22.04+ / macOS 14 |
| Node.js | 20 LTS (sihirbaz yoksa **otomatik kurar**) | 22 LTS veya 24 |
| pnpm | 10 (sihirbaz `corepack` ile kurar) | 10.33+ |
| git | 2.30+ | güncel |
| Tarayıcı (frontend — React 19) | Chrome/Edge/Firefox/Safari son 2 sürüm | aynı, güncel tutulan |
| Açık portlar | 3000 (frontend, yalnız geliştirme) / 3002 (backend — üretimde tek origin) | yapılandırılabilir |
| Ağ | İlk kurulumda internet (bağımlılık indirme) | üretimde reverse proxy (nginx/Caddy) + TLS |

---

## Senaryo 1 — Geliştirme / Pilot (SQLite, minimum)

Tek geliştirici veya küçük bir pilot (≤5 kullanıcı) için.

| | Minimum |
|---|---|
| vCPU | 1 |
| RAM | 1 GB |
| Disk | 5 GB, SSD |

Kurulum: `install/wizard.mjs` → "PostgreSQL kullanılsın mı?" sorusuna **Hayır** (varsayılan).

---

## Senaryo 2 — Küçük Ölçek Üretim (SQLite, önerilen — ~20 kullanıcıya kadar)

| | Önerilen |
|---|---|
| vCPU | 2 |
| RAM | 2 GB |
| Disk | 20 GB, **NVMe SSD zorunlu** |
| Veritabanı | SQLite (WAL modu + `busy_timeout=5s` — `backend/src/prismaClient.ts`, otomatik) |
| Yedekleme | Uygulama-içi (`backupService.ts`), hedefi **DB ile aynı diskte tutmayın** (Nextcloud/S3) |

**Gerekçe:**
- **RAM:** Node tek süreç (cluster/pm2 yok), idle RSS ~85 MB — 2GB'ın çoğu OS sayfa önbelleği/başlık payı, 4GB+ önerilmiyor çünkü darboğaz burada değil.
- **2 vCPU:** CPU yükü düşük ama arkaplan zamanlayıcılar (yedekleme `VACUUM INTO`, hatırlatma sweep'leri — `backend/src/services/*Reminders.ts`) kısa I/O patlamaları yapar; tek çekirdekte bunlar aktif istekleri geciktirebilir.
- **SSD/NVMe zorunlu, ağ diski (NFS/SMB) KULLANMAYIN:** WAL checkpoint'leri ve `fsync` gecikmeye çok duyarlı; SQLite resmi dokümantasyonu ağ dosya sistemlerinde kilitlenme riski konusunda açıkça uyarır.
- **Disk boyutu DB'den çok `backend/uploads/`'a bağlı** — sözleşme evrakları/teslimat kanıtları birikir; beklenen evrak hacmine göre yukarı çekin.
- **Sınır aşıldığında** (~20 kullanıcı veya gözle görülür `SQLITE_BUSY`/gecikme): donanımı büyütmek yerine Senaryo 3'e geçin.

Kurulum: `install/wizard.mjs` kapasite sorularına gerçekçi rakamlar girin — eşik aşılmıyorsa SQLite önerilir.

---

## Senaryo 3 — Kurumsal Üretim (PostgreSQL)

SQLite'ın tek-yazar kısıtı ortadan kalktığı için mimari farklılaşır: veritabanı ayrı
bir sunucuda/serviste, uygulama sunucusu(ları) ondan bağımsız ölçeklenebilir.

| Bileşen | Önerilen (orta ölçek başlangıcı — trafiğe göre yukarı çekin) |
|---|---|
| PostgreSQL sürümü | 14+ |
| DB sunucusu — vCPU | 2–4 |
| DB sunucusu — RAM | 4–8 GB |
| DB sunucusu — Disk | SSD/NVMe, boyut veri hacmine göre |
| Uygulama sunucusu — vCPU | 2 (her replika) |
| Uygulama sunucusu — RAM | 2 GB (her replika) |
| Bağlantı havuzu | Yüksek eşzamanlılıkta PgBouncer (veya benzeri) önerilir |
| Yatay ölçekleme | Artık mümkün — PostgreSQL gerçek eşzamanlı yazarları destekler; birden fazla backend replikası + load balancer kurulabilir (SQLite'ta mümkün değildi) |

Kurulum: `install/wizard.mjs` → "PostgreSQL kullanılsın mı?" **Evet** (kapasite eşiği
aşıldığında varsayılan zaten bu olur) — sihirbaz rol/DB provizyonunu (varsa `psql` ile)
otomatik yapar, `schema.prisma` provider'ını kendisi `postgresql`'e çevirir (elle
düzenleme **gerekmez**).

Mevcut bir Senaryo 1/2 kurulumundan geçiş: [`POSTGRES_MIGRATION_PLAN.md`](../install/POSTGRES_MIGRATION_PLAN.md)
+ `cd backend && pnpm migrate:to-postgres`.

---

## Senaryo 4 — Çoklu-Replika Kurumsal (birden fazla backend kopyası)

Senaryo 3'ün "yatay ölçekleme mümkün" ifadesi veritabanı için doğru, ama **uygulama
katmanı** için ek ön koşullar gerektirir — Senaryo 3'ten Senaryo 4'e (tek backend →
N backend replikası + load balancer) geçmeden önce aşağıdakiler sağlanmalı. Detaylı
gerekçe ve kod kanıtı: [Enflow Ölçeklendirme Mimarisi](../docs/OLCEKLENDIRME_DUZELTME_PLANI.md).

| Ön koşul | Durum | Not |
|---|---|---|
| Zamanlayıcı kilidi | ✅ Faz A'da eklendi | `backend/src/services/schedulerLock.ts` — DB-native, dialect-bağımsız |
| Paylaşımlı dosya deposu | ⚠️ **Zorunlu, elle yapılandırılır** | Nextcloud (`NEXTCLOUD_URL/USER/PASS`) yapılandırılmadan ikinci bir replika eklemeyin — aksi halde bir replikaya yüklenen sözleşme evrakı diğerinden erişilemez. `ENFLOW_MULTI_REPLICA=true` set edildiğinde boot'ta bu kontrol edilip eksikse loglanır (`deploymentGuard.ts`), süreç durdurulmaz. |
| Bağlantı havuzu boyutlandırma | ✅ Faz B'de eklendi | `backend/.env` → `DATABASE_POOL_MAX` (varsayılan 10). Kural: `DATABASE_POOL_MAX × replika_sayısı ≤ Postgres max_connections`; yüksek eşzamanlılıkta **PgBouncer artık önerilir değil, zorunludur**. |
| Genel API hız-sınırlama | ℹ️ Bilinçli sınırlama | `express-rate-limit` in-memory — fiili limit replika sayısıyla orantılı büyür. Şimdilik kabul edilen bir kısıt (bkz. Eksiklik Raporu S-04). |

Kurulum: `ENFLOW_MULTI_REPLICA=true` ortam değişkenini set edin, load balancer'ı
kurun, yukarıdaki tablo tamamlanmadan replika sayısını artırmayın.

---

## Lisans kapsamı notu

Sistem gereksinimleri lisans planından **bağımsızdır** — TRIAL/STARTER/PROFESSIONAL/ENTERPRISE
plan sınırları (kullanıcı/depolama) `Subscription` kaydında ayrıca izlenir, donanım sizing'i
etkilemez. Lisans şartları için: [`EULA.md`](EULA.md).
