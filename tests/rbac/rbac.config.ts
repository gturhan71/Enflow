// ============================================================================
// Enflow RBAC Test Yapılandırması
// Rolleri, endpoint'leri ve beklenen yetkileri buraya yaz.
// Testler bu matrisi otomatik koşar; bulunan sapmalar güvenlik açığıdır.
// ============================================================================

// --- URL'ler ----------------------------------------------------------------
export const baseURL    = process.env.ENFLOW_FRONTEND_URL ?? "http://localhost:5173";
export const apiBaseURL = process.env.ENFLOW_API_URL      ?? "http://localhost:3002";

// --- Roller (Enflow gerçek rolleri) -----------------------------------------
//
// YENİ ROL EKLEME ADIMLARI:
//   1. RoleName tipine yeni rol adını ekle (örn: "sales_manager")
//   2. ROLE_NAMES dizisine ekle
//   3. roles objesine email + tenantId ekle (.env'den oku)
//   4. apiMatrix içindeki her ApiCase için yeni rolün expect değerini belirle:
//      "allow" → bu rol erişebilmeli (401/403 OLMAMALI)
//      "deny"  → bu rol erişememeli (401 veya 403 beklenir)
//   5. uiMatrix içindeki her UiCase için "visible" / "hidden" belirle
//   6. DB'de kullanıcı yoksa önce DB'ye ekle, sonra .env'e bilgisini yaz
//   7. Testleri çalıştır: pnpm test — auth setup yeni rolü otomatik alır
//
// Şu an aktif roller:
//   GENERAL_MANAGER  — tam erişim
//   PRESALES_ENG     — teknik/presales modüller
//   SALES_REP        — CRM + fırsat oluşturma
//
// Yakında eklenecek roller (DB'ye kullanıcı eklenince aktif hale getirin):
//   sales_manager   → SALES_MANAGER rolü
//   procurement     → PROCUREMENT rolü
//   legal           → LEGAL rolü
//   project_manager → PROJECT_MANAGER rolü
//   admin           → ADMIN rolü

export type RoleName =
  | "general_manager"
  | "presales_eng"
  | "sales_rep"
  // Gerçek DB kullanıcılı (seed YOK):
  | "sales_mgr"
  | "sales_support"
  // Swimlane/yönetici rolleri (gerçek DB kullanıcıları — 2026-06-21 eklendi):
  | "finance_mgr"
  | "igpd_mgr"
  | "ksu_mgr"
  | "project_mgr"
  | "legal_mgr"
  | "procurement_mgr"
  | "isab_mgr"
  // Akış-dışı / destek / rezerve roller (gerçek DB kullanıcıları):
  | "admin"
  | "presales_mgr"
  | "technical_spec"
  | "operations_mgr"
  | "hr_mgr"
  | "auditor"
  | "kgd_mgr"
  // Yedek Yöneticisi — tüm akışa SALT-OKUNUR dahil; yalnız /backup yazabilir:
  | "backup_admin";

export const ROLE_NAMES: RoleName[] = [
  "general_manager",
  "presales_eng",
  "sales_rep",
  "sales_mgr",
  "sales_support",
  "finance_mgr",
  "igpd_mgr",
  "ksu_mgr",
  "project_mgr",
  "legal_mgr",
  "procurement_mgr",
  "isab_mgr",
  "admin",
  "presales_mgr",
  "technical_spec",
  "operations_mgr",
  "hr_mgr",
  "auditor",
  "kgd_mgr",
  "backup_admin",
];

