# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), sözleşme yönetimi, fiziksel arşiv, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş bir ERP/CRM platformudur.

---

## 🏗 Teknik Mimari (Technical Stack)

- **Frontend:** React 18 (SPA)
- **Animasyon:** Framer Motion (Akışkan UI)
- **Styling:** Tailwind CSS + Lucide Icons
- **Build:** Vite + TypeScript
- **State:** React Hooks (Context API)
- **AI Entegrasyonu:** Google Gemini API (Teknik şartname analizi için)
- **Dış Servisler:** Nextcloud (DMS), MS Exchange (Email), WhatsApp Business API

---

## 📂 Dosya Yapısı (Project Structure)

```text
Enflow/
├── src/
│   ├── components/         # Ortak bileşenler (Error Boundary, Task Tracker vb.)
│   ├── contexts/           # Global state (UnsavedChangesContext)
│   ├── layout/             # Sidebar, Header ve Ana İskelet
│   ├── services/           # Dış servis entegrasyonları (WhatsApp, Exchange, Nextcloud)
│   ├── lib/                # Yardımcı araçlar (utils.ts)
│   ├── modules/            # Ana iş mantığı modülleri
│   │   ├── CRMModule.tsx           # Satış kanalı ve fırsat yönetimi
│   │   ├── PresalesModule.tsx      # Teknik analiz ve BoM oluşturma
│   │   ├── SpecAnalysis.tsx        # AI tabanlı şartname analiz motoru
│   │   ├── SalesSupport.tsx        # Maliyetlendirme ve onay süreçleri
│   │   ├── ProposalEditor.tsx      # PDF teklif oluşturma editörü
│   │   ├── ProcurementModule.tsx   # Satın alma ve tedarik zinciri
│   │   ├── ContractModule.tsx      # Sözleşme ve evrak takibi
│   │   ├── ProjectManagement.tsx   # Saha operasyonları ve Kanban
│   │   ├── ArchiveModule.tsx       # Fiziksel arşiv ve kutu takibi
│   │   ├── DocumentsModule.tsx     # Kurumsal döküman merkezi
│   │   ├── TodoModule.tsx          # Görev ve iş emri yönetimi
│   │   ├── SettingsModule.tsx      # Şirket ayarları ve Entegrasyonlar
│   │   ├── IntegrationWizard.tsx   # Dış servis kurulum sihirbazı
│   │   └── ProvisionWizard.tsx     # Toplu kullanıcı/birim açma aracı
│   ├── types.ts            # TypeScript interface tanımları
│   └── constants.ts        # Mock datalar ve sistem sabitleri
└── README.md
```

---

## 🔄 İş Akış Modelleri

### 1. AI Tabanlı Şartname Analizi
`SpecAnalysis.tsx` modülü, yüklenen PDF/Word şartnamelerini Gemini AI kullanarak analiz eder. Teknik gereksinimleri özetler ve metinden otomatik olarak ürün (Part Number) listesi çıkartır.

### 2. Akıllı Teklif Editörü
`ProposalEditor.tsx`, teknik ekipten gelen BoM listesini alır. Marj hesaplamalarını otomatik yapar, antetli kağıt formunda profesyonel PDF teklifler üretir ve müşteriye gönderim için hazır hale getirir.

### 3. Fiziksel Arşiv Takibi
`ArchiveModule.tsx`, dijital süreçlerin yanı sıra ıslak imzalı evrakların fiziksel lokasyonlarını (Raf, Kutu No) takip eder. Ödünç verme ve imha süreçlerini yönetir.

### 4. Dış Servis Entegrasyonları
`IntegrationWizard.tsx` üzerinden Nextcloud (DMS), Exchange ve WhatsApp entegrasyonları "Zero Configuration" mantığıyla kolayca kurulabilir.

---

## 🚀 Başlangıç

1. `pnpm install` ile bağımlılıkları yükleyin.
2. `.env` dosyasına `GEMINI_API_KEY` ekleyin.
3. `pnpm dev` ile sistemi 3000 portunda çalıştırın.

---
*Bu proje Gökhan Turhan'ın MASTER standartlarına uygun olarak modernize edilmiştir.*
