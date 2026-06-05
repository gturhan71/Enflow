# Enflow — Kurumsal Süreç İşletim Sistemi (Walkthrough)

## 1. Vizyon ve Kapsam
Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), maliyetlendirme, sözleşme yönetimi, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan **End-to-End Enterprise Process Management (ERP & CRM)** platformudur. 

Statik bir kayıt sisteminden öte, birimler arası iş akışını (workflow) ve personeller arası iletişimi yöneten akıllı bir mekanizmadır.

---

## 2. Teknik Mimari (Tech Stack)

### Frontend (User Interface)
- **Framework:** React 18 (SPA)
- **Styling:** Tailwind CSS (Modern, Responsive, Performance-focused)
- **Animasyon:** Framer Motion (Akışkan geçişler ve modal yönetimleri)
- **Görselleştirme:** Recharts (Birim bazlı performans ve pipeline trend grafikleri)
- **İkon Seti:** Lucide React

### Backend (The Core)
- **Runtime:** Node.js (TypeScript)
- **Web Framework:** Express.js
- **ORM:** Prisma 7 (En güncel veritabanı erişim standartı)
- **Veritabanı:** SQLite (LibSQL Adapter) - Production aşamasında PostgreSQL'e tam uyumlu.
- **Güvenlik:** JWT tabanlı kimlik doğrulama ve Multi-tenant (Çoklu Şirket) veri izolasyonu.

---

## 3. Fonksiyonel Modüller

### A. CRM & Merkezi Müşteri Hafızası
Satış boru hattının (Pipeline) ve kurumsal hafızanın merkezidir.
- **Maksimum Veri Derinliği:** Müşterilerin sadece iletişim bilgileri değil; Vergi Detayları, Finansal Risk Skorları, Kredi Limitleri ve Teknik Alt Yapı (Tech Stack) verileri merkezi olarak tutulur.
- **Teklif Statüleri (Won / Lost / Pending):** Fırsatlar ve teklifler "Kazanıldı, Kaybedildi, Bekliyor" statülerinde takip edilir. Kaybedilen teklifler anlık olarak pipeline toplam değerinden düşürülerek Dashboard'da "Kaybedilen Değer" KPI kartına ve listesine aktarılır.
- **Otomasyon Kaynağı:** Kaydedilen her müşteri verisi; otomatik PDF teklif üretimi, lojistik planlama ve satın alma onayları için "Tek Kaynak" (Single Source of Truth) işlevi görür.

### B. Presales & AI Teknik Analiz
Projenin teknik omurgasını oluşturur.
- **Gemini AI Entegrasyonu:** PDF/Word şartnamelerini analiz ederek teknik gereksinimleri özetler ve ürün (Part Number) listesini otomatik çıkartır.
- **BoM (Bill of Materials) Editörü:** Teknik ekip tarafından hazırlanan ürün listesinin fırsatla ilişkilendirilmesi.

### C. Satış Destek & Maliyetlendirme
- **Marj Yönetimi:** BoM kalemlerinin alış maliyetleri üzerinden hedef kâr marjları ile fiyatlandırılması.
- **Onay Mekanizması:** BoM listelerinin yönetici onayına sunulması.

### D. Sözleşme Yönetimi & Evrak Doğrulama
- **Dinamik Evrak Hazırlığı (Satış Destek):** Kazanılan teklifler için otomatik sözleşme kartı oluşturulur. Sözleşmenin imzalanabilmesi için gerekli olan evrakların (Sözleşme Taslağı, Maliyet Analizi, İmza Sirküleri vb.) toplanması görevi **Satış Destek Birimi'ne** atanır.
- **Strict Validation:** Tüm evraklar tek tek onaylanmadığı sürece sözleşme imzalanıp devredilemez. 
- **Fiziksel Arşiv Takibi:** Islak imzalı evrakların raf, kutu ve ödünç durumlarının takibi.

