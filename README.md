# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), maliyetlendirme, sözleşme yönetimi, fiziksel arşiv, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş, **Multi-tenant Full-Stack** bir ERP/CRM platformudur.

> [!IMPORTANT]
> **v1.3.2 Proposal Negotiation Filtering Release:** Arayüz tamamen **tek-ui** standartlarında modernize edildi. Teklif hazırlama aşamasına **"Pazarlığa Açık" (openForNegotiation)** bayrağı eklendi. Pazarlık Kokpiti artık sadece bu bayrağa sahip teklifleri süzerek özel simülasyon turları başlatır.

---

## 🏗 Teknik Mimari & Modernizasyon (v1.2.9)

### 🎨 Görsel Standart (tek-ui & Premiumization)
*   **Design System:** Geist Sans tipografisi, HSL Primary (151 86% 39% - Zümrüt Yeşili) renk paleti.
*   **Glow & Blur Efektleri:** Arka plana gömülü dinamik blur mesh'ler, KPI kartlarında hover durumunda canlanan radial renk sızıntıları (`blur-[50px]`).
*   **Chart Gradients:** Recharts Bar grafiği sütunlarında özel dikey linear gradient renk geçişleri (`#barPrimary`, `#barBlue` vb.).
*   **Zaman Tüneli & Pulse Animasyonları:** Canlı operasyon gelişmelerinde aktif görevlerin ve imzalanmış sözleşmelerin durumunu anlık gösteren ping animasyonlu sinyal ışıkları.
*   **Cam Scrollbar:** Arayüze özel minimalist ve modern kaydırma çubukları (`webkit-scrollbar`).

### ⚡ Performans ve Mimari
*   **Frontend Core:** `useMemo`, `React.memo` ve özel geliştirilmiş `useSearch`, `useForm` hook'ları ile sıfır gereksiz render performansı.
*   **Backend Hardening:** Global `asyncHandler` sarmalı, merkezi hata yönetimi (Error Middleware) ve SQLite + Prisma v7.8.0 veritabanı entegrasyonu.
*   **Port & Süreç Yönetimi:** 3000 ve 3002 portlarındaki eski asılı süreçleri otomatik temizleyen port-killer entegreli orkestrasyon sistemi.

---

## 🔄 Öne Çıkan Modüller ve İş Akışları (Inter-Module Flow)

1.  **Satış Fırsatları & CRM Modülü:** Kredi limitleri, risk skorları ve fırsat statü takibi (Won/Lost). Kaybedilen fırsatlar otomatik olarak "Kaybedilenler Listesi"ne aktarılır.
2.  **AI Destekli Satış Öncesi (Presales):** Teknik şartnamelerden Gemini AI API entegrasyonu ile otomatik BoM (Bill of Materials) listesi ve teknik özet çıkartılması.
3.  **Onay Mekanizması (Approval Queue):** Yönetici paneli üzerinden tek tıkla doğrulanmış teknik teklif onaylama.
4.  **Canlı Pazarlık & Açık Eksiltme Kokpiti (v1.3.2):** Satış Birim Yöneticisine (Genel Müdür) özel, hazırlık aşamasında **"Pazarlığa Açık"** olarak kaydedilmiş teklifler üzerinden başlatılan 1v1 Canlı Müzakere chatbot'u ve Çoklu Rakip katılımlı **Açık Eksiltme Müzayedesi**.
5.  **Sözleşme Modülü & Evrak Kontrolü:** Islak imzalı evrakların yüklenme zorunluluğu olan devlet destekli "Evrak Kontrol Listesi" (Document Checklist). Tüm evraklar tamamlanmadan proje devredilemez.
6.  **Paralel Süreç Handoff'u:** Sözleşme onaylandığı anda **Proje Yönetimi** (Birim `u4` - Proje Başlatma Planı) ve **Satın Alma** (Birim `u3` - BoM Tedarik Başlatma) birimlerine otomatik yüksek öncelikli görevler (TodoTask) açılır.
7.  **Proje Yönetimi & Kapanış:** PM paneli üzerinden geçici kabul onayı (%100) ile proje tamamlanır ve otomatik olarak **Fiziksel Arşiv Modülü**'ne (ArchiveModule) devredilir.
8.  **E2E Stepper Simulator:** CRM'den fiziksel arşive kadar olan 8 aşamalı ERP akışını mock WhatsApp API & MS Exchange Graph API bildirim yükleriyle (payloads) test eden interaktif simülatör.

---

## 📂 Dosya Yapısı (Project Structure)

```text
Enflow/
├── backend/            # Prisma + Express API (The Core)
│   ├── prisma/         # Workflow, Migration & Tenant Şemaları
│   └── src/            # Controllers, Prisma Adapter, Routes
├── src/
│   ├── components/     # Standart UI Bileşenleri (Modal, Table)
│   ├── contexts/       # Auth & UnsavedChanges Management
│   ├── hooks/          # useSearch, useForm (Optimization Core)
│   ├── layout/         # tek-ui Sidebar ve Header (Glow Logout)
│   ├── modules/        # CRM, Dashboard (Kokpit), WorkflowBuilder (Stepper)
│   └── types/          # v1.2.9 Extended Types (Opportunity, Project)
├── run.sh              # macOS/Linux Tek Tuşla Başlatıcı
├── run.bat             # Windows Tek Tuşla Başlatıcı
├── run.js              # Node.js Port Killer & Orchestrator
└── README.md           # Güncel Proje Rehberi
```

---

## 🚀 Başlangıç (Kurulum ve Çalıştırma)

Cross-platform tek tuşla başlatma komutunu kullanarak hem frontend hem de backend'i aynı anda ayağa kaldırabilirsiniz:

```bash
# macOS veya Linux üzerinde port temizliği yaparak tek seferde başlatma
chmod +x run.sh
./run.sh
```

```cmd
# Windows üzerinde
run.bat
```

### Manuel Kurulum ve Ayrı Çalıştırma

#### Backend Kurulumu
1. `cd backend`
2. `pnpm install`
3. `npx prisma migrate dev`
4. `pnpm dev` (3002 portunda nodemon ile ts-node üzerinden ayağa kalkar)

#### Frontend Kurulumu
1. Proje kök dizininde `pnpm install`
2. `.env` dosyasına `GEMINI_API_KEY` ekleyin.
3. `pnpm dev` (3000 portunda Vite ile ayağa kalkar)

---
*Enflow v1.3.2 — Bu proje Gökhan Turhan'ın MASTER standartlarına uygun olarak modernize, optimize ve senkronize edilmiştir.*
