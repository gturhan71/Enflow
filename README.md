# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), maliyetlendirme, sözleşme yönetimi, fiziksel arşiv, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş, **Multi-tenant Full-Stack** bir ERP/CRM platformudur.

> [!IMPORTANT]
> **v1.5.1 Master License & Activation Release:** Proje ticari lisanslama altyapısına kavuştu. Master Admin için lisans anahtarı üretici ve müşteriler için anlık aktivasyon motoru entegre edildi. Logo, Mikro ve Netsis entegrasyon sihirbazı modernize edildi.

---

## 🏗 Teknik Mimari & Modernizasyon (v1.5.1)

### 🎨 Görsel Standart (tek-ui & Premiumization)
*   **Design System:** Geist Sans tipografisi, HSL Primary (151 86% 39% - Zümrüt Yeşili) renk paleti.
*   **Glow & Blur Efektleri:** Arka plana gömülü dinamik blur mesh'ler, KPI kartlarında hover durumunda canlanan radial renk sızıntıları (`blur-[50px]`).
*   **Zaman Tüneli & Pulse Animasyonları:** Canlı operasyon gelişmelerinde aktif görevlerin ve imzalanmış sözleşmelerin durumunu anlık gösteren ping animasyonlu sinyal ışıkları.
*   **Cam Scrollbar:** Arayüze özel minimalist ve modern kaydırma çubukları (`webkit-scrollbar`).

### ⚡ Performans ve Mimari
*   **Frontend Core:** `useMemo`, `React.memo` ve özel geliştirilmiş `useSearch`, `useForm` hook'ları ile sıfır gereksiz render performansı.
*   **Backend Hardening:** Global `asyncHandler` sarmalı, merkezi hata yönetimi (Error Middleware) ve SQLite + Prisma v7.8.0 veritabanı entegrasyonu.
*   **Universal Hybrid AI:** Tüm kurulum modellerinde (On-Premise dahil) AI servisleri, ana paketten bağımsız harici bulut aboneliği üzerinden hibrit olarak çalışır.
*   **Secure Licensing:** Base64 + Signature tabanlı şifrelenmiş lisans anahtarı sistemi. Master Admin tarafından üretilen anahtarlar firma adı ve limit bazlı doğrulama sağlar.
*   **Port & Süreç Yönetimi:** 3000 ve 3002 portlarındaki eski asılı süreçleri otomatik temizleyen port-killer entegreli orkestrasyon sistemi.

---

## 🔄 Öne Çıkan Modüller ve İş Akışları (Inter-Module Flow)

1.  **Lisans Üretici & Aktivasyon (v1.5.1):** Master Admin tarafından üretilen dijital anahtarlarla KOBİ, Pay-As-You-Go veya On-Premise modellerinin saniyeler içinde aktifleştirilmesi.
2.  **Yerel ERP & CRM Entegrasyon Sihirbazı:** Logo Tiger/Go, Netsis ve Mikro sistemleriyle REST API ve MSSQL Connector destekli canlı veri eşleme arayüzü.
3.  **Satış Fırsatları & CRM Modülü:** Kredi limitleri, risk skorları ve fırsat statü takibi (Won/Lost). Kaybedilen fırsatlar otomatik olarak "Kaybedilenler Listesi"ne aktarılır.
4.  **AI Destekli Satış Öncesi (Presales):** Teknik şartnamelerden Gemini AI API entegrasyonu ile otomatik BoM listesi ve teknik özet çıkartılması.
5.  **Canlı Pazarlık & Açık Eksiltme Kokpiti:** Satış Yöneticisine özel, hazırlık aşamasında "Pazarlığa Açık" olarak kaydedilmiş teklifler üzerinden 1v1 Müzakere ve Çoklu Rakip katılımlı Açık Eksiltme simülatörü.
6.  **Sözleşme Modülü & Evrak Kontrolü:** Islak imzalı evrakların yüklenme zorunluluğu olan devlet destekli "Evrak Kontrol Listesi". 
7.  **Paralel Süreç Handoff'u:** Sözleşme onaylandığı anda Proje Yönetimi ve Satın Alma birimlerine otomatik yüksek öncelikli görevlerin atanması.
8.  **Proje Yönetimi & Kapanış:** PM paneli üzerinden geçici kabul onayı ile proje tamamlanması ve otomatik Fiziksel Arşiv (ArchiveModule) devri.

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
│   ├── modules/        # CRM, Dashboard, SubscriptionModule, LicenseGenerator
│   └── types/          # Extended Types (Opportunity, Project, LicenseData)
├── LICENSE             # Ticari Lisans Dosyası
├── run.sh              # macOS/Linux Tek Tuşla Başlatıcı
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

---

## 📄 Lisans (License)

Bu yazılım **Ticari (Proprietary)** lisansa tabidir. Tüm hakları saklıdır. Yazılımın izinsiz kopyalanması, dağıtılması veya kullanılması kesinlikle yasaktır. Detaylar için `LICENSE` dosyasına bakınız.

Copyright (c) 2026 Gökhan Turhan.

---
*Enflow v1.5.1 — Bu proje Gökhan Turhan'ın MASTER standartlarına uygun olarak modernize, optimize ve senkronize edilmiştir.*
