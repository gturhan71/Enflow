# Enflow Memory — v2.x (Kurumsal Süreç Genişlemesi)

- **Tarih:** 18.06.2026
- **Status:** Aktif geliştirme — kurumsal süreç boşluk kapatma planı Faz 0–8.4 tamamlandı.
- **Özet:** ISO 9001 tipi kurumsal süreç gap-analizine göre platform operasyonel birimler ve yönetişim katmanıyla genişletildi. Detaylı bağlam `CLAUDE.md`, kullanım `walkthrough.md`, mimari `enflowdoc.md`.

## Faz Check-list (Faz 0–8.4)
- [x] **Faz 0** — Kalıcı `ApprovalChain`/`ApprovalStage` + Opportunity/ContractWorkflow onay akışları + 4 yeni swimlane birimi (İGPD/KSU/KGD/İSAB)
- [x] **Faz 1** — Aşama-bazlı onay swimlane (Bekleyen Onaylarım), kayıp fırsat nedeni + otomatik arşivleme, iş günü SLA, proje kod üreticisi
- [x] **Faz 2** — Ziyaret Planı + Günlük Rapor modülü, Proje Devir Paketi (11 zorunlu evrak)
- [x] **Faz 3** — Tenant-bazlı özgün doküman kodlama + Genel Hususlar (Alınan Dersler / Risk & Fırsat / KPI / Dış Doküman Sicili)
- [x] **Faz 4** — EKAP iskeleti (manuel İKN) + Hukuk talebi (`TodoTask.relatedModule='LEGAL'`)
- [x] **Faz 5** — Varsayılan iş akışı şablonu + skip-logic (deadlock önleme) + devir uyarıları
- [x] **Faz 6a/6b/6c** — Finans (fatura/tahsilat/teminat/maliyet onayı), Hukuk görünümü (LegalCase), İhale/İSAB (Tender + checklist)
- [x] **Faz 7** — Yönetim Raporları: birim metrik servisi + konsolide dashboard + iş akışı darboğazı + UnitReport gönderim/inceleme
- [x] **Faz 8.0–8.4** — Sanal Agent eklenti/lisans altyapısı (PluginEntitlement/AgentRun), imzalı lisans üretimi, köken etiketi (provenance), 5 deterministik handler (tender/project/presales/procurement/finance — finans ADVISORY-only)
- [ ] **Faz 7.4** — UnitReport PDF/yazdırma + dönem karşılaştırma
- [ ] **Faz 8.x** — kalan handler'lar (CRM/Hukuk)

> ℹ️ Lisanslama Ed25519'a geçti (`PLUGIN_LICENSE_SECRET` kaldırıldı) — bkz. `docs/LICENSING_ARCHITECTURE.md`.
> RBAC regresyon süiti her faz sonunda **69/69** geçti.

---

## Önceki: Final v1.6.3 (09.06.2026)

- **Status:** Production Ready.
- **Özet:** Tam TypeScript strict-mode refactoring tamamlandı. `console.log` → `logger` utility, `any` → proper types, backend `index.ts` (1064 satır) 17 router dosyasına bölündü. Frontend ve backend `tsc --noEmit` her ikisi de temiz.

## Final Check-list
- [x] Aydınlık mod glass kontrastı.
- [x] Teklif onay iş akışı (Approval Chain).
- [x] CRM fırsat ve teklif yönetim aksiyonları.
- [x] Manuel BoM ve Maliyet kalemi ekleme.
- [x] Global 'SaveButton' entegrasyonu.
- [x] Backend TypeScript derleme hatası giderildi.
- [x] Backend 3002 portunda çalışıyor.
- [x] Frontend 3000 portunda çalışıyor.
- [x] TypeScript strict-mode: `any` tipleri temizlendi (128 adet).
- [x] `console.log` → `logger` utility (27 adet, `import.meta.env.DEV` gate'li).
- [x] Backend `index.ts` modüler router mimarisine bölündü (17 route dosyası).
- [x] Frontend `tsc --noEmit` temiz.
- [x] Backend `tsc --noEmit` temiz.
