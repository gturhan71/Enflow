# Enflow — İlk Kurulum ve Yönetici Başlangıç Kılavuzu

> Bu kılavuz, Enflow'u **daha önce hiç kurmamış/kullanmamış** bir kişi için baştan sona
> yazılmıştır: işletim sisteminize göre kurulum → ilk açılış sihirbazı → lisans girişi →
> birim/kullanıcı oluşturma → onay/iş akışı yapılandırma → her birimin günlük kullanımı.
> Tek komutla hızlı kurulum için [`README.md`](README.md) yeterlidir — burada her adım
> **daha ayrıntılı ve açıklamalı** anlatılır. Aynı içerik uygulama içi **Yardım** modülünde
> (Ayarlar makalesi) ve genel tanıtım **Wiki**'sinde (`/wiki`) de özet olarak bulunur.

---

## İçindekiler

1. [Sistem Gereksinimleri](#1-sistem-gereksinimleri)
2. [Kurulum — İşletim Sisteminize Göre](#2-kurulum--i̇şletim-sisteminize-göre)
3. [İlk Açılış — Kurulum Sihirbazı](#3-i̇lk-açılış--kurulum-sihirbazı)
4. [Lisans Girişi](#4-lisans-girişi)
5. [Birim (Unit) Oluşturma](#5-birim-unit-oluşturma)
6. [Kullanıcı Oluşturma ve Yetkilendirme](#6-kullanıcı-oluşturma-ve-yetkilendirme)
7. [İş Akışı (Onay/Devir Şablonu) Oluşturma](#7-iş-akışı-onaydevir-şablonu-oluşturma)
8. [Birim Bazlı Genel Kullanım Kılavuzu](#8-birim-bazlı-genel-kullanım-kılavuzu)
9. [Sonraki Adımlar ve Kaynaklar](#9-sonraki-adımlar-ve-kaynaklar)

---

## 1. Sistem Gereksinimleri

Kurulum senaryonuza göre (deneme/pilot, küçük ölçek SQLite, kurumsal üretim PostgreSQL)
tam donanım/yazılım tablosu: **[`docs/SYSTEM_REQUIREMENTS.md`](../docs/SYSTEM_REQUIREMENTS.md)**.
Özet minimum:

| Bileşen | Minimum |
|---|---|
| Node.js | ≥ 20 LTS (önerilen 22) |
| pnpm | 10.33+ (yoksa kurulum betiği otomatik sağlar) |
| Disk | ≥ 2 GB boş alan |
| RAM | ≥ 4 GB (pilot/küçük ölçek) |
| Backend portu | 3002 (varsayılan) |
| Frontend portu | 3000 (yalnız geliştirme modunda; üretimde backend tek origin sunar) |

Node.js veya git makinenizde yoksa kurulum betiği bunları **kendisi kurar** — önce sistem
paket yöneticisiyle (Windows `winget`, macOS `brew`, Linux `apt`/`dnf`), o da yoksa admin
yetkisi gerektirmeyen taşınabilir bir Node sürümünü `install/.tools/` altına indirerek.

---

## 2. Kurulum — İşletim Sisteminize Göre

Aşağıdaki adımlardan **yalnız kendi işletim sisteminize ait olanı** izleyin.

### 2.1 Windows

**En kolay yol (çoğu kullanıcı için önerilir):**

1. Depoyu indirin (`git clone` veya ZIP olarak indirip açın).
2. `install\install.bat` dosyasına **çift tıklayın**.
3. Açılan pencere Node/git eksikse otomatik kurar, ardından sizden birkaç soru sorar
   (bkz. [§2.4](#24-sihirbaz-hangi-soruları-sorar) — hangi sorular sorulur).
4. Bilgisayar genelinde (tüm kullanıcılar için) kurulum istiyorsanız dosyaya sağ tıklayıp
   **"Yönetici olarak çalıştır"** seçin. Yönetici yetkiniz yoksa endişelenmeyin — betik
   otomatik olarak **taşınabilir moda** düşer ve yine çalışır.

**PowerShell ile elle çalıştırmak isterseniz:**

```powershell
# A) Depo zaten bilgisayarınızdaysa:
Set-ExecutionPolicy -Scope Process Bypass   # yalnız bu oturum için betik çalıştırmaya izin verir
.\install\install.ps1

# B) Sıfırdan (depoyu kendisi indirir):
.\install.ps1 -Dir C:\Enflow
```

> **Sık karşılaşılan hata:** *"bu sistemde betik çalıştırma devre dışı"* — yukarıdaki
> `Set-ExecutionPolicy` satırını çalıştırıp tekrar deneyin. Bu ayar kalıcı değildir, yalnız
> o PowerShell penceresi için geçerlidir.

### 2.2 macOS

Terminal'i açın (Spotlight'tan `Terminal` yazıp Enter) ve:

```bash
# A) Depo zaten elinizdeyse (klasöre girip):
./install/install.sh

# B) Sıfırdan — depoyu kendisi klonlar:
curl -fsSL https://raw.githubusercontent.com/gturhan71/Enflow/main/install/install.sh -o install.sh
bash install.sh --dir ~/Enflow
```

Homebrew kuruluysa Node/git eksikse otomatik `brew` ile kurulur; Homebrew yoksa taşınabilir
Node indirilir (admin şifresi istemez).

> **Gatekeeper uyarısı görürseniz** ("bilinmeyen geliştirici"): betiği çift tıklamak yerine
> yukarıdaki gibi Terminal'den `bash install.sh` ile çalıştırmak bu uyarıyı tetiklemez.

### 2.3 Linux

```bash
# A) Depo zaten elinizdeyse:
./install/install.sh

# B) Sıfırdan:
curl -fsSL https://raw.githubusercontent.com/gturhan71/Enflow/main/install/install.sh -o install.sh
bash install.sh --dir ~/Enflow
```

Dağıtımınıza göre (`apt` — Debian/Ubuntu, `dnf` — Fedora/RHEL) paket yöneticisiyle otomatik
kurulum denenir; hiçbiri yoksa yine taşınabilir Node'a düşer.

### 2.4 Sihirbaz Hangi Soruları Sorar?

Hangi işletim sisteminde olursanız olun, kurulum betiği aynı soruları sırayla sorar:

1. **Backend/frontend portu** — varsayılanları (3002 / 3000) kabul edebilir veya değiştirebilirsiniz.
2. **Beklenen kullanıcı sayısı + yıllık veri hacmi** — bu ikisine göre betik SQLite (küçük
   ölçek) veya PostgreSQL (kurumsal ölçek) önerir; eşik aşılırsa PostgreSQL varsayılan
   öneri olur ama zorunlu değildir.
3. **Veritabanı seçimi** — SQLite (varsayılan, ek kurulum gerektirmez) veya PostgreSQL.
4. **YZ (yapay zekâ) entegrasyonu** — isteğe bağlıdır, atlayıp uygulamadan da (Ayarlar →
   Entegrasyonlar) sonradan girebilirsiniz.

Betik ayrıca `AUTH_JWT_SECRET` ve `DATA_ENCRYPTION_MASTER_KEY` gibi güvenlik anahtarlarını
**sizin için otomatik ve güvenli rastgele üretir** — bunlarla ilgili hiçbir şey girmeniz
gerekmez.

**Etkileşimsiz kurulum** (CI/otomasyon, tüm sorulara varsayılan cevap):
```bash
./install/install.sh --yes
.\install\install.ps1 -Yes
```

### 2.5 Başlatma

Kurulum bittiğinde ekrana başlatma komutlarını yazar:

```bash
# ── ÜRETİM (önerilen) — derlenmiş sürüm, backend tek origin'den hem arayüzü hem API'yi sunar ──
cd backend && pnpm start        # → http://localhost:3002

# ── GELİŞTİRME — canlı kaynak, iki ayrı süreç ──
cd backend && pnpm start        # backend → :3002 (bir terminal)
pnpm dev --port 3000            # frontend → :3000 (ayrı terminal)
```

Üretimde tarayıcıda yalnız `http://localhost:3002` adresine gitmeniz yeterlidir.

### 2.6 Sık Karşılaşılan Sorunlar

| Belirti | Çözüm |
|---|---|
| `Node ... çok eski` | Node 20+ kurun (nvm veya nodejs.org). |
| `pnpm bulunamadı` | `corepack enable` çalıştırın ya da `npm i -g pnpm`. |
| Windows: *"betik çalıştırılamıyor"* | `Set-ExecutionPolicy -Scope Process Bypass` çalıştırıp tekrar deneyin. |
| Port zaten kullanımda | Sihirbazda farklı bir port girin. |
| `git clone` reddedildi | HTTPS URL kullanın (varsayılan zaten budur), SSH anahtarı gerekmez. |
| Migration sonrası backend çöküyor | `cd backend && pnpm prisma generate` çalıştırıp yeniden başlatın. |

---

## 3. İlk Açılış — Kurulum Sihirbazı

Kurulumdan sonra tarayıcıda uygulamayı ilk açtığınızda (veritabanı **boş** olduğu için)
otomatik olarak **5 adımlı bir tanımlama sihirbazı** karşınıza çıkar:

| Adım | Ne istenir |
|---|---|
| 1. Sistem | Backend bağlantısının çalıştığını doğrular (bilgi amaçlı, bir şey girmezsiniz). |
| 2. Şirket | Şirket adınız. |
| 3. Yönetici | İlk yönetici hesabınızın adı, e-postası ve şifresi (≥6 karakter). |
| 4. Lisans | Lisans anahtarınız varsa yapıştırın; yoksa **"Deneme sürümüyle devam et"**i seçin (30 gün). |
| 5. Tamamla | Özet — onaylayınca hesap oluşur ve otomatik giriş yapılır. |

> **Önemli:** Bu adımda oluşturduğunuz ilk kullanıcı otomatik olarak **GENERAL_MANAGER**
> (Genel Müdür) rolüyle oluşur — sistemdeki tüm modüllere ve ayarlara erişimi olan
> "superuser" hesabıdır. Bu kılavuzdaki sonraki tüm adımları (lisans, birim, kullanıcı,
> iş akışı) bu hesapla yapacaksınız.

Deneme süresiyle başladıysanız, süresi dolmadan **§4**'teki adımlarla gerçek bir lisans
girebilirsiniz — mevcut verileriniz kaybolmaz.

---

## 4. Lisans Girişi

Enflow'da **iki ayrı lisans türü** vardır — birbirine karıştırılmamalıdır:

### 4.1 Abonelik / Plan Lisansı (asıl lisans)

Şirketinizin genel plan seviyesini (Starter/Professional/Enterprise) ve kullanıcı/depolama
limitlerini belirler. Girmek için:

1. **Şirket Ayarları → Lisans Planları** sekmesine gidin.
2. Sayfanın üstünde sarı kutuda **"Bu şirketin Tenant ID'si"** görünür — **Kopyala**
   butonuyla kopyalayın.
3. Bu Tenant ID'yi, size lisansı sağlayan tedarikçiye/satıcıya iletin — lisans anahtarınız
   **bu değere bağlı (tenant-bound)** olarak üretilir; şirket adınızla değil bu ID ile eşleşir.
   > ⚠️ Lisans üretiminde şirket adı değil **tam olarak bu Tenant ID** kullanılmalıdır,
   > aksi halde aktivasyon sırasında "bu lisans bu tenant için üretilmemiş" hatası alırsınız.
4. Aldığınız lisans anahtarını aynı ekrandaki kutuya yapıştırıp **"Lisansı Aktifleştir"**e
   tıklayın. Başarılı olursa plan bilgisi ve son geçerlilik tarihi anında güncellenir.

Deneme süresi dolmadan lisans girmezseniz uygulama salt-okunur/kısıtlı moda geçebilir —
zamanında girmeniz önerilir.

### 4.2 Sanal Agent / Eklenti Lisansları (opsiyonel, ayrı)

Sanal agent'lar (Tender, Project, Presales, Procurement, Finance, Legal, CRM, İGB) ve bazı
ek modüller (ör. DMO Kataloğu) **ayrı ayrı lisanslanan eklentilerdir** — abonelik planınızdan
bağımsızdır. Bunları etkinleştirmek için: **Test Ortamı → Sanal Agentlar** ekranındaki
**"Lisans Aktivasyonu"** kutusuna ilgili eklenti anahtarını girin. Bu adım isteğe bağlıdır;
girmezseniz o agent/modül pasif kalır, geri kalan sistem normal çalışır.

---

## 5. Birim (Unit) Oluşturma

Enflow'da işler **birimler arasında** akar (Satış → Presales → Finans → ... → Sözleşme →
Proje gibi) — bu yüzden kullanıcı eklemeden **önce** birimlerin tanımlı olması gerekir.

### 5.1 Hızlı yol (önerilen — çoğu kurulum için yeterli)

**Şirket Ayarları → Birimler** sekmesine gidin ve **"Varsayılan Şablonu Yükle"** butonuna
tıklayın. Bu tek tıkla:

- Onay/iş akışı zincirinde kullanılan **8 standart birim** otomatik oluşturulur (Satış &
  Pazarlama, Teknik Çözümler & Presales, Finans, İGB, Üst Yönetim, KSU, KY, İYB — tam liste
  ve görevleri [§8](#8-birim-bazlı-genel-kullanım-kılavuzu)'de),
- Bu birimlerin kanonik sırasına göre **varsayılan bir onay/iş akışı şablonu** da otomatik
  kurulur (bkz. [§7](#7-iş-akışı-onaydevir-şablonu-oluşturma)).

İşlem **idempotenttir** — zaten var olan birimlere dokunmaz, yalnız eksik olanları ekler;
birden çok kez tıklamak güvenlidir.

### 5.2 Kendi organizasyonunuza göre ek birimler

Yukarıdaki 8 birim yalnız **onay zincirinde** yer alan swimlane birimleridir. Organizasyonunuzda
ayrıca **Proje Yönetimi**, **Satın Alma**, **Hukuk**, **İnsan Kaynakları** gibi başka
fonksiyonel ekipler varsa (ki genelde vardır), bunları da aynı ekrandan elle ekleyin:

1. **"Yeni Birim"** butonuna tıklayın.
2. Birim adı ve açıklaması girin.
3. Gerekiyorsa **üst birim (parentId)** seçerek hiyerarşi kurun (ör. bir alt-ekip için).

Bir birimi silmeden önce sistem, o birime bağlı kullanıcıların **başka bir birime
aktarılmasını** ister — veri kaybı olmaz.

---

## 6. Kullanıcı Oluşturma ve Yetkilendirme

### 6.1 Yeni kullanıcı ekleme

**Şirket Ayarları → Kullanıcılar → "Yeni Kullanıcı"**:

1. Ad, e-posta, **rol** (aşağıdaki 20 rolden biri — bkz. [§8](#8-birim-bazlı-genel-kullanım-kılavuzu))
   ve **birim** seçin.
2. Kaydedin — kullanıcı hemen sisteme giriş yapabilir (varsayılan parola kurulum sırasında
   belirlenen şema ile atanır/sıfırlanabilir; bkz. uygulama içi davranış).

### 6.2 ⚠️ Kritik adım: Yetki (izin) atama

**Yeni oluşturulan bir kullanıcı varsayılan olarak yalnız Dashboard'u görür** — rol seçmek
otomatik olarak modül erişimi vermez, izinler ayrıca ve elle verilmelidir:

1. **Şirket Ayarları → Yetkiler** sekmesine gidin.
2. Kullanıcıyı seçin.
3. Rolüne uygun modülleri açın — her modül grubu tek tıkla topluca açılıp kapanabilir
   (ör. "CRM" grubunu tek switch ile tümüyle açabilirsiniz).
4. Kaydedin.

> **Öneri:** Aynı role sahip birden fazla kullanıcı ekleyecekseniz, ilk kullanıcıda hangi
> izinleri açtığınızı not edin (ekran görüntüsü alın) — sistemde "rolden şablon kopyala"
> otomasyonu yoktur, her kullanıcı için elle tekrarlanır.

### 6.3 Rol ↔ birim eşlemesi

Bir kullanıcının hangi role sahip olduğu **onay zincirinde sırası geldiğinde işlem
yapabilmesini**, hangi **birime** atandığı ise görev/devir yönlendirmesini belirler. Bir
birimin **yöneticisi (managerId)** olmayan roller için o aşama otomatik atlanır (orphan-skip)
— yani örneğin KSU biriminde henüz kimse yoksa, onay zinciri KSU adımını atlayıp bir sonrakine
geçer, süreç kilitlenmez.

---

## 7. İş Akışı (Onay/Devir Şablonu) Oluşturma

İş akışını **sıfırdan elle kurmanız gerekmez** — sistem, tenant'ınızın **aktif birimlerinden**
kanonik sıraya göre otomatik bir varsayılan şablon üretir (birimleri §5'te oluşturduğunuzda
veya "Varsayılan Şablonu Yükle" ile birlikte). Yapmanız gereken, bu şablonu **gözden geçirip
ince ayar yapmaktır**:

1. **Şirket Ayarları → İş Akışı** sekmesine gidin — varsayılan şablon otomatik yüklenmiş
   gelir.
2. **Builder** sekmesinde her adımı (birim) görürsünüz; bir adımı devre dışı bırakabilir
   veya "tamamlanması zorunlu" olarak işaretleyebilirsiniz.
3. **Simülasyon** sekmesinde gerçek şablonunuzun adımlarını canlandırarak (oynat/duraklat)
   bir işin birimler arasında nasıl aktığını görsel olarak test edebilirsiniz — bu bir
   deneme alanıdır, kalıcı veri değiştirmez.
4. Bir birimi sonradan sildiğinizde veya eklediğinizde şablon **otomatik güncellenir**
   (skip-logic) — elle senkronize etmeniz gerekmez.

Ayrıca çok-aşamalı **onay zinciri** (Finans → İGB → GM → KSU sırasıyla, tutar eşiği
tanımlıysa tutara göre de değişebilir) bu iş akışından ayrı ama onunla uyumlu çalışan ikinci
bir katmandır — kullanıcılar "Görevler & Takip → Bekleyen Onaylarım" sekmesinden sırası
gelen onayları görür.

---

## 8. Birim Bazlı Genel Kullanım Kılavuzu

Aşağıdaki tablo, **"Varsayılan Şablonu Yükle"** ile oluşan 8 birimin ve tipik olarak eklenen
ek birimlerin kimler tarafından, hangi modüllerle, günlük olarak nasıl kullanıldığını özetler.
Her modülün ekran-bazlı ayrıntılı kullanımı için uygulama içi **Yardım** (Header'daki Yardım
ikonu) her zaman güncel referanstır.

### 8.1 Onay zincirindeki 8 varsayılan birim

| Birim | Tipik roller | Ana modüller | Günlük iş özeti |
|---|---|---|---|
| **Satış & Pazarlama** | Satış Müdürü, Satış Temsilcisi, Satış Destek | Ziyaret Planı, CRM, Satış Destek (İhale) | Haftalık ziyaret planlar, fırsat açar/ilerletir, teklif hazırlar, kamu ihalelerinde şartname/evrak takibi yapar. |
| **Teknik Çözümler & Presales** | Presales Müdürü, Presales Mühendisi, Teknik Uzman | Presales & Dizayn | Fırsata karşılık gelen malzeme listesini (BoM) hazırlar, şartnameyi YZ ile analiz ettirir, tedarikçi tekliflerini fiyat/teknik uygunluğa göre karşılaştırır. |
| **Finans** | Finans Müdürü | Finans | Fatura keser, tahsilat/ödeme kaydeder, teminat mektubu sürelerini izler, maliyet onay taleplerini değerlendirir — onay zincirinde **ilk** sıradadır. |
| **İGB — İş Geliştirme Birimi** | İGB Yöneticisi | Yönetim Raporları, Onay Zinciri | Fırsatların beklenen değerini (BD) analiz eder, onay zincirinde Finans'tan sonraki sıradadır. |
| **Üst Yönetim (GMÜ)** | Genel Müdür | Tüm modüller (superuser) | Nihai onayları verir (onay zincirinde 3. sıra), sistem genelinde ayarları ve raporları yönetir. |
| **KSU — Kontrat & Sözleşme Uzmanlığı** | KSU | Sözleşme Yönetimi | Sözleşme evraklarının eksiksizliğini kontrol eder, imza onay sürecini yürütür — onay zincirinde son sıradadır. |
| **KY — Kalite Yönetimi** | KY Yöneticisi | Genel Hususlar, Yönetim Raporları | Alınan dersleri, risk/fırsat kayıtlarını ve kurumsal KPI'ları takip eder. |
| **İYB — İhale Yönetim Birimi** | İYB Yöneticisi | Satış Destek (İhale) | İhale dosyalarını, uygunluk checklist'ini ve teminat mektuplarını takip eder. |

### 8.2 Sık eklenen diğer birimler (varsayılan şablonda yok — ihtiyaca göre siz eklersiniz)

| Birim | Tipik roller | Ana modüller | Günlük iş özeti |
|---|---|---|---|
| **Proje Yönetimi** | Proje Yöneticisi | Proje Yönetimi | Milestone/aşama takibi, gerçekleşen maliyet girişi, planlanan/gerçekleşen kârlılık karşılaştırması, teslimde 11 zorunlu devir evrakı. |
| **Satın Alma** | Satın Alma Müdürü | Satınalma | Satın alma talebi açar, tedarikçi teklifi toplar, sipariş/teslimat/fatura sürecini 9 statü üzerinden yürütür. |
| **Hukuk** | Hukuk Müdürü | Sözleşme Yönetimi (Hukuk görünümü) | Hukuki vaka takibi yapar — sistemde yalnız **danışman (advisory)** niteliğindedir, otonom işlem yapmaz. |
| **Teknik Servis** | (Proje ekibiyle paylaşılabilir) | Garanti & Servis | Teslim sonrası servis/arıza taleplerini kaydeder, çözer, kapatır. |
| **İdari** | (ayrı rol gerekmez) | Şirket Evrakları, Fiziksel Arşiv | Kurumsal doküman ve fiziksel arşiv kayıtlarını tutar. |
| **Yedekleme** | Yedek Yöneticisi (BACKUP_ADMIN) | Yedekleme | Sistem yedeği alır/doğrular/geri yükler — geri kalan tüm modüllere yalnız salt-okunur erişimi vardır. |

### 8.3 Tüm roller (referans)

`Sistem Yöneticisi`, `Genel Müdür`, `Satış Müdürü`, `Satış Temsilcisi`, `Satış Destek`,
`Presales Müdürü`, `Presales Mühendisi`, `Teknik Uzman`, `Proje Yöneticisi`,
`Operasyon Müdürü`, `Satın Alma Müdürü`, `Finans Müdürü`, `İnsan Kaynakları Müdürü`,
`Denetçi / Auditor`, `İGB Yöneticisi`, `KY Yöneticisi`, `KSU`, `İYB Yöneticisi`,
`Hukuk Müdürü / Şirket Avukatı`, `Yedek Yöneticisi` — toplam **20 rol**. Bir kullanıcıya
hangi rolün verileceğine karar verirken, o kişinin organizasyondaki gerçek görevine en yakın
rolü seçmeniz yeterlidir; ince ayar her zaman **Yetkiler** sekmesinden yapılır ([§6.2](#62-️-kritik-adım-yetki-i̇zin-atama)).

---

## 9. Sonraki Adımlar ve Kaynaklar

- **Uygulama içi Yardım** (Header'daki ❓ ikonu) — o an baktığınız ekranın "nasıl kullanılır"
  kılavuzunu gösterir, rol bazlı ve arama yapılabilir.
- **Wiki** (`/wiki` veya Yardım ekranındaki "Enflow'u Sıfırdan Öğren" bağlantısı) — yazılımı
  hiç bilmeyen biri için uçtan uca akış anlatımı.
- **[`docs/EULA.md`](../docs/EULA.md)** — lisans/kullanım koşulları.
- **[`docs/SYSTEM_REQUIREMENTS.md`](../docs/SYSTEM_REQUIREMENTS.md)** — kurulum senaryosuna
  göre tam donanım/yazılım gereksinimleri.
- **[`docs/LICENSING_ARCHITECTURE.md`](../docs/LICENSING_ARCHITECTURE.md)** — lisanslama
  mimarisinin teknik detayı (vendor imzalama, aktivasyon doğrulama).
- **[`POSTGRES_MIGRATION_PLAN.md`](POSTGRES_MIGRATION_PLAN.md)** — sonradan SQLite'tan
  PostgreSQL'e geçmek isterseniz.

---

*Bu kılavuz Enflow kurulum paketiyle birlikte dağıtılır. İçerik değişikliği gerektiğinde önce
bu dosya, ardından `walkthrough.md §27` (Wiki kaynağı) ve `src/content/helpArticles.ts`
(uygulama içi Yardım) güncellenmelidir — üçü aynı bilgiyi farklı derinlikte anlatır.*
