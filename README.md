# Enflow — Uçtan Uca Kurumsal Süreç Yönetimi (ERP & CRM)

Enflow, modern bir işletmenin satış öncesi (presales), satış (CRM), maliyetlendirme, sözleşme yönetimi, fiziksel arşiv, satın alma ve proje uygulama süreçlerini tek bir çatı altında toplayan, veriye dayalı karar destek mekanizmalarıyla güçlendirilmiş, **Multi-tenant Full-Stack** bir ERP/CRM platformudur.

> [!IMPORTANT]
> **v1.2.0 Hardened Edition:** Bu sürüm, kurumsal standartlarda hata yönetimi, yüksek performanslı state yönetimi ve "tek-ui" tasarım diliyle tamamen modernize edilmiştir.

---

## 🏗 Teknik Mimari & Modernizasyon (v1.2.0)

### 🎨 Görsel Standart (tek-ui)
- **Design System:** Geist Sans tipografisi, HSL Primary (151 86% 39%) paleti.
- **Glassmorphism:** `backdrop-blur-xl` ve premium gölgelendirmelerle modern "Cockpit" estetiği.
- **Micro-animations:** Framer Motion ile güçlendirilmiş pürüzsüz geçişler ve etkileşimler.

### ⚡ Performans ve Mimari
- **Frontend Core:** `useMemo`, `React.memo` ve özel geliştirilmiş `useSearch`, `useForm` hook'ları ile optimize edilmiş render performansı.
- **Backend Hardening:** Global `asyncHandler` sarmalı, merkezi hata yönetimi (Error Middleware) ve tenant izolasyonu.
- **Veritabanı:** Prisma 7 + SQLite (LibSQL) ile ilişkisel veri bütünlüğü.

---

## 🔄 Öne Çıkan Özellikler

- **Gelişmiş İş Akışı Motoru (Workflow Engine):** Birimler arası iş devirleri (Hand-off) admin tarafından görsel olarak tasarlanabilir ve veritabanında kalıcı olarak saklanır.
- **Akıllı CRM Portföyü:** Risk skorları, kredi limitleri ve teknik stack takibi içeren zırhlı müşteri veri merkezi.
- **Performanslı Dashboard:** Canlı KPI hesaplamaları ve role özel veri görselleştirmeleri (Memoized).
- **AI Tabanlı Analiz:** Şartnamelerden otomatik BoM listesi ve teknik özet çıkarma (Gemini API).
- **Zırhlı Yetkilendirme:** Buton seviyesine kadar inen granular yetki kontrolü (RBAC).

---

## 📂 Dosya Yapısı (Project Structure)

```text
Enflow/
├── backend/            # Prisma + Express API (The Core)
│   ├── prisma/         # Workflow & Tenant Şemaları
│   └── src/            # AsyncHandlers & Error Middleware
├── src/
│   ├── components/     # Standart UI Bileşenleri
│   ├── contexts/       # Auth & UnsavedChanges Management
│   ├── hooks/          # useSearch, useForm (Optimization Core)
│   ├── layout/         # tek-ui Sidebar ve Header
│   ├── modules/        # CRM, Dashboard, WorkflowBuilder (Logic)
│   └── types.ts        # v1.2.0 Extended Types
└── reference/          # Entegrasyon Rehberleri
```

---

## 🚀 Başlangıç

### Backend Kurulumu
1. `cd backend`
2. `pnpm install`
3. `npx prisma migrate dev`
4. `pnpm dev` (3002 portunda çalışır)

### Frontend Kurulumu
1. `pnpm install`
2. `.env` dosyasına `GEMINI_API_KEY` ekleyin.
3. `pnpm dev` (3000 portunda çalışır)

---
*Bu proje Gökhan Turhan'ın MASTER standartlarına uygun olarak modernize ve optimize edilmiştir.*
