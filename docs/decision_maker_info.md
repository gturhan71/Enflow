# ENFLOW — Karar Vericiler İçin Kapsamlı Platform Analizi
### Her Modülün, Her Ekranın ve Aralarındaki Akışın Sistem İçinden Analizi

> **Bu döküman nasıl üretildi?** Önceki sürüm, projenin geliştirme tarihçesindeki
> "faz"lara (Faz 0, Faz 1, ... Faz 9) göre kurgulanmıştı — bu, geliştiricinin ne
> zaman ne yaptığını anlatır ama karar vericinin sorduğu soruyu ("bu platform
> bugün, bir bütün olarak ne yapıyor?") cevaplamaz. Bu sürüm **sıfırdan**, tarihçeye
> bakılmaksızın, **platformdaki her bir modülün güncel koduna (ekranlar, iş
> mantığı, hesaplamalar, uç noktalar) tek tek girilerek** üretildi. Amaç: modüllerin
> tek tek ne yaptığını değil, **birlikte nasıl tek bir karar sistemi oluşturduklarını**
> göstermek — bu bütünlük ancak sistemin içinden, ekran ekran, akış akış görülünce
> anlatılabilir; dışarıdan bir özellik listesiyle anlatılamaz.
>
> Kapsam: **19 üst-seviye modül + Dashboard'un role-bazlı kokpit sistemi**, her biri
> ekranları, adım adım kullanıcı akışı, dikkat çeken iş mantığı/hesaplama/güvenlik
> kuralı ve komşu modüllerle somut veri bağlantısıyla birlikte. `docs/
> ENFLOW_Tanitim_ve_Mimari.md` ve `docs/ENFLOW_SUNUM_SLAYTLARI.md` ile birlikte
> okunabilir (bu döküman onların yerini almaz, derinlemesine tamamlar); §8'de bu
> dökümanın bir satış sunumuna nasıl dönüştürülebileceği gösteriliyor.

---

## 1. Enflow Tek Bakışta Ne

Enflow; IT sistem entegrasyonu, donanım/yazılım tedariki ve kamu ihalesiyle iş
yapan B2B şirketlerinin **satış fırsatından nakit tahsiline kadar tüm iş
yaşam döngüsünü** tek platformda yöneten, çok-kiracılı bir kurumsal karar
sistemidir. 19 modül var, ama bunlar 19 ayrı uygulama değil — her biri bir
işin belirli bir aşamasında durur, kendi işini yapar, sonra **veriyi elle
taşımadan** bir sonraki modüle devreder. Bu döküman önce bu devrin ortak
altyapısını (§2), sonra her modülü tek tek (§3), sonunda da bunların
toplamının neden "19 ayrı ekran" değil "tek bir platform" olduğunu (§4)
anlatıyor.

---

## 2. Paylaşılan Altyapı — Her Modülde Tekrar Eden Ortak Mekanizmalar

Aşağıdaki yedi mekanizma platformun "sinir sistemi"dir; her modül bölümünde
bunlara referans verilecek, burada tek seferde anlatılıyor.

### 2.1 Otomatik Geçiş Zinciri
Bir iş bir modülden diğerine geçerken sistem devreder, kullanıcı elle veri
girmez. Somut halkalar (kod tabanında T1, T3, T4/T4b, T5, T6 olarak
adlandırılıyor):

| Halka | Ne zaman tetiklenir | Ne olur |
|---|---|---|
| T1 | Fırsat WON | Proje kaydı otomatik açılır |
| T3 | İhale WON | Sözleşme Yönetimi'nde DRAFT kayıt otomatik açılır |
| T4 | Sözleşme imza onayı tamamlanır | Proje + milestone şablonu + AI'dan çıkan görev listesi otomatik oluşur |
| T4b | Sözleşme SIGNED/TRANSFERRED, ayrı bir tıkla | BoM, Satın Alma'da bir talebe dönüşür — **yalnız alış fiyatı** taşınır, satış fiyatı asla satınalmaya sızmaz |
| T5 | Satınalma PO_ISSUED (projeye bağlıysa) | Projenin maliyet kalemlerine otomatik işlenir (çift yönlü — Proje de Satınalma'ya talep açabilir) |
| T6 | Satınalma faturası girilir | Finans'ta PURCHASE tipi fatura otomatik (idempotent) oluşur |
| — | DMO sipariş teslim edilir | Finans'ta SALES faturası otomatik oluşur |

Her halka **idempotent**tir (aynı işlem iki kez tetiklense de kayıt
tekrarlanmaz) — bu, sistemin güvenilirliğinin temelidir.

### 2.2 Onay Swimlane'i
Kurumsal onaylar (Fırsat/Teklif: Finans→İGPD→Üst Yönetim→KSU; Sözleşme
imzası: KSU→Üst Yönetim) çok-aşamalı, sıralı bir zincirdir — bir aşama
onaylanmadan sıradaki aşama göremez. Üç önemli güvence:
- **Boş koltuk kilitlemez (orphan-skip):** bir aşamanın rolünde aktif
  kullanıcı yoksa, lisanslı bir sanal agent varsa o aşamayı onaylar, yoksa
  aşama otomatik "atlandı" işaretlenir — zincir asla sonsuza kadar bekleyen
  bir role takılıp kalmaz.
- **Vekalet:** bir yönetici izinliyse, kendi rolündeki onayları belirli
  tarihe kadar bir vekile devredebilir.
- **Görev Ayrılığı (SoD):** bir kaydı oluşturan kişi aynı kaydı onaylayamaz
  — hem CRM maliyet onayında hem onay zincirinde zorlanır.
- **Eşzamanlılık koruması:** iki yönetici aynı onayı aynı anda tıklarsa,
  sistem "optimistic locking" ile ikinciyi 409 hatasıyla reddeder —
  çift-onay riski yoktur.

### 2.3 RBAC — 20 Rol
`governance/role-matrix.ts` her rolün hangi modülü, hangi kararı, hangi
uç-noktayı kullanabileceğini tek bir yerde tanımlar; otomatik bir denetim
komutu bu matrisi gerçek kod ile karşılaştırıp sapmaları raporlar. İki
katmanlı: menü görünürlüğü (kullanıcı izni olmayan modülü hiç görmez) +
uç-nokta koruması (hassas işlemler ayrıca backend'de rol kilitli — ör.
faiz oranı, işletme maliyeti havuzu, tenant oluşturma yalnız Genel
Müdür'e açık).

### 2.4 Denetim İzi
Her oluşturma/güncelleme/silme ve durum geçişi, **kim yaptı** bilgisiyle
(insan kullanıcı mı, hangi sanal agent mı) kayda geçer — "bu kararı kim,
ne zaman verdi" sorusunun cevabı her zaman hazırdır, ayrıca bir Denetim
İzi ekranından filtrelenip görüntülenebilir.

### 2.5 Sanal Agentlar — 8 Adet
Boş kalan bir birim koltuğunu (o roldeki personel eksikse) deterministik
(yapay-zeka-sohbet-tabanlı değil, kural/formül-tabanlı) bir vekil doldurur.
Her agent bir lisans (Ed25519 imzalı, ayrı bir vendor aracıyla üretilen)
gerektirir ve iki moddan birinde çalışır — **Danışman** (öneri üretir,
insan onaylar) veya **Otonom** (geri-alınabilir/idempotent eylemi
doğrudan uygular):

| Agent | Birim/Rol | Ne yapar | İzinli mod |
|---|---|---|---|
| İhale Asistanı | İSAB | Checklist eksiksizliği + termin riski | Danışman + Otonom |
| Proje Asistanı | Proje | Eksik devir evrakı + geciken milestone tespiti | Danışman + Otonom |
| **Finans Asistanı** | Finans | Eşik-altı maliyet onayı/fatura taslağı önerir | **Yalnız Danışman** |
| **Hukuk Asistanı** | Hukuk | Sözleşme inceleme notu/görüş taslağı | **Yalnız Danışman** |
| CRM Asistanı | Satış | Fırsat triyajı + eksik alan/aşama önerisi | Danışman + Otonom |
| İş Geliştirme Asistanı | İGPD | Beklenen değer, değer kademesi, öncelik değerlendirmesi | Danışman + Otonom |
| Presales Asistanı | Presales | BoM eksiksizliği + maliyet analizi tutarlılığı | Danışman + Otonom |
| Satınalma Asistanı | Satınalma | Talep doğrulama + teklif-bazlı tedarikçi önerisi | Danışman + Otonom |

**Para (Finans) ve Hukuk agent'ları hiçbir yapılandırmada otonom karara
geçemez** — bu kısıtlama iki ayrı kilitle korunur (eklenti tanımındaki
izinli-mod listesi + çalışma-anı denetimi), yani API'den doğrudan
zorlansa bile aşılamaz.

### 2.6 Para Disiplini
Tüm parasal hesaplar kuruş-tabanlı yuvarlama ile çalışır; farklı para
birimleri **sessizce tek toplama çevrilmez** (döviz tutarları ayrı ayrı
gösterilir, karışık toplam yoktur). Ödeme anındaki gerçek kur ile
faturalama anındaki kur farklıysa, kur kazancı/zararı ayrıca hesaplanıp
kullanıcıya anında bildirilir.

### 2.7 Çok-Kiracılı İzolasyon + Ortak Doküman/Evrak Deseni
Her kayıt `tenantId` ile ayrışır; bir kiracının verisi bir diğerine hiçbir
koşulda sızmaz (otomatik izolasyon testleriyle her sürümde doğrulanır).
Ayrıca dört farklı modülde (İhale, Sözleşme, Proje Devir Paketi, ve
şirket-geneli doküman kodlama) **aynı** evrak-yönetim deseni tekrarlanır:
varsayılan zorunlu-evrak listesi ilk açılışta otomatik oluşur, her evrak
Yüklendi/Onaylandı/Muaf durumlarından birine geçer, dosyalar yerel diske
ve (yapılandırılmışsa) Nextcloud'a eşzamanlı yazılır, ve terminal aksiyon
(teklifi gönder / imzala / devri tamamla) tüm zorunlu evraklar
tamamlanmadan ya engellenir ya da açık bir uyarıyla onay ister. Bu, dört
ayrı sistem değil — uçtan uca tekrar kullanılan **tek bir "evrak kapısı"**
mekanizmasıdır.

---

## 3. Modül Modül — Ekranlar, Akışlar, Mantık

### 3.1 Dashboard — Herkes İçin Farklı Bir Ekran

Dashboard tek bir statik ekran değil; her rolün o gün gerçekten neyle
ilgilenmesi gerektiğine göre **kişiselleşen bir kokpit**tir. Giriş
yapıldığında sistem role göre önceden tanımlı bir widget seti yükler:
Genel Müdür KPI özeti + maliyet onayları + ihale vadeleri + teminat
süreleri + finansman açığı + geri çekilen ihaleler + devredilen BoM'ları
görür; bir Satış Temsilcisi yalnız kendi fırsatlarını ve görevlerini
görür; Satın Alma Müdürü yalnız bekleyen satınalma taleplerini ve
görevlerini görür. Rolü haritada tanımlı olmayan kullanıcılar varsayılan
olarak "görevlerim + fırsatlarım" görür. Her kart tıklanabilir ve ilgili
modüle doğrudan götürür — Dashboard yalnız bilgi vermez, aksiyona da
yönlendirir.

Yönetici rollerinde (Genel Müdür + tüm *_Müdür rolleri) kokpitin altında
ayrıca klasik bir blok var: 4 KPI kartı (Toplam Pipeline, Kazanılan
Değer, Aktif Projeler, Kaybedilen Değer), gelen birim raporları özeti,
Satış Boru Hattı grafiği ve son projeler listesi.

**Dikkat çeken mantık:** Kazanma oranı hesaplanırken "İştirak Edilmeyen"
(yönetimin bilinçli girmediği ihale) fırsatlar **hem payda hem paydan**
çıkarılır — yönetim kararı satış ekibinin istatistiğini olumsuz
etkilemez. Zaman-duyarlı uyarılar (ihale/teminat/milestone) aynı üç
renkli eşiğe göre boyanır: ≤2 gün kırmızı, ≤7 gün amber, ötesi nötr.

**Kimler kullanır:** Herkes — içerik role göre değişir.

---

### 3.2 Ziyaret Planı — Saha Emeğini Ölçülebilir Kılan Katman

CRM'den önce gelen bir modül: haftalık müşteri ziyaret planlaması +
günlük saha raporu. Kullanıcı haftalık bir plana ziyaretler ekler
(demo/teknik görüşme/sunum/diğer); ziyaret gerçekleştiğinde "Tamamlandı"
işaretlenir ve gerçekleşme tarihi damgalanır. Ayrı bir "Günlük Rapor"
ekranında saha notu girilir — bu not bir mevcut ziyarete, fırsata ya da
projeye bağlanabilir, ya da tamamen yeni bir temas ("Yeni İletişim")
olarak işaretlenip **sistemde henüz hiçbir yerde olmayan** bir potansiyel
müşteri olarak yakalanır.

Raporlar yöneticiye otomatik görünmez — temsilci belirli aralıkla
(varsayılan 7 gün) "Dönemi Yöneticiyle Paylaş" ile toplu paylaşır.

**Dikkat çeken mantık:** Yönetici ekranındaki "eşleşme oranı" —
performans ölçütü — bir ziyaretin yalnız "Tamamlandı" işaretlenmesiyle
değil, **o gün ayrıca bir günlük rapor da girilmiş olmasıyla** hesaplanır.
İki bağımsız girilen kaydın çapraz doğrulanması, saha faaliyetinin kendi
kendine rapor edilmesinin ötesinde gerçek bir hesap verebilirlik ölçütü
yaratır. Hedef eşleşme oranı (varsayılan %80) tenant-bazlı ayarlanabilir;
altında kalan personel panoda amber işaretlenir.

**Kimler kullanır:** Satış temsilcileri ve saha ekibi (raporlama/ayar
Satış Müdürü + Genel Müdür'e özel).

---

### 3.3 CRM & Müşteri — Ticari Çekirdek

CRM dört işlevi tek çatı altında toplar: müşteri kaydı, fırsat/pipeline
yönetimi, kur-riskine karşı korumalı maliyetlendirme, ve (yalnız Genel
Müdür'e özel) bir pazarlık simülatörü.

**Fırsatlar** kanban görünümünde ilerler (Yeni→İletişimde→Nitelikli→
Teklif→Pazarlık→Kazanıldı, ayrıca Kaybedildi). Bir fırsat kaybedilirken
sabit bir nedenler listesinden ("Fiyat rekabeti", "Bütçe iptal edildi",
"Rakip firma seçildi", "Teknik uygunsuzluk", "Zamanlama/termin",
"Müşteri vazgeçti", "Diğer") seçim **zorunludur** — bu neden hem fırsata
hem ileride kayıp-analizi raporlarına işlenir. Fırsat kazanılınca
kullanıcı otomatik olarak Sözleşme Yönetimi'ne yönlendirilir — akış
kesintisiz devam eder.

**Müşteriler** ekranında her hesabın kredi limiti tanımlanabilir.
**Somut bir risk-yakalama örneği:** bir teklif oluşturulurken, sistem o
müşterinin henüz kazanılmamış/kaybedilmemiş tüm açık fırsatlarının
toplam değerini kredi limitiyle karşılaştırır; limit aşılıyorsa hem
temsilciye anlık bir uyarı gösterilir hem de tüm Satış Müdürleri ve Genel
Müdür'e bildirim gider — daha önce hiçbir ekranda okunmayan kredi-limiti
alanı artık karar anında devreye giriyor.

**Maliyet Analizi (Fırsata özel bir alt ekran)** platformun en ince
finansal mantıklarından birini barındırır: **forward-kur (vadeli kur)
maliyetlendirme**. Kullanıcı bir satınalma usulü seçer (5 usul, her biri
kendi maliyet kalemi şablonunu otomatik ekler — açık ihale/pazarlık gibi
kamu usullerinde geçici teminat komisyonu, kesin teminat komisyonu,
sözleşme damga vergisi, ihale karar damga vergisi, KİK payı, ihale
dosyası bedeli, noter bedeli gibi kalemler otomatik satıra düşer),
tahsilat tarihini ve yıllık değer-kaybı yüzdesini girer. Sistem, spot
kuru bu vadeye göre **doğrusal olarak ileri taşıyarak** (`forward = spot
× (1 + yıllık_kayıp% × ay/12)`) teklif maliyetini hesaplar — yani teklif
verilirken kullanılan kur, paranın tahsil edileceği tarihe kadar
beklenen değer kaybını baştan fiyata yansıtır. Hedef marj girilince
teklif fiyatı ve gerçek marj (marj = kâr/satış fiyatı, maliyet üzerinden
değil) otomatik hesaplanır. **Marj tabanı güvencesi:** Genel Müdür
tenant-geneli bir marj tabanı (varsayılan %10) tanımlar; bir analiz bu
tabanın altında onaya gelirse onay ekranında kırmızı bir uyarı belirir ve
görev önceliği otomatik "Acil" olur. **Hesap, hem tarayıcıda canlı önizleme
için hem sunucuda kalıcı kayıt için ayrı ayrı çalışır — sunucu hesabı
her zaman esas alınır**, tarayıcı asla kendi hesabına güvenip
kaydetmez. BoM revize edilirse, daha önce onaylanmış/onay bekleyen bir
analiz otomatik olarak yeniden onaya düşer — güncel olmayan bir BoM
üzerinden teklif verilmesi engellenir.

**Canlı Pazarlıklar** — yalnız Genel Müdür'e açık bir eğitim/karar-destek
simülatörüdür (nav izninden daha sıkı, bileşen içinde ayrıca kilitli).
İki modu var: birebir pazarlık (müşteri karşı teklifi simüle edilir; taban
maliyetin altına inen bir teklif sistemde **sert biçimde engellenir**,
fiyat farkı %3'e indiğinde otomatik anlaşma sağlanır, 5 turda anlaşma
olmazsa süreç biter) ve açık eksiltme (birden çok simüle rakip, azalan
minimum kırım kuralıyla sıralı teklif turları).

**Kimler kullanır:** Satış ekibi ve yöneticileri; pazarlık simülatörü
yalnız Genel Müdür.

---

### 3.4 Presales & Dizayn — Belgeli En Uygun Tedarik

Presales'in işi, teknik şartnameyi fiyatlanabilir, kanıtlı bir malzeme
listesine (BoM) çevirmek — ticari fiyatlamadan **bilinçli olarak** ayrı
tutulur.

**Şartname Analizi:** şartname metni yapıştırılır/yüklenir; tenant'ın
yapılandırdığı yapay zekâ ile (yapılandırma yoksa deterministik bir
örnek sonuçla, sessizce ve açıkça — kullanıcı Ayarlar'a yönlendirilir)
ürün/miktar önerileri çıkarılır ve tek tıkla BoM'a aktarılır.

**Çoklu-tedarikçi teklif karşılaştırması:** her BoM satırı için birden
fazla tedarikçi teklifi girilebilir — fiyat + teknik uygunluk
(Uygun/Kısmen Uygun/Uygun Değil) + orijinal teklif dosyası (kanıt olarak
saklanır, Nextcloud'a da yansıtılabilir). Sistem uygun olanlar arasında
en ucuzu önerir, ama **"Uygun Değil" işaretli bir teklifin seçilmesi
sunucu tarafında kesin olarak reddedilir** — arayüzde gizlemekle
yetinilmez, API'den zorlansa bile geçmez. Bu, en ucuz ama teknik olarak
uygun olmayan bir bileşenin yanlışlıkla seçilmesini kesin olarak
engelleyen somut bir kontrol noktasıdır.

**Devir:** BoM Satışa devredildiğinde bir onay ya da fatura tetiklenmez —
Presales'in işi "teknik olarak doğru ve kaynaklı" ile biter, fiyatlama
Satış'ın işidir. Ancak her devir, değişmez bir anlık görüntü (item
listesi + değerlendirme detayı) olarak kaydedilir — bu, Dashboard'daki
"Devredilen BoM" widget'ını ve yönetici denetim ekranını besler. BoM her
revize edildiğinde devir sayacı artar ve eğer maliyet analizi zaten
onaylanmışsa otomatik olarak yeniden onaya düşürülür.

**Kimler kullanır:** Presales mühendisleri/müdürü, teknik uzmanlar.

---

### 3.5 Satış Destek / İhale (İSAB) — Diskalifiye Riskini Sıfırlayan Katman

Bu modül "katılalım mı, nasıl katılalım" kararının ve fiili ihale
dosyası hazırlığının yürütüldüğü yer — CRM/Presales'teki "kazanma
niyeti" ile Sözleşme arasında durur.

**Uygunluk Denetimi** ekranı operasyonel çekirdektir: şartname
yapıştırılır/PDF yüklenir → yapay zekâ analiz eder → gerekli evrak
listesi çıkar (idari şartname, teknik şartname, birim fiyat teklif
cetveli, geçici teminat mektubu, imza sirküleri, ticaret sicil gazetesi,
vergi/SGK borcu yoktur belgeleri gibi standart bir liste, yapay zekâ
yoksa bile otomatik oluşur) → sistem bu listeyi **Şirket Evrakları**
envanteriyle otomatik eşler: geçerlilik tarihi henüz dolmamış bir belge
varsa o kalem otomatik "Tamam" işaretlenir, dosyası önceden ekli gelir.
Kullanıcı yalnız eksikleri tamamlar. Bu eşleşme, kaç ihalede kaç evrağın
yeniden yüklenmesini gereksiz kıldığı olarak Yönetim Raporları'nda ayrıca
ölçülür.

**Teklifi gönderme koruması:** eksik zorunlu evrak varken "Teklif
İletildi"ye basılırsa sistem eksik listesini gösterip onay ister —
sessizce izin vermez. Zaman-duyarlı hatırlatmalar 72/48/12/6 saat
eşiklerinde otomatik gider (her eşik yalnız bir kez).

**Yönetimin "katılmama" kararı** (İştirak Etme) yalnız Genel Müdür
yetkisindedir, zorunlu bir gerekçe ister ve fırsatı **"Kaybedildi" değil
"İştirak Edilmedi"** olarak işaretler — hazırlığı yapan Satış Destek/
Presales ekibinin performans göstergesi bu karardan **olumsuz
etkilenmez**; sistem bunu ilgili herkese açıkça bildirir. Bu, teşvik
yapısını bozmayan bilinçli bir tasarım kararıdır.

**İhale WON → Sözleşme (T3):** durum "Kazanıldı"ya çevrildiği an, henüz
bağlı bir sözleşme kaydı yoksa, sistem Sözleşme Yönetimi'nde otomatik
bir DRAFT kayıt açar (isim, İKN, tahmini bedel otomatik taşınır).

**Kimler kullanır:** Satış Destek ve İSAB ekibi (geri çekilme kararı
Genel Müdür'e özel).

---

### 3.6 Sözleşme Yönetimi — İmza ile İş Başlangıcı Arasındaki Boşluğu Kapatan Modül

Beş sekmeli, durum-makinesi tabanlı bir akış: **Bağlam → Analiz → Evrak
Takibi → İmzalama → Proje Aktarımı**. Durum sırası: Taslak → Analiz
Tamamlandı → Hazırlık → İmzaya Hazır → İmza Onayında → İmzalandı →
Aktarıldı (her yerden İptal, yalnız İmzalandı'dan Fesih — kurallı, atlama
yok, yanlış bir geçiş denenirse reddedilir).

**Analiz** sekmesi, İhale modülüyle **aynı** yapay-zekâ servisini
kullanır (kod tekrarlanmaz) — ayrıca proje adı, İKN, sözleşme türü,
vergi yükümlülükleri, kritik terminler gibi bir "sözleşme özeti" çıkarır
ve bu özetten workflow başlığını otomatik günceller.

**Evrak Takibi → İmzaya Hazır otomatik geçişi:** tüm zorunlu evraklar
Yüklendi/Onaylandı/Muaf durumuna geldiği an, kullanıcı hiçbir düğmeye
basmadan durum otomatik "İmzaya Hazır"a geçer ve ekran İmzalama sekmesine
yönlenir.

**İmza onayı:** "Birim Yöneticisinin Onayına Gönder" ile resmî iki
aşamalı bir onay zinciri açılır — **KSU → Genel Müdür**. Onaylandığında
tek bir tıkla hem imza tamamlanır hem proje aktarımı tetiklenir.

**Proje Aktarımı — iki bağımsız devir:**
1. **Sözleşme → Proje (T4):** imzalı sözleşmeden proje tipine göre
   milestone şablonu otomatik oluşur; yapay-zekâ analizinden çıkan
   görevler doğrudan ilgili birime atanmış görevlere dönüşür.
2. **Sözleşme → Satınalma (T4b, ayrı bir tıkla):** BoM'daki kalemler bir
   satınalma talebine dönüşür — **kritik bir tasarım kararı olarak yalnız
   alış fiyatı taşınır, satış fiyatı Satınalma'ya asla sızmaz** (kodda
   açıkça yorumlanmış bir kural).

**Kimler kullanır:** Bütün rota, yedi yönetici rolüne (Genel Müdür, KSU,
Satış Müdürü, Proje Müdürü, Hukuk Müdürü, Finans Müdürü, İGPD) açık;
imza onayı ve iptal/fesih ayrıca role-kilitlidir.

---

### 3.7 Proje Yönetimi — Gerçek (Tam-Yüklü) Marj

İmzalı bir sözleşme otomatik olarak buraya bir proje + tipine göre
standart milestone şablonuyla düşer:

| Tip | Aşamalar (özet) |
|---|---|
| Donanım | Planlama → Satınalma → Sevkiyat → Kurulum → **Test & Kabul (onaylı)** → Garanti → Faturalandırma → Tahsilat |
| Yazılım | Planlama&Analiz → Geliştirme → Test → **Kabul&Geçiş (onaylı)** → Garanti → Faturalandırma → Tahsilat |
| Hizmet | Planlama → Hizmet Sözleşmesi → Hizmet Teslimi → **Kabul (onaylı)** → Garanti → Faturalandırma → Tahsilat |
| Karma | Planlama → Satınalma+Geliştirme (paralel) → Kurulum&Entegrasyon → **Test&Kabul (onaylı)** → Garanti → Faturalandırma → Tahsilat |

Dört şablon de aynı üç adımla biter (Garanti/Faturalandırma/Tahsilat) ve
her birinde tam olarak bir "Kabul" aşaması yönetici onayı ister — bilinçli
bir tutarlılık.

**Kârlılık — iki katmanlı gerçek:** ekran hem **katkı marjı** (yalnız
direkt maliyet) hem **tam-yüklü net marj**'ı (+ işletme maliyeti) yan
yana gösterir. İşletme maliyeti iki katmanda projeye yansır: (1) şirket
genel giderinin bir yüzdesi, (2) projeye iştirak eden her birimin dönem
maliyetinin bir katsayı ile ağırlıklandırılmış payı. **Bu overhead'in
raporlanan marja girip girmeyeceği yönetimin bilinçli tercihidir** — proje
bazlı bir anahtarla açılır, varsayılan kapalıdır; kapalıyken direkt marj
değişmez. Ayrı bir "Birim Bütçe Absorpsiyonu" raporu, her birimin
bütçesinin projelere ne kadar dağıtıldığını gösterir — hem atıl kapasiteyi
(şirketin cebinden çıkan, hiçbir projeye yansımayan maliyet) hem
aşırı-tahsisi (bir birimin kapasitesinin projeler arası toplamda %100'ü
aşacak şekilde vaat edilmesi) yakalar.

**Proje Sağlık Skoru** (yalnız aktif projeler): %40 marj + %35 takvim
(gecikmiş milestone oranı, projenin kendi son tarihi geçtiyse tavan 40
ile sınırlanır) + %25 bütçe ağırlıklı bileşik skor — 40 altı Kritik, 70
altı İzlemede, üstü Sağlıklı; en riskliden başlayarak sıralanır. Tek bir
sayı, portföydeki hangi projenin dikkat istediğini anında gösterir.

**Devir Paketi — 11 zorunlu evrak:** onaylı fizibiliteden proje devir
formuna kadar sabit bir liste ilk açılışta otomatik oluşur; başlıkta
kalıcı bir "Devir Bekliyor" rozeti tüm evraklar tamamlanana kadar görünür
kalır.

**Kimler kullanır:** Proje ekibi; overhead-uygulama kararı ve birim-iştirak
düzenlemesi yalnız Genel Müdür/Finans Müdürü'ne açık.

---

### 3.8 Satın Alma — Bilerek Pazarlık

9 statülü, sıkı sıralı bir onay akışı: Taslak → Birim Onayında → Satın
Alma Onayında → Genel Müdür Onayında → Sipariş Verildi → Teslimatta →
Faturalandı → Kapandı (her onay aşamasından Reddedildi'ye dallanabilir).
Her aşamanın onaycısı role-kilitlidir (Birim: Satış Müdürü/GM; Satın
Alma: Satın Alma Müdürü/GM; son aşama: yalnız GM). Sipariş verilince
sıralı bir PO numarası otomatik üretilir.

**Referans fiyat görünürlüğü:** Sözleşme'den (BoM üzerinden) gelen her
kalemde üretici/distribütör referans alış fiyatı ve kaynağı açıkça
gösterilir — satın alma uzmanı piyasa fiyatını bilerek pazarlık eder,
körlemesine değil.

**Kısmi teslimat mantığı:** durum "Faturalandı"ya yalnız **tüm
teslimatların birikimli miktarı** sipariş miktarına ulaştığında geçer —
tek bir kısmi teslimat kaydı tek başına siparişi kapatmaz. Hasarlı mal
işaretlenmesi teslimat ilerlemesini durdurmaz ama otomatik olarak Satın
Alma birimine acil bir görev açar.

**Reddedilen talep → yeniden gönderim:** reddedilen bir talep **yeni bir
kayıt açmadan** düzeltilip yeniden gönderilebilir — durum Taslak'a döner,
üç onay damgası temizlenir, ama kayıt kimliği ve tüm denetim izi
korunur; kaç kez düzeltildiği ayrıca sayılır.

**Tedarikçi teklif skorlaması** (sanal agent danışmanlığı katmanında):
fiyat %60 + puan %25 + teslim süresi %15 ağırlıklı bir formülle
çalışır — ama fiyat skoru **min-max değil oran-bazlı** normalize edilir
(`min(en_düşük_fiyat/bu_fiyat, 1)`), çünkü min-max en ucuzu her zaman tam
puana, en pahalıyı sıfıra iter ve gerçek fiyat farkı küçükse bile teslim
süresi/kalite farkını boğar; oran-bazlı yöntemde %2 daha pahalı bir
teklif yalnız ~0.02 puan kaybeder. Bu incelik, "gerçekten en iyi" teklifin
sadece "en ucuz" teklifle karıştırılmamasını sağlar.

**PO→Proje (T5, çift yönlü)** ve **Fatura→Finans (T6)** halkaları
paylaşılan altyapı bölümünde (§2.1) anlatıldı.

**Kimler kullanır:** Satın Alma ekibi; onay aşamaları role-kilitli.

---

### 3.9 Garanti & Servis — Teslim Sonrası Kapanmayan Tek Nokta

Teslim edilmiş bir projeye bağlı arıza bildirimi, yedek parça talebi ve
bakım talebi tek bir listede yaşar (Kategori: Arıza/Yedek Parça/Bakım/
Diğer; Öncelik: Düşük/Normal/Yüksek/Acil). Durum akışı: Açık → İşlemde →
Parça Bekliyor → Çözüldü → Kapandı. Her talep bir SLA süresi (saat
cinsinden) alır; süresi geçen ve hâlâ açık olan bir talep — atanan kişiye,
yoksa projenin proje yöneticisine, o da yoksa Genel Müdür'e — otomatik
bir kez bildirimle yükseltilir (aynı talep ikinci kez bildirim
üretmez).

**Kimler kullanır:** Genel Müdür, Proje Müdürü, Operasyon Müdürü.
**Bağlantı:** her talep zorunlu olarak bir Projeye bağlıdır — Proje
Yönetimi'nin doğal bir uzantısıdır.

---

### 3.10 Finans — Zamanın, Kurun ve Maliyetin Zekâsı

Yedi sekme: **Faturalar, Tahsilat, Teminat Mektupları, Maliyet Onayı,
Vade & Finansman, İşletme Maliyeti, Özet.**

**Tahsilat mantığı:** her fatura kısmi ödeme kabul eder; kalan bakiyeyi
%0,01'den fazla aşan bir tahsilat sistem tarafından **reddedilir**,
yalnız kullanıcı açıkça "fazla ödemeyi kabul et" derse kaydedilir — bu
durumda otomatik bir not eklenir ve tüm Finans Müdürleri "alacak/iade
takibi" için uyarılır.

**Kur farkı (FX) motoru:** döviz cinsinden bir faturanın kesim anındaki
kur ile tahsilat anındaki gerçek kur farklıysa, fark otomatik hesaplanıp
("kur kazancı" ya da "kur zararı" olarak) kullanıcıya anında gösterilir
ve ayrı bir kayıtla saklanır — hiçbir kur farkı sessizce kaybolmaz.

**Teminat mektubu hatırlatması:** süresi 30/15/7 gün kala (her eşik
bağımsız olarak yalnız bir kez) ilgili talep sahibine ve tüm Finans
Müdürlerine bildirim gider; süresiz mektuplar bu hatırlatmanın dışında
tutulur.

**Vade & Finansman:** bir fırsata bağlı taksitli tahsilat planı +
kalem-bazlı ödeme vadeleri girilir; sistem döviz-bazlı finansman
maliyeti/getirisini (taksit + banka faizi etkisi) hesaplar ve bir
nakit-akış-açığı uyarısı üretir. Faiz oranları tenant-ayarlanabilir
(varsayılan TRY %50, USD %10, EUR %8 — yüksek enflasyon ortamını
yansıtır). **Negatif net etki** (finansman maliyeti) tek tıkla Maliyet
Analizi'ne otomatik bir gider kalemi olarak eklenebilir; **pozitif etki
(getiri) bilinçli olarak otomatik kâr yazılmaz** — ekranda açıkça
"yönetim kararıdır" notuyla bırakılır. Bu işlem idempotenttir: yeniden
uygulanırsa önceki otomatik kalemler silinip güncel hesapla değiştirilir,
çift kayıt oluşmaz.

**İşletme Maliyeti (Overhead) havuzu:** dönemsel personel+opex havuzunun
tanımlandığı yer — Proje Yönetimi'ndeki tam-yüklü marj hesabının
girdisidir (bkz. §3.7). Düzenleme yalnız Genel Müdür/Finans Müdürü'ne
açık.

**Alacak Yaşlandırma & DSO:** açık satış faturaları vadeye göre 5
kovaya (vadesi gelmemiş / 0-30 / 31-60 / 61-90 / 90+ gün) ayrılır, hem
toplu hem para-birimi bazında; DSO (ortalama tahsilat süresi) tek bir
sayı olarak Özet ekranında görünür.

**Kimler kullanır:** Finans Müdürü + Genel Müdür (faiz oranı ve overhead
havuzu düzenlemesi ikisine kilitli).

---

### 3.11 DMO Kataloğu — Kârsız Satışı Kabul Etmeden Yakalayan Motor

Devlet Malzeme Ofisi kanalı üzerinden yapılan satışları yöneten, **ana
CRM→Sözleşme hattından bağımsız, ayrı lisanslı** paralel bir kanal. Beş
sekme: Siparişler, Katalog, Çerçeve Anlaşmalar, Döviz Kurları, Risturn
Mutabakatı.

**Neden ayrı bir motor gerekiyor:** DMO'ya satış fiyatı DMO'nun **kendi**
kuruyla, alış maliyeti ise **piyasa** kuruyla çevrilir — iki farklı,
birbirinden bağımsız kaynaktan gelen kur, aradan geçen zamanda ayrı ayrı
kayabilir ve brüt kârlı görünen bir satış sessizce zarara dönüşebilir.
Bir çerçeve anlaşmaya bağlı sipariş oluşturulduğunda **satış fiyatı ve
para birimi kilitlenir** (anlaşmadan gelir, değiştirilemez) ama **alış
maliyeti düzenlenebilir kalır** (gerçekten değişken olduğu için).

**Net kârlılık formülü:** ciro = miktar×satış fiyatı×DMO'nun satış kuru;
maliyet = miktar×alış maliyeti×piyasa kuru; brüt kâr = ciro−maliyet;
risturn oranı, **bu siparişi de dahil eden yıl-içi kümülatif ciroya**
göre kademeli bir tablodan okunur (yani marjinal risturn oranı, kümülatif
ciro bir eşiği geçtikçe sıçrayabilir); risturn kesintisi = ciro×oran;
komisyon (yüzde ya da sabit, cirodan ya da kârdan) düşülür; net kâr =
brüt kâr − risturn − komisyon. **Net kâr negatifse veya net marj
tenant-tanımlı eşiğin (varsayılan %5) altındaysa alarm üretilir** — ayrıca
DMO kurunun veya piyasa kurunun 7 günden eski (bayat) olması da
simetrik olarak ayrı bir alarm üretir.

**Sert onay kapısı:** sipariş "Onaylandı"ya ilerletilmek istendiğinde
kârsız çıkıyorsa, geçiş **engellenir** — yalnız uyarı verilmez, gerçekten
bloke edilir — ve otomatik olarak Genel Müdür onayına düşen bir onay
zinciri açılır (aynı "Bekleyen Onaylarım" ekranında görünür); yalnız
onaylandıktan sonra durum ilerleyebilir. Sipariş her durum değişikliğinde
**o anki güncel** kur/parametrelerle yeniden hesaplanır — geçmiş bir
siparişin kârlılığı sipariş anında donmuş kalmaz.

**Çerçeve anlaşma kotası** siparişin ilk onaylanmasında otomatik düşer;
sipariş sonradan iptal/reddedilirse kota simetrik olarak geri iade
edilir — iptal edilen siparişlerin kotayı kalıcı olarak "yemesi" önlenir.

**Teslim edilen sipariş** otomatik olarak Finans'ta bir SALES faturası
oluşturur (idempotent).

**Kimler kullanır:** Genel Müdür + Satış Müdürü (düzenleme); maliyet
parametreleri (risturn tablosu, marj eşiği, komisyon, piyasa kuru) yalnız
Genel Müdür + Finans Müdürü'ne açık. Ayrı bir modül lisansı gerektirir.

---

### 3.12 Görevler & Takip — Hiçbir İşin Düşmediği Yer

İki farklı şey aynı ekranda birleşir: (1) genel amaçlı, birime/kişiye
atanabilir görev havuzu, (2) ayrı, çok-aşamalı kurumsal **onay
swimlane'i** ("Bekleyen Onaylarım").

**Görev havuzu:** yeni görev açarken ilgili modül seçilirse (Fırsat/
Proje/Sözleşme/Satınalma/Hukuk) sabit bir "işlevsel görev kataloğundan"
seçim zorunludur (ör. Fırsat için: BoM hazırla / Maliyet analizi yap /
Şartname analizi yap / Teklif hazırla / Pazarlık yürüt) — görev başlığı
serbest yazılmaz, otomatik oluşur; genel görevlerde başlık serbesttir.
Termin ya doğrudan girilir ya da iş-günü SLA'sından (hafta sonu ve
tanımlıysa resmî tatiller hariç tutularak) otomatik hesaplanır. Bir
kullanıcı yalnız kendine atanan, kendi açtığı, ya da kendi biriminin
sahipsiz görevlerini görür — Genel Müdür hepsini görür.

**SLA eskalasyonu:** termini geçmiş ve hâlâ açık bir görev, biriminin
üst-birim yöneticisine (yoksa Genel Müdür'e) bir kez bildirimle
yükseltilir.

**Bekleyen Onaylarım — onay zinciri ekranı:** kullanıcının sırası gelen
onay aşamaları burada listelenir; her kart zincirin tüm rol sırasını
(ör. "Finans → İGPD → Üst Yönetim → KSU") ve önceki bir aşama bir sanal
agent tarafından otomatik onaylandıysa bunu gösteren bir rozet içerir.
Bu ekran; Fırsat/Teklif onayları, Sözleşme imza onayı **ve** DMO'nun
kârsız-sipariş veto mekanizması için **aynı** altyapıyı kullanır — tek
bir onay motoru, birden fazla modülden beslenir.

**Kimler kullanır:** görev havuzu neredeyse tüm rollere açık (herkes
birine görev atayabildiği için herkesin kendi gelen kutusunu görmesi
gerekir); onay swimlane'i yalnız zincirdeki dört role (Finans/İGPD/Üst
Yönetim/KSU) gerçek işlem sunar.

---

### 3.13 Yönetim Raporları — Platformun Görünürlük Katmanı

Beş sekme: **Genel Bakış, Büyüme Analitiği, Birim Detayı, Raporlarım,
Gelen Raporlar.**

**Genel Bakış + Birim Detayı**, 7 birimin (CRM, Presales, Satınalma,
Finans, Hukuk, İhale/İSAB, Proje) dönemsel operasyonel metriklerini
gösterir — dönem-öncesi ile karşılaştırmalı (▲/▼) — ve bir iş-akışı
darboğaz panelini içerir: onay zincirlerindeki ilk "sırası gelmiş"
aşamayı role göre tarayıp en uzun bekleyen rolü işaret eder.

**Raporlarım / Gelen Raporlar — biçimsel raporlama akışı:** birim
yöneticisi bir dönem raporu açar; form, o anki gerçek metrikleri **ve**
biriminin saha (ziyaret/günlük rapor) verisinin bir konsolidasyonunu
canlı önizler. "Sun" dendiğinde bu iki veri seti **o andaki hâliyle
donmuş bir anlık görüntü** olarak rapora yazılır (sonradan değişen canlı
veriden etkilenmez) ve rapor otomatik olarak üst-birim yöneticisine
(Genel Müdür her zaman tümünü görür) yönlenir. Yönetici onaylar ya da
notla iade eder; yalnız Taslak/İade edilmiş raporlar yeniden
düzenlenebilir. Her rapor tek başına ya da birleştirilmiş biçimde
yazdırılabilir.

**Büyüme Analitiği — 12 rapor, tamamı salt-okunur ve deterministik:**

| # | Rapor | Ne ölçer | Neden önemli |
|---|---|---|---|
| 1 | Dönüşüm Hunisi | Aşamadan aşamaya dönüşüm % + kayıp nedeni dağılımı | Fırsatlar tam olarak nerede ölüyor? |
| 2 | İhale Kazanma Kırılımı | İdare/yöntem bazında kazanma oranı, ortalama teklif | Hangi idare/usul gerçekten kazanılabiliyor? |
| 3 | BoM Maliyet Varyansı | Teklif anındaki BoM maliyeti vs. gerçekleşen proje maliyeti | Teklifi tutturduk mu, marj nerede eridi? |
| 4 | Ağırlıklı Tahmin & Hedef Kapsama | Açık pipeline × olasılık toplamı vs. GM'in koyduğu satış hedefi | Hedefi tutar mıyız? |
| 5 | Bid/No-Bid Skorkartı | İdare geçmişi + kalan süre + evrak hazırlığı + değer uyumu + İGPD triyajı → 0-100 puan | Bu ihaleye girmeli miyiz? (deterministik, kara kutu değil) |
| 6 | Belge Portföyü | Şirket Evrakları'nın kaç ihale evrakını otomatik karşıladığı, süresi dolan/dolacak belge sayısı | Evrak kütüphanesinin somut ROI'si |
| 7 | Müşteri & Kamu Konsantrasyonu | HHI endeksi + ilk-3 müşteri payı + kamu payı | Tek müşteriye/segmente ne kadar bağımlıyız? |
| 8 | Kurumsal Kompozit Sağlık Skoru | Satış%25+İhale%20+Finans%25+Müşteri%15+Uyum%15 tek skor | Yönetim kurulunun bakacağı ilk sayı |
| 9 | Proje Sağlık Skoru | Marj%40+Takvim%35+Bütçe%25, proje bazında | Hangi proje riskte, tek tek açmadan? |
| 10 | Müşteri Sağlık Skoru | Ödeme%35+Kazanma%30+Aktiflik%20+Sadakat%15 | Hangi kilit müşteri sessizce uzaklaşıyor? |
| 11 | DMO Kanalı Analitiği | Sipariş durumu dağılımı, net kâr/marj, kârsız sipariş sayısı | (Yalnız lisanslıysa) ince marjlı kanalın sağlığı |
| 12 | Birim Bütçe Absorpsiyonu | Bütçe vs. projelere dağıtılan pay, atıl/aşırı-tahsis | Overhead nerede boşa gidiyor, nerede fazla vaat ediliyor? |

Her skor kompozit ise **alt bileşenleri de gösterilir** — "kara kutu"
değil, her rakamın nasıl hesaplandığı izlenebilir. Kazanılmayan/geri
çekilen (İştirak Edilmeyen) kayıtlar tüm oranlarda tutarlı biçimde
paydadan hariç tutulur (§3.5'teki KPI-nötr kural buraya kadar uzanır).

**Kimler kullanır:** Genel Müdür (tam görünürlük) + ilgili birim
yöneticileri (kendi birimleri + kendilerine yönlenen raporlar).

---

### 3.14 Genel Hususlar — Kurumsal Hafıza

Dört sekme, ortak bir kayıt-oluşturma deseniyle: **Alınan Dersler**
(kategori/etki + isteğe bağlı proje bağlantısı), **Risk & Fırsat**
(olasılık×etki = skor, 1-25 arası, 5×5 matriste renk kodlu — 15+ kırmızı,
8+ amber), **Kurumsal KPI** (dönem bazlı hedef/gerçekleşen, tenant içinde
isim+dönem tekil), **Dış Doküman Sicili** (dışarıdan gelen standart/
mevzuat takibi).

Her kayıt, isteğe bağlı olarak platformun ortak **doküman kodlama**
motorundan (§2.7'nin numaralandırma kısmı) sıralı bir belge numarası
alabilir — şirket kodu + kategori kodu + (isteğe bağlı yıl) + sıra
numarası, tamamen tenant-yapılandırılabilir; hiçbir üçüncü-taraf
notasyonu varsayılan olarak gelmez, her tenant kendi notasyonunu
tanımlar.

**Kimler kullanır:** Kalite ve yönetim ekibi (Genel Müdür varsayılan
erişimli).

---

### 3.15 Şirket Evrakları — Görünmeyen Otomasyonun Kaynağı

Basit bir envanter gibi görünür (isim, kategori — Hukuki/ISO/Sertifika/
İş Deneyimi —, geçerlilik tarihi, etiketler) ama platformun en yüklü
"görünmez otomasyon" noktalarından biridir: bir ihale şartnamesi analiz
edildiğinde, çıkan her gerekli-evrak kalemi burada bulanık isim
eşleştirmesiyle (alt-metin ya da en az 2 ortak anlamlı kelime + hâlâ
geçerli olma şartı) taranır; eşleşen ve süresi geçmemiş her belge
otomatik "Tamam" işaretlenir, dosyası önceden ekli gelir. Bu eşleşmenin
kaç kez, kaç ihalede tekrar kullanıldığı Yönetim Raporları'ndaki Belge
Portföyü kartında ölçülür — yani kütüphanenin somut değeri sayıyla
görünür.

**Kimler kullanır:** İdari ekip + evrağı üreten/tüketen tüm birimler.

---

### 3.16 Fiziksel Arşiv — Denetime Hazır Gerekçe Kayıtları

Kutu/raf bazlı fiziksel arşiv takibi görünse de, iki iş olayı için
**otomatik ve değişmez** bir dijital kayıt üretir:

1. Bir fırsat **Kaybedildi** durumuna geçtiği an — yalnız o geçişte, bir
   kez — başlık/müşteri/değer/kayıp nedenini özetleyen bir arşiv kaydı
   otomatik oluşur. "Neden kaybettik" sorusunun cevabı kalıcı olarak
   saklanır.
2. Bir BoM, tedarikçi teklifleriyle birlikte Satışa devredildiğinde,
   tüm tekliflerin (seçilen + alternatifler, fiyat + teknik uygunluk)
   değişmez bir anlık görüntüsü hem fırsata hem arşive yazılır — "neden
   bu tedarikçi, o rakiplerine karşı" sorusunun zaman damgalı, itiraza
   kapalı kanıtı oluşur.

**Dikkat çeken erişim kararı:** bu modül nav düzeyinde geniş bir izinle
görünse de, **sunucu tarafında tüm uç noktalar yalnız Genel Müdür'e
kilitlidir** — fiziksel/hukuki kayıt gözetimi bilinçli olarak tek elde
toplanmış.

**Kimler kullanır:** Fiilen yalnız Genel Müdür (idari ekip nav'da
görünse de yazma/okuma sunucuda GM'e kilitli).

---

### 3.17 Yedekleme — Veri Güvencesi

Üç sekme: **Yedekler, Geri Yükle, Zamanlama.** Hedef: yerel disk,
Nextcloud, veya S3; kapsam tüm platform ya da yalnız bu tenant; tür tam,
durum-dosyası, ya da yalnız veri.

**Doğrulama** iki farklı yöntemle çalışır: veri yedekleri için
checksum + JSON bütünlüğü + model bazında satır-sayısı karşılaştırması;
durum-dosyası (SQLite) yedekleri için ayrı bir bağlantı üzerinden
bütünlük kontrolü.

**Geri yükleme asla kör değildir:** önce bir **fark analizi** çalışır —
her veri modelinde eklenen/silinen/değişen kayıt sayısı hesaplanır,
yedek alındığından beri şemaya eklenmiş modeller açıkça "bunlara
dokunulmayacak" diye işaretlenir; kullanıcı bu raporu görüp onayladıktan
sonra geri yükleme başlar. Mantıksal geri yüklemeden **hemen önce**,
sistem otomatik olarak ayrı bir güvenlik yedeği alır — bu adım
başarısız olursa geri yükleme hiç başlamaz.

**Zamanlama** sunucu-içi bir döngüyle çalışır (ayrı bir cron sunucusu
gerekmez), tenant başına ayarlanabilir eşik saatte bir tetiklenir.

**Dikkat çeken rol tasarımı:** özel bir "Yedek Yöneticisi" rolü
platformun **her yerinde salt-okunur**dur (herhangi bir modülde veri
değiştiremez) — **yalnız** Yedekleme/Geri Yükleme uç noktalarında yazma
yetkisi vardır. Bu kısıtlama tüm platformu kapsayan ortak bir güvenlik
katmanında (her isteğin önünden geçen) uygulanır, tek tek ekranlarda
değil — yani bu rolün bir yerden veri değiştirmesi mimari olarak mümkün
değildir, unutulmuş bir ekran riski yoktur.

**Kimler kullanır:** Yedek Yöneticisi + Genel Müdür.

---

### 3.18 Şirket Ayarları — Koddan Değil Ekrandan Yönetim

Dokuz alt-sekme: Şirket Profili, Birimler, Kullanıcılar, İş Akışı,
Yetkiler, Entegrasyonlar, Abonelik & Kullanım, Lisans Planları, Modüller.

**Şirket Profili** aynı zamanda iki başka önemli yapılandırmayı da
barındırır: yedekleme zamanlaması (Yedekleme modülüyle aynı API'yi
paylaşır) ve **doküman kodlama notasyonu** — şirket kodu, ayraç, sıra
numarası basamak sayısı, yıl dahil edilsin mi — platformun her yerinde
(Genel Hususlar, Yönetim Raporları'ndaki raporlar, vb.) kullanılan tek
numaralandırma motoru.

**Kullanıcılar** ekranında rol ataması + **vekalet ataması** yapılır
(bir kullanıcıya, belirli bir tarihe kadar, kendi onaylarını devredecek
bir vekil atanır) — Görevler modülündeki onay-vekaleti mekanizmasının
yönetim arayüzü tam olarak burasıdır.

**Entegrasyonlar — YZ sağlayıcısı, sağlayıcıdan bağımsız:** tenant kendi
API adresini, model adını ve anahtarını girer — herhangi bir OpenAI-
uyumlu sağlayıcı çalışır, hiçbir tek YZ firmasına kilitlenme yoktur.
Anahtar **yazma-amaçlı**dır: bir kez girildikten sonra ekranda asla
tekrar gösterilmez, yalnız "kayıtlı" işareti görünür. Ayrıca Nextcloud/
e-posta (Exchange)/WhatsApp bağlantı sihirbazı burada.

**Modüller (yalnız Genel Müdür):** hangi "test" modüllerinin tüm
kullanıcılara açılacağını kontrol eder; platformun çekirdek modülleri
ayrıca burada kalıcı/kilitli olarak listelenir — şeffaflık için.

**Sanal Agent lisanslama:** lisanslar artık bu uygulama içinde
üretilmez — ayrı bir vendor aracı özel bir imza anahtarıyla üretir, bu
uygulama yalnız **doğrular** ve aktive eder. Bir lisans token'ı aktive
edildiğinde ilgili tüm agent'lar için bir yetki kaydı (durum: Aktif,
mod: agent'ın varsayılan modu) otomatik oluşur. Mod değişiklikleri
sunucu tarafında agent'ın **izinli-mod listesine karşı** doğrulanır —
yani bir Finans ya da Hukuk agent'ını doğrudan API çağrısıyla bile
Otonom moda geçirmek yapısal olarak mümkün değildir; kısıtlama arayüzde
değil, agent tanımının kendisinde kilitlidir.

**Kimler kullanır:** Sistem yöneticisi rolü + Genel Müdür; en hassas
işlemler (tenant oluşturma/abonelik, YZ anahtarı, yönetişim ayarları,
kullanıcı oluşturma/silme, birim bütçesi) yalnız Genel Müdür'e
kilitlidir — Sistem Yöneticisi rolü bile bunları yapamaz.

---

### 3.19 Yardım — Uygulama İçi, Bağlamsal Kılavuz

*(2026-08-03 eklendi.)* Header'daki Yardım ikonuyla açılır; kullanıcı o
an hangi ekrandaysa doğrudan o modülün "ne işe yarar / nasıl kullanılır"
makalesiyle karşılaşır, arama kutusuyla başka bir konuyu da bulabilir.
Rol-duyarlıdır — kullanıcı yalnız kendi sidebar'ında gördüğü modüllerin
kılavuzunu görür, ne fazlası ne eksiği. Sayfa üstünde, yazılımı hiç
tanımayan biri için ayrı bir **Wiki** sayfasına (uçtan uca akışı anlatan
dışa açık statik kılavuz) link verir — iki katman birbirini tekrar
etmez: Wiki dışa dönük genel tanıtım, Yardım içe dönük ekran kılavuzu.

**Kimler kullanır:** Herkes.

---

## 4. Bütünsel Sentez — Neden "19 Ayrı Ekran" Değil, "Tek Bir Platform"

Yukarıdaki 19 bölümü tek tek okumak bile aslında platformun ne olduğunu
tam anlatmaz — asıl gösterge, **bir tek işin** bu modüllerin arasından
nasıl kesintisiz aktığıdır. Somut bir örnek üzerinden özetleyelim:

Bir saha ziyareti sırasında yeni bir temas günlük rapora düşer (§3.2).
CRM'de fırsata dönüşür; kredi limiti kontrolü arka planda sessizce
çalışır (§3.3). Presales, teknik olarak uygun **ve** kanıtlı bir BoM
hazırlar — en ucuz ama uygunsuz bir tedarikçi seçimi sunucu tarafında
zaten imkânsızdır (§3.4). Satış, forward-kur ile korunmuş bir teklif
üretir; marj tabanının altına düşerse onay ekranı bunu kırmızı ile
işaretler (§3.3). Kamu işiyse, şartname otomatik analiz edilir, gerekli
evrakın çoğu Şirket Evrakları'ndan **kendiliğinden** eşlenir (§3.5,
§3.15). İhale kazanılınca sözleşme kendiliğinden açılır (§3.5→§3.6);
imza onaylanınca hem proje hem satınalma talebi **aynı anda, elle veri
taşınmadan** doğar — ve satınalmaya yalnız alış fiyatı geçer, satış
fiyatı hiçbir zaman sızmaz (§3.6). Proje ilerlerken gerçek maliyet
Satınalma'dan otomatik işlenir (§3.7↔§3.8); teslim sonrası bir arıza
bildirimi gelirse süresi geçmeden önce otomatik eskale edilir (§3.9).
Her fatura, her kur farkı, her teminat süresi Finans'ta izlenir (§3.10);
paralel bir DMO satışı varsa, aynı işin kârlı mı zararlı mı olduğu kabul
edilmeden önce görülür (§3.11). Bu zincirin her adımı Görevler'de bir
görev, bir onay ya da bir bildirim üretir (§3.12); hepsi Yönetim
Raporları'nda tek bir sağlık skoruna, tek bir darboğaz paneline döner
(§3.13). Ve zincirin her halkasında **kim neyi yaptı** Denetim İzi'nde
kalıcıdır (§2.4).

İşte bu yüzden 19 modül "19 ayrı özellik" değil: her biri aynı işin farklı
bir anındaki durağıdır, ve aralarındaki **otomatik geçişler, ortak onay
motoru, ortak RBAC, ortak denetim izi ve ortak para disiplini** —
tek başına hiçbirinin sahip olmadığı bir şeyi, bütünün kendisini,
üretir: satılan hiçbir işin kâr mı zarar mı ettiğini bilmeden ilerlemediği,
hiçbir onayın sahipsiz kalmadığı, hiçbir kararın izsiz geçmediği bir
karar sistemi.

---

## 5. Ölçek — Bugünün Rakamları (2026-08-03)

| Gösterge | Sayı |
|---|---|
| Veri modeli (Prisma) | 67 |
| Ekran modülü (19 üst-seviye + alt-sekmeler) | 33 dosya |
| API alanı (`/api/*`) | 38 |
| Backend servisi | 35 |
| Sanal agent | 8 (Finans + Hukuk daima danışman) |
| Rol | 20 |
| Büyüme Analitiği raporu | 12 + 3 seviyeli sağlık skoru |
| Otomatik geçiş halkası | 6 (T1, T3, T4, T4b, T5, T6) |

*(Kaynak: bu döküman, her modülün 2026-08-03 tarihli güncel kodunun
doğrudan okunmasıyla üretildi — `walkthrough.md §27` ve `CLAUDE.md` ile
tutarlıdır ama onlardan kopyalanmadı.)*

---

## 6. Ölçülebilir Fayda (ROI Dili)

| Alan | Fayda | Hangi mekanizmadan gelir |
|---|---|---|
| Kâr koruması | Zarar eden/erozyona uğrayan işin kabul edilmeden önlenmesi | Forward-kur (§3.3), marj tabanı (§3.3), DMO kârsız-alarm+veto (§3.11), tam-yüklü marj (§3.7) |
| Kayıp iş önleme | Unutulan görev/süresi geçen evrak riskinin sıfıra inmesi | SLA eskalasyonu (§3.9, §3.12), teminat hatırlatması (§3.10) |
| İhale kazanımı | Diskalifiye riskinin düşmesi, hazırlığın doğru ihaleye yönlenmesi | Otomatik evrak eşleme (§3.5, §3.15), Bid/No-Bid skorkartı (§3.13) |
| Süreç hızı | İmza-iş başlangıcı gecikmesinin ortadan kalkması | T3/T4/T4b/T5/T6 otomatik zincir (§2.1, §4) |
| Pazarlık gücü | Körlemesine değil referans-fiyat destekli tedarik | Satınalma referans fiyat görünürlüğü (§3.8) |
| Yönetişim maliyeti | IT/danışmanlık bağımlılığının azalması | Ekrandan RBAC/iş akışı/vekalet (§2.3, §3.18) |
| Risk azaltımı | Bağımlılık, hesap verebilirlik, veri kaybı riskinin görünür olması | Konsantrasyon/HHI (§3.13), denetim izi (§2.4), izolasyon+yedekleme (§2.7, §3.17) |
| Kullanıcı benimsemesi | Disiplinin yük değil kolaylık olarak algılanması | Otomatik doldurma, proaktif hatırlatma, uygulama-içi Yardım (§3.19) |

---

## 7. Bu Dökümandan Satış Sunumu (Pitch Deck) Üretimi

Mevcut `docs/ENFLOW_SUNUM_SLAYTLARI.md` (Marp) ile birlikte kullanılabilir:

| Bu dökümanın bölümü | Sunumdaki karşılığı | Not |
|---|---|---|
| §1 Tek bakışta | Kapak + Problem/Çözüm slaytları | Faz tarihçesi yok, doğrudan kullanılabilir |
| §2 Paylaşılan altyapı | "Mimari — Neden Güven Verir" + "Yönetişim & Güvenlik" | 8-agent tablosu doğrudan slayta çevrilir |
| §3.1-3.19 modül bölümleri | Her modül için 1 slayt önerisi | Her bölümün "dikkat çeken mantık" paragrafı hazır slayt notu |
| §3.3, §3.11 (forward-kur, DMO) | "Finansal Zekâ" + "Kârsız Satışı Yakalar" slaytları | Somut formüller zaten yazılı |
| §3.13 tablo (12 rapor) | "Büyüme Analitiği" slaydı | Tablo satırları doğrudan madde işareti olur |
| §4 Bütünsel sentez | **Yeni slayt önerisi:** "Bir İşin Hikâyesi — Uçtan Uca" | Tek bir işin 19 modülden geçişini anlatan akış slaydı |
| §5-6 Ölçek + ROI | "Mimari" + "Ölçülebilir Fayda" slaytları | Rakamları güncel tut |

---

## 8. Şeffaflık Notları (Kısıtlar)

- İşletme maliyeti (overhead), projeye yalnız yönetim bilinçli olarak
  açarsa marja dahil olur — varsayılan kapalıdır.
- DMO Kataloğu ayrı lisanslı bir modüldür; lisans yoksa menü görünmez,
  API erişimi engellenir.
- Finans ve Hukuk sanal agentları hiçbir yapılandırmada otonom karara
  geçemez (iki bağımsız kilitle korunur).
- Fiziksel Arşiv, nav izninden bağımsız olarak sunucuda yalnız Genel
  Müdür'e açıktır.
- Sweep-tabanlı hatırlatmalar (SLA, teminat) bir zamanlayıcı sunucusu
  gerektirmez, ilgili ekran açıldığında tetiklenir — kaçırılmaz, yalnız
  ekran açılana kadar gecikebilir.
- Bu döküman, kod tabanının 2026-08-03 tarihli hâlinin doğrudan
  okunmasıyla üretildi; iddia edilen her mekanizma ilgili modülün/
  servisin gerçek kodunda doğrulanmıştır — spekülatif ya da eski
  sürümden kopyalanmış bilgi içermez.

---

*İlgili dökümanlar: `docs/ENFLOW_Tanitim_ve_Mimari.md` (genel tanıtım &
mimari) · `docs/ENFLOW_SUNUM_SLAYTLARI.md` (Marp sunum) ·
`docs/BUYUME_ANALITIGI.md` · `docs/DMO_KATALOG.md` ·
`docs/ISLETME_MALIYETI.md` · proje kökü `walkthrough.md §27` (canlı wiki
kaynağı, `wiki/index.html` / `/wiki`).*