### E. Paralel İş Akışları (PM & Satın Alma)
- **Eş Zamanlı İş Açma:** Sözleşme tamamlandığı an, paralel olarak **Proje Yönetimi** (Proje Başlatma Planı) ve **Satın Alma** (BoM Kalemleri Tedariği) birimlerine otomatik yüksek öncelikli görevler (`TodoTask`) atanarak süreçler eş zamanlı tetiklenir.
- **Tedarik Zinciri:** Onaylı BoM kalemlerinin sipariş (ETA) takibi ve depo giriş yönetimi.
- **Kanban Proje Takibi:** Saha operasyonlarının görev bazlı takibi.

---

## 4. Akıllı Sistem Katmanları

### I. Dinamik İş Akışı Motoru (Workflow Engine)
Enflow'un en güçlü yanıdır.
- **Workflow Builder:** Admin tarafından görsel olarak tasarlanabilen birimler arası akışlar.
- **Dinamik Hand-off (Devir):** Bir iş bittiğinde, sistemin otomatik olarak bir sonraki birimi ve personeli belirleyerek işi ataması.
- **Dashboard Canlı Gelişmeler Paneli:** İmzalanan sözleşmeler ve atanan paralel işlerin güncel durumları anlık olarak Dashboard'da "Canlı Operasyon Gelişmeleri" panelinden yayınlanır.

### II. Bildirim Katmanı (Notifications)
İş akışındaki her devir anında şu kanallar üzerinden bildirim gider:
- **WhatsApp:** Meta Cloud API üzerinden anlık mesaj.
- **Exchange:** Microsoft Graph API üzerinden kurumsal e-posta.
- **Sistem İçi:** Dashboard üzerinde kırmızı bayraklı uyarılar.

### III. Granular Yetkilendirme (RBAC)
- **Permission Gate:** Buton ve sayfa bazlı yetki kontrolü. Admin panelinden bir yetki kaldırıldığında, ilgili buton kullanıcının arayüzünden anlık olarak kaybolur.

---

## 5. Production (Canlıya Geçiş) Stratejisi
Sistem şu an "Ready to Deploy" iskeletine sahiptir:
- **Veri İzolasyonu:** `x-tenant-id` header yapısı ile her şirket sadece kendi verisini görür.
- **Dökümante Entegrasyonlar:** WhatsApp, MS Exchange ve Nextcloud için gerçek dünya scriptleri dökümante edilmiştir.
- **Role-based Dashboards:** Her personelin (GM, Satış, Teknik vb.) işine odaklanmasını sağlayan kişiselleştirilmiş ana sayfalar.

---

*Bu doküman Enflow v1.2.5 mimarisini ve Gökhan Turhan'ın MASTER standartlarını temsil eder.*

---
## v1.6.0 Güncelleme Notları
- **Mobile-First Navigation:** Mobil cihazlar için özel alt navigasyon barı (Bottom Nav) eklendi.
- **Workflow Hand-off:** Birimler arası görev aktarımında otomatik WhatsApp ve E-posta bildirim entegrasyonu (WorkflowService) canlıya alındı.
- **Accessibility:** Aydınlık modda kontrast ve okunabilirlik iyileştirmeleri (High-Contrast Glass UI).

---
## v1.6.1 Final Güncelleme (05.06.2026)
- **UI/UX:** Tüm modüllerde aydınlık modda okunabilirlik için Glass-morphism kontrast iyileştirmesi yapıldı.
- **Teklif Yönetimi:** Yönetici onay mekanizması, 'Reddet/Onayla' aksiyonları ve revizyon akışı (Draft -> Pending -> Approved/Rejected) entegre edildi.
- **Workflow:** Onay zinciri (Approval Chain) altyapısı kuruldu.
- **Veri Yönetimi:** Tüm veri girişi yapılan modüllere merkezi 'SaveButton' bileşeni eklendi.