// 19 rolün tamamı gerçek DB kullanıcısı (2026-06-21: eksik roller için kalıcı
// kullanıcılar oluşturuldu → seed mekanizmasına gerek kalmadı).
export const roles: Record<RoleName, { email: string; tenantId: string }> = {
  general_manager: {
    email:    process.env.GM_EMAIL      ?? "gokhan@t-ecosystem.com",
    tenantId: process.env.GM_TENANT_ID  ?? "tenant-1",
  },
  presales_eng: {
    email:    process.env.PRESALES_EMAIL     ?? "goktugturhan74@gmail.com",
    tenantId: process.env.PRESALES_TENANT_ID ?? "tenant-1",
  },
  sales_rep: {
    email:    process.env.SALES_EMAIL     ?? "mehmetkoc@enflow.com",
    tenantId: process.env.SALES_TENANT_ID ?? "tenant-1",
  },
  sales_mgr:       { email: "nur.becerikli@enflow.coom",      tenantId: "tenant-1" },
  sales_support:   { email: "nesrin.kayik@enflow.com",        tenantId: "tenant-1" },
  finance_mgr:     { email: "finans.muduru@enflow.com",       tenantId: "tenant-1" },
  igpd_mgr:        { email: "igpd.muduru@enflow.com",         tenantId: "tenant-1" },
  ksu_mgr:         { email: "sozlesme.uzmani@enflow.com",     tenantId: "tenant-1" },
  project_mgr:     { email: "proje.yoneticisi@enflow.com",    tenantId: "tenant-1" },
  legal_mgr:       { email: "hukuk.muduru@enflow.com",        tenantId: "tenant-1" },
  procurement_mgr: { email: "satinalma.muduru@enflow.com",    tenantId: "tenant-1" },
  isab_mgr:        { email: "isab.muduru@enflow.com",         tenantId: "tenant-1" },
  admin:           { email: "admin@enflow.com",               tenantId: "tenant-1" },
  presales_mgr:    { email: "presales.mgr@enflow.com",        tenantId: "tenant-1" },
  technical_spec:  { email: "teknik.uzman@enflow.com",        tenantId: "tenant-1" },
  operations_mgr:  { email: "operasyon.muduru@enflow.com",    tenantId: "tenant-1" },
  hr_mgr:          { email: "ik.muduru@enflow.com",           tenantId: "tenant-1" },
  auditor:         { email: "denetci@enflow.com",             tenantId: "tenant-1" },
  kgd_mgr:         { email: "kalite.muduru@enflow.com",       tenantId: "tenant-1" },
  backup_admin:    { email: "backup@t-ecosystem.com",         tenantId: "tenant-1" },
};

// Tüm test kullanıcıları için ortak parola (backfill/seed varsayılanı).
export const testPassword = process.env.RBAC_PASSWORD ?? "123456";

// Başka tenant'tan kullanıcı — izolasyon testleri için
export const crossTenantUser = {
  email:    process.env.CROSS_EMAIL     ?? "ali.mal@enflow.com",
  tenantId: process.env.CROSS_TENANT_ID ?? "cmq484c3f0000jbw3z10ae4ex",
};

// --- Gerçek kaynak ID'leri (tenant-1) ----------------------------------------
// Tenant izolasyon testlerinde tenant-1 kaynakları hedef alınacak.
export const T1_IDS = {
  customer:         "cmp9s09uy0000h4o389b6ebr6",
  opportunity:      "cmp9w930k0000xkw3okbst90s",
  proposal:         "cmpa5pciz0000hvw3qv3g9vkb",
  contractWorkflow: "cmqcfdjew0001ep9ks6ewzfpp",
  unit:             "cmp5lheha000059w3rs1buoba",
  task:             "cmpa41dux000k0yw3gpvom0z9",
  // Kullanıcı silme testi için var olmayan ID (yanlışlıkla gerçek veri silme yok)
  dummyUserId:      "nonexistent-user-id-rbac-test",
};

// --- API Yetki Matrisi -------------------------------------------------------
// "allow" → rol bu isteği yapabilmeli (401/403 OLMAMALI)
// "deny"  → rol bu isteği yapamamalı (401 veya 403 beklenir)
//
// YENİ ROL EKLENİNCE: her ApiCase'in expect objesine yeni rolün değerini ekle.
// Örnek: expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", sales_manager: "allow" }
type Perm = "allow" | "deny";

