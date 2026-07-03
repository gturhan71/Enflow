# Enflow — Büyüme Analitiği
### Neden İzliyoruz? Ne Kazandırır? — Sunum & Karar Rehberi

> **Amaç:** Bu belge, Enflow'un **Büyüme Analitiği** katmanındaki her göstergenin *neden* var olduğunu, hangi kök soruna dokunduğunu, izlendiğinde *hangi kararı* mümkün kıldığını ve *ne fayda* ürettiğini anlatır. Teknik olmayan yöneticilerle sunumlarda doğrudan kullanılabilir.
>
> **Konum (uygulama):** Yönetim Raporları → **Büyüme Analitiği** sekmesi. Sağlık kartları ayrıca Proje Yönetimi ve CRM → Müşteriler ekranlarında da görünür.
>
> **Ortak ilke:** Tüm göstergeler **salt-okunur** ve **deterministik**tir — mevcut operasyonel veriden türetilir, veri yaratmaz, tahmin uydurmaz. Her kiracının (tenant) verisi izole hesaplanır.

---

## 1. Yönetici Özeti

Bir B2B / kamu-ihalesi / IT-entegrasyon şirketinde büyüme; **satış hunisi, ihale kazanımı, proje kârlılığı, tahsilat ve müşteri portföyü** olmak üzere birbirini besleyen beş halkanın sağlığına bağlıdır. Bu halkaların herhangi biri sessizce bozulduğunda sonuç aynıdır: **ciro büyür ama nakit ve kâr büyümez.**

Büyüme Analitiği, bu beş halkayı **tek bir ekranda, sebep-sonuç ilişkisiyle** görünür kılar. Her gösterge bir soruya cevap verir:

| Soru | Gösterge |
|------|----------|
| Fırsatlar nerede tıkanıyor, neden kaybediyoruz? | **Dönüşüm Hunisi** |
| Hangi idarede/yöntemde kazanıyoruz, nereye teklif vermeliyiz? | **İhale Analitiği** + **Bid/No-Bid Skorkartı** |
| Pipeline gerçekte ne vaat ediyor, hedefi tutar mı? | **Ağırlıklı Tahmin & Kapsama** |
| Teklif ettiğimiz maliyeti tutturabiliyor muyuz? | **BoM Maliyet Varyansı** |
| Paramız nerede takılı, ne zaman gelecek? | **Alacak Yaşlandırma & DSO** |
| Tek müşteriye/kamuya ne kadar bağımlıyız? | **Konsantrasyon (HHI)** |
| İhaleye girmeye yetkinlik belgemiz hazır mı? | **Belge Portföyü** |
| İşin genel sağlığı nedir, zayıf halka hangisi? | **İş / Proje / Müşteri Sağlık Skorları** |

**Kısaca fayda:** Sorunları *gerçekleşmeden önce*, kök nedenine inerek görmek → geç kalmış kararların (kaçan tahsilat, kaybedilen ihale, erozyona uğramış marj) maliyetini önlemek.

---

## 2. Okuma Mantığı: Neden → Ölçüm → Sonuç

Her göstergeyi üç katmanda okuyun:

```
KÖK NEDEN            →   ÖLÇÜM (gösterge)        →   SONUÇ / KARAR
(neyi izliyoruz?)         (nasıl sayısallaşır?)       (izlersek ne kazanırız?)
```

Aşağıdaki bölümlerde her gösterge bu üç katmanla ve bir **"Sunum Mesajı"** ile verilmiştir.

---

## 3. Satış Motoru

### 3.1 Dönüşüm Hunisi (Funnel)

**Ne ölçer:** Fırsatların `Yeni → İletişim → Nitelikli → Teklif → Müzakere → Kazanıldı` aşamaları boyunca kaç adet ilerlediğini ve **her aşamadan sonrakine geçiş oranını**. Ayrıca kaybedilen fırsatları **kayıp nedenine göre** gruplar.

**Neden önemli (kök neden):** Ciro düşüşünün nedeni çoğu zaman "az fırsat" değil, **belirli bir aşamada sistematik sızıntıdır** — örn. tekliflerin %70'i müzakerede ölüyorsa sorun fiyatlama/yetkinlikte, huninin başında değildir. Neden görünmezse çözüm yanlış yere yatırılır.

