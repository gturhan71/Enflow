# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, bir işletmenin satış öncesi (presales), satış (CRM), sözleşme yönetimi, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş modern bir ERP/CRM platformudur.

Bu doküman, sistemin mimarisini, veri modellerini ve iş akışlarını NotebookLM gibi yapay zeka sistemlerinin tam kapasiteyle anlayabilmesi için detaylandırılmıştır.

---

## 🛠 Teknik Mimari (Technical Stack)

Enflow, modern web standartları ve performans odaklı kütüphaneler üzerine inşa edilmiştir:

- **Frontend:** React 18 (SPA)
- **Dil:** TypeScript (Sıkı tip güvenliği)
- **Build Aracı:** Vite (Hızlı HMR ve Optimize Bundle)
- **Stil:** Tailwind CSS (Utility-first)
- **Animasyon:** Framer Motion (Akışkan UI)
- **İkon:** Lucide React
- **Paket Yönetimi:** pnpm (Hızlı ve verimli bağımlılık yönetimi)

---

## 🔄 Uçtan Uca İş Akışı (End-to-End Workflow)

Sistem, bir projenin yaşam döngüsünü 6 ana aşamada yönetir:

1.  **Fırsat Yönetimi (CRM):** Müşteri ile ilk temas kurulur, `Opportunity` kaydı açılır.
2.  **Teknik Analiz (Presales):** Müşteri gereksinimleri analiz edilir, şartname uyumluluğu (`SpecAnalysis`) kontrol edilir ve Malzeme Listesi (`BoM`) oluşturulur.
3.  **Maliyetlendirme (Sales Support):** BoM listesindeki kalemlerin maliyetleri girilir, kar marjları hesaplanır ve `ProposalEditor` ile resmi teklif hazırlanır.
4.  **Sözleşme (Contract Management):** Teklif onaylandığında fırsat `WON` durumuna geçer. Sistem otomatik olarak `Contract` kaydı oluşturur ve gerekli teminat/evrak toplama sürecini başlatır.
5.  **Tedarik (Procurement):** Sözleşme imzalandığında `PurchaseOrder` oluşturulur. Distribütörlerden ürün tedariği ve lojistik takibi yapılır.
6.  **Uygulama (Project Management):** Donanım teslimatı sonrası saha kurulum görevleri Kanban üzerinden yönetilir ve proje `COMPLETED` olarak kapatılır.

---

## 📦 Modül Detayları

### 1. CRM & Fırsat Takibi (`CRMModule.tsx`)
- **İşlev:** Satış boru hattını yönetir.
- **Veri Modeli:** `Opportunity`, `Customer`.
- **Özellikler:** Fırsat durumu takibi (Yeni -> Kazanıldı), Müşteri risk skoru analizi.

### 2. Presales & Teknik Analiz (`PresalesModule.tsx`)
- **İşlev:** Teknik şartname uyumluluğu ve BoM oluşturma.
- **Veri Modeli:** `BoMItem`, `SpecificationRequirement`.
- **Özellikler:** Excel'den BoM içe aktarma, teknik onay mekanizması.

### 3. Satış Destek & Teklif (`SalesSupport.tsx`, `ProposalEditor.tsx`)
- **İşlev:** Finansal hesaplamalar ve teklif dökümanı üretimi.
- **Veri Modeli:** `CostRequirement`, `BoMItem`.
- **Özellikler:** Dinamik kar marjı hesaplama, PDF formatında teklif önizleme.

### 4. Sözleşme Yönetimi (`ContractModule.tsx`)
- **İşlev:** Hukuki ve finansal evrak takibi.
- **Veri Modeli:** `Contract`, `ContractDocumentRequirement`.
- **Özellikler:** Teminat mektubu takibi, imza süreci izleme.

### 5. Satın Alma & Lojistik (`ProcurementModule.tsx`)
- **İşlev:** Tedarik zinciri yönetimi.
- **Veri Modeli:** `PurchaseOrder`.
- **Özellikler:** ETA (Tahmini varış) takibi, depo stok girişi bildirimi.

### 6. Proje Yönetimi (`ProjectManagementModule.tsx`)
- **İşlev:** Saha operasyonları ve görev takibi.
- **Veri Modeli:** `Project`, `ProjectTask`.
- **Özellikler:** Kanban Board, ilerleme yüzdesi hesaplama.

### 7. İş Emirleri ve Takip (`TodoModule.tsx`, `TaskProgressTracker.tsx`)
- **İşlev:** Departmanlar arası görev atama.
- **Veri Modeli:** `TodoTask`.
- **Özellikler:** Modül bağımsız görev atama, zaman damgalı ilerleme notları.

---

## 🔐 Yetkilendirme Modeli (`UserRole`)

Sistem rol tabanlı erişim kontrolü (RBAC) kullanır:
- `SALES_REP`: Fırsat oluşturur, müşteri yönetir.
- `PRESALES_ENG`: Teknik BoM hazırlar.
- `SALES_SUPPORT`: Maliyet girer, teklif hazırlar.
- `UNIT_MANAGER`: Teknik ve finansal onay verir.
- `PROCUREMENT_MGR`: Satın alma süreçlerini yönetir.
- `GENERAL_MANAGER`: Tüm sistem raporlarını görür.

---

## 🔌 Entegrasyonlar
- **Nextcloud:** Proje dökümanlarının merkezi depolanması.
- **Exchange:** E-posta ve takvim senkronizasyonu.
- **WhatsApp:** Müşteri bildirimleri ve ekip içi anlık iletişim.

---

## 📂 Dosya Yapısı Summary

```text
src/
├── components/      # Ortak UI bileşenleri (Task Tracker, Error Boundary)
├── layout/          # Sidebar, Header ve Ana İskelet
├── modules/         # İş mantığını barındıran ana modüller (CRM, Project vb.)
├── services/        # Dış API entegrasyonları (WhatsApp, Exchange)
├── types.ts         # Merkezi TypeScript interface tanımları
└── constants.ts     # Mock datalar ve sistem sabitleri
```

---
*Bu README, Enflow projesinin "Single Source of Truth" dökümanıdır.*
