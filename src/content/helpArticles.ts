// Uygulama-içi Yardım modülünün içerik kaynağı.
// Her makale, NAV_ITEMS'teki bir üst-seviye modül id'siyle eşleşir (başlık/ikon
// NAV_ITEMS'ten alınır, burada tekrarlanmaz — tek doğruluk kaynağı orada kalır).
// Dil: son-kullanıcıya yönelik, sade Türkçe — walkthrough.md/CLAUDE.md'nin
// geliştirici diliyle KARIŞTIRILMAMALI (orada denetim/curl/migration detayı var,
// burada yalnız "nasıl kullanırım" var).

export interface HelpArticleSection {
  heading: string;
  body: string;
}

export interface HelpArticle {
  moduleId: string;
  summary: string;
  audience: string;
  sections: HelpArticleSection[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    moduleId: 'dashboard',
    summary: 'Rolünüze göre kişiselleştirilmiş özet ekranı — o an dikkat etmeniz gereken işleri, zamana duyarlı uyarıları ve genel KPI\'ları tek bakışta gösterir.',
    audience: 'Herkes — içerik role göre otomatik değişir.',
    sections: [
      { heading: 'Ne görürsünüz', body: 'Üstte rolünüze özel "Kokpit" kartları (ör. Satış Müdürü için bekleyen maliyet onayları, Finans için teminat/fatura vadeleri). Yöneticiler için ayrıca 4 KPI kartı (Pipeline, Kazanılan, Aktif Proje, Kaybedilen), gelen birim raporları, satış boru hattı grafiği ve aktif projeler listesi.' },
      { heading: 'Nasıl kullanılır', body: 'Herhangi bir kart üzerine tıklamak sizi ilgili modüle götürür (ör. "Bekleyen Maliyet Onayı" kartı Maliyet Analizi ekranına açılır). Dashboard salt-görüntüleme amaçlıdır; işlem yapmak için ilgili modüle geçmeniz gerekir.' },
    ],
  },
  {
    moduleId: 'visit-plan',
    summary: 'Haftalık müşteri ziyaret planlaması ve saha ekiplerinin günlük ziyaret raporları.',
    audience: 'Satış temsilcileri ve saha ekipleri.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Bir haftalık dönem için hangi müşterilerin ziyaret edileceğini önceden planlarsınız; ziyaret sonrası "Günlük Rapor" ile ne konuşulduğunu, sonucu ve varsa yeni fırsatı kayda geçirirsiniz.' },
      { heading: 'Nasıl kullanılır', body: '1) "Yeni Plan" ile haftayı seçip planlanan ziyaretleri (müşteri + tarih) ekleyin. 2) Ziyaret gerçekleştikten sonra o satırdan "Günlük Rapor" doldurun — plan ile gerçekleşen otomatik eşleştirilir, plansız/ani ziyaretler de ayrıca eklenebilir. 3) Rapor girildikçe yöneticiniz plan↔gerçekleşen mutabakatını Yönetim Raporları\'ndan izleyebilir.' },
    ],
  },
  {
    moduleId: 'crm',
    summary: 'Müşteri kayıtları, satış fırsatları, teklifler ve pazarlık süreçlerinin yönetildiği ana satış modülü.',
    audience: 'Satış ekibi ve yöneticileri.',
    sections: [
      { heading: 'Alt sekmeler', body: '**Genel Bakış** (özet), **Müşteriler** (firma/kişi kayıtları), **Fırsatlar** (satış fırsatı kartları — durum: Yeni→İletişimde→Nitelikli→Teklif→Pazarlık→Kazanıldı/Kaybedildi), **Maliyet Analizi** (BoM üzerinden marj hesabı, müdür onayına gönderim), **Teklifler** (versiyonlu teklif belgeleri), **Canlı Pazarlıklar** (aktif müzakere turları).' },
      { heading: 'Bir fırsatı baştan sona götürmek', body: '1) Önce **Müşteriler**\'de firma yoksa ekleyin. 2) **Fırsatlar**\'da "Yeni Fırsat" ile müşteri + tahmini değeri girin. 3) Fırsat olgunlaştıkça **Maliyet Analizi**\'nde BoM/marj hazırlayın (bu adım aslında Presales ile birlikte yürütülür). 4) **Teklifler**\'de teklif belgesi oluşturup onaya gönderin. 5) Müşteriyle pazarlık varsa **Canlı Pazarlıklar**\'da turları kaydedin. 6) Fırsat kazanılınca durumunu "Kazanıldı" yapın — bu, Sözleşme Yönetimi\'ne otomatik geçişin tetikleyicisidir.' },
      { heading: 'Kaybedilen fırsatlar', body: 'Bir fırsat kaybedilirse durumunu "Kaybedildi" yapıp bir kayıp nedeni seçin — bu bilgi Yönetim Raporları\'nda analiz edilir, silinmez, arşivlenir.' },
    ],
  },
  {
    moduleId: 'presales',
    summary: 'Teklife konu olacak malzeme listesinin (BoM) hazırlanması ve tedarikçi tekliflerinin fiyat/teknik uygunluk açısından karşılaştırılması.',
    audience: 'Presales mühendisleri ve teknik uzmanlar.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Bir fırsata karşılık gelecek ürün/hizmet listesini (BoM — Bill of Materials) hazırlar, gerekiyorsa şartname belgesini yapay zekâ ile analiz ettirip otomatik ürün önerisi alır, birden fazla tedarikçi teklifini fiyat + teknik uygunluk + dosya kanıtına göre karşılaştırırsınız.' },
      { heading: 'Nasıl kullanılır', body: '1) İlgili fırsatı seçin, BoM satırlarını (ürün, miktar, birim maliyet) ekleyin — şartname dosyanız varsa "Şartnameden Çıkar" ile otomatik taslak alabilirsiniz. 2) Aynı kalem için birden fazla tedarikçi teklifi girildiyse karşılaştırma görünümünden en uygun olanı işaretleyin. 3) BoM tamamlandığında "Satışa Devret" ile CRM\'deki Maliyet Analizi\'ne aktarın — bundan sonrası Satış ekibinin elinde.' },
    ],
  },
  {
    moduleId: 'sales-support',
    summary: 'Kamu ihalelerinde şartname analizi, uygunluk kontrol listesi ve teminat takibi.',
    audience: 'Satış Destek ve İSAB (İhale Satın Alma Birimi) ekibi.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Bir ihale dosyası açtığınızda idari şartname otomatik olarak analiz edilir ve size gerekli evrakların bir kontrol listesi (checklist) hâlinde çıkarılır; her evrağın durumu (bekliyor/yüklendi/onaylandı) takip edilir. Geçici teminat mektubu bilgisi de burada tutulur.' },
      { heading: 'Nasıl kullanılır', body: '1) "Yeni İhale" ile İKN (İhale Kayıt Numarası) ve temel bilgileri girin. 2) Şartname dosyasını yükleyip analiz ettirin — sistem otomatik bir evrak listesi oluşturur. 3) Her evrağı hazırladıkça sırayla yükleyin; termine yaklaşan ihaleler için zaman-duyarlı hatırlatmalar Dashboard\'da görünür. 4) İhale kazanılırsa (WON) durumunu güncelleyin — bu, Sözleşme Yönetimi\'nde otomatik bir kayıt açar.' },
    ],
  },
  {
    moduleId: 'contract-workflow',
    summary: 'Kazanılan işin sözleşme evraklarının hazırlanması, imza onayı ve Proje Yönetimi\'ne resmî devri.',
    audience: 'KSU (Kontrat & Sözleşme Uzmanı) ve yönetim onaycıları.',
    sections: [
      { heading: 'Durum akışı', body: 'Taslak → Analiz Tamamlandı → Hazırlık → İmzaya Hazır (tüm zorunlu evraklar tamamlanınca otomatik) → İmza Onayında → İmzalandı → Aktarıldı (Proje Yönetimi\'ne otomatik).' },
      { heading: 'Nasıl kullanılır', body: '1) **Bağlam** sekmesinde ihale/teklif bilgisi otomatik dolar. 2) **Analiz** sekmesinde sözleşme metnini yükleyip yapay zekâ analiziyle bir evrak listesi çıkarın (yapay zekâ yapılandırılmamışsa otomatik bir örnek liste gelir). 3) **Evrak Takibi**\'nde her evrağı sırayla yükleyin — hepsi tamamlanınca durum otomatik "İmzaya Hazır"a geçer. 4) **İmzalama** sekmesinde "Onayla & Aktar" ile imza onayına gönderin; yönetici onayından sonra sözleşme "İmzalandı" olur ve **Proje Aktarımı** sekmesi otomatik olarak Proje Yönetimi\'nde bir proje kaydı ve görev listesi oluşturur.' },
    ],
  },
  {
    moduleId: 'project-mgmt',
    summary: 'İmzalanan bir işin milestone (aşama), maliyet ve karlılık takibiyle uygulamaya alınması.',
    audience: 'Proje yöneticileri.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Sözleşme imzalanan bir iş buraya otomatik proje olarak düşer; proje tipine göre (Donanım/Yazılım/Hizmet/Karma) standart aşama (milestone) şablonu otomatik oluşur. Gerçekleşen maliyetleri girdikçe planlanan/gerçekleşen kârlılık karşılaştırması güncellenir.' },
      { heading: 'Nasıl kullanılır', body: '1) Proje otomatik oluşmadıysa "Yeni Proje" ile bir kazanılmış fırsat seçin, form otomatik dolar. 2) Milestone\'ları ilerledikçe durumlarını güncelleyin (bir milestone tamamlanınca proje aşaması otomatik ilerler). 3) Maliyet kalemleri sekmesinden gerçekleşen giderleri girin — plan/gerçek marj karşılaştırması anında güncellenir. 4) Proje tesliminde "Devir Paketi"nde 11 zorunlu evrağı (kabul tutanağı vb.) tamamlayın.' },
    ],
  },
  {
    moduleId: 'procurement',
    summary: 'Malzeme/hizmet satın alma talebinden tedarikçi seçimine, sipariş emrine ve faturaya kadar 9 statülü satın alma süreci.',
    audience: 'Satın Alma ekibi.',
    sections: [
      { heading: 'Durum akışı', body: 'Taslak → Birim Onayında → Satın Alma Onayında → GM Onayında → Sipariş Verildi → Teslimatta → Faturalandı → Kapandı (herhangi aşamada Reddedildi de olabilir).' },
      { heading: 'Nasıl kullanılır', body: '1) BoM\'dan gelen bir kalem için "Yeni Talep" oluşturun. 2) Birden fazla tedarikçiden teklif toplayıp karşılaştırın, en uygununu "Seç" ile işaretleyin. 3) Onay adımlarından geçtikten sonra sipariş verilir; teslimat geldikçe kısmi/tam teslimat kaydı girin. 4) Fatura bilgisini girin — bu otomatik olarak Finans modülünde bir gider faturası oluşturur; süreç "Kapandı" ile biter.' },
    ],
  },
  {
    moduleId: 'service-tickets',
    summary: 'Teslim edilmiş bir proje/ürün için gelen servis talebi veya arıza kaydının açılıp kapatılması.',
    audience: 'Proje ekibi ve teknik servis.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Müşteriden gelen bir servis/arıza talebini ilgili projeyle ilişkilendirerek kaydeder, çözüm sürecini ve kapanışını takip edersiniz — garanti kapsamındaki işler için tek referans noktasıdır.' },
      { heading: 'Nasıl kullanılır', body: '1) "Yeni Talep" ile ilgili projeyi/müşteriyi seçip talebi tanımlayın. 2) Talebi işleme alırken durumunu güncelleyin, çözüm notlarını ekleyin. 3) Sorun giderildiğinde talebi kapatın — geçmiş kayıtlar müşteri bazında filtrelenebilir, tekrarlayan arızaları görmek için kullanışlıdır.' },
    ],
  },
  {
    moduleId: 'finance',
    summary: 'Fatura kesme, tahsilat takibi, teminat mektupları, maliyet onayları ve finansal özet.',
    audience: 'Finans ekibi ve yöneticiler.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Satış (SALES) ve satın alma (PURCHASE) faturalarını, bunlara karşı yapılan (kısmi olabilen) tahsilatları/ödemeleri, teminat mektuplarının süre takibini ve maliyet onay taleplerini tek yerden yönetirsiniz. Döviz cinsinden faturalarda kur farkı otomatik hesaplanır.' },
      { heading: 'Nasıl kullanılır', body: '1) **Faturalar** sekmesinde yeni fatura oluşturun veya otomatik gelenleri (satın alma/DMO kaynaklı) görüntüleyin. 2) Bir faturaya tahsilat/ödeme kaydı eklerken kısmi ödeme girebilirsiniz — kalan bakiye otomatik güncellenir. 3) **Teminatlar** sekmesinde mektup bilgisi + süre takibi yapın; süresi yaklaşanlar için hatırlatma Dashboard\'da görünür. 4) **Maliyet Onayları**\'nda bekleyen talepleri onaylayın/reddedin.' },
    ],
  },
  {
    moduleId: 'dmo',
    summary: 'Devlet Malzeme Ofisi (DMO) tipi sipariş akışı ve kendi kur+risturn+komisyon kârlılık motoru — ana satış hattından bağımsız, paralel bir kanal.',
    audience: 'Bu kanalı kullanan satış/finans ekibi (ayrıca lisanslı bir modüldür).',
    sections: [
      { heading: 'Ne işe yarar', body: 'DMO üzerinden alınan siparişleri, katalog fiyatlarını, çerçeve anlaşmalarını ve döviz kurlarını kaydeder; her sipariş için kur farkı + risturn (iskonto dilimi) + komisyon hesabıyla net kârlılığı otomatik çıkarır — kârsız çıkan siparişler uyarı verir.' },
      { heading: 'Nasıl kullanılır', body: '1) **Katalog** sekmesinde ürün/fiyat tanımlarını, **Anlaşmalar**\'da çerçeve sözleşmeleri, **Kurlar**\'da güncel döviz kurlarını girin. 2) **Siparişler**\'de yeni sipariş açıp kalemleri ekleyin — kârlılık hesabı otomatik güncellenir; kâr eşiğinin altına düşerse ekran uyarır. 3) **Mutabakat** sekmesinde dönemsel ciro/risturn takibini yapın.' },
    ],
  },
  {
    moduleId: 'todo',
    summary: 'Birimler arası akan görevlerin ve "sıranızı bekleyen" onayların toplandığı ortak havuz.',
    audience: 'Tüm birimler.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Sistemde bir birimden diğerine devredilen her iş burada bir görev olarak belirir (ör. sözleşme imzası sonrası proje ekibine düşen görevler). İş günü bazlı SLA\'ya göre termin otomatik hesaplanır.' },
      { heading: 'Nasıl kullanılır', body: '1) Size atanan görevleri listeden görüp durumunu (bekliyor/tamamlandı) güncelleyin. 2) **"Bekleyen Onaylarım"** sekmesi, çok-aşamalı onay zincirinde (Finans→İGPD→GM→KSU) sıranın size geldiği kayıtları gösterir — buradan onaylayın veya reddedin, aktif kullanıcısı olmayan roller otomatik atlanır. 3) Görev başlığına tıklamak sizi ilgili modüldeki kayda götürür.' },
    ],
  },
  {
    moduleId: 'management-reports',
    summary: 'Birim bazlı performans metrikleri, süreç darboğazları ve dönemsel birim raporları.',
    audience: 'GM ve birim müdürleri.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Her birimin ne kadar görev tamamladığını, nerede iş biriktiğini (darboğaz) ve dönemsel olarak birimlerin kendi hazırladığı raporları tek ekranda görürsünüz; önceki dönemle karşılaştırma (▲/▼) otomatik hesaplanır.' },
      { heading: 'Nasıl kullanılır', body: '1) Üst sekmelerden birim metriklerini, darboğaz analizini veya gelen birim raporlarını seçin. 2) Bir birim müdürüyseniz kendi biriminiz için dönemsel rapor gönderebilir, üstünüz onayına sunabilirsiniz. 3) Raporları tek tek veya konsolide olarak yazdırabilirsiniz.' },
    ],
  },
  {
    moduleId: 'corporate-governance',
    summary: 'Alınan dersler, risk/fırsat kayıtları, kurumsal KPI\'lar ve dış doküman sicili — kurumsal hafıza katmanı.',
    audience: 'Kalite ve yönetim ekibi.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Bir projeden/işten çıkarılan dersleri, tespit edilen riskleri (olasılık × etki = skor ile önceliklendirilir), izlenen kurumsal performans göstergelerini ve dış kaynaklı (müşteri/tedarikçi) dokümanların kaydını tutarsınız — hepsi tenant\'ınızın doküman numaralandırma kuralına göre otomatik numaralanır.' },
      { heading: 'Nasıl kullanılır', body: 'Üst sekmelerden ilgili kategoriyi seçip "Yeni Kayıt" ile ekleyin. Risk kaydında olasılık ve etki değerini (1-5) girdiğinizde skor otomatik hesaplanır ve renk kodlanır (kırmızı=yüksek).' },
    ],
  },
  {
    moduleId: 'documents',
    summary: 'Şirketin resmî/kurumsal dokümanlarının (politika, prosedür, sertifika vb.) geçerlilik tarihli envanteri.',
    audience: 'İdari ekip.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Kurumsal dokümanları kategori ve geçerlilik tarihiyle kayıt altına alır, süresi dolan/dolmak üzere olan dokümanları takip edersiniz.' },
      { heading: 'Nasıl kullanılır', body: '"Yeni Doküman" ile dosyayı yükleyip kategori + geçerlilik tarihi girin. Listeyi kategoriye göre filtreleyebilirsiniz.' },
    ],
  },
  {
    moduleId: 'archive',
    summary: 'Fiziksel kutu/raf arşivinin dijital lokasyon kaydı.',
    audience: 'İdari ekip.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Fiziksel olarak saklanan sözleşme/fatura/evrak kutularının hangi rafta, hangi kutuda olduğunu dijital olarak kaydeder, arama ile hızlıca bulmanızı sağlar. Kaybedilen fırsatlar ve tamamlanan BoM değerlendirmeleri de otomatik olarak arşive düşer.' },
      { heading: 'Nasıl kullanılır', body: 'Üstteki arama kutusundan kutu no, raf no veya etikete göre arayın. "Yeni Kayıt" ile fiziksel bir kutunun içeriğini ve konumunu tanımlayın.' },
    ],
  },
  {
    moduleId: 'backup',
    summary: 'Sistem yedeklerinin alınması, doğrulanması ve gerektiğinde geri yüklenmesi.',
    audience: 'Yedek Yöneticisi (Backup Admin) — sisteme salt-okunur erişimi olan, yalnız yedekleme/geri yükleme yapabilen özel bir rol.',
    sections: [
      { heading: 'Ne işe yarar', body: 'Veritabanının tamamının (yerel diskte, Nextcloud veya S3 üzerinde) yedeğini alır, yedeğin bozuk olmadığını doğrular ve gerekirse fark analiziyle geri yükleme yapabilirsiniz. Zamanlanmış otomatik yedekleme de kurulabilir.' },
      { heading: 'Nasıl kullanılır', body: '1) "Yedek Al" ile manuel bir yedek oluşturun veya zamanlama ayarlayın. 2) Alınan yedeği "Doğrula" ile kontrol edin. 3) Geri yükleme gerekiyorsa "Analiz Et" önce mevcut veriyle farkları gösterir, onayladıktan sonra geri yükleme başlar — bu geri alınamaz bir işlemdir, dikkatli olun.' },
    ],
  },
  {
    moduleId: 'settings',
    summary: 'Şirket profili, birimler, kullanıcılar, yetkiler, entegrasyonlar, abonelik ve lisans yönetimi.',
    audience: 'Sistem yöneticisi ve GM.',
    sections: [
      { heading: 'Alt sekmeler', body: 'Şirket Profili, Birimler, Kullanıcılar, İş Akışı (onay/geçiş şablonu), Yetkiler (rol bazlı izin matrisi), Entegrasyonlar (yapay zekâ sağlayıcısı, Nextcloud, Exchange, WhatsApp), Abonelik & Kullanım, Lisans Planları, Modüller.' },
      { heading: 'Nasıl kullanılır', body: 'Yeni bir kullanıcı eklerken önce **Birimler**\'de birimin var olduğundan emin olun, ardından **Kullanıcılar**\'da ekleyip rolünü atayın — rol, hangi menüleri göreceğini otomatik belirler; ince ayar gerekiyorsa **Yetkiler**\'den bireysel izin ekleyip çıkarabilirsiniz. Yapay zekâ destekli analizleri (şartname/sözleşme) kullanmak için **Entegrasyonlar**\'da kendi sağlayıcı bilginizi (adres/anahtar/model) girmeniz gerekir — girilmezse sistem otomatik bir örnek/mock sonuçla çalışır.' },
    ],
  },
];

export const getHelpArticle = (moduleId: string): HelpArticle | undefined =>
  HELP_ARTICLES.find((a) => a.moduleId === moduleId);
