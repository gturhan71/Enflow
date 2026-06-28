# Enflow Wiki

Yazılımı hiç bilmeyene uçtan uca anlatan **tek statik sayfa**. **Tek doğruluk
kaynağı:** `walkthrough.md §27`.

## Üretim
```bash
node wiki/build.mjs    # walkthrough §27 → wiki/index.html
```
Çıktı deterministiktir (tarih §27'den) — §27 değişmedikçe dosya değişmez.

## Yayın (sürekli, otomatik)

1. **GitHub Pages** — `.github/workflows/wiki-pages.yml`: `walkthrough.md` veya
   `wiki/build.mjs` her değiştiğinde wiki yeniden üretilir ve Pages'e deploy edilir.
   - **Tek seferlik kurulum:** GitHub → Settings → Pages → Source = **GitHub Actions**.
   - Yayın URL'si: `https://gturhan71.github.io/Enflow/`

2. **Backend `/wiki`** — `backend/src/index.ts` statik servis (`GET /wiki`).
   Backend açılışında `wiki/build.mjs` best-effort yeniden çalışır → servis güncel kalır.
   - Lokal: `http://localhost:3002/wiki/`

## Güncelleme akışı
```
walkthrough §27 güncelle  →  push
   ├─ CI: build → GitHub Pages (otomatik)
   └─ backend restart: build → /wiki (otomatik)
```
