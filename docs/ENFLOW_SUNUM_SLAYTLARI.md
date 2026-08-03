---
marp: true
title: Enflow — Karar Platformu Sunumu
description: Fırsattan teslime tek akış; değerlendiren, uyaran, karar üreten kurumsal SaaS
paginate: true
theme: default
class: lead
---

<!--
  ENFLOW — Sunum Slaytları (Marp formatı)
  Kullanım: VS Code + "Marp for VS Code" eklentisi → PDF/PPTX/HTML export.
  Ya da CLI: npx @marp-team/marp-cli docs/ENFLOW_SUNUM_SLAYTLARI.md -o enflow.pdf
  Her "---" bir slayttır. <!-- ... --> notları konuşmacı içindir (slaytta görünmez).
  Kaynak anlatı: docs/ENFLOW_Tanitim_ve_Mimari.md
-->

# ENFLOW

## Fırsattan teslime, tek akış.

**B2B · Kamu İhalesi · IT Entegrasyonu için**
**değerlendiren, uyaran, karar üreten kurumsal SaaS**

<!-- Açılış: "Kaydeden değil, değerlendiren bir sistem." -->

---

## Problem — Üç Sessiz Maliyet

Süreç parçalı: CRM ayrı, teklif Excel'de, ihale klasörde, sözleşme e-postada, finans muhasebede.

- 🕳️ **Kaçan iş** — vade, onay, evrak unutulur
- 💸 **Eriyen kâr** — yanlış kur, gizli işletme maliyeti, kötü tedarikçi kararı
- ⚠️ **Görünmeyen risk** — tek müşteriye bağımlılık, kârsız satış, geciken tahsilat

> Ciro büyür; **kâr ve nakit büyümez.**

---

## Çözüm — Tek Akış + Her Adımda Karar

**Ziyaret → CRM → Teklif → İhale → Sözleşme → Proje → Satınalma → Finans**

- Birimler-arası geçiş **otomatik** — veri elle taşınmaz
- İnsan yalnız **karar verir**, sistem taşır ve **değerlendirir**
- Neyin kârlı, neyin riskli, neyin geciktiğini **gerçekleşmeden** söyler

<!-- Vurgu: klasik ERP kaydeder; Enflow değerlendirir ve uyarır. -->

---

## Karar Vericiye 6 Net Vaat

1. **Fırsattan teslime tek akış** — otomatik geçiş zinciri
2. **Kuruşuna kadar finansal doğruluk** — kur, vade, teminat, işletme maliyeti
3. **Kâr getirmeyen satışı kabul etmeden yakalar** (özellikle DMO)
4. **Büyümeyi kök nedeniyle izler** — 13 rapor + 3 seviyeli sağlık skoru
5. **Yönetişim koddan değil ekrandan** — 19 rol, denetim izi
6. **Boş koltuğu doldurur** — 8 sanal agent (para/hukuk daima danışman)

---

## Mimari — Neden Güven Verir

- **Çok-kiracılı izolasyon** — veri sızmaz (IDOR testli)
- **Otomatik geçiş zinciri** — "arada düşen iş" biter
- **Denetim izi** — her işlem köken-etiketli (insan | agent)
- **Para disiplini** — eksik kur bloke; sessiz çevrim yok
- **Ölçek** — SQLite (kolay kurulum) → PostgreSQL (üretim)

`React 19 · Express v5 · Prisma · 65+ model · 7 katman`

---

## Uçtan Uca Akış — Neden→Sonuç

```
Fırsat (usul + vade)  →  Satış Destek (şartname→evrak→hatırlatma→Bid/No-Bid)
      →  Presales BoM (fiyat + teknik uygunluk + kanıt → en uygun)
      →  Maliyet Analizi (forward kur) → Müdür onayı
      →  Sözleşme imza → Proje + Satınalma (referans alış fiyatı)
      →  Finans (vade + finansman + İŞLETME MALİYETİ → tam-yüklü marj)
      →  Büyüme Analitiği + Sağlık Skorları
```

> Her ok bir **otomatik halka**; insan yalnız karar verir.

---

## Sistem "Nasıl Değerlendirir?" — Karar Motorları

| Motor | Çıktı |
|-------|-------|
| Forward-kur Maliyet | Korunmuş marjlı teklif fiyatı |
| BoM Değerlendirme | Fiyat+uygunluk+kanıtla en uygun |
| Bid/No-Bid Skorkartı | Katıl / İncele / Katılma (0–100) |
| Finansman Etkisi | Döviz-bazlı net maliyet/getiri |
| İşletme Maliyeti | Tam-yüklü net marj + absorpsiyon |
| DMO Kârlılık | Net marj + **kârsız alarmı** |
| Sağlık Skorları | 0–100 + zayıf halka |

*Hepsi deterministik & şeffaf — kara kutu değil.*

---

## Finansal Zekâ — "Kuruşuna Kadar"

- **Forward kur:** Kur, teklif anında değil **tahsilat anında** gerçekleşir → marj baştan korunur
- **Finansman etkisi:** Taksitli tahsilat + banka faizi → döviz-bazlı net etki
- **İşletme maliyeti:** Personel+opex havuzu projelere **iki katmanda** yansır (şirket% + birim katsayısı)

