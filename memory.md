# Enflow Memory — Production Phase 1

## Son Durum
- **Tarih:** 14.05.2026
- **Durum:** Sistem statik prototipten gerçek Multi-tenant Full-Stack mimariye taşındı. Backend canlıya alındı.

## Yapılan Devrimler

### 1. Full-Stack Backend (The Core)
- **Stack:** Node.js + Express + Prisma 7 + SQLite (LibSQL).
- **Multi-tenancy:** `x-tenant-id` header tabanlı veri izolasyonu sağlandı.
- **Veritabanı:** `dev.db` oluşturuldu; Birimler, Kullanıcılar, Fırsatlar ve Workflow kayıtları gerçek tablolar haline getirildi.
- **Persistence:** Frontend `localStorage`'dan söküldü, tüm organizasyonel değişiklikler veritabanına kaydediliyor.

### 2. Akıllı Yetkilendirme & Auth
- **Merkezi Auth:** `AuthContext` ve `useAuth` hook ile oturum yönetimi globalleşti.
- **Permission Gate:** Modüllerdeki kritik aksiyonlar (Ekle, Devret, Onayla) `PermissionGate` bileşeni ile granular (ince ayarlı) yetkilendirmeye bağlandı.
- **Giriş Sistemi:** Gerçek API tabanlı login ve "Şifremi Unuttum" akışı eklendi. Yeni personeller e-postalarıyla sisteme girebiliyor.

### 3. Dinamik İş Akışı (Workflow Engine)
- **Workflow Builder:** Ayarlar sekmesine görsel "Kutu Tasarlayıcı" eklendi. Birimler arası akışlar admin tarafından tanımlanabiliyor.
- **Hand-off (Devir):** Modüllere dinamik "İşi Devret" modalı eklendi. Birim ve personel seçimiyle iş ataması yapılabiliyor.
- **Bildirimler:** Devir anında otomatik **WhatsApp** ve **Exchange (Email)** bildirimleri dökümante edilen gerçek script altyapısına bağlandı.

### 4. Kişiselleştirilmiş Dashboard
- **Role-based UI:** General Manager, Sales, Presales ve Procurement rolleri için farklılaştırılmış dashboard görünümleri tasarlandı.
- **Veri Görselleştirme:** `recharts` ile Pipeline Trend ve Birim İş Yükü grafikleri canlandırıldı.
- **Alert System:** Roller bazlı dinamik kritik uyarı mekanizması kuruldu.

## Karar Günlüğü
| Tarih | Karar | Neden |
|-------|-------|-------|
| 14.05.2026 | Backend Migration | Sistemin gerçek dünyada yüzlerce kullanıcıya hizmet verebilmesi için. |
| 14.05.2026 | Prisma 7 Upgrade | En güncel ve hızlı veritabanı erişim standartlarını kullanmak için. |
| 14.05.2026 | Role-based Dashboard | Personel verimliliğini artırmak ve odaklanmış iş takibi için. |

---
*Enflow, Gökhan Turhan'ın MASTER standartlarında bir Kurumsal İşletim Sistemine dönüşmüştür.*
