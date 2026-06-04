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

### 10. Interactive 8-Step End-to-End Simulation Dashboard (v1.2.6)
- **End-to-End Stepper Simulator:** Developed a stunning, state-of-the-art interactive stepper simulator inside `WorkflowBuilder.tsx` charting the complete ERP flow: CRM Opportunity → AI Presales BoM → Cost & Proposal Approval → Won Conversion → Contract Docs Checklist → Parallel PM & Procurement Activation → Procurement Order ETA & Kanban Execution → Project Closure & Physical Archiving.
- **Mock Integration Terminal:** Renders live, reactive WhatsApp API and MS Exchange Graph API mock payloads for each stage, detailing exactly what notifications are fired, to whom, and why.
- **Prisma Entity Inspector:** Displays realistic JSON schema models of the records created/mutated in SQLite database at each step.

### 11. Core Inter-Module Flow Synchronization (v1.2.7)
- **Shared Tasks State Injection:** Resolved `undefined` task creation bug by fully injecting `tasks` and `setTasks` into `ContractModule` inside `App.tsx`, enabling real-time generation of parallel PM and Procurement duties during contract handoff.
- **Auto-Selection UX Default:** Smart-mapped `selectedContractId` in `ContractModule.tsx` to automatically focus on the first unsigned contract, minimizing friction upon redirection from the CRM.
- **Project Completion & Physical Archive Handoff:**
  - Passed `setProjects` and `setActiveTab` to `ProjectManagementModule.tsx`.
  - Added a state-driven "Geçici Kabulü Onayla & Tamamla (%100)" button in the PM reporting panel that updates project status to `COMPLETED` globally.
  - Enabled direct transition to the **Fiziksel Arşiv (ArchiveModule)** via a premium "Evrakları Fiziksel Arşive Teslim Et" handoff action upon project closeout.

### 12. Global Dynamic Headers & Glassmorphic Logout (v1.2.8)
- **Dynamic Module Title Resolution:** Added a dynamic lookup function mapping the active layout tab directly to custom localized titles (e.g. CRM & Satış Fırsatları, Sözleşme Yönetim Modülü, Proje Yönetim Paneli), correcting the previous blank page title issue.
- **Glowing Crimson Glassmorphic Logout:** Engineered a stunning, high-contrast global Logout button within the top header group, styled with red-glowing glassmorphism and animated hover states.
- **Universal Page Visibility:** Passed the global `onLogout` auth action handler down through `App.tsx` directly into the `Header` component, ensuring instant, one-click logout capability on every page of the application.

### 13. Canlı Pazarlık Kokpiti & Açık Eksiltme Platformu (v1.3.2)
- **"Pazarlığa Açık" Teklif Seçimi:** Satış teklifi hazırlama/düzenleme (`ProposalEditor.tsx`) aşamasına zırhlı ve glowing "Pazarlığa Açık" toggle switch'i eklendi.
- **Dinamik Müzakere Filtresi:** Pazarlık modülünde, sadece hazırlık aşamasında "Pazarlığa Açık" olarak işaretlenmiş teklifler listelenir. Seçilen teklifin versiyonu ve net fiyatı baz alınarak müzakere simülasyonu başlatılır.
- **Otomatik Süreç Handoff'u:** Teklif "Pazarlığa Açık" olarak kaydedildiğinde, backend üzerinde fırsatın statüsü otomatik olarak `'NEGOTIATION'` aşamasına taşınarak satış hunisi (sales pipeline) senkronize edilir.
- **Çift Modlu Pazarlık Seçeneği:** Satış yöneticisine 1v1 Canlı Müzakere veya Çoklu Rakip katılımlı **Açık Eksiltme (Reverse Auction)** arasında geçiş yapabilme imkanı sunan üst düzey tab bar entegre edildi.
- **Açık Eksiltme Simülatörü:** Çoklu firmaların katıldığı, tur tabanlı teklif eksiltme müzayedesi geliştirildi:
  - Rakipler ve bizim son tekliflerimizi gösteren canlı katılımcı teklif tablosu.
  - Dinamik tur kuralları: Katılımcı rakip firma sayısı, ilk tur min eksiltme adımı ve tur başına eksiltme azalma oranı (sıkılaştırma katsayısı) özelleştirilebilir.
  - Otomatik Teklif Eksiltme butonu veya tamamen **Manuel Teklif Giriş** paneli.
  - Canlı tur akış logları, rakiplerin dip maliyetlerine ulaşıp teker teker ihaleden çekilme (drop-out) simülasyonu.
  - Son tek kazanan teklif sahibi kalana kadar devam eden gerçek zamanlı round mantığı.