**Nasıl hesaplanır:** `dönüşüm(n) = aşama(n+1)'e ulaşan / aşama(n)'e ulaşan`. Kayıp kırılımı, `LOST` fırsatların `lostReason` alanından sayılır.

**İzlersek ne kazanırız (sonuç):**
- Darboğaz aşamayı tam olarak işaretler → eğitim/süreç yatırımını doğru yere yönlendirir.
- En sık kayıp nedeni ("fiyat", "yetkinlik", "zamanlama"...) görünür → tekrar eden kaybı yapısal olarak keser.
- Aşama-arası oran zaman içinde izlenirse, bir sürecin **iyileşip iyileşmediği** ölçülebilir.

> **Sunum Mesajı:** "Fırsat üretmiyoruz değil — tekliften müzakereye geçişte %X kaybediyoruz; kayıpların çoğu tek bir nedene bağlı. Oraya müdahale büyümenin en ucuz kaldıracı."

---

### 3.2 Ağırlıklı Tahmin & Hedef Kapsama (Weighted Forecast)

**Ne ölçer:** Açık pipeline'ın **olasılıkla ağırlıklandırılmış** değerini ve bunun **satış hedefini (kota)** ne oranda karşıladığını.

**Neden önemli (kök neden):** Ham pipeline yanıltır — 10 M₺ pipeline'ın %10 kapanma olasılıklı olması ile %70 olması apayrı gerçeklerdir. Yönetim "boru dolu" diye rahatlar, çeyrek sonunda hedef tutmaz. **Gerçek beklenti = değer × olasılık.**

**Nasıl hesaplanır:** `ağırlıklı pipeline = Σ (fırsat değeri × olasılık/100)` (yalnız açık fırsatlar). `kapsama = ağırlıklı pipeline / hedef`. Hedef Genel Müdür tarafından girilir.

**İzlersek ne kazanırız (sonuç):**
- Çeyrek daha bitmeden **hedef açığını** görürüz → geç kalmadan pipeline besleme/hızlandırma kararı.
- Kapsama < %100 ise "yeni fırsat mı, mevcutları hızlandırmak mı" tartışması **veriye** dayanır.
- Aşama bazlı ağırlıklı kırılım, hangi aşamadaki değerin gerçekçi olduğunu gösterir.

> **Sunum Mesajı:** "Boru 11 M₺ görünüyor ama olasılıkla ağırlıklı gerçek beklenti X₺ ve hedefin %Y'sini karşılıyor. Açığı bugün kapatmaya başlamazsak çeyrek sonunda seçenek kalmaz."

---

## 4. İhale / Kamu Satış

### 4.1 İhale Analitiği (Tender Analytics)

**Ne ölçer:** İhaleleri **idare (authority)** ve **usul (method: açık/pazarlık/doğrudan...)** bazında gruplayıp her grup için kazanma oranı, kazanılan değer, aktif pipeline ve ortalama teklif tutarını.

**Neden önemli (kök neden):** İhale kaynağı sınırlıdır (zaman, teminat, hazırlık maliyeti). "Her ihaleye girmek" yerine **kazandığımız yerlere** yoğunlaşmak gerekir. Hangi idarede/yöntemde güçlü olduğumuz görünmezse kaynak yanlış dağıtılır.

**Nasıl hesaplanır:** `kazanma oranı = KAZANILAN / (KAZANILAN + KAYBEDİLEN)`, idare ve usul bazında; aktif pipeline `SUBMITTED|EVALUATING` durumundaki değerlerin toplamı.

**İzlersek ne kazanırız (sonuç):**
- Güçlü olduğumuz idare/usul kombinasyonlarını görür, **teklif enerjisini** oraya yatırırız.
- Sürekli kaybedilen bir kanaldan **stratejik çekilme** kararı verilebilir (maliyet tasarrufu).
- Aktif pipeline değeri, teminat ve nakit planlamasını besler.

> **Sunum Mesajı:** "X Bakanlığı açık usul ihalelerinde kazanma oranımız %70; Y kanalında %10. Kaynağı birinciye kaydırmak hem kazanma hem kârlılık artışı demek."

---

### 4.2 Bid / No-Bid Skorkartı

**Ne ölçer:** **Karar aşamasındaki** (taslak/hazırlık) her ihale için 0-100 **girme kararı skoru** ve **Katıl / İncele / Katılma** önerisi.

