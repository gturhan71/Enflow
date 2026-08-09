# Enflow — Tenant Verisi Şifreleme Planı (Alan-Bazlı, Tenant-Başına DEK)

> **Durum:** ✅ TAMAMLANDI (2026-08-09, Faz 12 — bkz. `CLAUDE.md` Faz Geçmişi tablosu, migration
> `add_tenant_dek`). Doğrulama adımları (bkz. aşağıdaki "Doğrulama" bölümü) uygulandı: DB'de
> ciphertext, API'de doğru çözülmüş değer, backfill idempotent, `dekWrapped` client'a sızmıyor,
> `tsc` 0, statik kontroller (tenant-scope/no-console/no-mock) yeşil. Kapsam dışı bırakılanlar
> (key rotation, dosya şifreleme, gerçek KMS) hâlâ geçerli — aşağıdaki "Bilinçli kapsam dışı"
> bölümüne bakın.

## Bağlam

İki güvenlik konusu değerlendirildi: (1) kodun kopyalanması/değiştirilmesinin engellenmesi —
mevcut EULA (`docs/EULA.md`) + Ed25519 lisanslama (`docs/LICENSING_ARCHITECTURE.md`) zaten en
etkili katman, teknik obfuscation caydırıcılıktan öteye geçmiyor, bu dokümanın kapsamı dışında;
(2) **tenant verisinin şifreli hale getirilmesi** — bu doküman bunun planı.

Kod taraması şunu doğruladı: Enflow şu an **hiçbir alanı şifrelemiyor**. `Tenant.moduleSettings`
JSON alanı içinde YZ entegrasyon `apiKey`'i düz metin duruyor (`backend/src/routes/tenants.ts`
sadece `hasKey` ile client'a maskeliyor, ama DB'de açık); `Vendor.iban`/`bankName` ve
`Customer.taxNumber`/`taxOffice` da düz metin. SQLite→PostgreSQL geçişi yeni tamamlandığı için
(`b0b2598`, bkz. `install/POSTGRES_MIGRATION_PLAN.md`) bu, şifreleme katmanını her iki DB
motorunda da aynı şekilde çalışacak (uygulama-katmanı, DB-lehçesinden bağımsız) kurmak için
doğru zamanlama.

Kullanıcı ile netleştirilen kapsam kararları:
- **Dağıtım modeli:** Hem on-prem hem gelecekte hosted SaaS düşünülerek tasarlanacak — bugün
  env-var master key ile başlar, master key kaynağı tek bir fonksiyona izole edilir (KMS'e geçiş
  = o fonksiyonu değiştirmek, geniş bir "provider interface" inşa etmeden).
- **Kapsam (Faz 1, minimal alan-bazlı):** Tenant YZ `apiKey`, `Vendor.iban`+`bankName`,
  `Customer.taxNumber`+`taxOffice`. Hiçbiri arama/filtre (`where`) içinde kullanılmıyor —
  şifrelenmeleri hiçbir sorguyu kırmaz (doğrulandı: `grep` sonucu yalnızca create/update/read).
- **Anahtar izolasyonu:** Tenant başına ayrı DEK (envelope encryption) — bir tenant'ın anahtarı
  sızsa diğerleri etkilenmez.
- Disk/TLS düzeyi şifreleme (temel katman) ayrı, dokümantasyon-only bir öneri olarak ele alınıyor
  — kod değişikliği gerektirmiyor, kurulum rehberine not düşülecek.

## Mimari

**Envelope encryption, tenant-başına DEK:**
- `Tenant` tablosuna yeni nullable alan: `dekWrapped String?` — her tenant'ın kendi 32-byte'lık
  Data Encryption Key'i, master key ile AES-256-GCM sarmalanmış halde saklanır.
- Master key: `DATA_ENCRYPTION_MASTER_KEY` env değişkeni (32 byte, base64) — `AUTH_JWT_SECRET` ile
  **aynı desen**: üretimde zorunlu (yoksa açılışta hata), dev'de sabit-ama-güvensiz fallback.
  Yükleme tek bir fonksiyonda izole edilir (`loadMasterKey()`) — ileride KMS'ten çekilecekse
  sadece bu fonksiyon değişir.
