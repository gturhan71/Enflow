# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), maliyetlendirme, sözleşme yönetimi, fiziksel arşiv, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş, **Multi-tenant Full-Stack** bir ERP/CRM platformudur.

> 📘 **Detaylı Sunum ve Analiz:** Projenin teknik mimarisi, iş akışları ve NotebookLM entegrasyonu için hazırlanan kapsamlı rapor dökümanına [walkthrough.md](./walkthrough.md) üzerinden ulaşabilirsiniz.

---

## 🏗 Teknik Mimari (Technical Stack)

- **Frontend:** React 18 (SPA) + Framer Motion + Recharts
- **Backend:** Node.js (TypeScript) + Express.js
- **Veritabanı:** Prisma 7 + SQLite (LibSQL)
- **Güvenlik:** JWT tabanlı Auth + Role-based Access Control (RBAC)
- **AI:** Google Gemini API (Teknik şartname analizi için)
- **Entegrasyonlar:** Nextcloud (DMS), MS Exchange, WhatsApp Business API

---

## 📂 Dosya Yapısı (Project Structure)

```text
Enflow/
├── backend/            # Prisma 7 + Express API (The Core)
├── src/
│   ├── components/     # Ortak bileşenler (PermissionGate, Tracker vb.)
│   ├── contexts/       # Global State (AuthContext, UnsavedChanges)
│   ├── layout/         # Dinamik Sidebar ve Header
│   ├── services/       # API ve Dış Servis (WhatsApp, Workflow) entegrasyonları
│   ├── modules/        # Ana iş mantığı modülleri (CRM, Presales, WorkflowBuilder vb.)
│   ├── types.ts        # Merkezi TypeScript tanımları
│   └── constants.ts    # Sistem sabitleri ve mock veriler
├── reference/          # Canlıya geçiş ve entegrasyon rehberleri
├── walkthrough.md      # NotebookLM ve Sunum dökümanı
└── README.md
```

---

## 🔄 Öne Çıkan Özellikler

- **Dinamik İş Akışı (Workflow):** Birimler arası iş devirleri (Hand-off) admin tarafından görsel olarak tasarlanabilir.
- **Kişiselleştirilmiş Dashboardlar:** GM, Satış, Teknik ve Satın Alma birimleri için role özel canlı veri görselleştirmeleri.
- **AI Tabanlı Analiz:** Şartnamelerden otomatik BoM listesi ve teknik özet çıkarma.
- **Zırhlı Yetkilendirme:** Buton seviyesine kadar inen granular yetki kontrolü.

---

## 🚀 Başlangıç

### Backend Kurulumu
1. `cd backend`
2. `pnpm install`
3. `npx prisma migrate dev`
4. `pnpm dev` (3001 portunda çalışır)

### Frontend Kurulumu
1. `pnpm install`
2. `.env` dosyasına `GEMINI_API_KEY` ekleyin.
3. `pnpm dev` (3000 portunda çalışır)

---
*Bu proje Gökhan Turhan'ın MASTER standartlarına uygun olarak modernize edilmiştir.*
