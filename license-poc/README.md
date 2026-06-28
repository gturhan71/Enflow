# Enflow Lisans PoC (Ed25519, tenant-bağlı, yalnız-doğrula)

Lisans üretiminin tenant yazılımından **ayrılması** mimarisinin kanıtı.
Tam plan: [`docs/LICENSING_ARCHITECTURE.md`](../docs/LICENSING_ARCHITECTURE.md).

> ⚠️ Bu yalnız **PoC**'tir. Üretim aracı **ayrı özel repo + GUI** olacak; bu klasör
> tenant koduna dokunmaz ve üretime gitmez.

## Çalıştır
```bash
node license-poc/demo.mjs
```
keygen → tenant-1 lisansı imzala → doğrulama senaryoları (6/6):
geçerli→KABUL · yanlış tenant→RED · tamper→RED · sahte anahtar→RED · süresi dolmuş→RED.

## Dosyalar
- `lib.mjs` — çekirdek: `makePayload` · `issue(payload, privatePem)` (yalnız üreteç) ·
  `verifyToken(token, publicPem, tenantId)` (yalnız tenant). Token: `ENF1.<payload>.<sig>`.
- `demo.mjs` — uçtan uca senaryo + keygen.

## İlke
- **private key** yalnız vendor üretecinde (offline); **public key** tenant'a gömülür.
- Tenant'ta sır yok → lisans **forge edilemez**; `tenantId` binding → başka tenant'ta geçersiz.

> Üretilen `*.pem` anahtarlar **commit edilmez** (`.gitignore`).