- Alan şifreleme: AES-256-GCM, `iv(12B)+authTag(16B)+ciphertext` paketlenip base64, önüne
  `enc:v1:` versiyon öneki eklenir. Önek olmayan (eski düz-metin) değerler decrypt'te olduğu gibi
  geri döner — bu, backfill script çalışmadan önce/sırasında kırılma olmadan kademeli geçişi
  sağlar.
- Tenant DEK'leri process-memory `Map` ile cache'lenir (JWT secret'ın da process ömrü boyunca
  bellekte tutulmasıyla aynı güven sınırı) — her alan şifreleme/çözmede DB'den unwrap tekrarı
  önlenir.

**Neden genel Prisma `$extends` kancası (money-rounding deseni) değil, route-bazlı çağrı:**
`prismaClient.ts`'deki `roundMoneyData` deseni tüm modellerde *uniform* sayısal alanlara
uygulanıyor. Alan şifreleme ise model/alan-bazlı seçici (yalnız 3 model, 5 alan) ve tenantId
çözümü create/update/many şekillerinde tutarsız olabiliyor — bunu genel hot path'e eklemek
gereksiz karmaşıklık+kırılganlık getirir. Bunun yerine küçük, açık bir servis fonksiyonu seti
(`encryptForTenant`/`decryptForTenant`) yazılıp tam olarak dokunan ~7-8 route noktasında
çağrılacak (zaten `ai-settings` route'unda benzer seçici maskeleme mantığı var — aynı yere
oturuyor).

## Yeni dosyalar

**`backend/src/services/tenantEncryption.ts`** (yeni)
- `loadMasterKey()` — env'den 32-byte key, prod'da zorunlu/uzunluk kontrolü, dev fallback.
- `getTenantDek(tenantId)` — `Tenant.dekWrapped` unwrap eder; yoksa lazy-provision (üretir,
  sarmalar, kaydeder) — eski tenant'lar backfill'siz de kırılmaz.
- `encryptForTenant(tenantId, plaintext): Promise<string|null>`
- `decryptForTenant(tenantId, value): Promise<string|null>` — `enc:v1:` önekine göre
  şifreli/düz-metin ayrımı yapar.

**`backend/src/scripts/backfill-tenant-encryption.ts`** (yeni, `backfill-passwords.ts` deseni
tekrarlanır — tek seferlik `npx ts-node` betiği)
- Her tenant için DEK yoksa üretir.
- Mevcut düz-metin `Vendor.iban/bankName`, `Customer.taxNumber/taxOffice`,
  `Tenant.moduleSettings.ai.apiKey` değerlerini yerinde şifreler.
- İdempotent: `enc:v1:` önekiyle başlayanları atlar (tekrar çalıştırma güvenli).

**Migration `add_tenant_dek`** — `Tenant.dekWrapped String?` (Prisma schema'ya eklenip
`npx prisma migrate dev` + `npx prisma generate` + **backend restart**).

## Değişecek dosyalar

- **`backend/prisma/schema.prisma`** — `Tenant` modeline `dekWrapped String?`.
- **`backend/.env.example`** — `DATA_ENCRYPTION_MASTER_KEY=` (açıklama satırıyla,
  `AUTH_JWT_SECRET` bloğunun yanına).
- **`install/wizard.mjs`** — mevcut `secret()` üretim deseni (satır ~58, `AUTH_JWT_SECRET` için
  kullanılan yer ~206/219) aynı şekilde `DATA_ENCRYPTION_MASTER_KEY` için de çalıştırılır (32
  byte, `base64` — `base64url` değil, açıkça ayrı encode).
- **`backend/src/services/aiClient.ts`** (`getTenantAIConfig`, satır 21-41) — `ai.apiKey` DB'den
  okunduktan sonra `await decryptForTenant(tenantId, ai.apiKey)` ile çözülür, dönen config'e
  çözülmüş değer konur. Env fallback (`AI_API_KEY`) dokunulmaz (zaten env, DB değil).
- **`backend/src/routes/tenants.ts`** PUT `/ai-settings` (satır 154-186) — yeni apiKey
  girildiğinde (`apiKey.trim()` doluysa) `encryptForTenant` ile şifrelenip saklanır; boş
  gelirse mevcut (**zaten şifreli**) `prev.apiKey` aynen korunur (gereksiz decrypt/re-encrypt
  yok). GET `/ai-settings` ve `/module-settings` değişmiyor — zaten yalnız `hasKey` dönüyor.
