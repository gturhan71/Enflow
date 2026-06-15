# Enflow — RBAC ve Güvenlik Test Raporu

**Tenant:** T-Ecosystem Teknoloji (`tenant-1`)  
**Test ortamı:** localhost (Frontend :5173 · Backend :3002)  
**Test tarihi:** ____ / ____ / ______  
**Test eden:** _________________  
**Commit:** _________________

---

## 1. Yönetici Özeti

> 3-5 cümle. Kaç senaryo koşuldu, kaç bulgu çıktı, en kritik risk, genel durum.

- Toplam senaryo: ____
- Geçen / Kalan: ____ / ____
- Bulgu dağılımı: Kritik ___ · Yüksek ___ · Orta ___ · Düşük ___

---

## 2. Kapsam

| Boyut | Kapsanan |
|---|---|
| Roller | GENERAL_MANAGER · PRESALES_ENG · SALES_REP |
| Cross-tenant | ali.mal@enflow.com (tenant-2) |
| Test türü | API yetki matrisi · Tenant izolasyonu (IDOR) · UI sidebar görünürlük |
| Kapsam dışı | Şifre sıfırlama · E-posta bildirimleri · Dosya indirme |

---

## 3. API Yetki Matrisi Sonucu

> ✅ = beklenen · ❌ = sapma (bulgu numarasıyla eşleştir)

| Endpoint | GM | PRESALES | SALES_REP |
|---|---|---|---|
| GET /api/users | | | |
| POST /api/users | | | |
| DELETE /api/users/:id | | | |
| GET /api/customers | | | |
| DELETE /api/customers/:id | | | |
| GET /api/opportunities | | | |
| POST /api/opportunities | | | |
| GET /api/proposals | | | |
| GET /api/units | | | |
| POST /api/units | | | |
| GET /api/tasks | | | |
| GET /api/contract-workflows | | | |
| POST /api/contract-workflows | | | |
| GET /api/archive | | | |

---

## 4. Tenant İzolasyonu (IDOR) Sonucu

| # | Senaryo | Beklenen | Gerçekleşen | Risk |
|---|---|---|---|---|
| I-01 | Başka tenant müşteri listesi | 403/404 | | |
| I-02 | Başka tenant fırsat listesi | 403/404 | | |
| I-03 | Başka tenant tekil fırsat | 403/404 | | |
| I-04 | Başka tenant sözleşme süreci | 403/404 | | |
| I-05 | Başka tenant kullanıcı listesi | 403/404 | | |

---

## 5. UI Erişim Sonucu

| Kontrol | GM | PRESALES | SALES_REP |
|---|---|---|---|
| Test Ortamı (Sözleşme Test) menüsü | görünür | gizli | gizli |
| Ayarlar menüsü | görünür | gizli | gizli |
| Ön Satış menüsü | görünür | görünür | gizli |
| CRM menüsü | görünür | gizli | görünür |
| Login sayfası (oturumsuz) | | | |

---

## 6. Bulgular

### BUG-001 — [Başlık]
- **Ciddiyet:** Kritik / Yüksek / Orta / Düşük
- **Rol:** _____   **Endpoint / Ekran:** _____
- **Tip:** API yetki · Tenant IDOR · UI görünürlük
- **Adımlar:**
  1. _____
  2. _____
- **Beklenen:** _____
- **Gerçekleşen:** _____
- **Kanıt:** (log / Playwright screenshot / HTTP response)
- **Öneri:** _____

> Her bulgu için bu bloğu kopyala.

---

## 7. Öneriler

| Öncelik | Bulgu | Önerilen aksiyon | Sahip |
|---|---|---|---|
| P0 — KRİTİK | Tenant IDOR | x-tenant-id'yi user.tenantId ile eşleştir (middleware) | Backend |
| P1 — YÜKSEK | RBAC enforcement eksik | Route'lara role guard middleware ekle | Backend |
| P2 — ORTA | UI gizleme yeterli değil | API katmanı koruması olmadan UI gizlemek yetmez | Fullstack |

---

## 8. Ek: Otomatik Test Kapsamı

- `tests/api-permissions.spec.ts` — 14 endpoint × 3 rol = 42 senaryo
- `tests/tenant-isolation.spec.ts` — 5 IDOR senaryosu
- `tests/ui-access.spec.ts` — 4 sidebar kontrolü × 3 rol + 1 oturumsuz = 13 senaryo
- HTML rapor: `playwright-report/index.html`
- JSON çıktı: `test-results/results.json`