// Yeni 9 rol için tekrar eden expect blokları (route guard'larından deterministik türetildi).
// Çoğu endpoint GM/özel-rol kapılı → yeni rollerin tümü deny; gate'siz GET'ler → tümü allow.
// Akış-dışı 7 rol (admin/presales_mgr/technical_spec/operations_mgr/hr_mgr/auditor/kgd_mgr)
// hiçbir requireRole gate'inde yok → ND/NCW=deny, NA(gate'siz GET)=allow.
// backup_admin: salt-okunur (enforceReadOnlyRoles) → tüm mutasyonlar deny; gate'siz GET allow.
const ND = { sales_mgr: "deny", sales_support: "deny", finance_mgr: "deny", igpd_mgr: "deny", ksu_mgr: "deny", project_mgr: "deny", legal_mgr: "deny", procurement_mgr: "deny", isab_mgr: "deny", admin: "deny", presales_mgr: "deny", technical_spec: "deny", operations_mgr: "deny", hr_mgr: "deny", auditor: "deny", kgd_mgr: "deny", backup_admin: "deny" } as const; // gate'li (GM/özel) → bu roller deny
const NA = { sales_mgr: "allow", sales_support: "allow", finance_mgr: "allow", igpd_mgr: "allow", ksu_mgr: "allow", project_mgr: "allow", legal_mgr: "allow", procurement_mgr: "allow", isab_mgr: "allow", admin: "allow", presales_mgr: "allow", technical_spec: "allow", operations_mgr: "allow", hr_mgr: "allow", auditor: "allow", kgd_mgr: "allow", backup_admin: "allow" } as const; // gate'siz GET (tenantMiddleware) → tümü allow
// contract-workflows 7-rol gate: GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL_MGR+FINANCE_MGR+IGPD_MGR (backup_admin yok → deny)
const NCW = { sales_mgr: "allow", sales_support: "deny", finance_mgr: "allow", igpd_mgr: "allow", ksu_mgr: "allow", project_mgr: "allow", legal_mgr: "allow", procurement_mgr: "deny", isab_mgr: "deny", admin: "deny", presales_mgr: "deny", technical_spec: "deny", operations_mgr: "deny", hr_mgr: "deny", auditor: "deny", kgd_mgr: "deny", backup_admin: "deny" } as const;

// --- DMO Birimi (2026-08-03 eklendi) -----------------------------------------
// Kod incelemesi (backend/src/routes/dmo.ts): DMO_MGR diye ayrı bir rol YOK.
// GET /catalog,/agreements,/rates,/orders,/alarms → yalnız tenantMiddleware (gate yok) → NA ile aynı.
// editRoles  = requireRole(['GENERAL_MANAGER','SALES_MGR'])   → catalog/agreements/rates/orders yazma
// paramRoles = requireRole(['GENERAL_MANAGER','FINANCE_MGR']) → /settings (kur/ristürn parametreleri)
// ⚠️ Tutarsızlık: governance/role-matrix.ts SALES_MGR.modules listesinde DMO_VIEW YOK
// (bkz. mevcut "DMO Kataloğu menüsü" UI testi → sales_mgr: hidden). Yani SALES_MGR menüyü
// göremiyor ama backend'e doğrudan istek atarsa yazabiliyor → frontend/backend izin driftı.
// Karar verilmeli: (a) DMO_VIEW SALES_MGR'a eklenip menü açılsın, ya da (b) editRoles'tan
// SALES_MGR çıkarılıp yalnız GM kalsın. Bu matris şu anki (b öncesi) gerçek davranışı test eder.
const NDMO_EDIT  = { sales_mgr: "allow", sales_support: "deny", finance_mgr: "deny", igpd_mgr: "deny", ksu_mgr: "deny", project_mgr: "deny", legal_mgr: "deny", procurement_mgr: "deny", isab_mgr: "deny", admin: "deny", presales_mgr: "deny", technical_spec: "deny", operations_mgr: "deny", hr_mgr: "deny", auditor: "deny", kgd_mgr: "deny", backup_admin: "deny" } as const;
const NDMO_PARAM = { sales_mgr: "deny", sales_support: "deny", finance_mgr: "allow", igpd_mgr: "deny", ksu_mgr: "deny", project_mgr: "deny", legal_mgr: "deny", procurement_mgr: "deny", isab_mgr: "deny", admin: "deny", presales_mgr: "deny", technical_spec: "deny", operations_mgr: "deny", hr_mgr: "deny", auditor: "deny", kgd_mgr: "deny", backup_admin: "deny" } as const;

export interface ApiCase {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  expect: Record<RoleName, Perm>;
}