- **`backend/src/routes/vendors.ts`** — GET `/` listesinde her satır için `iban`/`bankName`
  `decryptForTenant` ile çözülüp dönülür; POST `/` ve PUT `/:id`'de aynı alanlar kaydedilmeden
  önce `encryptForTenant` ile şifrelenir.
- **`backend/src/routes/customers.ts`** — GET `/` listesinde `taxNumber`/`taxOffice` çözülür;
  POST `/` ve PUT `/:id` şu an `{ ...req.body, tenantId }` şeklinde tüm body'yi spread ediyor
  (satır 20-21, 34) — bu iki alan body'den ayrıca çekilip şifrelenip üzerine yazılacak şekilde
  küçük bir müdahale gerekiyor (tam spread deseni korunur, yalnız 2 alan override edilir).

## Dokümantasyon

- `install/POSTGRES_MIGRATION_PLAN.md` içine kısa bir not: Postgres bağlantısında
  `sslmode=require` önerisi + işletim-sistemi/disk düzeyinde şifreleme (BitLocker/FileVault/
  bulut sağlayıcı disk encryption) taban-katman önerisi olarak eklenir — kod değişikliği yok,
  yalnız kurulum rehberliği.
- `CLAUDE.md` "Faz Geçmişi" tablosuna yeni satır + "Önemli Teknik Kararlar"a şifreleme deseni
  özeti eklenir (mevcut dosyanın kendi kuralı gereği).
- **Versiyon notu:** CLAUDE.md'nin kendi kuralına göre bu **mimari değişiklik** (yeni veri
  modeli alanı + yeni servis katmanı) → MINOR artış (`v2.3.0` → `v2.4.0`). Kural gereği bu,
  implementasyon bitiminde ayrıca kullanıcı onayıyla yapılacak — bu plan bunu otomatik
  varsaymıyor.

## Bilinçli kapsam dışı (sonraya bırakılan)

- Key rotation / re-wrap tooling (master key değişirse tüm DEK'lerin yeniden sarmalanması) —
  dokümante edilir ama şimdilik build edilmez.
- `backend/uploads/` altındaki yüklenmiş dosyaların (sözleşme/devir evrakı) disk-düzeyinde
  şifrelenmesi — kullanıcı bunu Faz 1 dışında bıraktı.
- Gerçek KMS/HSM entegrasyonu (AWS KMS, Vault) — `loadMasterKey()` fonksiyonu buna izin verecek
  şekilde izole edildi ama entegrasyonun kendisi yapılmadı.

## Doğrulama (uygulama başladığında)

1. `npx prisma migrate dev` + `npx prisma generate` + backend restart (nodemon eski client'la
   çöker — proje kuralı).
2. `tsc` 0 hata.
3. Vendor oluştur (IBAN'lı) → DB'yi doğrudan sorgula (sqlite3/prisma studio): `iban` sütunu
   `enc:v1:` ile başlamalı, düz IBAN görünmemeli. GET `/api/vendors` yanıtında IBAN doğru
   çözülmüş halde dönmeli (VendorForm'da olduğu gibi görünür kalmalı — davranış değişmemeli).
4. Aynısı Customer `taxNumber` için.
5. Ayarlar→Entegrasyonlar'dan YZ apiKey kaydet → DB'de `moduleSettings.ai.apiKey` şifreli;
   spec-analysis/spec-extract çağrısı gerçek/mock uçla çalışmaya devam etmeli (aiClient
   `getTenantAIConfig` decrypt ediyor).
6. `backend/src/scripts/backfill-tenant-encryption.ts` dev.db'ye karşı çalıştırılır — mevcut
   seed verisindeki düz-metin alanlar şifrelenir; script ikinci kez çalıştırılıp idempotent
   olduğu (çift şifreleme yok, değerler aynı çözülüyor) doğrulanır.
7. RBAC süiti yeşil kalmalı — davranışsal fark olmamalı, yalnız depolama şekli değişti.
8. Hiçbir yerde plaintext key/DEK/apiKey `console.log`/`logActivity details` içine sızmadığından
   emin ol (`logActivity` çağrıları zaten `hasKey`/isim gibi güvenli alanlar kullanıyor —
   yeni eklenen yerlerde de aynı disiplin korunacak).
