// Enflow — Lisans doğrulama PUBLIC anahtarı (Ed25519, SPKI/PEM).
// Lisansı VENDOR aracı (ayrı özel repo) imzalar; tenant yalnız bununla DOĞRULAR.
// Sır YOK → lisans forge edilemez. ÜRETİMDE bu, vendor'un gerçek public key'iyle değiştirilir.
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAkpomKbaoY0KkM0hyWxxU8+mrRurNir+sq9x/q+OON/c=
-----END PUBLIC KEY-----`;