export const apiMatrix: ApiCase[] = [
  // --- Kullanıcı Yönetimi ---
  {
    name: "Kullanıcı listesi",
    method: "GET",
    path: "/api/users",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
  },
  {
    name: "Yeni kullanıcı oluştur",
    method: "POST",
    path: "/api/users",
    body: { name: "RBAC Test", email: "rbac-test@example.com", role: "SALES_REP", permissions: [], password: "123456" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
  },
  {
    name: "Kullanıcı sil",
    method: "DELETE",
    path: `/api/users/${T1_IDS.dummyUserId}`,
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
  },

  // --- Müşteri Yönetimi ---
  {
    name: "Müşteri listesi",
    method: "GET",
    path: "/api/customers",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },
  {
    name: "Müşteri sil",
    method: "DELETE",
    path: `/api/customers/${T1_IDS.dummyUserId}`,
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
  },

  // --- Fırsatlar ---
  {
    name: "Fırsat listesi",
    method: "GET",
    path: "/api/opportunities",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },
  {
    name: "Yeni fırsat oluştur",
    method: "POST",
    path: "/api/opportunities",
    body: { title: "RBAC Test Fırsat", value: 0, status: "LEAD", probability: 10, customerId: "x", assignedToId: "x" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "allow", ...ND },
  },

  // --- Teklifler ---
  {
    name: "Teklif listesi",
    method: "GET",
    path: "/api/proposals",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },

  // --- Birimler ---
  {
    name: "Birim listesi",
    method: "GET",
    path: "/api/units",
    // backup_admin units GET kapısına eklendi (salt-okunur akış dahli) → allow
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "deny", ...ND, backup_admin: "allow" },
  },
  {
    name: "Birim oluştur",
    method: "POST",
    path: "/api/units",
    body: { name: "RBAC Test Birim" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
  },

  // --- Görevler ---
  {
    name: "Görev listesi",
    method: "GET",
    path: "/api/tasks",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },

  // --- Sözleşme Süreci (yüksek hassasiyet) ---
  {
    name: "Sözleşme süreçleri listesi",
    method: "GET",
    path: "/api/contract-workflows",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NCW },
  },
  {
    name: "Sözleşme süreci oluştur",
    method: "POST",
    path: "/api/contract-workflows",
    body: { title: "RBAC Test Sözleşme" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NCW },
  },

  // --- Arşiv ---
  {
    // 2026-08-03 (Faz: 8-madde düzeltme, madde 8) — backend gevşetildi: archive.ts artık
    // yalnız tenantMiddleware (documents.ts'in aynı deseni), requireRole(['GENERAL_MANAGER'])
    // kaldırıldı. Kullanıcı kararı: "Backend'i gevşet, izin gerçekten çalışsın" — gerçek
    // yetkilendirme frontend'in ARCHIVE_VIEW izni + PermissionGate'te. Bu yüzden artık
    // gate'siz GET (tenantMiddleware) → tüm roller allow (NA deseni), ND DEĞİL.
    name: "Arşiv listesi",
    method: "GET",
    path: "/api/archive",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },

  // --- Yedekleme (BACKUP_ADMIN + GM kapısı) ---
  {
    name: "Yedek listesi (backup gate)",
    method: "GET",
    path: "/api/backup/jobs",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND, backup_admin: "allow" },
  },

  // --- DMO Kataloğu (ayrı lisanslı modül — 2026-08-03 eklendi) ---
  // GET'ler gate'siz (tenantMiddleware) → NA. Yazma → editRoles/paramRoles (yukarı bkz.).
  {
    name: "DMO katalog listesi",
    method: "GET",
    path: "/api/dmo/catalog",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },
  {
    // Şema zorunlu alanları: dmoCode + name (backend/prisma/schema.prisma DmoCatalogItem).
    name: "DMO katalog kalemi oluştur",
    method: "POST",
    path: "/api/dmo/catalog",
    body: { dmoCode: "RBAC-TEST-001", name: "RBAC Test DMO Ürün" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NDMO_EDIT },
  },
  {
    // Şema zorunlu alanları: agreementNo + title (DmoFrameworkAgreement).
    name: "DMO çerçeve anlaşma oluştur",
    method: "POST",
    path: "/api/dmo/agreements",
    body: { agreementNo: "RBAC-TEST-AGR-001", title: "RBAC Test Anlaşma" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NDMO_EDIT },
  },
  {
    // dmo.ts POST /orders: orderNo + institutionName zorunlu; kalemler normalizeItems(b.items)
    // ile işleniyor — top-level catalogItemId/quantity DEĞİL, items[] dizisi bekleniyor.
    name: "DMO sipariş oluştur",
    method: "POST",
    path: "/api/dmo/orders",
    body: {
      orderNo: "RBAC-TEST-ORD-001",
      institutionName: "RBAC Test Kurumu",
      items: [{ name: "RBAC Test Kalem", qty: 1, unitPrice: 100, unitCost: 50 }],
    },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NDMO_EDIT },
  },
  {
    name: "DMO sipariş sil",
    method: "DELETE",
    path: `/api/dmo/orders/${T1_IDS.dummyUserId}`,
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NDMO_EDIT },
  },
  {
    // setDmoParams(Partial<DmoCostParams>) → gerçek alan minMarginPct (risturnRate YOK).
    name: "DMO ayarları güncelle (kâr eşiği)",
    method: "PUT",
    path: "/api/dmo/settings",
    body: { minMarginPct: 0.1 },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...NDMO_PARAM },
  },
  {
    name: "DMO kârsız satış alarmları",
    method: "GET",
    path: "/api/dmo/alarms",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow", ...NA },
  },
];