**Neden önemli (kök neden):** İhaleye girme kararı çoğu şirkette *sezgiseldir*; sonuç, hazırlık maliyetinin boşa gitmesi veya kazanılabilir işin kaçmasıdır. Karar **tekrarlanabilir ve savunulabilir** kriterlere bağlanmalı.

**Nasıl hesaplanır (deterministik skor):**

| Faktör | Ağırlık | Mantık |
|--------|---------|--------|
| İdare kazanma geçmişi | 0–30 | O idaredeki geçmiş kazanma oranımız |
| Son teslim süresi | 0–25 | Hazırlık için kalan gün (çok az → düşük) |
| Evrak hazırlığı | 0–20 | Checklist tamamlanma oranı |
| Değer uyumu | 0–25 | Tahmini bedelin kazandığımız işlerin medyanına yakınlığı |
| İGPD triyaj kademesi | ±5 | Bağlı fırsatın iş-geliştirme değer kademesi |

Skor ≥ 65 → **Katıl**, ≥ 45 → **İncele**, altı → **Katılma**.

**İzlersek ne kazanırız (sonuç):**
- Hazırlık kaynağını **kazanma olasılığı yüksek** ihalelere yönlendirir; düşük skorlu işlere harcanan emeği keser.
- Karar bir kişinin sezgisi değil, **kurumsal kriter** olur → tutarlılık ve denetlenebilirlik.
- Zayıf faktör (örn. "evrak hazır değil") görünür → ihale öncesi somut aksiyon.

> **Sunum Mesajı:** "Bu ihaleye girme skoru 48/100 — idare geçmişi zayıf, evrak %10 hazır. Emeği skoru 70+ olan ihaleye ayırmak daha yüksek beklenen getiri."

---

### 4.3 Belge Portföyü (Yetkinlik Belgeleri)

**Ne ölçer:** Şirket Evrakları envanterini **kategoriye göre dağılım**, **geçerlilik durumu** (geçerli / 90 gün içinde dolacak / dolmuş) ve ihale checklist'lerinde **yeniden-kullanım** açısından.

**Neden önemli (kök neden):** Kamu ihalesinde tek bir süresi dolmuş belge (ISO, vergi levhası, iş deneyim...) teklifi **diskalifiye** eder. Bu risk sessizdir — dolma tarihi geldiğinde fark edilir, o an geç olur.

**Nasıl hesaplanır:** `expiryDate` bugüne göre kovalanır; dolmuş ve 90 gün içinde dolacaklar "dikkat" listesine düşer. Yeniden-kullanım = checklist'lerde otomatik eşlenen belge sayısı.

**İzlersek ne kazanırız (sonuç):**
- Dolmadan **önce** yenileme uyarısı → ihale gününde diskalifiye riskini sıfırlar.
- Portföyün ne kadar "kaldıraç" ürettiği (yeniden-kullanım) görünür.
- Eksik kategori, gelecekteki ihalelere **hazırlık** kararını besler.

> **Sunum Mesajı:** "2 kritik belgemizin süresi dolmuş. Bir sonraki ihalede bunlar bizi diskalifiye edebilir — yenileme bu haftanın işi."

---

## 5. Proje Kârlılığı & Nakit

### 5.1 BoM Maliyet Varyansı

**Ne ölçer:** Teklif aşamasında **verdiğimiz maliyet** (BoM/seçili tedarikçi teklifi) ile projede **gerçekleşen maliyet** (proje maliyet kalemleri) arasındaki farkı ve bunun **marj erozyonuna** etkisini.

**Neden önemli (kök neden):** Kâr, satışta değil **projede** kaybedilir. Teklif fiyatı doğru ama gerçekleşen maliyet şişerse marj sessizce erir. Bu fark ölçülmezse aynı hata her projede tekrarlanır.

**Nasıl hesaplanır:** `varyans = gerçekleşen − teklif edilen`, `varyans% = varyans / teklif`. Kalem bazında sıralanır; toplam **marj erozyonu %** hesaplanır.

**İzlersek ne kazanırız (sonuç):**
- Hangi kalemde (döviz, tedarikçi, kapsam kayması) para kaybettiğimizi görür → sonraki tekliflerde **fiyatlama düzeltmesi**.
- Sistematik erozyon, satın alma/sözleşme sürecine geri besleme yapar.
- "Kârlı görünen ama zarar eden" projeleri erken yakalar.

