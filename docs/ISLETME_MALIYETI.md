# Enflow — İşletme Maliyeti (Overhead) Dağıtımı & Birim Bütçeleme
### Hesaplama Mantığı, Neden & Sunum Rehberi

> **Amaç:** Personel + diğer işletme masraflarından oluşan **işletme maliyeti havuzunu** projelere iki
> katmanda yansıtmak; her projenin **tam-yüklü (gerçek) marjını** hesaplamak; ve birim bütçelerinin
> projelere göre **izlenebilir** olmasını sağlamak. Overhead'in projede kullanılması **yönetim
> insiyatifine** (toggle) bağlıdır — varsayılan kapalı, eski projeler etkilenmez.
>
> **Konum:** Finans → **İşletme Maliyeti** (havuz) · Proje Yönetimi → **Karlılık** (panel + toggle) ·
> Yönetim Raporları → Büyüme Analitiği → **Birim Bütçe Absorpsiyonu**.
>
> **İlke:** Deterministik ve salt-hesap; tüm tutarlar TRY'ye normalize edilir; para birimi kuruş (minor)
> tabanında yuvarlanır. Her kiracı (tenant) verisi izole hesaplanır.

---

## 1. Neden? — "Kârlı görünen proje neden para kazandırmıyor?"

Klasik proje kârı yalnız **direkt maliyeti** (satın alma, seyahat, dış hizmet) düşer:

```
Katkı Marjı = (Sözleşme Değeri − Direkt Maliyet) / Sözleşme Değeri
```

Ama şirketi asıl ayakta tutan **personel + kira + enerji + yazılım lisansı + idari** giderler bu hesaba
girmez. 10 proje "kârlı" görünürken şirket zarar edebilir — çünkü işletme maliyeti hiçbir projeye
yüklenmemiştir. **Tam-yüklü (net) marj** bu boşluğu kapatır:

```
Net Marj = (Sözleşme Değeri − Direkt Maliyet − İşletme Maliyeti) / Sözleşme Değeri
```

İşletme maliyetini projelere **adil** dağıtmak için iki katman kullanılır.

---

## 2. İki Katmanlı Dağıtım

### Katman 1 — Şirket Genel Gideri (yüzdeyle)

Dönemsel havuz tanımlanır: `Havuz = Personel Gideri + Diğer Opex`. Havuz projelere bir **yöntemle**
yansır (yönetim seçer):

| Yöntem | Taban | Formül |
|--------|-------|--------|
| `PCT_OF_VALUE` | Sözleşme değeri | `overhead = değer × oran%` |
| `PCT_OF_DIRECT_COST` | Direkt maliyet | `overhead = direkt maliyet × oran%` |
| `POOL_RATE` | Direkt maliyet | `overhead = direkt maliyet × oran` (ondalık) |

> `PCT_*` yöntemlerinde **oran yüzdedir** (8 = %8). `POOL_RATE`'te **oran ondalıktır** (0.12).

### Katman 2 — Birim İştirak Katsayısı

Her birim bir **maliyet merkezidir**; dönemsel bütçesi ve **fiili dönem maliyeti** (`periodCost`) vardır.
Bir birim projeye iştirak ettiğinde bir **katsayı** (0–1 arası, ağırlık/FTE-payı) o birimin maliyetinin ne
kadarının projeye yükleneceğini belirler:

```
Birim Yükü (proje) = Σ ( birim.periodCost × katsayı[0..1] )    (iştirak eden her birim için)
```

### Toplam

```
Toplam İşletme Maliyeti = Katman-1 (şirket) + Katman-2 (birim yükü)
```

---

## 3. Direkt Maliyet Nasıl Bulunur?

Direkt maliyet, projenin **overhead-dışı ve reddedilmemiş** maliyet kalemlerinin TRY toplamıdır:

```
Direkt Maliyet = Σ ProjectCostItem.amountTRY
                 (kategori ≠ OVERHEAD ve onay ≠ REJECTED olanlar)
```

Böylece overhead, direkt maliyetle **çift sayılmaz**.

---

## 4. Marj Hesabı — İki Yüz

Her proje için iki marj birlikte gösterilir:

| Marj | Formül | Anlamı |
|------|--------|--------|
| **Katkı Marjı** | `(değer − direkt) / değer` | Bugünkü klasik marj; işletme maliyeti hariç |
| **Tam-Yüklü Net Marj** | `(değer − direkt − overhead) / değer` | Projenin şirkete gerçek katkısı |

**Önemli:** Önizlemede tam-yüklü net marj **her zaman** hesaplanır ve gösterilir (yönetim etkisini
görebilsin). Ama net marj yalnızca yönetim **toggle'ı açtığında** projeye kalıcı yazılır.

---

## 5. Yönetim İnsiyatifi (Toggle) — `applyOverhead`

- **Varsayılan: kapalı.** Overhead hesaplanır ama marja düşülmez (yalnız bilgi). Eski projeler etkilenmez.
- Yalnızca **GM / Finans Müdürü** açıp kapatabilir (RBAC). Her açma/kapama denetim izine (ActivityLog)
  yazılır.
