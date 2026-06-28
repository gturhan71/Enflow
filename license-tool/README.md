# Enflow Lisans Üreteci (Vendor — yerel web GUI)

Tenant'a özel **imzalı lisans** üretir. Tenant yalnız **doğrular** (sır yok).

> ⚠️ **AYRI ÖZEL REPOYA TAŞINACAK.** Bu araç tenant yazılımından bağımsızdır,
> tenant dağıtımına **asla** girmez. `keys/private.pem` yalnız operatörün
> makinesinde durur; **asla paylaşılmaz/commit edilmez** (`.gitignore`).

## Çalıştır
```bash
node license-tool/server.mjs       # → http://localhost:7070
```
1. **Anahtar Üret** (bir kez) → `keys/private.pem` (gizli) + `public.pem`.
2. **public key**'i tenant'a göm (`backend/.../licensePublicKey.pem`) — doğrulama için.
3. Form: Tenant ID + SKU + limit + süre + agent seçimi → **Lisans Üret** → token.
4. Token müşteriye verilir; müşteri Enflow'da **Aktive Et** ile girer.

## Güvenlik
- **private key = imzalama yetkisi.** Donanım/secret-store'da tut; yedekle; sızdırma.
- Anahtar değişimi (rotation): yeni çift üret → yeni public key'i dağıt → eski lisansları yeniden düzenle.
- Token tenant'a bağlıdır (`tenantId`); başka tenant'ta geçersiz. Ed25519 imza → forge edilemez.

## Dosyalar
- `core.mjs` — kendi içinde tam Ed25519 imzalama (`keygen`/`makePayload`/`issue`).
- `server.mjs` — bağımlılıksız yerel sunucu (`/api/keygen`, `/api/issue`, `/api/pubkey`).
- `public/index.html` — GUI.

Mimari & tenant tarafı: [`docs/LICENSING_ARCHITECTURE.md`](../docs/LICENSING_ARCHITECTURE.md).