> **Sunum Mesajı:** "Teklifte tutturduğumuz marj, projede %X eridi — kaybın çoğu şu kalemde. Bir sonraki teklifte bunu fiyata yansıtmak zorundayız."

---

### 5.2 Alacak Yaşlandırma & DSO

**Ne ölçer:** Açık (tahsil edilmemiş) satış alacaklarını **vade kovalarına** (vadesi gelmemiş / 0-30 / 31-60 / 61-90 / 90+ gün gecikmiş) böler ve **DSO** (Ortalama Tahsilat Süresi) hesaplar.

**Neden önemli (kök neden):** "Kârlı" bir şirket **nakitsizlikten** batabilir. Ciro fatura kesildiğinde tanınır ama nakit ancak tahsilatla gelir. Gecikme büyürse büyüme kendini finanse edemez.

**Nasıl hesaplanır:** Her açık faturanın `kalan = tutar − ödenen` değeri gecikme gününe göre kovaya yazılır. `DSO = (toplam açık alacak / son 365 günlük satış tutarı) × 365`.

**İzlersek ne kazanırız (sonuç):**
- 90+ gün kovasındaki tutar **acil tahsilat** aksiyonunu tetikler.
- DSO trendi, tahsilat performansının iyileşip kötüleştiğini gösterir → nakit-akış planı.
- Büyürken nakit sıkışması **önceden** görünür.

> **Sunum Mesajı:** "Ciro büyüyor ama DSO X güne çıktı ve Y₺ alacak 90 günü aştı. Bu, büyümeyi finanse edemememiz demek — tahsilat önceliğimiz."

---

## 6. Portföy Riski

### 6.1 Müşteri & Kamu Konsantrasyonu (HHI)

**Ne ölçer:** Kazanılan gelirin müşterilere dağılımını; **HHI yoğunlaşma endeksi**, en büyük müşteri (top-1) ve ilk üç müşteri (top-3) payı, ve **kamu bağımlılığı** oranı.

**Neden önemli (kök neden):** Gelirin büyük kısmı tek müşteriden/tek kanaldan (örn. kamu) geliyorsa, o müşteri/kanal kaybı **varoluşsal risk**tir. Büyüme, riski gizleyebilir; konsantrasyon ölçülmezse kırılganlık görünmez.

**Nasıl hesaplanır:** `HHI = Σ (müşteri pay% × 100)²` (0–10.000; >2500 yüksek yoğunlaşma). Kamu payı, müşteri adı/sektör metnindeki kamu terimlerinden sezgisel türetilir.

**İzlersek ne kazanırız (sonuç):**
- Tehlikeli bağımlılık görünür → **çeşitlendirme** (yeni sektör/müşteri) stratejisini tetikler.
- Kamu payı yüksekse, bütçe/mevzuat riskine karşı özel sektör dengeleme kararı.
- Yatırımcı/banka sunumlarında **risk şeffaflığı** (olgunluk göstergesi).

> **Sunum Mesajı:** "Gelirin %74'ü tek müşteride, HHI 6181 — yüksek yoğunlaşma. Büyüyoruz ama kırılganız; çeşitlendirme stratejik öncelik olmalı."

---

## 7. Sağlık Skorları — Tek Bakışta Durum

Sağlık skorları, yukarıdaki göstergeleri **tek bir 0-100 skora** ve renk koduna (yeşil/amber/kırmızı) indirger. Amaç: detaya inmeden **nereye bakılacağını** söylemek.

### 7.1 İş Sağlığı Skoru (Kurumsal Kompozit)

Beş sütunu ağırlıklı toplar ve **zayıf halkayı** işaretler:

| Sütun | Ağırlık | Kaynak |
|-------|---------|--------|
| Satış | %25 | Hedef kapsama / huni dönüşümü |
| İhale | %20 | Kazanma oranı + teklif hazırlığı |
| Finans | %25 | Vadesi geçmiş alacak oranı |
| Müşteri | %15 | Yoğunlaşma (HHI) + kamu bağımlılığı |
| Uyum | %15 | Belge geçerliliği |

