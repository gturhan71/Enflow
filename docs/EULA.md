# Enflow — Son Kullanıcı Lisans Sözleşmesi (EULA)

> ⚠️ **Taslak — hukuki inceleme gerekir.** Bu belge, kod tabanında (LICENSE, lisanslama
> mimarisi, abonelik planları) doğrulanabilir gerçek olgulardan derlenmiştir; ancak
> `[YER TUTUCU]` işaretli bölümler (yargı yetkisi/uygulanacak hukuk, destek şartları,
> iletişim kanalı) hak sahibi tarafından doldurulmadan ve bir hukuk danışmanınca
> onaylanmadan **müşteriyle paylaşılmamalıdır**.

**Telif Hakkı Sahibi:** Gökhan Turhan
**Yazılım:** Enflow — Uçtan Uca Kurumsal Süreç & Satış Yaşam Döngüsü Platformu
**Sürüm referansı:** `src/constants.ts` → `APP_VERSION` (bkz. [`CLAUDE.md`](../CLAUDE.md))

---

## 1. Kabul

Enflow'un kurulumu, erişimi veya kullanımı ile bu Sözleşme'nin şartlarını kabul etmiş
sayılırsınız ("Lisans Sahibi" / "Tenant"). Kabul etmiyorsanız yazılımı kurmayın veya kullanmayın.

## 2. Mülkiyet

Enflow ve ilişkili tüm dosyalar münhasıran Gökhan Turhan'ın mülkiyetindedir; ticari ve
gizlidir (Proprietary & Confidential). Bu Sözleşme yalnızca aşağıda tanımlanan sınırlı,
devredilemez kullanım hakkını verir — mülkiyet devri anlamına gelmez. Bkz. kök dizin
[`LICENSE`](../LICENSE).

## 3. Lisans Modeli — kurulum senaryosuna göre kapsam

Enflow **tek-tenant kendi-barındırma (self-hosted)** modeliyle dağıtılır: her kurulum
(`install/wizard.mjs`) tek bir şirkete (tenant) aittir, vendor tarafından merkezi olarak
barındırılmaz. Lisans, **Ed25519 ile imzalı ve tenant-bağlı** bir jetondur (bkz.
[`LICENSING_ARCHITECTURE.md`](LICENSING_ARCHITECTURE.md)) — başka bir tenant'ta çalışmaz,
kopyalanamaz/forge edilemez. Kapsam, kurulum sırasında seçilen veritabanı motorundan
**bağımsızdır** (SQLite ↔ PostgreSQL arasında `pnpm migrate:to-postgres` ile geçiş lisansı
etkilemez — aynı tenant, aynı jeton).

| Plan (`SubscriptionPlan`) | Devreye giriş | Kullanıcı/Depolama sınırı |
|---|---|---|
| **TRIAL** (deneme) | Lisans girilmezse kurulum sihirbazında otomatik, **30 gün** | 5 kullanıcı / 5 GB (varsayılan) |
| **STARTER** | İmzalı lisans jetonu | Jetonun `limits.users` / `limits.storageGB` alanına göre |
| **PROFESSIONAL** | İmzalı lisans jetonu | Jetonun `limits.users` / `limits.storageGB` alanına göre |
| **ENTERPRISE** | İmzalı lisans jetonu | Jetonun `limits.users` / `limits.storageGB` alanına göre |

Sınırlar `Subscription.licensedUserLimit` / `licensedStorageLimit` alanlarında tutulur;
aşımlar uygulama içinde görünür kılınır. Süre `licenseExpiryDate` ile sınırlıysa (jetonda
`expiresAt`), süre dolduğunda lisans yenilenmeden kullanım devam edemez.

**Eklenti/Sanal Agent lisansları** ayrı, aynı imza mekanizmasıyla (`/plugins/activate`)
tenant'a bağlanır; her eklenti kendi kapsamında (ADVISORY/AUTONOMOUS mod) ayrıca lisanslanır.

## 4. Kullanım Hakkı ve Kısıtlamalar

Lisans Sahibi'ne, yalnızca kendi iç iş süreçleri için, lisanslanan kullanıcı/depolama
sınırları dahilinde, tek bir tenant kurulumunda çalıştırma hakkı verilir. Aşağıdakiler
**yasaktır** (hak sahibinin yazılı izni olmadan): kopyalama, değiştirme, tersine mühendislik,
dağıtma, alt lisanslama, üçüncü tarafa devir, kaynak kodun ayrıştırılması, lisans doğrulama
mekanizmasının (`licenseVerify.ts`, Ed25519 imza kontrolü) atlatılmaya çalışılması.

## 5. Veri Sahipliği ve Sorumluluk (kendi-barındırma modeli)

Yazılım kendi-barındırma (self-hosted) olarak dağıtıldığından, **Lisans Sahibi kendi
verisinin (veritabanı, `backend/uploads/` içindeki yüklenen dosyalar) sahibi ve tek
sorumlusudur.** Vendor, Lisans Sahibi'nin altyapısına erişmez, veri yedeklemesini
yönetmez. Uygulama içi yedekleme aracı (`backupService.ts` — LOCAL/Nextcloud/S3 hedefli)
sağlanır; yapılandırma ve çalıştırma sorumluluğu Lisans Sahibi'ndedir.

## 6. Garanti Reddi

Yazılım **"OLDUĞU GİBİ"** sağlanır, satılabilirlik, belirli bir amaca uygunluk ve
ihlal etmeme dahil ancak bunlarla sınırlı olmaksızın açık veya zımni hiçbir garanti
verilmez.

## 7. Sorumluluk Sınırlaması

Hak sahibi, sözleşme, haksız fiil veya başka bir gerekçeyle, yazılımın kullanımından
veya kullanılamamasından doğan hiçbir talep, zarar veya diğer sorumluluktan sorumlu
tutulamaz.

## 8. Süre ve Fesih

Bu Sözleşme, lisans jetonu geçerli olduğu sürece yürürlüktedir. Şartların ihlali
halinde hak sahibi lisansı feshedebilir; fesih halinde Lisans Sahibi yazılımı
kullanmayı durdurmalıdır. Fesih, Lisans Sahibi'nin kendi verisi üzerindeki
mülkiyetini etkilemez (bkz. §5).

## 9. Destek

`[YER TUTUCU — destek kapsamı/SLA/kanalları hak sahibi tarafından tanımlanacak]`

## 10. Uygulanacak Hukuk ve Yetki

`[YER TUTUCU — yargı yetkisi/uygulanacak hukuk hak sahibi tarafından belirlenecek]`

## 11. İletişim

Lisanslama talepleri için hak sahibiyle iletişime geçin
(`[YER TUTUCU — resmi iletişim kanalı]`). Bkz. [`LICENSE`](../LICENSE).

---

**İlgili belgeler:** [`LICENSE`](../LICENSE) (kısa telif bildirimi) ·
[`LICENSING_ARCHITECTURE.md`](LICENSING_ARCHITECTURE.md) (teknik imzalama/doğrulama mimarisi) ·
[`SYSTEM_REQUIREMENTS.md`](SYSTEM_REQUIREMENTS.md) (kurulum senaryolarına göre sistem gereksinimleri)
