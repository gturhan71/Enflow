# Enflow — 10x Takım Değerlendirmesi (2026-09-26, v2.5.0, main@d1fd443)

## Özet not
Alan kapsamı ve iş-mantığı derinliği güçlü; ürün "özellik tamam" noktasına geldi ancak **üretim işletim altyapısı ve doğrulama katmanı kapsamın gerisinde**. Bundan sonra en yüksek getiri yeni özellikte değil, "canlıya güvenle çıkabilir mi" sorusunda.

| Perspektif | Not | Tek cümle |
|---|---|---|
| CTO / Ürün | A- | Türk kamu ihalesi zinciri için nadir uçtan uca kapsam; odak dağılma riski |
| Mimari | B | Temiz modüler monolit + merkezi süreç motoru; FE veri katmanı tutarsız |
| Kod kalitesi | B+ | Strict TS, guard script'leri, logger/logActivity disiplini |
| Güvenlik | B- | Katmanlı önlemler var; CSP kapalı + localStorage JWT + doğrulanmamış RLS |
| Veri / DBA | C+ | SQLite-merkezli migration; Postgres yolu migration geçmişsiz |
| Test / QA | C+ | Backend saf-fonksiyon + E2E oracle iyi; route testi yok, FE testi 0, RBAC CI dışı |
| DevOps / SRE | C | Prod'da ts-node, process manager yok, metrik/alert yok |

## P0 — canlı/müşteri öncesi
1. **Üretim çalışma zamanı:** `tsc` build → `node dist`, systemd/pm2 servis birimi, `start.sh` pkill yaklaşımını emekliye ayır.
2. **Postgres'i birinci sınıf yap:** ayrı Postgres migration hattı (provider regex + `db push` yerine), CI'da Postgres job'u, Faz 15 RLS'i gerçek Postgres'te `verify-postgres-rls` ile doğrula.
3. **XSS→oturum çalma zinciri:** CSP'yi aç (en az `script-src 'self'`), JWT'yi httpOnly cookie'ye taşı veya kısa ömür + refresh/revocation ekle. `App.tsx:195` `'mock-token'` fallback'ini kaldır.
4. **RBAC süitini CI'a al:** `seed.ts`'e deterministik ikinci tenant ekle (CI yorumunda zaten gerekçe yazılı).

## P1 — 1–2 sprint
5. Route/entegrasyon testleri: en kritik 10 router (opportunities, contractWorkflow, purchaseRequests, finance, approvalChains…) için supertest katmanı; E2E oracle'ı CI'a al.
6. FE veri katmanını TanStack Query'ye birleştir (45 modül useEffect+fetch) — cache/yeniden yükleme hataları buradan doğar.
7. Gözlemlenebilirlik: request-id, latency/hata metrikleri (Prometheus endpoint veya OTel), zamanlayıcı başarısızlık alarmı.
8. Repo hijyeni: kökteki 10 log dosyası; `backend_log.txt`/`frontend_log.txt` git'ten çıkarılmalı (`*.txt` log'lar ignore dışı).

## P2 — sürdürülebilirlik
9. Büyük dosyalar: `processEngine.ts` (1038), `WorkflowBuilder.tsx` (984), `routes/opportunities.ts` (948) → alt servislere böl.
10. URL-tabanlı routing (derin link, geri tuşu, paylaşılabilir ekran).
11. Sürüm yönetişimi: bekleyen MINOR adayları (Faz 15 → v2.6.0) ve stash'teki mock-demo işi netleştirilmeli.
12. Entegrasyon katmanı (Nextcloud/Exchange/WhatsApp) doğrulaması.

## Korunması gerekenler (iyi olanlar)
- `check:tenant-scope`, `check:no-mock`, `check:no-console` guard'ları — ucuz, etkili regresyon koruması.
- E2E oracle yaklaşımı: 12 test, 3 gerçek bug (biri güvenlik) — en yüksek ROI'li test yatırımı.
- Alan-bazlı tenant şifreleme, Ed25519 lisans, ADVISORY-only para/hukuk agent çift kilidi.
- Tek-kaynak dokümantasyon disiplini (CLAUDE.md + walkthrough §27 + plan dokümanları).
