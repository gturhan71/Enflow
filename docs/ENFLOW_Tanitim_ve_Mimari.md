# ENFLOW — Sistem Tanıtım & Mimari Dökümanı
### Karar Vericiler İçin Değer & Yetenek Anlatısı · Pitch Deck · Tanıtım Videosu Kaynağı

> Bu döküman Enflow'u **satın alma kararı verecek yöneticiye** anlatmak için yazılmıştır. Her
> bölüm; öne çıkan özelliği, işin sahadaki akışını, **neden–sonuç** ilişkisini, sistemin
> **nasıl değerlendirme yaptığını**, **hangi rapora nasıl ulaşıldığını** ve **somut faydayı**
> içerir. Amaç: "güzel bir yazılım" değil, **kararı kolaylaştıran, parayı ve zamanı koruyan bir
> karar sistemi** olduğunu göstermek.

---

## 0. Yönetici Özeti (Tek Sayfa)

**Sorun.** B2B, kamu ihalesi ve IT-entegrasyon işi yapan şirketlerde süreç **parçalıdır**: CRM
ayrı, teklif Excel'de, ihale dosyası klasörde, sözleşme e-postada, satınalma WhatsApp'ta, finans
muhasebede. Bu kopukluk üç sessiz maliyet üretir: **(1) kaçan iş** (vade/onay unutulur), **(2)
eriyen kâr** (yanlış kur, gizli işletme maliyeti, kötü tedarikçi kararı), **(3) görünmeyen risk**
(tek müşteriye bağımlılık, kârsız satış, geciken tahsilat).

**Çözüm.** Enflow bu zinciri **tek akışta** birleştirir ve her adımda **karar üretir**: neyin
kârlı olduğunu, neyin risk taşıdığını, hangi işin geciktiğini — *gerçekleşmeden önce* söyler.

**Karar vericiye 6 net vaat:**
1. **Fırsattan teslime tek akış** — birimler arası geçiş otomatik; veri elle taşınmaz, insan yalnız *karar verir*.
2. **Kuruşuna kadar finansal doğruluk** — döviz, vade, teminat, taksitli tahsilat, banka faizi ve **işletme maliyeti** hesaba katılır; "kârlı görünen" işin *gerçek* marjı görünür.
3. **Kâr getirmeyen satışı kabul etmeden yakalar** — özellikle DMO gibi düşük-marj/yüksek-hacim kanallarda otomatik alarm.
4. **Büyümeyi kök nedeniyle izler** — 13 rapor + 3 seviyeli sağlık skoru; zayıf halkayı işaretler.
5. **Yönetişim koddan değil ekrandan** — 19 rol, yetkiler ve iş akışı ekrandan yönetilir; her işlem denetim izinde.
6. **Boş koltuğu doldurur** — 8 deterministik sanal birim-agentı; para ve hukuk daima *danışman* (asla otonom).

**Kanıt kültürü.** Çok-kiracılı veri izolasyonu, RBAC + tenant-izolasyon (IDOR) test süiti, para
alanlarında kuruş-tabanlı yuvarlama ve tam denetim izi (insan/agent ayrımı) her sürümde güvence altındadır.

---

## 1. Enflow Nedir? (Değer Önermesi)

**Enflow, bir satış fırsatının doğuşundan — ihale dosyasına, teklife, sözleşmeye, satınalmaya,
finansa ve proje teslimine kadar — tüm iş yaşam döngüsünü uçtan uca yöneten, çok-kiracılı
(multi-tenant) kurumsal bir SaaS karar platformudur.**

**Kime hitap eder?** IT entegrasyonu · sistem/donanım tedariki · kamu ihalesine giren · B2B proje
yürüten şirketlerin **Genel Müdür, Finans, Satış, Satınalma, Proje ve İhale** yöneticileri.