**Fayda:** Yönetim tek sayıya bakar, düşükse **hangi sütunun** çektiğini anında görür. Toplantı gündemi otomatik oluşur.

> **Sunum Mesajı:** "Genel iş sağlığı 78/100 (Güçlü) — ama zayıf halka İhale (48). Büyümenin bir sonraki adımı orada."

### 7.2 Proje Sağlığı

Her aktif proje için: **Marj (%40) · Takvim (%35) · Bütçe (%25)** → Kritik / İzlemede / Sağlıklı. En riskli proje en üstte.

**Fayda:** Yönetim, 20 proje arasında **hangi 2'sinin** el gerektirdiğini saniyede görür; geciken milestone ve marj erozyonu proje batmadan yakalanır.

### 7.3 Müşteri Sağlığı

Her müşteri için: **Ödeme (%35) · Kazanma (%30) · Aktivite (%20) · Sadakat (%15)** → Sadık / İstikrarlı / Riskli.

**Fayda:** Ödemesi geciken veya aktivitesi düşen müşteri "riskli" olarak öne çıkar → **churn (kayıp) önleme** ve tahsilat aksiyonu proaktif olur.

---

## 8. Göstergeler Birbirini Nasıl Besler? (Zincir)

Büyüme Analitiği'nin asıl gücü, göstergelerin **tek tek değil zincir olarak** okunmasındadır:

```
Huni tıkanması  →  Ağırlıklı tahmin düşer  →  Hedef kapsama açığı
      ↓
Bid/No-Bid ile doğru ihaleye odak  →  İhale kazanma oranı ↑
      ↓
BoM varyansı ile marj korunur  →  Proje sağlığı ↑
      ↓
Zamanında tahsilat (DSO ↓)  →  Finans sağlığı ↑  →  Büyüme kendini finanse eder
      ↓
Konsantrasyon izlenir  →  Tek müşteri riski çeşitlendirilir  →  Sürdürülebilir büyüme
```

**Kompozit İş Sağlığı skoru** bu zincirin çıktısını tek sayıda özetler; alt göstergeler ise **nedenini** açıklar.

---

## 9. Öneri: İzleme Ritmi

| Sıklık | Bakılacaklar | Karar |
|--------|--------------|-------|
| **Haftalık** | Bid/No-Bid skorkartı, Belge portföyü dikkat listesi, 90+ gün alacak | İhale girme kararı, belge yenileme, tahsilat araması |
| **Aylık** | Huni dönüşümü, Ağırlıklı tahmin & kapsama, Proje/Müşteri sağlığı | Pipeline besleme, riskli proje/müşteri müdahalesi |
| **Çeyreklik** | İhale analitiği trendi, BoM varyans trendi, Konsantrasyon/HHI | Kanal stratejisi, fiyatlama düzeltmesi, çeşitlendirme |

**Kural:** Bir gösterge kırmızıya döndüğünde eylem *o an* tanımlanır ve sahiplenilir — panel "izlemek" için değil, **karar tetiklemek** içindir.

---

## 10. Sunum İçin Özet Slayt Notları

1. **Sorun:** Ciro büyürken kâr/nakit büyümeyebilir — çünkü sızıntılar (huni, marj, tahsilat, bağımlılık) sessizdir.
2. **Çözüm:** Büyüme Analitiği, bu sızıntıları **kök nedeniyle** ve **gerçekleşmeden önce** görünür kılar.
3. **Kapsam:** Satış hunisi · Ağırlıklı tahmin · İhale analitiği · Bid/No-Bid · Belge portföyü · BoM varyansı · Alacak/DSO · Konsantrasyon · 3 seviyeli sağlık skoru.
4. **Fark:** Deterministik ve salt-okunur — operasyonel gerçekten türetilir, tahmin uydurmaz; her kiracı için izole.
5. **Sonuç:** Kaybedilen ihalenin, eriyen marjın, geciken tahsilatın ve müşteri bağımlılığının **maliyeti önlenir** → büyüme *sürdürülebilir* hale gelir.
6. **Tek cümle:** *"Nereye bakacağımızı ve neden oraya bakacağımızı bilerek büyümek."*

---

*Bu belge Enflow Büyüme Analitiği katmanının (Faz 1–3) işlevsel özetidir. Formül ve eşikler uygulamadaki `analyticsService` hesaplamalarıyla birebir örtüşür.*