// --- Tenant İzolasyonu (IDOR) ------------------------------------------------
// crossTenantUser, tenant-2 kullanıcısıdır.
// tenant-1 kaynaklarına x-tenant-id:tenant-1 göndererek erişmeye çalışacak.
// Beklenti: 403 veya 404 — erişim engellenmeli.
// Gerçek durum: header'daki tenant doğrulanmıyor → IDOR mevcut olabilir.
export interface IsolationCase {
  name: string;
  method: "GET" | "PUT" | "DELETE";
  path: string;
  targetTenantId: string; // erişilmeye çalışılan tenant (yabancı)
}

export const isolationMatrix: IsolationCase[] = [
  {
    name: "Başka tenant müşteri listesi okuma (IDOR)",
    method: "GET",
    path: "/api/customers",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant fırsat listesi okuma (IDOR)",
    method: "GET",
    path: "/api/opportunities",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant tekil fırsat okuma (IDOR)",
    method: "GET",
    path: `/api/opportunities/${T1_IDS.opportunity}`,
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant sözleşme süreci okuma (IDOR)",
    method: "GET",
    path: `/api/contract-workflows/${T1_IDS.contractWorkflow}`,
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant kullanıcı listesi okuma (IDOR)",
    method: "GET",
    path: "/api/users",
    targetTenantId: "tenant-1",
  },
  // Büyüme Analitiği Faz 1 — yeni salt-okunur raporlar (IDOR koruması)
  {
    name: "Başka tenant alacak yaşlandırma okuma (IDOR)",
    method: "GET",
    path: "/api/finance/aging",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant funnel okuma (IDOR)",
    method: "GET",
    path: "/api/reports/funnel",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant tender analitik okuma (IDOR)",
    method: "GET",
    path: "/api/reports/tender-analytics",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant BoM varyans okuma (IDOR)",
    method: "GET",
    path: "/api/reports/bom-variance",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant konsantrasyon okuma (IDOR)",
    method: "GET",
    path: "/api/reports/concentration",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant forecast okuma (IDOR)",
    method: "GET",
    path: "/api/reports/forecast",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant bid skorkartı okuma (IDOR)",
    method: "GET",
    path: "/api/reports/bid-scorecard",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant belge portföyü okuma (IDOR)",
    method: "GET",
    path: "/api/reports/document-portfolio",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant iş sağlığı skoru okuma (IDOR)",
    method: "GET",
    path: "/api/reports/business-health",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant proje sağlığı okuma (IDOR)",
    method: "GET",
    path: "/api/reports/project-health",
    targetTenantId: "tenant-1",
  },
  {
    name: "Başka tenant müşteri sağlığı okuma (IDOR)",
    method: "GET",
    path: "/api/reports/customer-health",
    targetTenantId: "tenant-1",
  },
  { name: "Başka tenant DMO katalog okuma (IDOR)", method: "GET", path: "/api/dmo/catalog", targetTenantId: "tenant-1" },
  { name: "Başka tenant DMO anlaşma okuma (IDOR)", method: "GET", path: "/api/dmo/agreements", targetTenantId: "tenant-1" },
  { name: "Başka tenant DMO kur okuma (IDOR)", method: "GET", path: "/api/dmo/rates", targetTenantId: "tenant-1" },
  { name: "Başka tenant DMO sipariş okuma (IDOR)", method: "GET", path: "/api/dmo/orders", targetTenantId: "tenant-1" },
  { name: "Başka tenant DMO alarm okuma (IDOR)", method: "GET", path: "/api/dmo/alarms", targetTenantId: "tenant-1" },
  { name: "Başka tenant DMO analitik okuma (IDOR)", method: "GET", path: "/api/reports/dmo-analytics", targetTenantId: "tenant-1" },
  { name: "Başka tenant işletme maliyeti havuzu okuma (IDOR)", method: "GET", path: "/api/finance/operating-cost-pool", targetTenantId: "tenant-1" },
  { name: "Başka tenant birim bütçesi okuma (IDOR)", method: "GET", path: "/api/units/budgets", targetTenantId: "tenant-1" },
  { name: "Başka tenant birim absorpsiyon okuma (IDOR)", method: "GET", path: "/api/reports/unit-budget-absorption", targetTenantId: "tenant-1" },
];