**Farkı (klasik ERP'den):** Klasik ERP *kaydeder*; Enflow **değerlendirir ve uyarır**. Bir teklifin
marjını, bir ihaleye girmenin mantığını, bir satışın gerçek kârını, bir birimin atıl maliyetini,
bir müşterinin risk skorunu **hesaplayıp karar vericinin önüne koyar**.

Slayt başlıkları (kısa vaatler):
- *"Fırsattan teslime, tek akış."*
- *"Kârlı görünen satışın gerçekte kazandırıp kazandırmadığını, kabul etmeden görmek."*
- *"Döviz, vade, teminat ve işletme maliyetini kuruşuna kadar hesaplayan finans zekâsı."*
- *"Büyümeyi kök nedeniyle izleyen 13 rapor + 3 seviyeli sağlık skoru."*
- *"Boş kalan koltuğu sanal agent doldurur; her işlem köken-etiketli denetim izinde."*

---

## 2. Sistem Mimarisi — Neden Karar Vericiye Güven Verir

Karar verici için mimari, "moda teknoloji listesi" değil; **veri güvenliği, sürdürülebilirlik ve
doğruluk** garantisidir.

### 2.1 Katmanlı Mimari (7 Katman)
```
┌─────────────────────────────────────────────────────────────┐
│  SUNUM      React 19 + TypeScript 6 (strict) · Vite 8        │
│             (Rolldown) · Tailwind v4 (glass-morphism) ·       │
│             TanStack Query v5 · motion/react · Recharts       │
├─────────────────────────────────────────────────────────────┤
│  API        Express.js v5 · /api/* (30+ domain router)       │
├─────────────────────────────────────────────────────────────┤
│  SERVİS     workflowService · projectFactory · activityLog · │
│             unitReportingService · dashboardService ·         │
│             analyticsService (büyüme) · overheadService ·     │
│             dmoCosting · financingEffect · backupService…     │
├─────────────────────────────────────────────────────────────┤
│  AKIŞ MOTORU Workflow/WorkflowStep (skip-logic) · TodoTask · │
│             ApprovalChain/Stage (swimlane) · Notification     │
├─────────────────────────────────────────────────────────────┤
│  AI / AGENT  8 sanal birim-agentı (deterministik) ·          │
│             PluginEntitlement (lisans/modül kapısı) · AgentRun│
├─────────────────────────────────────────────────────────────┤
│  VERİ        Prisma ORM · SQLite/PostgreSQL · 65+ model       │
├─────────────────────────────────────────────────────────────┤
│  İZOLASYON   Çok-kiracılı: her kayıt tenantId ile izole       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Teknoloji Yığını
| Katman | Teknoloji | Karar vericiye anlamı |
|--------|-----------|----------------------|
| Frontend | React 19 · TS 6 (strict) · Vite 8 | Hızlı, güvenli, bakımı sürdürülebilir arayüz |
| Backend | Express v5 · Prisma ORM | Standart, taşınabilir, denetlenebilir çekirdek |
| Veritabanı | **SQLite (kolay kurulum) → PostgreSQL (üretim)** | Küçükte sıfır-bağımlılık, büyükte kurumsal DB; kurulum sihirbazı seçtirir |
| Belge | Yerel `/uploads` + opsiyonel Nextcloud (WebDAV) | Evrak yönetimi + kurumsal DMS entegrasyonu |
| YZ | **Sağlayıcıdan bağımsız** (OpenAI-uyumlu; tenant kendi anahtarı) | Şartname/sözleşme analizi; hiçbir sağlayıcıya kilit yok |
| Yedekleme | Yerel · Nextcloud · S3 (doğrulamalı) | Veri güvencesi, felaket kurtarma |

### 2.3 Karar Vericiyi İlgilendiren 5 Mimari İlke
1. **Çok-kiracılı izolasyon:** Her kayıt `tenantId` ile ayrışır; bir müşterinin verisi diğerine
   **asla** sızmaz — cross-tenant (IDOR) testleriyle her sürümde kanıtlanır. → *Güven & uyumluluk.*
2. **Tek-kaynak gerçeklik:** Şema, rol matrisi ve akış tek yerde tanımlıdır; "farklı ekranlarda
   farklı rakam" sorunu yapısal olarak önlenir. → *Tutarlılık.*
3. **Otomatik geçiş zinciri:** İhale→Sözleşme→Proje→Satınalma→Finans halkaları sistem tetikler.
   → *İnsan hatası ve "arada düşen iş" riski minimuma iner.*
4. **Denetim izi (provenance):** Her mutasyon `ActivityLog`'a yazılır (insan | agent, köken
   etiketiyle). → *Denetime hazır; sorumluluk izlenebilir.*
5. **Para birimi disiplini:** Döviz değerleri sessizce tek para birimine **çevrilmez**; eksik kur
   uyarıyla bloke edilir. → *"Yanlış kur = hayati maliyet hatası" riski önlenir.*

---

## 3. RBAC & Yönetişim — Neden Önemli, Nasıl Çalışır

**Karar vericinin sorusu:** "Kim neyi görür, kim neyi yapar — ve bunu değiştirmek için yazılımcıya
mı muhtacım?" **Cevap:** Hayır. Yetkiler ve iş akışı **ekrandan** yönetilir.

**İki katmanlı denetim:** (1) *Menü görünürlüğü* — her modülün bir izni vardır; izin yoksa menü
görünmez. (2) *Uç nokta koruması* — hassas aksiyonlar rol-kapılıdır (örn. ihaleden çekilme kararı,
faiz oranı, işletme maliyeti havuzu, lisans üretimi yalnız üst yönetim).

**Tek kaynak + otomatik bekçi:** `governance/role-matrix.ts` her rolün birimini, modüllerini, karar
haklarını ve görevlerini tanımlar; bir denetim komutu bu matrisi gerçek izinler + menüler +
uç-nokta kapılarıyla karşılaştırıp tutarsızlıkları raporlar (0-hata hedefi). **19 rol** tanımlıdır
(GM, Operasyon, Satış×3, Presales×3, Satınalma, Finans, Proje, İhale/İSAB, İGPD, Kalite/KGD,
Sözleşme/KSU, Hukuk, İK, Denetçi, Admin).

**Değerlendirme & kanıt:** Playwright tabanlı RBAC + tenant-izolasyon süiti, her rol için erişim
senaryolarını ve kiracılar-arası sızma denemelerini otomatik test eder → her sürümde **yeşil**.

**Karar vericiye değer:** *Yetki değişikliği dakikalar sürer, kod dağıtımı gerektirmez; yanlış
yetki riski test süitiyle güvenceye alınır.*

---

## 4. Modüller — Her Biri: Özellik · Akış · Neden→Sonuç · Değerlendirme & Rapor · Fayda

> Her modül sürecin bir halkasıdır ve Yönetim Raporları'na canlı metrik besler. Aşağıda her modül,
> **karar vericinin bakış açısıyla** anlatılır.

### 4.1 Dashboard — Role-Bazlı Kokpit
- **Öne çıkan özellik:** Tek dashboard, **role göre değişen içerik**. GM yönetim kokpitini (KPI +
  darboğaz + zaman uyarıları), Finans teminat/vade boşluğunu, Satış Destek ihale vadelerini görür.
- **Akış:** Giriş → rolün widget seti yüklenir → her widget ilgili modüle **tıkla-git**.
- **Neden→Sonuç:** Herkes tek ekrana bakar ama *kendi işini* görür → dikkat dağılmaz, "hangi işi
  yapayım" belirsizliği ortadan kalkar.
- **Değerlendirme & Rapor:** `dashboardService` canlı aggregator; kaynak fırsat/ihale/teminat/
  fatura/milestone/görev/bildirim. **Zamana-duyarlı zekâ** eşik bazlı uyarı üretir (cron'suz).
- **Karar vericiye değer:** *Sabah tek ekran açar, gününün kritik 5 işini ve şirketin nabzını görür.*

### 4.2 Yönetim Raporları + Büyüme Analitiği ⭐
- **Öne çıkan özellik:** Birim performansı **ve** işi bir sonraki seviyeye taşıyan **13 rapor + 3
  seviyeli sağlık skoru** — tek sekmede stratejik pano.
- **Akış:** Birim seç → canlı metrik + iş-akışı darboğazı → birim müdürü dönem raporu yazar →
  üst yöneticiye **escalation** → inceleme (onayla/iade) → tek + konsolide **yazdırma**.
- **Büyüme Analitiği (deterministik, salt-okunur):**
  - **Satış:** Dönüşüm Hunisi (nerede kaybediyoruz?), Ağırlıklı Tahmin & Hedef Kapsama (boru
    gerçekte ne vaat ediyor?).
  - **İhale:** Kazanma Kırılımı (idare/usul), **Bid/No-Bid Skorkartı** (bu ihaleye girmeli miyiz?).
  - **Portföy:** Müşteri/Kamu **Konsantrasyonu (HHI)** (tek müşteriye ne kadar bağımlıyız?), Belge
    Portföyü (yetkinlik belgesi hazır mı?).
  - **Kâr/Nakit:** BoM Maliyet Varyansı (teklifi tutturduk mu?), **Alacak Yaşlandırma & DSO**
    (paramız nerede takılı?).
  - **Sağlık Skorları:** **İş Sağlığı** (5 sütun kompozit: Satış/İhale/Finans/Müşteri/Uyum) ·
    **Proje Sağlığı** · **Müşteri Sağlığı** — zayıf halkayı işaretler.
  - Ayrıca **DMO Kanalı** ve **Birim Bütçe Absorpsiyonu** kartları (ilgili modüller aktifse).
- **Neden→Sonuç:** Ciro büyürken kâr/nakit sızıntıları (huni tıkanması, marj erozyonu, geciken
  tahsilat, müşteri bağımlılığı) **sessizdir**. Bu katman onları **kök nedeniyle ve gerçekleşmeden
  önce** görünür kılar → yanlış yere yatırım/geç kalmış karar önlenir.
- **Değerlendirme & Rapor:** `analyticsService` + `unitReportingService`; her rapor tenant-scoped
  ve IDOR-testli; sağlık skorları ağırlıklı kompozit + eşik renk kodu.
- **Karar vericiye değer:** *"Büyümenin bir sonraki adımı nerede?" sorusuna tek bakışta cevap;
  toplantı gündemi otomatik oluşur.*

### 4.3 Ziyaret Planı — Saha Ölçümü
- **Öne çıkan özellik:** Haftalık plan ↔ günlük gerçekleşen **mutabakatı**; personel KPI =
  ziyaret eşleşme oranı.
- **Akış:** Haftalık ziyaret planı (tanışma/planlı/fırsat/proje) → günlük rapor → plan-gerçekleşen
  eşleşmesi → Excel çıktısı.
- **Neden→Sonuç:** Saha emeği görünmezse ölçülemez, ödüllendirilemez → plan/gerçekleşen mutabakatı
  emeği **nesnel** kılar.
- **Değerlendirme & Rapor:** `VisitPlan/Visit/DailyReport` work-link matrisi + metricsSnapshot.
- **Karar vericiye değer:** *Satış ekibinin sahadaki verimini rakamla görür, prim/hedefi buna bağlar.*

### 4.4 CRM & Müşteri + Maliyet Analizi ⭐
- **Öne çıkan özellik:** Müşteri/fırsat/teklif/canlı pazarlık + **kuru tahsilat tarihine sabitleyen
  akıllı maliyetlendirme** ve **müdür onay akışı**.
- **Akış:** Fırsat açılırken **satınalma usulü + son teklif tarihi** girilir (Satış Destek tetiklenir)
  → Maliyet Analizi: BoM alış fiyatları × **forward (tahsilat) kur** + usule göre otomatik masraflar +
  satış-üzerinden marj → teklif fiyatı → **Satış Müdürü onayı** → teklif hazırlanır.
- **Neden→Sonuç:** Döviz kuru teklif anında değil **tahsilat anında** gerçekleşir; spot kurla
  fiyatlanan iş, vadede kur farkından zarar eder → forward-kur mantığı marjı **baştan** korur.
- **Değerlendirme & Rapor:** `Opportunity.costConfig` (forward kur, marj modu), `Proposal`
  (versiyonlu), teklif durum sıralaması (APPROVED>ACCEPTED>SENT…) ile "en iyi teklif fiyatı".
- **Karar vericiye değer:** *Marjı erozyona uğratan gizli kur riski, teklif verilmeden nötralize edilir.*

### 4.5 Presales & Dizayn — Kanıtlı En Uygun BoM ⭐
- **Öne çıkan özellik:** Her kalem için **farklı vendorlardan teklif** + **fiyat + 3-seviye teknik
  uygunluk** (Uygun/Kısmen/Uygun Değil) + **orijinal teklif dosyası** kanıtı; sistem uygunlar
  içinde **en ucuzu önerir**.
- **Akış:** Şartname analizi (YZ) → ürün/BoM → vendor teklifleri + uygunluk + dosya → yalnız
  teknik-uygun seçilebilir → BoM'a **hazırlandığı kur/döviz** ile işlenir → Satışa devir → yönetici
  "Devredilen BoM'lar"da içeriği inceler.
- **Neden→Sonuç:** En ucuz teklif teknik uygun değilse iş batırır; sadece fiyat bakan seçim risklidir
  → fiyat **ve** uygunluk **ve** kanıt birlikte değerlendirilir → hem maliyet hem kalite korunur.
- **Değerlendirme & Rapor:** `BoMLineQuote` (technicalCompliance, isSelected, fileUrl), `BomHandoff`
  snapshot; kaybedilen değerlendirmeler arşivlenir ve BoM Varyans raporunu besler.
- **Karar vericiye değer:** *Her tedarik kararı belgeli ve savunulabilir; denetimde "neden bu vendor?"
  sorusunun cevabı hazır.*

### 4.6 Satış Destek / İhale-İSAB — Şartnameyi Okuyan Asistan ⭐
- **Öne çıkan özellik:** İdari/teknik şartnameyi **YZ ile analiz** → **verilmesi gereken evrak listesi**
  → **Şirket Evrakları envanterinden geçerli evrakları otomatik eşler** → **zaman-duyarlı hatırlatmalar
  (3g/2g/12s/6s)**.
- **Akış:** Fırsattan otomatik düşen ihale → şartname analizi/PDF → checklist → evrak otomatik eşleme
  → Finans'a **teminat talebi** → "Teklif İletildi" ile Girilen İhaleler arşivi.
- **Neden→Sonuç:** İhalede tek eksik/süresi geçmiş evrak = **diskalifiye**; vade kaçarsa iş kaybı →
  evrakı sistemin bulması ve vadeyi hatırlatması bu **sessiz riski sıfırlar**.
- **Değerlendirme & Rapor:** `Tender` + `TenderChecklistItem` (source AI/CORPORATE_DOC), `specAnalysis`;
  Bid/No-Bid Skorkartı ihaleye girme kararını (idare geçmişi + süre + evrak hazırlığı + değer uyumu)
  0–100 puanlar → **Katıl/İncele/Katılma**.
- **Karar vericiye değer:** *Hazırlık emeği kazanma olasılığı yüksek ihalelere yönlendirilir; diskalifiye
  riski görünür.*

### 4.7 Sözleşme Yönetimi (KSU + Yönetim)
- **Öne çıkan özellik:** İhale kazanımıyla **otomatik oluşan** sözleşme; imza sonrası **iki yöne devir**
  (Proje + Satınalma) tek tıkla.
- **Akış:** Otomatik sözleşme → YZ evrak analizi → hazırlık → imza onay akışı (KSU→GM) → SIGNED →
  Proje kaydı + görevler **ve** Satınalmaya BoM + referans alış fiyatları.
- **Neden→Sonuç:** İmza ile iş başlaması arasındaki gecikme ve elle veri taşıma hata üretir →
  otomatik devir zinciri bu boşluğu kapatır.
- **Değerlendirme & Rapor:** `ContractWorkflow` (durum akışı, projectId, procurementRequestId).
- **Karar vericiye değer:** *"İmza attık ama proje 2 hafta sonra başladı" sorunu ortadan kalkar.*

### 4.8 Satın Alma — "Alınan Fiyatı Bilerek Pazarlık"
- **Öne çıkan özellik:** Sözleşmeden gelen BoM'da her kalemin **referans alış fiyatı + üretici/
  distribütör kaynağı** görünür; 9 statülü onay akışı.
- **Akış:** BoM → DRAFT talep → referans fiyata göre teklif topla → onay zinciri (birim→satınalma→GM)
  → PO → teslimat → fatura; **PO→Proje maliyet kalemi**, **fatura→Finans** otomatik.
- **Neden→Sonuç:** Satınalma "piyasa fiyatını" bilmeden pazarlık ederse kâr kaçar → referans fiyat
  görünürlüğü **pazarlık gücü** verir.
- **Değerlendirme & Rapor:** `PurchaseRequest` (9 statü), `PurchaseItem` (estimatedUnitPrice, refVendor),
  BoM Maliyet Varyansı raporu teklif↔gerçekleşen farkını ölçer.
- **Karar vericiye değer:** *Tedarik maliyeti körlemesine değil, referans-fiyat destekli düşürülür.*

### 4.9 Proje Yönetimi — Gerçek (Tam-Yüklü) Marj ⭐
- **Öne çıkan özellik:** İmzalı sözleşmeden **otomatik proje + tipine göre milestone şablonu**;
  Karlılık sekmesinde **katkı marjı vs tam-yüklü net marj** + **işletme maliyeti yönetim toggle'ı**.
- **Akış:** Otomatik proje (HARDWARE/SOFTWARE/SERVICE/MIXED) → milestone + maliyet + karlılık
  (planlı/gerçekleşen/forecast) → GM onaylı geçişler → **11 zorunlu devir evrakı** paketi.
- **Neden→Sonuç:** Direkt maliyetle hesaplanan marj **yanıltır**; personel/kira/opex hiçbir projeye
  yüklenmezse şirket "kârlı" projelerle zarar edebilir → tam-yüklü marj gerçeği gösterir.
- **Değerlendirme & Rapor:** `overheadService`; Proje Sağlığı skoru (Marj 40% + Takvim 35% + Bütçe 25%)
  → Kritik/İzlemede/Sağlıklı.
- **Karar vericiye değer:** *"Bu proje gerçekten kazandırdı mı?" sorusunun kesin cevabı.*

### 4.10 Finans — Zamanın, Kurun ve Maliyetin Zekâsı ⭐
- **Öne çıkan özellik:** Fatura/tahsilat/teminat + **Vade & Finansman Etkisi** (taksitli tahsilat +
  banka faizi → döviz-bazlı finansman maliyeti/getirisi) + **İşletme Maliyeti Dağıtımı**.
- **Vade & Finansman:** Ödeme vadeleri + taksitli tahsilat planı + banka faizleri → **döviz-bazlı**
  net etki; negatif → "Finansman Maliyeti" kalemi (yönetim onayı), pozitif → bilgi (otomatik kâr değil).
- **İşletme Maliyeti (Overhead):** Dönemsel havuz (personel+opex) projelere **iki katmanda** yansır —
  (1) şirket genel gideri **yüzdeyle**, (2) projeye iştirak eden **birim** dönem maliyetinin **katsayıyla**
  yüklenmesi. **Birim bütçesi** tanımlanır, **absorpsiyonu** (bütçe vs iştiraklere dağıtılan) izlenir.
  Overhead'in marja girmesi **yönetim insiyatifine** (proje toggle) bağlıdır; varsayılan kapalı.
- **Neden→Sonuç:** Para zamanın fonksiyonudur; teklif anındaki kâr, vade+faiz+kur+işletme maliyeti
  sonrası bambaşka olabilir → Finans bu dönüşümü **kuruşuna kadar** hesaplar.
- **Değerlendirme & Rapor:** `financeEngine` (kuruş-tabanlı yuvarlama), `financingEffect`,
  `overheadService`; Alacak Yaşlandırma & DSO, Birim Bütçe Absorpsiyonu raporları.
- **Karar vericiye değer:** *"Ciro büyüdü ama nakit nerede?" ve "gerçek kârım ne?" sorularına kesin cevap.*

### 4.11 DMO Kataloğu & Kârlılık (Ayrı Lisanslı) ⭐
- **Öne çıkan özellik:** Devlet Malzeme Ofisi satış kanalı için **kârlılık motoru** — her sipariş için
  **DMO'nun kendi (geçerliliği belirsiz) satış kuru ile piyasa maliyet kuru açığı + risturn + üçüncü-şahıs
  komisyonu** hesaplanır; **kâr getirmeyen satış otomatik alarm** üretir.
- **Akış:** Katalog + çerçeve anlaşma → sipariş (satış fiyatı sözleşmeyle **sabit/kilitli**, alış maliyeti
  **değişken**) → o anki koşullarla net marj → kârsızsa Reddet/uyarı → teslim → **otomatik SALES fatura**
  → Finans/Analitik zincirine akar.
- **Neden→Sonuç:** DMO düşük-marj/yüksek-hacim kanaldır; DMO kuru piyasadan düşük + risturn + komisyon
  brütte kârlı görünen satışı **net zarara** çevirebilir → motor bunu **kabul edilmeden** yakalar.
- **Değerlendirme & Rapor:** `dmoCosting` (kalem-bazlı satış dövizi, efektif risturn, kur snapshot);
  Risturn Mutabakatı (dönem tahakkuk vs gerçek), Büyüme Analitiği'nde DMO Kanalı kartı.
- **Karar vericiye değer:** *"Hangi DMO satışı gerçekten kazandırıyor?" — kabul etmeden görmek. Ayrı
  lisanslanabilir add-on (modül lisanslama örneği).*

### 4.12 Görevler & Takip — Hiçbir İş Düşmez
- **Öne çıkan özellik:** Birimler-arası görev havuzu + **"Bekleyen Onaylarım"** onay swimlane'i + iş-günü SLA.
- **Neden→Sonuç:** Her devir bir göreve, her onay bir kuyruğa dönüşür → "arada unutulan iş" yapısal olarak biter.
- **Karar vericiye değer:** *Süreç akışı görünür ve hesap verebilir hale gelir.*

### 4.13 Şirket Evrakları — İhale Dosyasını Besleyen Envanter
- **Öne çıkan özellik:** Kurumsal doküman envanteri **geçerlilik tarihiyle**; ihale evrak listesine
  **otomatik eşleme** kaynağı. → *Süresi geçmiş belge diskalifiye riski önlenir.*

### 4.14 Fiziksel Arşiv — Denetime Hazır Karar Gerekçeleri
- **Öne çıkan özellik:** Kutu/raf arşiv; **kaybedilen fırsat + BoM tedarikçi değerlendirmesi** otomatik,
  değişmez kayıtla arşivlenir. → *"Neden bu kararı verdik?" sorusunun kanıtı hazır.*

### 4.15 Genel Hususlar / Kurumsal Yönetişim
- **Öne çıkan özellik:** Alınan dersler, risk/fırsat (skor = olasılık×etki), KPI, dış doküman kaydı +
  **tenant-yapılandırılabilir özgün doküman kodlama** (üçüncü-taraf notasyonu kullanılmaz).
- **Karar vericiye değer:** *Kurumsal hafıza + risk yönetimi + kalite tek çatıda; ISO/denetim uyumu kolaylaşır.*

### 4.16 Yedekleme — Veri Güvencesi
- **Öne çıkan özellik:** Zamanlanmış/manuel yedek (mantıksal/durum) · hedef **yerel/Nextcloud/S3** ·
  **doğrulama** + kontrollü geri-yükleme (ön-analiz + güvenlik snapshot'ı).
- **Karar vericiye değer:** *Felaket kurtarma ve veri kaybına karşı kurumsal güvence.*

### 4.17 Şirket Ayarları — Koddan Değil Ekrandan Yönetim
- **Öne çıkan özellik:** Şirket profili, **birim & kullanıcı yönetimi**, **iş akışı şablonu (skip-logic)**,
  **yetki (RBAC) düzenleme**, **YZ entegrasyonu** (kendi anahtarın), Nextcloud/e-posta/WhatsApp, abonelik,
  **lisans üretimi & modüller**.
- **Karar vericiye değer:** *Süreç ve yetki değişiklikleri IT projesi değil, ekran ayarı.*

### 4.18 Test Ortamı — Güvenlik · Sanal Agentlar · Denetim İzi (Yalnız GM)
- **Öne çıkan özellik:** OWASP/güvenlik testi; **8 sanal birim-agentı** (boş koltuğu deterministik vekil
  doldurur; **para & hukuk ADVISORY-only**, asla otonom); ActivityLog **denetim izi** (insan/agent köken).
- **Neden→Sonuç:** Kadro boşluğu süreci durdurur; agent boşluğu doldurur ama para/hukukta **son söz insanda**.
- **Karar vericiye değer:** *Eksik kadroyla bile süreç akar; kritik kararlarda otomasyon riski alınmaz.*

**Onay swimlane (kesişen):** OPPORTUNITY/PROPOSAL → FINANCE_MGR → İGPD → GM → KSU; sözleşme imzası → KSU → GM.
Aktif kullanıcısı olmayan rol otomatik atlanır (lisanslı agent varsa agent-onaylı). Hukuk **danışman**;
İGPD/KGD iş geliştirme ve kalite rolüyle swimlane'de.

---

## 5. Sidebar Hızlı Erişim Matrisi (Tek Bakışta)

| Menü | Ne yapar | Erişim | Öne çıkan değer |
|------|----------|--------|-----------------|
| **Dashboard** | Role-bazlı kokpit | DASHBOARD_VIEW | Herkese kendi işi, GM'e tüm tablo |
| **Yönetim Raporları** | Birim metrik + **Büyüme Analitiği** (13 rapor + sağlık skoru) | MANAGEMENT_REPORTS_VIEW | Büyümeyi kök nedeniyle izler |
| **Ziyaret Planı** | Plan↔gerçekleşen mutabakatı | VISIT_PLAN_VIEW | Saha emeği ölçülür |
| **CRM & Müşteri** | Fırsat/teklif/pazarlık + **forward-kur maliyet analizi** | CRM_VIEW | Kur riski baştan nötrlenir |
| **Presales & Dizayn** | Vendor teklif + teknik uygunluk + kanıt | PRESALES_VIEW | Belgeli en-uygun BoM |
| **Satış Destek** | Şartname→evrak + vade hatırlatma + Bid/No-Bid | SALES_SUPPORT_VIEW | Diskalifiye riski sıfır |
| **Sözleşme Yönetimi** | İmza→Proje+Satınalma otomatik devir | CONTRACTS_VIEW | İmza anında iş başlar |
| **Satın Alma** | 9-statü + referans alış fiyatı | PROCUREMENT_VIEW | Pazarlık gücü |
| **Proje Yönetimi** | Milestone + **tam-yüklü marj** + 11-evrak devir | PROJECT_MGMT_VIEW | Gerçek proje kârı |
| **Finans** | Vade & finansman + **işletme maliyeti** + teminat | FINANCE_VIEW | Kuruşuna kadar doğruluk |
| **DMO Kataloğu** | Kârlılık motoru + kârsız-satış alarmı | DMO_VIEW **+ lisans** | Zarar eden satışı yakalar |
| **Görevler & Takip** | Görev + onay swimlane | TODO_VIEW | Hiçbir iş düşmez |
| **Şirket Evrakları** | Geçerlilik-tarihli envanter | DOCUMENTS_VIEW | İhaleye otomatik evrak |
| **Fiziksel Arşiv** | Karar gerekçeleri arşivi | ARCHIVE_VIEW | Denetime hazır |
| **Genel Hususlar** | Dersler/risk/KPI + doküman kodlama | CORPORATE_GOV_VIEW | Kurumsal hafıza |
| **Yedekleme** | Çok-hedefli doğrulamalı yedek | BACKUP_VIEW | Veri güvencesi |
| **Şirket Ayarları** | Birim/kullanıcı/RBAC/iş akışı/lisans | SETTINGS_VIEW | Koddan değil ekrandan |
| **Test Ortamı** (GM) | Güvenlik + 8 agent + denetim izi | GM-only | Boş koltuğu agent doldurur |

---

## 6. Uçtan Uca Akış — Neden-Sonuç Zinciri

```
Ziyaret/CRM ──► Fırsat (satınalma usulü + son teklif tarihi)
   │  neden: usul/vade baştan bilinirse ihale hazırlığı zamanında tetiklenir
   │
   ├─► Satış Destek: şartname analizi → evrak listesi → otomatik eşleme →
   │   vade hatırlatmaları → Bid/No-Bid skoru → Teklif İletildi
   │   [Yönetim çekilme kararı → akış kesilir, birim KPI'sı CEZALANMAZ]
   ▼
Presales BoM ──► Vendor teklif (fiyat + teknik uygunluk + kanıt → en uygun)
   │  sonuç: en ucuz DEĞİL, en uygun+belgeli seçilir → maliyet ve kalite korunur
   ▼
Satış: Maliyet Analizi (forward kur + usul masrafları + marj) → Müdür onayı
   │  sonuç: vade kur riski teklif anında nötrlenir
   ▼
Sözleşme imza ──► Proje (otomatik + milestone) + Satınalma (referans alış fiyatı)
   ▼
Satın Alma (referans fiyatla pazarlık) → PO → teslimat → fatura → Finans
   ▼
Finans: teminat + vade&finansman + İŞLETME MALİYETİ dağıtımı → TAM-YÜKLÜ MARJ
   ▼
Büyüme Analitiği + Sağlık Skorları: tüm zinciri kök nedeniyle değerlendirir
```

**Otomatik geçiş halkaları:** İhale WON→Sözleşme · Sözleşme SIGNED→Proje · Proje→Satınalma ·
Satınalma faturası→Finans · WON Fırsat→Proje · **DMO teslim→SALES fatura→Finans/Analitik.**

---

## 7. Sistem "Nasıl Değerlendirir?" — Karar Motorları

Enflow'un farkı, veriyi **değerlendirmesidir**. Başlıca deterministik karar motorları:

| Motor | Neyi değerlendirir | Nasıl (özet) | Çıktı |
|-------|--------------------|--------------|-------|
| **Maliyet Analizi (forward-kur)** | Teklif marjı | Alış × tahsilat-kuru + usul masrafı + marj | Teklif fiyatı, korunmuş marj |
| **BoM Değerlendirme** | En uygun tedarik | Fiyat + teknik uygunluk + kanıt | Seçili teklif + arşiv |
| **Bid/No-Bid Skorkartı** | İhaleye girme kararı | İdare geçmişi + süre + evrak + değer uyumu | Katıl/İncele/Katılma (0–100) |
| **Finansman Etkisi** | Vade+faiz+döviz etkisi | Taksitli tahsilat + banka faizi (döviz-bazlı) | Net finansman maliyeti/getirisi |
| **İşletme Maliyeti** | Gerçek proje marjı | Havuz % (şirket) + birim katsayısı | Tam-yüklü net marj + absorpsiyon |
| **DMO Kârlılık** | Satış kâr getirir mi | Kur açığı + risturn + komisyon | Net marj + kârsız alarmı |
| **Sağlık Skorları** | İş/Proje/Müşteri sağlığı | Ağırlıklı kompozit + eşik | 0–100 skor + zayıf halka |
| **Konsantrasyon (HHI)** | Portföy riski | Gelir dağılımı + kamu payı | HHI + bağımlılık uyarısı |

**Ortak ilke:** Hepsi **deterministik** (aynı girdi → aynı sonuç), **şeffaf** (formül belli) ve
**tenant-izole**dir. "Kara kutu" değil; her rakamın **nasıl** hesaplandığı gösterilebilir.

---

## 8. Raporlara Nasıl Ulaşılır? — Soru → Rapor Haritası

| Karar vericinin sorusu | Ulaşılan rapor/çıktı | Nerede |
|------------------------|----------------------|--------|
| Fırsatlar nerede tıkanıyor? | Dönüşüm Hunisi + kayıp nedenleri | Büyüme Analitiği |
| Hedefi tutar mıyız? | Ağırlıklı Tahmin & Kapsama | Büyüme Analitiği |
| Bu ihaleye girmeli miyiz? | Bid/No-Bid Skorkartı | Büyüme Analitiği |
| Teklif maliyetini tutturduk mu? | BoM Maliyet Varyansı | Büyüme Analitiği |
| Paramız nerede takılı? | Alacak Yaşlandırma & DSO | Finans / Analitik |
| Tek müşteriye bağımlı mıyız? | Konsantrasyon (HHI) | Büyüme Analitiği |
| İşin genel sağlığı? | İş/Proje/Müşteri Sağlık Skoru | Büyüme Analitiği |
| Bu projenin gerçek marjı? | Tam-Yüklü Net Marj | Proje → Karlılık |
| Birimlerin bütçesi verimli mi? | Birim Bütçe Absorpsiyonu | Analitik / Finans |
| Bu DMO satışı kazandırıyor mu? | DMO Kârlılık + Kanal kartı | DMO / Analitik |
| Birim performansı & darboğaz? | Birim Metrik + Darboğaz + UnitReport | Yönetim Raporları |

Tüm raporlar **canlı** (anlık veriden hesaplanır), **yazdırılabilir** (birim raporları tek+konsolide)
ve **denetlenebilir**dir.

---

## 9. Karar Vericiyi Etkileyecek 10 Fark

1. **"Kaydeden" değil "değerlendiren" sistem** — her adımda karar üretir.
2. **Kâr gerçeği** — direkt marjın yanında **tam-yüklü** ve **finansman-sonrası** marj.
3. **Kur zekâsı** — forward kur + döviz-bazlı finansman; kur farkı zararı baştan önlenir.
4. **Kârsız satış alarmı** — özellikle DMO gibi kanallarda zarar eden işi kabul etmeden yakalar.
5. **Büyüme kök nedeni** — 13 rapor + sağlık skoru; "nereye bakılacağını" söyler.
6. **Diskalifiye önleme** — şartname→evrak eşleme + vade hatırlatma; ihale kaybı riski düşer.
7. **Belgeli tedarik** — fiyat + teknik uygunluk + kanıt; her karar savunulabilir.
8. **Otomatik zincir** — birimler-arası geçiş; "arada düşen iş" biter.
9. **Ekrandan yönetişim** — RBAC + iş akışı kod değiştirmeden; test süitiyle güvence.
10. **Denetlenebilirlik & izolasyon** — her işlem köken-etiketli; çok-kiracılı IDOR testli.

---

## 10. Ölçülebilir Faydalar (Sunumda "ROI" Dili)

- **Kâr koruması:** Forward-kur + tam-yüklü marj + DMO alarmı → *zarar eden/erozyona uğrayan işin
  önlenmesi.*
- **Nakit görünürlüğü:** DSO + alacak yaşlandırma → *geciken tahsilatın erken müdahalesi.*
- **İhale kazanımı:** Bid/No-Bid odaklanması + diskalifiye önleme → *hazırlık kaynağının doğru
  kullanımı, kazanma oranı artışı.*
- **Süreç hızı:** Otomatik geçiş zinciri → *imza-iş başlangıcı gecikmesinin ortadan kalkması.*
- **Yönetişim maliyeti:** Ekrandan RBAC/iş akışı → *IT/danışmanlık bağımlılığının azalması.*
- **Risk azaltımı:** Konsantrasyon (HHI) + denetim izi + yedekleme → *bağımlılık ve veri kaybı riskinin görünür/yönetilir olması.*

---

## 11. Pitch Deck İçin Slayt İskeleti (Öneri)

1. **Kapak** — "Enflow: Fırsattan teslime, tek akış."
2. **Problem** — Parçalı süreç → kaçan iş, eriyen kâr, görünmeyen risk.
3. **Çözüm** — Uçtan uca, otomatik geçişli, **değerlendiren** karar platformu.
4. **Mimari & Güven** — 7 katman + çok-kiracılı izolasyon + denetim izi.
5. **Akış** — Uçtan uca neden-sonuç zinciri (Bölüm 6).
6. **Karar Motorları** — "Sistem nasıl değerlendirir?" (Bölüm 7).
7. **Finansal Zekâ** — Forward kur + finansman etkisi + işletme maliyeti → tam-yüklü marj.
8. **Büyüme Analitiği** — 13 rapor + İş/Proje/Müşteri sağlık skoru.
9. **DMO Kârlılık Motoru** — Kur açığı + risturn + komisyon → kârsız-satış alarmı (modül lisanslama).
10. **Yönetişim & Güvenlik** — 19 rol, ekrandan RBAC, IDOR izolasyonu, yedekleme.
11. **Sanal Agentlar** — Boş koltuğu dolduran 8 deterministik vekil (para/hukuk danışman).
12. **Ölçülebilir Fayda / CTA** — ROI dili + demo + iletişim.

> **Görsel öneri:** Bölüm 2.1, 6, 7 şemaları infografik; Dashboard'un rol-bazlı farkını yan yana
> ekran görüntüsüyle; bir "zarar eden DMO satışı" ve bir "tam-yüklü marj" örneğini before/after olarak göster.

---

## 12. Çalışma Kriterleri & Kısıtlar (Şeffaflık)

- **Çok-kiracılı izolasyon:** Veri `tenantId` ile ayrışır; cross-tenant erişim yok (IDOR testli).
- **Rol kapısı:** Çekilme kararı/faiz/işletme maliyeti havuzu/lisans üretimi yalnız üst yönetim.
- **Para birimi:** Tek-toplam zorlanmaz; eksik döviz bloke (kritik kural).
- **İşletme maliyeti** projeye yalnız yönetim toggle'ı açınca girer (varsayılan kapalı; direkt marj değişmez).
- **DMO** ayrı lisanslı modül (`DMO_MODULE`); lisans yoksa menü gizli + API 402.
- **Para (Finans) & Hukuk agentları** asla otonom değildir (ADVISORY-only).
- **Doküman kodlama** özgün + tenant-yapılandırılabilir (üçüncü-taraf notasyonu yok).
- **Büyüme Analitiği** salt-okunur/deterministik; veri üretmez, her rapor IDOR-testli.
- **Kurulum:** Sihirbaz SQLite (sıfır-bağımlılık) veya PostgreSQL (üretim) seçtirir; Nextcloud/e-posta/S3
  entegrasyonları yapılandırılabilir; lisans imza sırrı (Ed25519) korunur.

---

*Bu döküman kod tabanından (schema.prisma, constants.ts, role-matrix.ts, unitReportingService,
dashboardService, analyticsService, overheadService, dmoCosting, financeEngine ve ilgili route'lar)
türetilmiştir. İlgili derin dokümanlar: `BUYUME_ANALITIGI.md` · `DMO_KATALOG.md` · `ISLETME_MALIYETI.md`.
Sunum/video üretiminde slayt başlıkları, şemalar ve neden-sonuç anlatıları doğrudan kullanılabilir.*
