# ENFLOW — Karar Vericiler İçin Bilgilendirme Dökümanı
### Entegratör Süreçlerinde Hata Yakalama, Kontrol Mekanizması ve Tek-Bakış Görünürlük

> **Bu döküman kime hitap eder?** IT sistem entegrasyonu, donanım/yazılım tedariki ve kamu
> ihalesi ile B2B proje yürüten şirketlerin **Genel Müdür, Finans, Satış, Satınalma ve Proje**
> yöneticilerine. Amaç: Enflow'un günlük operasyonda **hangi hataları nasıl yakaladığını**,
> **hangi kontrol mekanizmasını kurduğunu**, **olası ve yürüyen işlerin durumunu tek bakışta
> nasıl gösterdiğini** ve **kullanıcıya günlük işte ne kolaylık sağladığını** somut örneklerle
> anlatmaktır.
>
> Bu döküman, `docs/ENFLOW_Tanitim_ve_Mimari.md` (genel tanıtım & mimari) ve
> `docs/ENFLOW_SUNUM_SLAYTLARI.md` (Marp sunum) ile birlikte okunmak üzere tasarlanmıştır;
> onların **"kontrol ve görünürlük" derinleştirmesidir** — aynı örnekleri tekrar etmez,
> odağını üç somut soruya daraltır. Sonundaki **§7** bu dökümanın satış sunumuna nasıl
> dönüştürüleceğini gösterir.

---

## 0. Neden Bu Üç Soru?

Bir sistem entegratörü şirketinde iş, birden çok elden geçer: satışçı fırsatı açar, presales
malzeme listesini hazırlar, satış destek ihale evrakını toplar, sözleşme birimi imzayı yönetir,
proje ekibi teslim eder, satınalma tedarik eder, finans tahsil eder. **Her el değişimi bir hata
fırsatıdır:** unutulan bir görev, süresi geçen bir teminat, yanlış kurla verilen bir teklif,
teknik olarak uygun olmayan bir tedarikçinin seçilmesi, kimsenin fark etmediği bir kârsız satış…

Yönetim üç şeyi bilmek ister:

1. **"Bu hatalar olduğunda sistem bunu yakalıyor mu, düzeltmeyi nasıl kolaylaştırıyor?"**
2. **"Kim neyi yapabiliyor, kim neyi onaylıyor, bunu nasıl denetliyoruz?"**
3. **"Sabah ofise geldiğimde, elimdeki ve gelmekte olan işlerin durumunu tek ekrandan görebiliyor muyum?"**

Bu döküman bu üç soruyu sırasıyla cevaplar (§1, §2, §3), ardından kullanıcıya sağlanan
kolaylıkları (§4) ve ölçülebilir faydayı (§6) özetler.

---

## 1. Süreç İçinde Oluşan Hatalar Nasıl Yakalanır ve Düzeltilir?

Enflow'da hata yönetimi **tek bir "onay butonu"** değil, üç farklı katmanda çalışan bir
mekanizmadır: **(A) otomatik yakalama** (bir şey unutulduğunda/süresi geçtiğinde sistem
kendiliğinden fark eder), **(B) düzeltme akışı** (bir şey reddedildiğinde/yanlış girildiğinde
geri dönüp doğru şekilde tamamlamanın resmî bir yolu vardır) ve **(C) veri girişinde önleme**
(bazı hatalar en baştan girilmesine izin verilmeyerek engellenir).

### 1.1 Hata Türü → Yakalama Mekanizması (Özet Tablo)