// --- UI Erişim Matrisi ------------------------------------------------------
// Enflow bir SPA — URL tabanlı erişim değil, sidebar görünürlüğü kontrol edilir.
// Her test login → içerik görünür mü / erişim engeli var mı bakar.
export interface UiCase {
  name: string;
  sidebarText: string;        // Sidebar'da görünmesi/gizlenmesi beklenen metin
  expect: Record<RoleName, "visible" | "hidden">;
}

// UI görünürlük — yeni roller (seed izinleri = matris modülleri; sales_mgr/support gerçek DB izinleri).
// backup_admin tüm *_VIEW izinlerine sahip (salt-okunur) → menüler GÖRÜNÜR; ama Test
// Ortamı (GM-only) ve Ayarlar (SETTINGS_VIEW yok) gizli. UH'te hidden; aşağıda override.
const UH = { sales_mgr: "hidden", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "hidden" } as const;
// Presales üst menü: PRESALES_VIEW veya COST_ANALYSIS_VIEW → sales_mgr + presales_mgr + technical_spec + backup_admin
const UPRES = { ...UH, sales_mgr: "visible", presales_mgr: "visible", technical_spec: "visible", backup_admin: "visible" } as const;
// CRM üst menü: CRM_VIEW → sales_mgr + igpd_mgr + presales_mgr + backup_admin
const UCRM = { ...UH, sales_mgr: "visible", igpd_mgr: "visible", presales_mgr: "visible", backup_admin: "visible" } as const;