- Toggle açıkken: `Project.netMargin` = tam-yüklü; `Project.overheadAmount` = hesaplanan işletme maliyeti.
- **Direkt marj (`avgMargin`) hiçbir zaman değişmez** — iki marj yan yana yaşar.

> Neden toggle? Çünkü overhead dağıtım **politikası yönetim kararıdır**: hangi projeye ne kadar genel
> gider yükleneceği (özellikle düşük-marjlı/yüksek-hacimli DMO kanalı gibi durumlarda) yönetim tercihidir.

---

## 6. Birim Bütçe Absorpsiyonu — "Birim bütçesi iştiraklere göre izlenebilir"

Her birim için: **bütçe (planlanan) vs projelere dağıtılan (iştirak yükü) vs absorpsiyon %**.

```
Dağıtılan (birim) = birim.periodCost × Σ katsayı   (birimin tüm projelerindeki iştirak katsayıları)
Absorpsiyon %     = Dağıtılan / Birim Toplam Bütçesi
Atıl Maliyet      = Σ max(0, Bütçe − Dağıtılan)     (projelere yüklenemeyen; şirket üstlenir)
Aşırı-Dağıtım     = (Σ katsayı > 1)                  (birim %100'den fazla yüklenmiş → uyarı)
```

**Yorum:**
- **Düşük absorpsiyon** = birim maliyetinin çoğu hiçbir projeye yüklenmemiş → **atıl maliyet**, şirket
  yüklenir. Ya birim fazla kadrolu ya iştirakler eksik girilmiş.
- **>%100 (aşırı-dağıtım)** = birim aynı dönemde kapasitesinden fazla projeye yüklenmiş → katsayılar
  gerçekçi değil; düzeltme gerekir.

Bu, **"birimlerin bütçelenmesi iştiraklere göre izlenebilir olmalı"** gereksinimini karşılar.

---

## 7. Uçtan Uca Sayısal Örnek

**Kurulum:**
- Havuz: Personel 2.000.000 + Opex 500.000 = **2.500.000**; yöntem `PCT_OF_VALUE`, oran **%8**.
- Proje: Sözleşme değeri **48.200.000**, direkt maliyet 0 (henüz maliyet girilmemiş).
- Birim (Satış & Pazarlama): dönem maliyeti (`periodCost`) **950.000**; projeye katsayı **0.3**.

**Hesap:**
```
Katman-1 (şirket)   = 48.200.000 × %8            = 3.856.000
Katman-2 (birim)    = 950.000 × 0.3              =   285.000
Toplam Overhead     = 3.856.000 + 285.000        = 4.141.000

Katkı Marjı         = (48.200.000 − 0) / 48.200.000            = %100.0
Tam-Yüklü Net Marj  = (48.200.000 − 0 − 4.141.000) / 48.200.000 = %91.4
```

**Absorpsiyon (Satış & Pazarlama):**
```
Dağıtılan   = 950.000 × 0.3 = 285.000
Absorpsiyon = 285.000 / 1.000.000 (bütçe) = %28
Atıl Maliyet = 1.000.000 − 285.000 = 715.000   ← şirketin üstlendiği atıl kısım
```

> **Sunum Mesajı:** "Proje kâğıt üstünde %100 katkı marjlı görünüyor; ama işletme maliyeti yüklenince
> gerçek net marj %91.4. Ayrıca Satış & Pazarlama biriminin bütçesinin yalnız %28'i projelere
> dağıtılmış — 715.000 ₺ atıl maliyet şirketin sırtında."

---

## 8. Yönetim İçin Ne Sağlar? (Karar Tablosu)

| Görünürlük | Karar |
|------------|-------|
| Tam-yüklü net marj düşük | Fiyatlama/kapsam gözden geçir; düşük-marjlı işi seç |
| Bir birimin absorpsiyonu düşük (atıl) | Kadro/kapasite planı; iştirakleri doğru gir |
| Bir birim aşırı-dağıtılmış (>%100) | Katsayıları düzelt; kapasite aşımı riski |
| Proje bazında overhead aç/kapat | Kanal politikası (ör. DMO'ya farklı yöntem) |

---

## 9. Mimari Notlar (teknik)

- Saf hesap fonksiyonları: `financeEngine.computeCompanyOverhead`, `computeUnitParticipationLoad`,
  `projectMargins` (kuruş/minor tabanında yuvarlama).
- Orkestrasyon: `overheadService.computeProjectOverhead` (önizleme), `applyProjectOverhead` (toggle),
  `computeUnitBudgetAbsorption` (rapor).
- Modeller: `OperatingCostPool`, `UnitBudget`, `ProjectUnitParticipation`; `Project.applyOverhead/
  overheadAmount/netMargin`.
- Salt-okunur çekirdek yetenek — **ayrı lisans değil**; yönetim kontrollü.

---

*Bu belge Enflow İşletme Maliyeti katmanının (Faz 1–3) işlevsel özetidir. Formül ve eşikler uygulamadaki
`financeEngine` + `overheadService` hesaplamalarıyla birebir örtüşür.*
