# Enflow Memory — True Full-Stack Evolution

## Son Durum
- **Tarih:** 17.05.2026
- **Kapanış Durumu:** Proje `gturhan71` reposundan devralındı, `Dev_Ops_New` hiyerarşisine taşındı ve MASTER standartlarına (SIGMAP, entities, vault) uygun şekilde yapılandırıldı.

## Bugünün Teknik Devrimleri

### 4. Top-to-Bottom Audit & Standardization (The Master Audit)
- **Design System:** `index.css` tek-ui standartlarına çekildi (Geist Sans, HSL Primary: `151 86% 39%`).
- **UI Premiumization:** Dashboard "Kurumsal Kokpit" adıyla yeniden tasarlandı; glassmorphism, HSL bazlı chart renkleri ve dinamik animasyonlarla "WOW" efekti güçlendirildi.
- **Sidebar & Profile:** Sidebar dinamik `currentUser` verisine bağlandı, hardcoded isimler temizlendi ve glass-effect optimize edildi.
- **Backend Hardening:** Eksik olan `forgot-password` endpoint'i eklendi, tüm auth akışı senkronize edildi.
- **Registry:** `entities.json` oluşturuldu, `atlas.md` ve `gitrepo.md` güncellendi.

### 5. Favicon & Metadata Premiumization (v1.2.1)
- **Favicon Suite:** "tek-ui" tasarım dilimize (zümrüt yeşili: HSL `151 86% 39%`) ve "Enflow" akış/düğüm konseptine uygun yüksek kaliteli, glassmorphism cam efektli bir logo üretildi. Python + Pillow kullanılarak çoklu çözünürlük içeren `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png` ve PWA logoları oluşturuldu.
- **Metadata & PWA:** `index.html` üzerindeki jenerik başlık temizlenerek `Enflow — Uçtan Uca Kurumsal Süreç Yönetimi` yapıldı. Mobil ve modern tarayıcı entegrasyonları için `site.webmanifest` eklendi.

### 6. Cross-Platform Orchestrator (v1.2.2)
- **Unified Run Scripts:** Windows, macOS ve Linux üzerinde tek tuşla hem frontend hem backend katmanlarını ayağa kaldırıp yöneten `run.js` (Core), `run.sh` ve `run.bat` betikleri geliştirildi.
- **Robust Port Releasing:** 3000 ve 3002 portlarında asılı kalmış eski süreçleri otomatik tespit edip zorla sonlandıran (taskkill / kill -9) "restart" mekanizması eklendi.
- **Colored Logging:** Log akışları zümrüt yeşili (`[Frontend]`) ve camgöbeği (`[Backend]`) renk kodlarıyla görselleştirildi, terminal takibi son derece pratikleştirildi.

### 7. Full Build Fix & DB Stabilization (v1.2.3)
- **TypeScript Clean:** `Opportunity` tipi `types.ts`'e eklendi, `User.tenantId` eklendi, `PresalesModule`/`ContractModule` eksik prop'ları tamamlandı, `handleLogin` imzası düzeltildi.
- **Icon Imports:** `ShoppingCart` (SpecAnalysis), `Loader2` (TodoModule), `import React` (useShared) eksikleri giderildi.
- **Mock Data:** `constants.ts`'teki `assignedTo`/`createdBy` → `assignedToId`/`createdById` rename.
- **Backend Adapter:** `PrismaLibSql` v7.8.0'da `{ url }` Config alıyor. `@libsql/client` kaldırıldı.
- **Express 5 Cast:** `req.params.id as string` — 20 route'da uygulandı.
- **DB Migration:** `Workflow`/`WorkflowStep` tabloları schema'da vardı, DB'de yoktu — `add_workflow_tables` migration'ı oluşturuldu.
- **UnsavedChangesProvider:** Layout root'una taşındı, Sidebar da kapsanıyor.
- **Sonuç:** `tsc` ✅ `vite build` ✅ Backend `/health` ✅ `/api/workflows` ✅

### 8. CRM Proposal Statuses & Lost Dashboard KPIs (v1.2.4)
- **Status Tracking:** Proposal flow updated to track "Kazanıldı (Won)", "Kaybedildi (Lost)", and "Bekliyor (Pending)". Lost deals are automatically subtracted from the active pipeline and routed to the "Lost List".
- **Dashboard Integration:** Added "Kaybedilen Değer" KPI card and "Kaybedilenler Listesi" panel to the admin dashboard, reflecting lost value transparently.

### 9. Contract Document Checklist & Parallel Workflows (v1.2.5)
- **Dynamic Documents Checklist:** The required documents checklist in the Contract Detail view is now fully stateful and interactive.
- **Sales Support Assignment:** Explicitly assigned the Sales Support Unit to prepare these files.
- **Strict Handoff Block:** The "Sözleşmeyi İmzala & Devret" button is strictly locked until all checklist documents are approved/verified.
- **Parallel PM & Procurement Activation:** Upon contract transfer, parallel high-priority tasks are automatically created in the tasks registry (`TodoTask`) for both **Project Management** (Unit `u4` - Proje Başlatma Planı) and **Procurement** (Unit `u3` - BoM Satınalma Başlatma).
- **Dashboard Operations Feed:** Created a "Canlı Operasyon Gelişmeleri" (Live Operations Developments) feed on the admin dashboard, displaying signed contracts and active PM/Procurement workflow task statuses in real-time.

## Portlar
- **Frontend:** `http://localhost:3000`
- **Backend:** `http://localhost:3002`

## Başlatma
```bash
# Terminal 1 — proje root
pnpm dev
# Terminal 2 — backend
cd backend && npx tsx src/index.ts
```

## Karar Günlüğü
| Tarih | Karar | Neden |
|-------|-------|-------|
| 15.05.2026 | LocalStorage Emekliliği | Veri tutarlılığını sağlamak ve gerçek ERP deneyimi sunmak için. |
| 15.05.2026 | Centralized Data Fetch | Modül bazlı fetch karmaşasını önlemek ve Single Source of Truth prensibi için. |
| 15.05.2026 | Tek-UI Standardizasyonu | MASTER standartlarına tam uyum ve premium kullanıcı deneyimi için. |
| 17.05.2026 | Workspace Migration | Proje atlası ve envanter yönetimi için `Management_Panels` altına taşındı. |
| 17.05.2026 | Favicon & Manifest Entegrasyonu | Kurumsal PWA standartları ve marka bütünlüğü için. |
| 17.05.2026 | Tek Tuşla Başlatıcı (run.js) | Geliştirici üretkenliği ve cross-platform kolaylık için. |
| 17.05.2026 | PrismaLibSql URL-only | v7.8.0 adapter Client değil Config alıyor. |
| 17.05.2026 | Workflow Migration | Schema'da tablolar DB'de yoktu, migration oluşturuldu. |
| 17.05.2026 | Evrak Bazlı Paralel Handoff | Sözleşme güvencesiyle eş zamanlı PM ve Satınalma aktivasyonu için. |

---
*Enflow v1.2.5 — 17 Mayıs 2026. Full-stack type-safe, build clean, DB senkron, workflow-driven.*