| Sahada olan hata | Kim fark etmezse ne olur | Enflow'un yakalama mekanizması |
|---|---|---|
| Bir görev unutulur, termini geçer | İş birim içinde sessizce donar | **SLA Eskalasyonu** — dueDate'i geçmiş, hâlâ açık görev bir üst yöneticiye (birimin ebeveyn yöneticisi, yoksa GM) otomatik bildirimle yükseltilir |
| Teminat mektubunun süresi dolmak üzeredir | Teminat süresiz sanılıp iş sözleşme ihlaline düşer | **Teminat Hatırlatması** — 30/15/7 gün eşiklerinde, her eşik yalnız bir kez, Finans Müdürü'ne bildirim |
| Garanti/servis talebi cevapsız kalır | Müşteri memnuniyetsizliği, sözleşme ihlali | **Servis SLA Eskalasyonu** — termini geçmiş açık servis talebi atanan kişiye, yoksa proje yöneticisine, o da yoksa GM'e yükseltilir |
| Satınalma talebi yanlış/eksik bilgiyle onaya girer | Ya yanlış onaylanır ya da süreç tıkanır | **Gerekçeli Red + Yeniden Gönderim** — talep gerekçesiyle reddedilir, düzeltilip **resubmit** edilir (kaç kez düzeltildiği sayılır ve denetim izinde görünür) |
| Onay sırası kimsenin olmadığı bir role denk gelir | Zincir sonsuza kadar bekler ("kilitlenme") | **Orphan-Skip** — o rolde aktif kullanıcı yoksa aşama otomatik atlanır (lisanslı bir sanal agent varsa agent-onaylı geçer) |
| Onaycı izinli/hastadır | Onay bekleyen iş birikir | **Onay Vekaleti (Delegasyon)** — kullanıcı kendi rolündeki onayları belirli veya süresiz bir tarihe kadar bir vekile devredebilir |
| Reddedilen bir teklif/sözleşme yeniden değerlendirilmelidir | Elle yeni bir kayıt açmak gerekir, iz kaybolur | **Onay Zincirini Sıfırlama** — aynı kayıt üzerinde zincir baştan PENDING'e alınır, geçmiş korunur |
| Teklif spot kurla verilir, tahsilat vadesinde kur yükselir | Marj kur farkından erir | **Forward-Kur Zorunluluğu** — maliyet, tahsilat tarihindeki *tahmini* kurla hesaplanır; eksik kur girilmeden teklif ilerlemez |
| Teknik olarak uygun olmayan ama ucuz bir tedarikçi seçilir | İş teslimde batar | **Teknik Uygunluk Filtresi** — yalnız "Uygun" işaretli + dosya kanıtlı teklifler seçilebilir; sistem uygunlar içinde en ucuzu önerir |
| DMO gibi düşük-marj kanalda satış aslında zarar ediyordur | Kimse fark etmeden ciro büyür, kâr erir | **Kârsız-Satış Alarmı** — kur açığı + risturn + komisyon hesaplanıp net marj negatifse sipariş kırmızı uyarı verir |
| İhaleye eksik/süresi geçmiş evrak ile girilir | Diskalifiye | **Otomatik Evrak Eşleme + Vade Hatırlatması** — şartname analiz edilip gereken evrak listesi çıkarılır, Şirket Evrakları'ndaki geçerli belgeler otomatik eşlenir, 3g/2g/12s/6s hatırlatmaları gider |

### 1.2 Otomatik Yakalama Nasıl Çalışır? (Teknik Olmayan Anlatım)

Bu hatırlatma/eskalasyon mekanizmaları arka planda **"sweep" (tarama)** adı verilen bir
kontrolle çalışır: kullanıcı ilgili ekranı her açtığında (görevler, teminatlar, servis
talepleri) sistem o an süresi geçmiş/eşiğe girmiş kayıtları tarar ve **daha önce
bildirilmemişse** (idempotent — aynı uyarı iki kez gitmez) bir bildirim üretir. Ayrı bir
zamanlayıcı sunucusu (cron) kurulmasına gerek yoktur; kontrol, sistemin normal kullanımına
gömülüdür — bu da kurulumu ve bakımı basitleştirir.

### 1.3 Somut Senaryo — "Bir Görev Nasıl Kaybolmaktan Kurtulur?"

