# Enflow — DMO Katalog & Kârlılık Modülü
### Hesaplama Mantığı, Neden & Sunum Rehberi

> **Amaç:** Şirketin **Devlet Malzeme Ofisi (DMO)** kataloğunda tedarikçi (satıcı) olarak yaptığı
> satışları uçtan uca yönetmek — katalog, çerçeve anlaşma, sipariş — ve **her siparişin gerçek
> kârlılığını o anki koşullara göre** hesaplayıp **kâr getirmeyen satışlarda alarm** üretmek.
>
> **Kritik gerçek:** DMO satışında her işlem kâr getirmeyebilir. Modülün kalbi bu yüzden bir
> **kârlılık/maliyetlendirme motorudur**; katalog + sipariş bu motorun taşıyıcısıdır.
>
> **Konum:** Sol menü → **DMO Kataloğu** (5 sekme: Siparişler · Katalog · Çerçeve Anlaşmalar · Döviz
> Kurları · Risturn Mutabakatı). **Ayrı lisanslı modül** (`DMO_MODULE` entitlement).

---

## 1. Neden Kâr Getirmeyebilir? — Üç Zarar Kaynağı

1. **DMO kendi döviz kurunu belirler** ve geçerlilik süresi **belirsizdir** (3 gün–3 ay). Satış bu
   (çoğu zaman piyasadan düşük ve donmuş) kurla TL'ye çevrilir; oysa **maliyet güncel piyasa kuruyla**
   oluşur. İki kur **farklı kaynaktan** → **kur açığı** zarar ettirir.
2. **Risturn** — DMO dönem sonunda **toplam ciro** üzerinden kademeli bir kâr-payı/iade tahsil eder;
   bu maliyeti düşürür.
3. **Üçüncü-şahıs komisyonu** — oran (%) **veya** kârdan sabit tutar.

Bu üç kalem, brüt kârda pozitif görünen bir satışı net zarara çevirebilir.

---

## 2. Hesaplama Motoru — Adım Adım

Her sipariş için (kalem bazında) şu hesap yapılır:

```
# 1) Ciro — DMO satış fiyatı × DMO'nun kendi kuru
revenue  = Σ ( adet × birimSatış × dmoKur[satışDövizi] )        # satışDövizi TRY ise ×1

# 2) Maliyet — kendi alış maliyeti × PİYASA kuru (ayrı kaynak!)
cost     = Σ ( adet × birimMaliyet × piyasaKur[maliyetDövizi] )  # piyasaKur ayarlardan

# 3) Brüt kâr
gross    = revenue − cost

# 4) Risturn — dönem cirosuna göre efektif kademe, ciroya uygulanır
risturnRate = efektifKademe( dönemCiro + revenue )   # kademeli eşikler
risturn     = revenue × risturnRate

# 5) Komisyon
komisyon = (tip=ORAN)  ? (taban=KÂR ? gross : revenue) × değer/100
         : (tip=SABİT) ? değer

# 6) Net kâr & marj
net      = gross − risturn − komisyon
marj%    = net / revenue

# 7) Alarm
alarm = (net < 0)  Ya da  (marj% < asgariMarjEşiği)  Ya da  (kur yok/süresi dolmuş)
```

