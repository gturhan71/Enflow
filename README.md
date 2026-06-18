# Enflow Memory Repository

Bu klasör, Enflow projesinin tüm bellek, doküman ve geçmiş kayıtlarını içerir.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `memory.md` | Güncel proje durumu, check-list ve kararlar |
| `walkthrough.md` | Teknik mimari, modüller ve güncelleme notları |
| `readme.md` | Bu dosya — bellek deposu kılavuzu |

## Sürüm Takibi

- **v2.x (18.06.2026):** Kurumsal süreç genişlemesi (Faz 0–8.4) — kalıcı ApprovalChain, Ziyaret Planı, Proje Devir Paketi, tenant-bazlı doküman kodlama + Genel Hususlar, varsayılan iş akışı + skip-logic, **Finans / Hukuk / İhale (İSAB)** operasyonel modülleri, **Yönetim Raporları** (birim metrik + UnitReport), **Sanal Agent** eklenti/lisans altyapısı (provenance + 5 handler). Detay: `enflowdoc.md`, `walkthrough.md`, `CLAUDE.md`.
- **v1.6.3 (09.06.2026):** TypeScript strict-mode refactoring — 128 `any` temizlendi, 27 `console.log` → logger, backend `index.ts` 17 router'a bölündü. tsc frontend+backend sıfır hata.
- **v1.6.2 (08.06.2026):** Backend TypeScript derleme sorunu giderildi. Express `Request` typing pattern normalize edildi. Backend 3002, Frontend 3000 portları stabilize.
- **v1.6.1 (05.06.2026):** Teklif onay akışı, Approval Chain, SaveButton entegrasyonu.
- **v1.6.0:** Workflow Hand-off canlıya alındı, mobil navigasyon eklendi.

## Frontend Komutları

```bash
# Frontend (Vite) — kendi bağımlı olduğu backend 3002 ile konuşur
pnpm install
pnpm dev --port 3000 --host

# docker-compose.yml ile de çalıştırılabilir
docker-compose up -d
```

## Backend Komutları

```bash
cd backend
pnpm install
pnpm dev        # Port 3002
# veya
docker compose up -d  # Port 3001
```

## Memory Güncelleme Kuralları

1. Her milestone sonrası `memory.md` ve `walkthrough.md` güncellenmeli.
2. Versiyon numarası `v1.minor.patch` formatında artırılır.
3. Güncelleme notları, yapılan değişiklikleri izah etmelidir.
4. Commit mesajı formatı: `docs: v1.x.x — [kısa açıklama]`