export const uiMatrix: UiCase[] = [
  {
    name: "Test Ortamı bölümü (sadece GM)",
    sidebarText: "Güvenlik Testi",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", ...UH },
  },
  {
    name: "Ayarlar menüsü",
    sidebarText: "Ayarlar",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", ...UH, admin: "visible" },
  },
  {
    // "Presales & Dizayn" üst menüsü artık YALNIZ "BoM & Tasarım" (PRESALES_VIEW)
    // alt öğesini içerir — "Maliyet Analizi" CRM (Satış) grubuna taşındı. Dolayısıyla
    // bu menü yalnız PRESALES_VIEW olan rollere görünür. sales_rep'te PRESALES_VIEW
    // yok (cost CRM'e taşındı) → sales_rep için artık GİZLİ. sales_mgr'da PRESALES_VIEW
    // ayrıca bulunduğu için görünür kalır.
    name: "Presales menüsü",
    sidebarText: "Presales",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "hidden", ...UPRES },
  },
  {
    name: "CRM menüsü",
    sidebarText: "CRM",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", ...UCRM },
  },
  {
    // DMO Kataloğu: yalnız DMO_VIEW izni olanlarda (v1'de yalnız GM superuser).
    name: "DMO Kataloğu menüsü",
    sidebarText: "DMO Kataloğu",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", ...UH },
  },

  // ── Modül boyutu — kalan NAV_ITEMS üst-seviye modülleri (2026-08-03) ────────
  // Yukarıdaki 5 kayıt yalnızca spot-check'ti (5/19 modül). Buradaki 15 kayıt,
  // NAV_ITEMS'teki geri kalan tüm üst-seviye modülleri kapsar — artık modül
  // boyutu da tam (19/19). Her `expect` DB'deki gerçek test kullanıcısı
  // `permissions` alanından üretildi (src/contexts/AuthContext.hasPermission
  // ile BİREBİR aynı mantık: GENERAL_MANAGER superuser, diğerleri liste
  // üyeliği) — elle tahmin değil. Yeni bir NAV_ITEMS modülü eklendiğinde
  // buraya da bir kayıt eklenmeli (aksi halde o modül RBAC UI testinde kör
  // nokta kalır).
  {
    name: "Dashboard menüsü",
    sidebarText: "Dashboard",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "visible", procurement_mgr: "visible", isab_mgr: "visible", admin: "visible", presales_mgr: "visible", technical_spec: "visible", operations_mgr: "visible", hr_mgr: "visible", auditor: "visible", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Ziyaret Planı menüsü",
    sidebarText: "Ziyaret Planı",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "visible", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Satış Destek menüsü",
    sidebarText: "Satış Destek",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "visible", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Sözleşme Yönetimi menüsü",
    sidebarText: "Sözleşme Yönetimi",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "visible", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Proje Yönetimi menüsü",
    sidebarText: "Proje Yönetimi",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "hidden", sales_mgr: "visible", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "visible", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "visible", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Satın Alma menüsü",
    sidebarText: "Satın Alma",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "visible", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "visible", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Garanti & Servis menüsü",
    sidebarText: "Garanti & Servis",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "hidden", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "hidden" },
  },
  {
    name: "Finans menüsü",
    sidebarText: "Finans",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "visible", sales_support: "hidden", finance_mgr: "visible", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Görevler & Takip menüsü",
    sidebarText: "Görevler & Takip",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "visible", procurement_mgr: "visible", isab_mgr: "visible", admin: "hidden", presales_mgr: "visible", technical_spec: "visible", operations_mgr: "visible", hr_mgr: "visible", auditor: "hidden", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Yönetim Raporları menüsü",
    sidebarText: "Yönetim Raporları",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "visible", sales_support: "hidden", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "visible", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Genel Hususlar menüsü",
    sidebarText: "Genel Hususlar",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "hidden", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Şirket Evrakları menüsü",
    sidebarText: "Şirket Evrakları",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "visible", procurement_mgr: "visible", isab_mgr: "visible", admin: "hidden", presales_mgr: "visible", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "visible", auditor: "hidden", kgd_mgr: "visible", backup_admin: "visible" },
  },
  {
    name: "Fiziksel Arşiv menüsü",
    sidebarText: "Fiziksel Arşiv",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "visible", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Yedekleme menüsü",
    sidebarText: "Yedekleme",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", sales_mgr: "hidden", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden", admin: "hidden", presales_mgr: "hidden", technical_spec: "hidden", operations_mgr: "hidden", hr_mgr: "hidden", auditor: "hidden", kgd_mgr: "hidden", backup_admin: "visible" },
  },
  {
    name: "Yardım menüsü",
    sidebarText: "Yardım",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", sales_mgr: "visible", sales_support: "visible", finance_mgr: "visible", igpd_mgr: "visible", ksu_mgr: "visible", project_mgr: "visible", legal_mgr: "visible", procurement_mgr: "visible", isab_mgr: "visible", admin: "visible", presales_mgr: "visible", technical_spec: "visible", operations_mgr: "visible", hr_mgr: "visible", auditor: "visible", kgd_mgr: "visible", backup_admin: "visible" },
  },
];