1. Sözleşme imzalanır → sistem otomatik olarak Proje Yönetimi'ne bir devir görevi açar
   ("Devir paketini hazırla", termini iş-günü bazlı SLA'ya göre otomatik hesaplanır).
2. Proje yöneticisi o hafta yoğundur, görev **PENDING** kalır, termin geçer.
3. Proje yöneticisi görevler ekranını her açtığında sistem taramayı çalıştırır; termin
   geçtiği ve daha önce eskale edilmediği için görev, proje yöneticisinin bağlı olduğu
   birimin üst yöneticisine (yoksa GM'e) **bir kez** bildirimle yükseltilir.
4. Üst yönetici görevi görür, proje yöneticisiyle konuşur veya görevi kendi üstlenir/başka
   birine atar. **İş, hiçbir yerde sessizce kaybolmaz** — ya tamamlanır ya da yönetimin
   bilgisi dahilinde gecikir.

Aynı desen teminat mektupları ve servis/garanti talepleri için de geçerlidir — tek fark
kime/hangi eşikte bildirim gittiğidir (bkz. §1.1 tablosu).

---

## 2. Kurumsal Kontrol Mekanizması (Governance)

Yönetimin ikinci sorusu **"kim neyi yapabiliyor ve bunu nasıl denetliyoruz"**dur. Enflow'da
kontrol, tek bir özellik değil, birbirini tamamlayan **sekiz** mekanizmadan oluşur:

| # | Mekanizma | Ne sağlar |
|---|---|---|
| 1 | **Rol Tabanlı Erişim (RBAC) — 20 rol** | Her modülün bir izni vardır; izni olmayan kullanıcı o menüyü hiç görmez. Hassas uç noktalar (faiz oranı, işletme maliyeti havuzu, lisans üretimi, ihaleden çekilme kararı) ayrıca rol-kapılıdır. |
| 2 | **Tek-kaynak yetki matrisi + otomatik denetim** | `governance/role-matrix.ts` her rolün birimini, modüllerini ve karar haklarını tek yerde tanımlar; bir denetim komutu (`pnpm audit:roles`) bu matrisi gerçek kod ile karşılaştırıp sapmaları raporlar — "ekranda gördüğüm yetki ile kodun yaptığı aynı mı" sorusu otomatik doğrulanır. |
| 3 | **Görev Ayrılığı (SoD)** | Bir kaydı oluşturan kişi, aynı kişi olsa bile onu onaylayamaz — kritik onay/geri-yükleme aksiyonlarında zorunlu kılınır. |
| 4 | **Tutar-Bazlı Onay Matrisi (DoA)** | Tenant isterse tutar eşiği tanımlayabilir; belirli tutarın üzerindeki işler otomatik olarak daha üst onay rolüne yönlenir (opt-in — açılmadıysa sabit şablon geçerlidir). |
| 5 | **Çok-Aşamalı Onay Swimlane + Orphan-Skip** | Finans→İGPD→GM→KSU sırası zorunludur; aktif kullanıcısı olmayan aşama otomatik atlanır (zincir hiç kilitlenmez), lisanslı bir sanal agent varsa o aşama agent-onaylı geçer. |
| 6 | **Denetim İzi (ActivityLog)** | Her oluşturma/güncelleme/silme ve durum geçişi, **kim yaptı** (insan kullanıcı mı, hangi sanal agent mı) etiketiyle kayda geçer — "bu kararı kim, ne zaman verdi" sorusunun cevabı her zaman hazırdır. |
| 7 | **Çok-Kiracılı İzolasyon** | Her kayıt `tenantId` ile ayrışır; bir müşterinin/şirketin verisi bir diğerine **hiçbir koşulda** sızmaz — bu, otomatik testlerle her sürümde doğrulanır. |
| 8 | **Yedekleme & Felaket Kurtarma** | Zamanlanmış/manuel yedek (yerel/Nextcloud/S3), doğrulama ve fark-analizli kontrollü geri yükleme — yetkisi yalnız özel bir "Yedek Yöneticisi" rolüne verilir (o da başka hiçbir veriyi değiştiremez). |

**Sanal agentlarda kontrol.** Boş kalan birim koltuklarını (ör. atanmamış bir Presales veya
Satınalma rolü) dolduran 8 deterministik sanal agent vardır; ancak **Finans ve Hukuk agent'ları
hiçbir zaman otonom karar veremez** — yalnızca öneri sunar, son kararı her zaman insan verir.
Bu kısıtlama koddan değil, yapılandırmadan da değiştirilemez (çift kilit: hem eklenti izin
listesi hem çalışma-anı denetimi).

**Yönetime değeri:** Yetki değişikliği **dakikalar sürer, kod dağıtımı gerektirmez**; yanlış
yetki riski otomatik test süitiyle (RBAC + kiracı-izolasyon, güncel: **486/486** kontrol yeşil)
her sürümde güvence altındadır.

---

## 3. Tek Bakışta Görünürlük — Olası ve Yürüyen Projeler

Üçüncü soru: **"Sabah ofise geldiğimde ne görürüm?"**

### 3.1 Dashboard — Role-Bazlı Kokpit

Herkes aynı uygulamayı açar ama **kendi işini** görür: Genel Müdür KPI + zaman-duyarlı
uyarıları + darboğazları görür; Finans teminat/vade boşluklarını; Satış Destek ihale
vadelerini; Satış Müdürü bekleyen maliyet onaylarını. Her kart tıklanınca ilgili modüle
götürür — dashboard salt bilgi vermez, **aksiyona da yönlendirir**.

### 3.2 Olası Projeler (Pipeline) — Henüz Kazanılmamış İşler

| Soru | Nerede cevaplanır |
|---|---|
| Fırsatlarımız hangi aşamada tıkanıyor? | **Dönüşüm Hunisi** (yeni→iletişimde→nitelikli→teklif→pazarlık→kazanıldı/kaybedildi, kayıp nedenleriyle) |
| Bu çeyrek/yıl hedefi tutar mıyız? | **Ağırlıklı Tahmin & Hedef Kapsama** — açık pipeline, aşama olasılığıyla ağırlıklandırılıp hedefe oranlanır |
| Bu ihaleye girmeli miyiz? | **Bid/No-Bid Skorkartı** — idare geçmişi + kalan süre + evrak hazırlığı + değer uyumuna göre 0–100 puan, Katıl/İncele/Katılma önerisi |
| Tek müşteriye/kamu segmentine ne kadar bağımlıyız? | **Portföy Konsantrasyonu (HHI)** |

### 3.3 Yürüyen Projeler — İmzalanmış, Uygulamada Olan İşler

| Soru | Nerede cevaplanır |
|---|---|
| Bu projenin gerçek kârı ne? | **Proje → Karlılık** sekmesi: katkı marjı **vs** işletme maliyeti dahil **tam-yüklü net marj** |
| Proje takvimi/bütçesi sapıyor mu? | **Proje Sağlığı Skoru** (Marj %40 + Takvim %35 + Bütçe %25 ağırlıklı kompozit) → Kritik/İzlemede/Sağlıklı |
| Teklif ettiğimiz maliyeti tutturduk mu? | **BoM Maliyet Varyansı** (teklif ↔ gerçekleşen alış farkı) |
| Paramız nerede takılı? | **Alacak Yaşlandırma & DSO** |
| Birimler arası darboğaz nerede? | **Yönetim Raporları → İş Akışı Darboğazı** |

Tüm bu göstergeler **Büyüme Analitiği** katmanında toplanır: **13 salt-okunur, deterministik
rapor + 3 seviyeli sağlık skoru** (İş Sağlığı, Proje Sağlığı, Müşteri Sağlığı) — her biri
zayıf halkayı renkle işaretler, hiçbiri veri üretmez/değiştirmez, hepsi kiracı-izole ve
denetlenebilirdir.

**Yönetime değeri:** "Büyümenin bir sonraki adımı nerede?" ve "hangi proje riskte?" sorularının
cevabı **toplantı beklemeden**, tek ekrandan alınır.

---

## 4. Kullanıcılara Sağlanan Kolaylıklar

Kontrol ve görünürlük kadar önemli olan, günlük kullanıcının işini **kolaylaştırmasıdır** —
aksi halde disiplin bir yük olarak algılanır ve terk edilir. Enflow'da somut kolaylıklar:

1. **Otomatik devir zinciri** — İhale kazanılınca sözleşme, sözleşme imzalanınca proje +
   satınalma kaydı, satınalma faturası kesilince finans faturası **kendiliğinden** oluşur.
   Kullanıcı aynı bilgiyi ikinci kez elle girmez.
2. **YZ destekli şartname/sözleşme analizi** — İdari şartname veya sözleşme metni yüklenir,
   gerekli evrak listesi otomatik çıkarılır; sağlayıcıdan bağımsız (tenant kendi anahtarını
   girer) — hiçbir tek YZ firmasına bağımlılık yoktur, yapılandırılmamışsa deterministik bir
   örnek sonuçla çalışmaya devam eder (sistem hiçbir zaman kilitlenmez).
3. **Şirket Evrakları'ndan otomatik eşleme** — İhale evrak listesi çıkınca, geçerlilik
   tarihi dolmamış şirket belgeleri otomatik eşlenir; kullanıcı sadece eksikleri tamamlar.
4. **Proaktif hatırlatmalar** — Kullanıcının hiçbir şeyi aklında tutmasına gerek yok: teminat,
   görev, servis talebi ve ihale vadeleri sistem tarafından zamanı geldiğinde hatırlatılır
   (bkz. §1).
5. **Uygulama-içi Yardım modülü + Enflow Wiki** *(2026-08-03 eklendi)* — Header'daki Yardım
   ikonuna tıklayan kullanıcı, **o an bulunduğu ekranın** kullanım kılavuzuyla karşılaşır;
   arama kutusuyla başka bir konuyu da bulabilir. Rol-duyarlıdır — kullanıcı yalnız kendi
   yetkisi dahilindeki modüllerin kılavuzunu görür. Yazılımı hiç tanımayan biri için ayrıca
   dışa açık bir **Wiki** sayfası (uçtan uca akışı anlatan statik kılavuz) mevcuttur.
6. **Onay vekaleti** — İzinli/hasta bir yöneticinin onayları, kendisi tarafından bir vekile
   devredilebilir; süreç kimseyi beklemeden akmaya devam eder.
7. **Yazdırılabilir/konsolide raporlar** — Birim raporları tek tek veya birleştirilmiş olarak
   yazdırılabilir; dönemsel karşılaştırma (▲/▼) otomatik hesaplanır.
8. **Ekrandan yönetişim** — Yeni kullanıcı ekleme, rol/izin değişikliği, iş akışı şablonu
   düzenleme; hiçbiri kod dağıtımı veya IT bileti gerektirmez.
9. **Mobil uyum** — Sidebar mobilde çekmece (drawer) olarak çalışır, güvenli alan (safe-area)
   desteğiyle telefon/tablet üzerinden de kullanılabilir.
10. **Sanal agentlar boş koltuğu doldurur** — Bir birimde geçici olarak kimse yoksa (izin,
    kadro boşluğu), ilgili sanal agent süreç önerisini üretmeye devam eder; süreç **durmaz**,
    yalnız kritik kararlarda (para/hukuk) insan onayı beklenir.

---

## 5. Ölçek — Bugünün Rakamları (2026-08-03)

| Gösterge | Sayı |
|---|---|
| Veri modeli (Prisma) | 67 |
| Ekran modülü | 33 |
| API alanı (`/api/*`) | 38 |
| Backend servisi | 35 |
| Sanal agent | 8 (para/hukuk daima danışman) |
| Rol | 20 |
| Mimari katman | 8 (0–7) |
| Büyüme Analitiği raporu | 13 + 3 seviyeli sağlık skoru |
| RBAC + kiracı-izolasyon test sonucu | **486/486 yeşil** |

*(Kaynak: `walkthrough.md §27`, `CLAUDE.md`, ilgili servis/route dosyaları — bu döküman kod
tabanından türetilmiştir, spekülatif rakam içermez.)*

---

## 6. Ölçülebilir Fayda (ROI Dili)

| Alan | Fayda |
|---|---|
| **Kâr koruması** | Forward-kur + tam-yüklü marj + DMO kârsız-satış alarmı → zarar eden/erozyona uğrayan işin **kabul edilmeden** önlenmesi |
| **Kayıp iş önleme** | SLA eskalasyonu + teminat/servis hatırlatmaları → unutulan görev/süresi geçen evrak riskinin sıfıra inmesi |
| **İhale kazanımı** | Bid/No-Bid odaklanması + otomatik evrak eşleme → diskalifiye riskinin düşmesi, hazırlık emeğinin doğru ihaleye yönlenmesi |
| **Süreç hızı** | Otomatik devir zinciri → imza-iş başlangıcı arasındaki gecikmenin ortadan kalkması |
| **Yönetişim maliyeti** | Ekrandan RBAC/iş akışı + vekalet → IT/danışmanlık bağımlılığının ve onay tıkanıklığının azalması |
| **Risk azaltımı** | Konsantrasyon (HHI) + denetim izi + çok-kiracılı izolasyon + yedekleme → bağımlılık, hesap verebilirlik ve veri kaybı risklerinin görünür/yönetilir olması |
| **Kullanıcı benimsemesi** | Otomatik doldurma + proaktif hatırlatma + uygulama-içi Yardım → disiplinin yük değil, kolaylık olarak algılanması |

---

## 7. Bu Dökümandan Satış Sunumu (Pitch Deck) Üretimi

Bu döküman, mevcut `docs/ENFLOW_SUNUM_SLAYTLARI.md` (Marp formatlı sunum) ile birlikte
kullanılmak üzere tasarlandı. Aşağıdaki eşleme, bu dökümanın hangi bölümünün hangi slayda
karşılık geldiğini (veya mevcut sunuma **hangi yeni slaytların eklenebileceğini**) gösterir:

| Bu dökümanın bölümü | Sunumdaki karşılığı | Not |
|---|---|---|
| §0 Neden bu üç soru | Problem slaydı ("Üç Sessiz Maliyet") | Mevcut sunumda var — bu döküman gerekçeyi derinleştirir |
| §1 Hata yakalama tablosu (1.1) | **Yeni slayt önerisi:** "Hatayı Nasıl Yakalarız?" | Tablo doğrudan slayt içeriğine çevrilebilir; her satır bir madde |
| §1.3 Somut senaryo | **Yeni slayt önerisi:** "Bir Görevin Hikâyesi" (before/after) | Mevcut sunumdaki DMO before/after örneğiyle aynı üslupta |
| §2 Kontrol mekanizması tablosu | "Yönetişim & Güvenlik" slaydı | Mevcut slaydı 8-mekanizma tablosuyla genişletir |
| §3 Tek bakışta görünürlük | "Büyüme Analitiği" + "Raporlara Nasıl Ulaşılır" slaytları | Olası/yürüyen proje ayrımı yeni bir alt-başlık olarak eklenebilir |
| §4 Kullanıcı kolaylıkları | **Yeni slayt önerisi:** "Kullanıcıya Ne Kolaylaştırır?" | Yardım modülü + Wiki maddesi mevcut sunumda yok, eklenmeli |
| §5 Ölçek rakamları | "Mimari — Neden Güven Verir" slaydı | Rakamları güncel tut (67 model, 20 rol, 8 katman) |
| §6 ROI tablosu | "Ölçülebilir Fayda (ROI)" slaydı | Mevcut slaytla birebir uyumlu, ek satır (Kullanıcı benimsemesi) eklenebilir |

**Öneri:** Yeni bir satış görüşmesi öncesi, dinleyici kitlesine göre bu dökümandan §1 (hata
yakalama) veya §2 (kontrol) öne çıkarılabilir — teknik/operasyon odaklı bir GM için §1,
kurumsal yönetişim/denetim odaklı bir yönetim kurulu için §2 daha ikna edicidir. §3 ve §4 her
izleyici kitlesi için ortak zemindir (herkes "sabah ne görürüm" ve "işim kolaylaşıyor mu"
sorularını sorar).

---

## 8. Şeffaflık Notları (Kısıtlar)

- İşletme maliyeti (overhead), projeye yalnız yönetim bilinçli olarak açarsa (proje bazlı
  toggle) marja dahil olur — varsayılan kapalıdır, direkt marj hesabı değişmez.
- DMO Kataloğu ayrı lisanslı bir modüldür; lisans yoksa menü görünmez, API erişimi engellenir.
- Finans ve Hukuk sanal agentları hiçbir yapılandırmada otonom karara geçemez.
- Sweep tabanlı hatırlatmalar (§1.2) bir zamanlayıcı sunucusu gerektirmez, ilgili ekran
  açıldığında tetiklenir — çok uzun süre hiç açılmayan bir ekranın bildirimi de o ekran
  açıldığı an gönderilir (kaçırılmaz, yalnız gecikebilir).
- Bu döküman kod tabanından (`walkthrough.md §27`, `CLAUDE.md`, ilgili servis dosyaları)
  türetilmiştir; iddia edilen her mekanizma ilgili servis dosyasında doğrulanmıştır.

---

*İlgili dökümanlar: `docs/ENFLOW_Tanitim_ve_Mimari.md` (genel tanıtım & mimari, modül-modül
anlatı) · `docs/ENFLOW_SUNUM_SLAYTLARI.md` (Marp sunum) · `docs/BUYUME_ANALITIGI.md` (Büyüme
Analitiği derinlemesine) · `docs/DMO_KATALOG.md` · `docs/ISLETME_MALIYETI.md` · proje kökü
`walkthrough.md §27` (canlı wiki kaynağı, `wiki/index.html` / `/wiki`).*
