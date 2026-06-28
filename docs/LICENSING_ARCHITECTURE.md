# Enflow — Lisanslama Mimarisi (hedef + geçiş planı)

> **Karar (2026-06-27):** Lisans üretimi tenant yazılımından **tamamen ayrılır**.
> Ayrı **özel repo + masaüstü/web GUI** vendor aracı imzalar; tenant yalnız
> **doğrular + aktive eder**. Asimetrik (Ed25519), **tenant-bağlı**, **sert kesim**.
> Bu turda: **plan + PoC** (`license-poc/`, kanıtlandı). Tenant entegrasyonu = sonraki adım.

## 1. Bugünkü sorun (doğrulandı)

İki lisans sistemi de aynı kusuru taşır:

| Sistem | Üretim | İmza | Tenant-bağlı? |
|---|---|---|---|
| Eklenti/Agent (`entitlementService`) | Uygulama içi, GM (`/plugins/generate-key`) | **Simetrik HMAC** (`PLUGIN_LICENSE_SECRET` tenant backend'inde; default repoda hardcoded) | Hayır |
| Abonelik (`/tenants/activate-license`) | Uygulama içi, GM (ProvisionWizard) | base64 JSON + zayıf `signature` | Hayır |

**Kök ihlal:** İmzalayan **sır**, lisansı **kullanan** tenant'ın sunucusunda → tenant
kendine sınırsız lisans basabilir; bir lisans her tenant'ta çalışır. Ticari lisanslama anlamsız.

## 2. Hedef mimari

```
   ┌── VENDOR (ayrı özel repo + GUI) ──┐         ┌──── TENANT (Enflow) ────┐
   │  private key (offline, gizli)     │  token  │  public key (gömülü)    │
   │  License GUI → issue(payload,priv)│ ───────▶│  verify(token,pub,tid)  │
   │  System Admin operatörü            │         │  yalnız DOĞRULA + AKTİVE │
   └────────────────────────────────────┘         └─────────────────────────┘
```

- **Asimetrik imza (Ed25519):** private key yalnız vendor aracında; tenant'ta yalnız
  public key → **forge edilemez** (PoC ile kanıtlı).
- **Tenant-bağlı:** payload `tenantId` içerir; başka tenant'ta **RED**.
- **Tenant = yalnız doğrula:** uygulama içi üretim kalkar; sır tenant'tan çıkar.
- **Token:** `ENF1.<base64url(payload)>.<base64url(sig)>` (versiyonlu).
- **Payload:** `{ v, tenantId, sku, plugins[], limits{users,storageGB}, issuedAt, expiresAt|null, nonce }`.

## 3. Vendor aracı (ayrı özel repo + GUI)

- **Ayrı private repo** (tenant dağıtımıyla hiçbir bağı yok). Küçük **web/masaüstü GUI**:
  form (tenantId, SKU, plugin seçimi, limitler, süre) → **imzalı token** üretir, panoya/dosyaya verir.
- **Private key yönetimi:** bir kez üretilir, **offline/donanım/secret-store**'da tutulur; repoya girmez.
- **Operatör:** vendor "System Admin". (Tenant içinde lisans üreten role gerek yok.)
- Mantık `license-poc/lib.mjs` (`makePayload`/`issue`) ile aynı çekirdek; GUI bunu sarar.

## 4. Tenant tarafı değişiklikleri (sonraki adım)

1. **Public key göm:** `backend/src/config/licensePublicKey.pem` (yalnız açık anahtar).
2. **`entitlementService`:** `signaturePart`(HMAC) + `generateLicenseKey` **kaldır**;
   `validateLicenseKey` → `verifyToken` (Ed25519 + tenantId binding + süre). `PLUGIN_LICENSE_SECRET` env'den çıkar.
3. **`/plugins/generate-key` kaldır** (410 Gone / dev-only değil — tamamen). `/plugins/activate` yalnız doğrular.
4. **Abonelik `/tenants/activate-license`:** aynı `verifyToken` + binding.
5. **Frontend:** `LicenseGeneratorModule` + VirtualAgents "anahtar üret" UI **kaldır**;
   `LicenseTypesModule`/VirtualAgents'ta **yalnız aktivasyon** kalır.
6. **Sert kesim:** yalnız Ed25519-imzalı + tenant-bağlı lisans kabul. Halen aktive
   edilmiş `PluginEntitlement`/`Subscription` kayıtları **geçerli kalır** (DB kaydı,
   her seferinde yeniden doğrulanmıyor) — yalnız **yeni aktivasyon** yeni lisans ister.
7. **RBAC:** üretim kapısı (`settings-license-generate`, plugins generate-key) kalkar; audit:roles güncellenir.

## 5. PoC (bu turda — kanıtlandı)

`license-poc/` (bağımlılıksız, tenant koduna dokunmaz):
- `lib.mjs` — `makePayload` / `issue` (sign) / `verifyToken` (Ed25519 + binding + süre).
- `demo.mjs` — keygen → tenant-1 lisansı → senaryolar.

**Sonuç (`node license-poc/demo.mjs` → 6/6):** geçerli→KABUL · yanlış tenant→RED(binding) ·
tamper→RED(imza) · sahte anahtar→RED(forge) · süresi dolmuş→RED.

## 6. Durum & sonraki adımlar

- [x] **PoC** (Ed25519, tenant-bağlı) — `license-poc/`, 6/6.
- [x] **Vendor üreteç (GUI)** — `license-tool/` (yerel web GUI; ayrı özel repoya taşınacak).
- [x] **Tenant verify-only — EKLENTİ/AGENT yolu (Faz 1):** `backend/src/config/licensePublicKey.ts`
  (public key) + `licenseVerify.ts` (Ed25519+binding+süre) + `entitlementService` (HMAC üretimi
  KALDIRILDI → bundle verify-only) + `/plugins/generate-key` **410** + frontend üretim UI kaldırıldı.
  Doğrulama: yeni token→KABUL · yanlış tenant→RED · eski HMAC→RED · generate-key→410. tsc 0.
- [ ] **Faz 2 — ABONELİK yolu:** `/tenants/activate-license` + `LicenseGeneratorModule` + `ProvisionWizard`
  aynı Ed25519 doğrulayıcıya geçirilir; uygulama-içi abonelik üretimi kaldırılır.
- [ ] **RBAC:** `rbac.config.ts`'te `/plugins/generate-key` beklentisi güncellenir (artık 410); `settings-license-generate` (abonelik üretimi) Faz 2'de kalkar. (RBAC süiti kullanıcı isteyince.)
- [ ] **Üretim:** `licensePublicKey.ts` vendor'un gerçek public key'iyle değiştirilir; `PLUGIN_LICENSE_SECRET` env'den çıkarılır (artık kullanılmıyor).
- [ ] Mevcut müşterilere yeni imzalı lisansların yeniden düzenlenmesi (operasyonel).

## Güvenlik notları
- Private key **asla** tenant repo/dağıtımında olmaz; PoC'nin ürettiği `*.pem` **gitignore**.
- Public key tenant'ta açıkta olabilir (doğrulama için yeterli, imzalama yapamaz).
- Sert kesim sonrası `PLUGIN_LICENSE_SECRET` gereksiz — kaldırılır.