> **Katkı marjı %100 → tam-yüklü net marj %91.4** *(gizli maliyet görünür olur)*

---

## Kârsız Satışı Yakalar — DMO Örneği

DMO: düşük-marj/yüksek-hacim kanal. DMO kuru piyasadan düşük + risturn + komisyon.

```
Ciro   = 100 × $1.000 × 34,5 (DMO kuru)   = 3.450.000
Maliyet= 100 ×   $800 × 40   (piyasa)      = 3.200.000
Brüt   = +250.000   ← KÂRLI görünüyor
Risturn %5 + Komisyon %3      = −276.000
Net    = −26.000    ← ZARAR  →  🔴 ALARM
```

> **Kabul etmeden** görürsünüz. *(Ayrı lisanslı modül.)*

---

## Büyüme Analitiği — Kök Nedeni İzle

**13 rapor + 3 seviyeli sağlık skoru** (deterministik, salt-okunur)

- **Satış:** Dönüşüm Hunisi · Ağırlıklı Tahmin & Kapsama
- **İhale:** Kazanma Kırılımı · Bid/No-Bid
- **Kâr/Nakit:** BoM Varyansı · Alacak Yaşlandırma & DSO
- **Risk:** Konsantrasyon (HHI) · Belge Portföyü
- **Sağlık:** İş · Proje · Müşteri skoru → **zayıf halka işaretli**

> "Büyümenin bir sonraki adımı nerede?" — tek bakışta.

---

## Raporlara Nasıl Ulaşılır? — Soru → Rapor

| Soru | Rapor |
|------|-------|
| Fırsatlar nerede tıkanıyor? | Dönüşüm Hunisi |
| Hedefi tutar mıyız? | Ağırlıklı Tahmin & Kapsama |
| Bu ihaleye girmeli miyiz? | Bid/No-Bid Skorkartı |
| Paramız nerede takılı? | Alacak Yaşlandırma & DSO |
| Tek müşteriye bağımlı mıyız? | Konsantrasyon (HHI) |
| Bu projenin gerçek marjı? | Tam-Yüklü Net Marj |
| Bu DMO satışı kazandırıyor mu? | DMO Kârlılık |

*Tüm raporlar canlı · yazdırılabilir · denetlenebilir.*

---

## Yönetişim & Güvenlik

- **19 rol** — menü görünürlüğü + uç-nokta rol kapısı
- **Ekrandan RBAC & iş akışı** — kod dağıtımı gerekmez
- **Tek-kaynak matris + otomatik denetim** (0-hata hedefi)
- **Çok-kiracılı IDOR izolasyonu** — her sürümde test yeşil
- **Yedekleme** — yerel/Nextcloud/S3, doğrulamalı geri-yükleme

> Yetki değişikliği **dakikalar**, IT projesi değil.

---

## Sanal Agentlar — Boş Koltuğu Doldurur

- **8 deterministik birim-agentı** — kadro boşluğunu doldurur
- Çıktı → görev + denetim izi (köken etiketiyle)
- **Para (Finans) & Hukuk = ADVISORY-only** — asla otonom
- İmzalı lisans (Ed25519) + modül lisanslama kapısı

> Eksik kadroyla bile süreç akar; kritik kararda **son söz insanda.**

---

## Karar Vericiyi Etkileyecek Farklar

1. Kaydeden değil **değerlendiren** sistem
2. **Gerçek kâr** — tam-yüklü + finansman-sonrası marj
3. **Kur zekâsı** — forward kur, zarar baştan önlenir
4. **Kârsız satış alarmı**
5. **Diskalifiye önleme** — evrak eşleme + vade hatırlatma
6. **Belgeli tedarik** — fiyat + uygunluk + kanıt
7. **Otomatik zincir** — arada düşen iş biter
8. **Ekrandan yönetişim** + denetlenebilirlik

---

## Ölçülebilir Fayda (ROI)

- **Kâr koruması** — zarar eden/erozyona uğrayan iş önlenir
- **Nakit görünürlüğü** — DSO ile geciken tahsilata erken müdahale
- **İhale kazanımı** — Bid/No-Bid odağı + diskalifiye önleme
- **Süreç hızı** — imza→iş başlangıcı gecikmesi ortadan kalkar
- **Yönetişim maliyeti** — IT/danışmanlık bağımlılığı azalır
- **Risk azaltımı** — HHI + denetim izi + yedekleme

---

## Modüller — Tek Bakışta

**Dashboard · Yönetim Raporları + Büyüme Analitiği · Ziyaret Planı · CRM & Maliyet · Presales · Satış Destek/İhale · Sözleşme · Satın Alma · Proje + İşletme Maliyeti · Finans · DMO Kataloğu · Görevler · Evraklar · Arşiv · Genel Hususlar · Yedekleme · Ayarlar · Test/Agentlar**

> 18 modül, tek akış, tek gerçeklik.

---

# Teşekkürler

## Enflow — "Nereye bakacağımızı ve neden oraya bakacağımızı bilerek büyümek."

**Demo · İletişim**

<!--
  Kapanış: bir "zarar eden DMO satışı" ve bir "tam-yüklü marj" ekranını
  canlı demo ile göster. Ardından soru-cevap.
-->
