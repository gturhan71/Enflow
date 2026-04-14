# Kapsamlı Kurumsal Yönetim ve ERP Sistemi

Bu proje, bir işletmenin satış fırsatından başlayarak proje teslimine kadar olan tüm operasyonel süreçlerini tek bir platform üzerinden yönetmesini sağlayan kapsamlı bir Kurumsal Kaynak Planlama (ERP) ve Müşteri İlişkileri Yönetimi (CRM) uygulamasıdır.

## 🔄 Temel İş Akışı (Workflow)

Sistem, bir projenin uçtan uca yaşam döngüsünü aşağıdaki akışla yönetir:

1. **Fırsatın Doğması (CRM):** Satış ekibi yeni bir müşteri ve fırsat kaydı oluşturur.
2. **Teknik Analiz (Presales):** Fırsat için teknik gereksinimler belirlenir ve Malzeme Listesi (BoM) oluşturulur.
3. **Maliyetlendirme ve Teklif (Satış Destek):** Teknik liste maliyetlendirilir, kar marjı eklenir ve müşteriye teklif sunulur.
4. **Sözleşme Aşaması:** Teklif onaylanıp fırsat "Kazanıldı" durumuna geçtiğinde, sistem otomatik olarak projeyi Sözleşme modülüne aktarır. Gerekli evraklar ve teminatlar toplanır.
5. **Tedarik ve Operasyon (Satın Alma & Proje Yönetimi):** Sözleşme imzalandıktan sonra donanım/yazılım siparişleri verilir (Satın Alma) ve saha kurulum görevleri Kanban panosunda yönetilir (Proje Yönetimi).
6. **Sürekli Takip (Görevler):** Tüm bu aşamalar boyunca birimler birbirlerine iş emirleri atar ve ilerlemeleri anlık olarak takip eder.

## 🌟 Modüller ve Son Kullanıcı Kontrolleri

Son kullanıcılar (satış temsilcileri, yöneticiler, mühendisler vb.), yetkileri dahilinde aşağıdaki modülleri kullanarak süreçleri kontrol edebilir:

*   **📊 Dashboard:** 
    *   *Kullanıcı ne yapabilir?* Şirketin genel durumunu, aktif projeleri, bekleyen görevleri ve finansal özetleri tek ekranda görüntüleyebilir.
*   **🤝 CRM & Fırsat Yönetimi:** 
    *   *Kullanıcı ne yapabilir?* Yeni müşteri ekleyebilir, fırsatların (opportunity) durumunu (Yeni, Teklif, Kazanıldı vb.) güncelleyebilir, fırsatlara özel iş emirleri oluşturabilir ve müşteri iletişim bilgilerini yönetebilir.
*   **💡 Presales (Akıllı İçe Aktarım):** 
    *   *Kullanıcı ne yapabilir?* Müşteri gereksinimlerini sisteme girebilir, Excel veya manuel olarak BoM (Malzeme Listesi) oluşturabilir ve onay süreçlerini yönetebilir.
*   **📝 Satış Destek:** 
    *   *Kullanıcı ne yapabilir?* Ürünlerin alış maliyetlerini girebilir, kar marjı belirleyerek satış fiyatlarını hesaplayabilir ve teklif hazırlayabilir.
*   **🛒 Satın Alma & Tedarik Zinciri:** 
    *   *Kullanıcı ne yapabilir?* Proje ihtiyaçları için tedarikçilere sipariş geçebilir, ETA (Tahmini Varış Zamanı) güncelleyebilir, depo girişlerini kaydedebilir ve satın alma iş emirlerini yönetebilir.
*   **📑 Evrak Havuzu:** 
    *   *Kullanıcı ne yapabilir?* Şirketin ISO belgeleri, imza sirküleri gibi kurumsal evraklarını sisteme yükleyebilir, geçerlilik tarihlerini takip edebilir ve fiziksel arşiv konumlarını (Örn: Dolap A / Klasör 1) güncelleyebilir.
*   **💰 Maliyet Analizi:** 
    *   *Kullanıcı ne yapabilir?* Projelerin karlılık durumlarını, öngörülen ve gerçekleşen maliyetlerini grafikler üzerinden analiz edebilir.
*   **✍️ Sözleşme Yönetimi:** 
    *   *Kullanıcı ne yapabilir?* Sözleşme taslaklarını yükleyebilir, teminat tutarlarını/tarihlerini girebilir, eksik evrakları talep edebilir ve sözleşmeyi imzalayarak projeyi başlatabilir.
*   **🚀 Proje Yönetimi:** 
    *   *Kullanıcı ne yapabilir?* Proje görevlerini Kanban panosu (Yapılacak, Devam Eden, Biten) üzerinde sürükle-bırak mantığıyla yönetebilir, proje ilerleme yüzdesini güncelleyebilir ve üst yönetime rapor sunabilir.
*   **✅ Görevler ve Takip (İş Emirleri):** 
    *   *Kullanıcı ne yapabilir?* Herhangi bir modüle (Proje, Fırsat, Sözleşme, Satın Alma) bağlı veya bağımsız iş emirleri oluşturabilir. Atanan görevlerin durumunu değiştirebilir ve görev içine tarih damgalı "İlerleme Raporları" (Progress Notes) ekleyebilir.

## 🛠️ Kullanılan Teknolojiler

Proje, modern web teknolojileri kullanılarak yüksek performanslı ve ölçeklenebilir bir yapıda tasarlanmıştır:

*   **Frontend Framework:** React 18
*   **Derleyici / Build Aracı:** Vite
*   **Programlama Dili:** TypeScript (Sıkı tip güvenliği ve interface tabanlı veri modelleri)
*   **Stil ve Tasarım:** Tailwind CSS (Utility-first CSS yaklaşımı ile hızlı ve responsive tasarım)
*   **Animasyonlar:** Framer Motion (`motion/react` ile akıcı sayfa geçişleri ve UI animasyonları)
*   **İkonografi:** Lucide React
*   **Yardımcı Kütüphaneler:** `clsx` ve `tailwind-merge` (Dinamik class yönetimi için)

## 🚀 Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyebilirsiniz:

1.  Bağımlılıkları yükleyin:
    ```bash
    npm install
    ```

2.  Geliştirme sunucusunu başlatın:
    ```bash
    npm run dev
    ```

3.  Tarayıcınızda `http://localhost:3000` adresine giderek uygulamayı görüntüleyin.

## 📂 Proje Yapısı

*   `/src/components`: Yeniden kullanılabilir UI bileşenleri (Örn: `TaskProgressTracker`, `ErrorBoundary`).
*   `/src/modules`: Uygulamanın ana sayfalarını ve iş mantığını barındıran modüller (Örn: `CRMModule`, `ProjectManagementModule`).
*   `/src/types.ts`: Uygulama genelinde kullanılan TypeScript arayüzleri (Interfaces) ve veri modelleri.
*   `/src/constants.ts`: Geliştirme aşamasında kullanılan sahte (mock) veriler ve sabitler.
*   `/src/lib/utils.ts`: Tailwind class'larını birleştirmek için kullanılan yardımcı fonksiyonlar.