- **Zırhlı Maliyet Koruması (En Dip Rakam):** Pazarlık ve açık eksiltme esnasında girilen teklifler, Maliyet Analiz Modülü verilerinden (BoM Ürün Maliyetleri + Giderler) hesaplanan **En Dip Maliyet (Floor Cost)** ile denetlenir. Bizim teklifimiz en dip rakamın altına indiğinde sistem onay uyarısı vererek güvenliği sağlar.
- **Executive Yetkilendirme Kontrolü:** Pazarlık odası sadece `GENERAL_MANAGER` rolüne açılmıştır, yetkisiz girişler zırhlı kilit ekranıyla korunur.

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
| 17.05.2026 | E2E Operasyonel Simülatör | Müşterinin fırsattan kapanışa kadar olan tüm akışı görsel olarak deneyimlemesi için. |
| 18.05.2026 | Uçtan Uca Modül Senkronizasyonu | CRM, Sözleşme, PM, Satınalma ve Fiziksel Arşiv modüllerini kesintisiz bağlamak için. |
| 18.05.2026 | Global Header Logout & Başlıklar | Tüm ekranlarda güvenli tek-tık çıkış ve dinamik başlık deneyimi sağlamak için. |
| 18.05.2026 | Canlı Pazarlık Simülasyonu | Satış müdürüne özel dip maliyet korumalı interaktif müzakere paneli sunmak için. |
| 18.05.2026 | Çoklu Açık Eksiltme İhalesi | Rakip firmaların katıldığı turlu, kurallı ve manuel/otomatik eksiltmeli müzayede simülasyonu sunmak için. |
| 18.05.2026 | Pazarlığa Açık Teklif Koruması | Teklif hazırlama aşamasına 'Pazarlığa Açık' bayrağı ve pazarlık kokpiti seçici entegrasyonu sunmak için. |
- **Sıralı Manuel Açık Eksiltme İhalesi:** Rakip firmaların ve Bizim tekliflerin manuel form üzerinden girildiği, ardışık eksiltme kurallarına göre sıralı doğrulanan, çekilme/dahil etme destekli premium ihale motoru entegre etmek için.
| 01.06.2026 | Yerel ERP & CRM Sihirbazı | Türkiye'de en yaygın kullanılan Logo, Mikro, Netsis sistemleri için veri şeması eşlemeli entegrasyon sihirbazı eklemek için. |
| 05.06.2026 | Ticari Lisanslama (Proprietary) | Projenin SaaS potansiyeli ve kurumsal değeri korunmak amacıyla ticari lisans modeline geçildi. |
| 05.06.2026 | Pricing & Subscription Modülü | KOBİ, Pay-As-You-Go ve On-Premise modellerini içeren interaktif aktivasyon paneli eklendi. |

### 14. Ticari Lisanslama & Fikri Mülkiyet Koruması (v1.5.0)
- **Proprietary Model:** Proje açık kaynak modelinden tamamen ticari (Proprietary) modele geçirildi.
- **LICENSE Dosyası:** Kök dizine "All Rights Reserved" ibaresini ve kullanım kısıtlamalarını içeren ticari `LICENSE` dosyası eklendi.
| 05.06.2026 | Pricing & Subscription Modülü | KOBİ, Pay-As-You-Go ve On-Premise modellerini içeren interaktif aktivasyon paneli eklendi. |
| 05.06.2026 | Master License Generator | Firmalara özel şifrelenmiş lisans anahtarı üretme ve aktivasyon motoru entegre edildi. |
| 05.06.2026 | 30 Günlük Deneme Lisansı | Tek tıkla üretilebilen, 30 gün sınırlı deneme (Trial) lisansı altyapısı eklendi. |

### 15. Pricing & Subscription Management (The Profit Core - v1.5.2)
- **Unified Subscription Engine:** KOBİ (SaaS), Pay-As-You-Go (Metrik tabanlı) ve On-Premise (Kurumsal) lisans modelleri tek bir panelde toplandı.
- **Universal Hybrid AI Model:** AI servisleri tüm modellerde hibrit bulut aboneliği üzerinden çalışacak şekilde ayrıştırıldı.
- **Master License Generator (Trial Support):** Master panelde **30 Günlük Deneme Modu** eklendi. Bu mod aktif edildiğinde sistem otomatik olarak 30 günlük son kullanma tarihi ve "Trial" bayrağı içeren anahtarlar üretir.
- **Trial Status Monitoring:** Müşteri panelinde deneme lisansı kullanılıyorsa, "DENEME" badge'i ve anlık olarak **kalan gün sayısı** gösterilmektedir.
- **Secure Key Activation:** Firma adı, model, limitler ve trial bilgisini içeren Base64 imzalı aktivasyon motoru.

---
*Enflow v1.5.2 — 5 Haziran 2026. Full-stack type-safe, proprietary license secured, trial licensing & remaining days tracking enabled.*