**Kilit nokta:** *satış kuru* (DMO'nun belirlediği) ile *maliyet kuru* (piyasa) **ayrı kaynaklardan**
gelir. DMO kuru piyasadan düşükse, brütte kâr görünse bile risturn + komisyon sonrası **net zarar** çıkar.

---

## 3. Uçtan Uca Sayısal Örnek — "Zarar eden satış"

**Kurulum:** 100 adet sunucu; **satış** \$1.000/adet, **maliyet** \$800/adet.
DMO USD satış kuru **34,5** · piyasa USD maliyet kuru **40** · risturn kademesi **%5** (ciro >1M) ·
komisyon **%3 ciro** · asgari marj eşiği **%10**.

```
Ciro      = 100 × 1.000 × 34,5   = 3.450.000
Maliyet   = 100 ×   800 × 40     = 3.200.000
Brüt Kâr  = 3.450.000 − 3.200.000 =   250.000     ← burada KÂRLI görünüyor!
Risturn   = 3.450.000 × %5        =   172.500
Komisyon  = 3.450.000 × %3        =   103.500
Net Kâr   = 250.000 − 172.500 − 103.500 = −26.000  ← ZARAR
Marj      = −26.000 / 3.450.000   = −%0,8
→ ALARM: "Net kâr negatif — bu satış zarar ettiriyor."
```

**Aynı sipariş, DMO kuru 42 olsaydı** (Yeniden Hesapla):
```
Ciro = 100 × 1.000 × 42 = 4.200.000 → Net Kâr = +664.000, Marj %16 → kârlı.
```

> **Sunum Mesajı:** "Bu satış brütte 250.000 ₺ kârlı görünüyor; ama DMO kuru piyasadan düşük olduğu için
> risturn ve komisyon sonrası **26.000 ₺ zarar**. Sistem otomatik alarm veriyor — teklif kabul edilmeden
> önce görülüyor."

---

## 4. Kur Belirsizliği — "Süresi dolmuş kur" alarmı

DMO kuru, kullanıldığı an **snapshot**'lanır (kur + geçerlilik). Geçerlilik süresi belirsiz olduğundan:
- Kur değiştiğinde **Yeniden Hesapla** o anki koşullarla marjı günceller.
- Snapshot'lanan kurun geçerliliği dolmuşsa **uyarı** üretilir; yeniden hesaplama önerilir.

Bu, "seçilen kurun geçerlilik zamanı belirsiz — 3 günde de 3 ayda da geçebilir" gerçeğini yönetir.

---

## 5. Risturn — Efektif Tahakkuk + Dönem Mutabakatı

- **Her siparişe:** o anki kümülatif ciroya (dönemCiro + sipariş cirosu) karşılık gelen **efektif kademe
  oranı** ciroya tahakkuk ettirilir → anlık kârlılık gerçekçi olur.
- **Dönem sonu (Risturn Mutabakatı):** dönemin toplam cirosuna gerçek kademe uygulanır; **tahakkuk eden
  vs gerçek** fark hesaplanır (dönem sonu düzeltmesi).

```
Gerçek Risturn = ΣdönemCiro × efektifKademe(ΣdönemCiro)
Fark           = Gerçek Risturn − Σ(siparişlere tahakkuk eden risturn)
```

---

## 6. Satış Sabit / Alış Değişken (İş Kuralı)

Aynı **çerçeve anlaşma** kapsamındaki ürünlerin **satış fiyatı ve dövizi sözleşmeyle sabittir** —
bir kez **katalogda** tanımlanır, siparişlerde hep oradan seçilir ve **kilitlidir** (değiştirmek için
katalog kalemi düzenlenir). **Alış maliyeti değişkendir** — sipariş anındaki güncel maliyet girilir.

Bu ayrım motorun mantığıyla örtüşür: **satış deterministik** (sözleşme fiyatı × DMO kuru), **kâr/zararı
belirleyen değişken maliyet + kur açığıdır**.

---

## 7. Sipariş Yaşam Döngüsü ve Otomatik Halkalar

```
DEĞERLENDİRME → CONFIRMED → IN_DELIVERY → DELIVERED → INVOICED → CLOSED
   (fırsat/                                                       · REJECTED (kârsız reddedildi)
    maliyetlendirme)                                              · CANCELLED
```

- **DEĞERLENDİRME:** "fırsat" aşaması — kârlılık + alarm burada görülür; kârsızsa **Reddet**.
- **CONFIRMED (ilk geçiş):** çerçeve anlaşma **kotası** artırılır + kârsızsa yönetime **uyarı bildirimi**.
- **DELIVERED:** otomatik **SALES Invoice** (idempotent) → mevcut Finans/Büyüme Analitiği zincirine
  (alacak yaşlandırma/DSO, müşteri sağlığı, ciro) **kendiliğinden** akar.

---

## 8. Büyüme Analitiği'ne Yansıma — "DMO Kanalı" kartı

Yönetim Raporları → Büyüme Analitiği'nde **DMO Kanalı** kartı:
- Gerçek ciro · net kâr (risturn+komisyon sonrası) · ort. net marj
- Değerlendirmedeki fırsatlar · **kârsız sipariş sayısı** · risturn/komisyon toplamı
- Durum dağılımı · en büyük kurumlar (kâr/zarar renkli)

Böylece DMO'nun **düşük-marj/yüksek-hacim** karakteri kurumsal panoda ayrı izlenir.

---

## 9. Ayrı Lisans

DMO modülü **bağımsız lisanslı** bir add-on'dur (`DMO_MODULE` entitlement). Lisans yoksa menü gizli ve
API 402 döner. Lisans, vendor lisans üreticisiyle (Ed25519 imzalı token) üretilir ve uygulamadan aktive
edilir. Diğer modüller (izin sistemi) etkilenmez.

---

## 10. Sunum İçin Özet

1. **Sorun:** DMO satışında DMO kendi (donmuş, düşük) kuruyla öder; maliyet piyasa kuruyla oluşur; üstüne
   risturn + komisyon → her satış kâr getirmez.
2. **Çözüm:** Her sipariş için **o anki koşullara göre** net kâr/marj hesabı + **kârsızsa otomatik alarm**.
3. **Fark:** Satış fiyatı sözleşmeyle sabit; kâr/zararı **değişken maliyet + kur açığı** belirler.
4. **Sonuç:** Zarar eden satış **kabul edilmeden önce** görünür; risturn dönem sonunda mutabık kalınır;
   teslimler kurumsal finans/analitiğe akar.
5. **Tek cümle:** *"DMO'da hangi satışın gerçekten kazandırdığını, kabul etmeden önce görmek."*

---

*Bu belge Enflow DMO modülünün işlevsel özetidir. Formüller uygulamadaki `dmoCosting` motoruyla birebir
örtüşür (kalem-bazlı satış dövizi, efektif risturn, komisyon, kur snapshot, alarm).*
