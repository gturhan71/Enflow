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
  // Swimlane/yönetici rolleri — global-setup'ta seed edilir (rbac-test-* email):
  | "finance_mgr"
  | "igpd_mgr"
  | "ksu_mgr"
  | "project_mgr"
  | "legal_mgr"
  | "procurement_mgr"
  | "isab_mgr";

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
];

// Seed edilen swimlane rolleri → DB rol anahtarı + seed izinleri (matris modülleri).
// global-setup.ts bunları rbac-test-<key>@enflow.test email'iyle oluşturur;
// global-teardown (cleanup: email contains 'rbac-test') otomatik siler.
export const SEED_ROLES: Record<string, { dbRole: string; permissions: string[] }> = {
  finance_mgr:     { dbRole: "FINANCE_MGR",     permissions: ["DASHBOARD_VIEW", "FINANCE_VIEW", "MANAGEMENT_REPORTS_VIEW", "CONTRACTS_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
  igpd_mgr:        { dbRole: "IGPD_MGR",        permissions: ["DASHBOARD_VIEW", "CRM_VIEW", "MANAGEMENT_REPORTS_VIEW", "CONTRACTS_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
  ksu_mgr:         { dbRole: "KSU_MGR",         permissions: ["DASHBOARD_VIEW", "CONTRACTS_VIEW", "MANAGEMENT_REPORTS_VIEW", "DOCUMENTS_VIEW", "ARCHIVE_VIEW", "TODO_VIEW"] },
  project_mgr:     { dbRole: "PROJECT_MGR",     permissions: ["DASHBOARD_VIEW", "PROJECT_MGMT_VIEW", "MANAGEMENT_REPORTS_VIEW", "CONTRACTS_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
  legal_mgr:       { dbRole: "LEGAL_MGR",       permissions: ["DASHBOARD_VIEW", "CONTRACTS_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
  procurement_mgr: { dbRole: "PROCUREMENT_MGR", permissions: ["DASHBOARD_VIEW", "PROCUREMENT_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
  isab_mgr:        { dbRole: "ISAB_MGR",        permissions: ["DASHBOARD_VIEW", "SALES_SUPPORT_VIEW", "DOCUMENTS_VIEW", "TODO_VIEW"] },
};

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
  // Gerçek DB kullanıcıları (seed yok):
  sales_mgr:     { email: process.env.SALES_MGR_EMAIL     ?? "nur.becerikli@enflow.coom", tenantId: "tenant-1" },
  sales_support: { email: process.env.SALES_SUPPORT_EMAIL ?? "nesrin.kayik@enflow.com",   tenantId: "tenant-1" },
  // Seed edilen swimlane rolleri (rbac-test-* → teardown siler):
  finance_mgr:     { email: "rbac-test-finance_mgr@enflow.test",     tenantId: "tenant-1" },
  igpd_mgr:        { email: "rbac-test-igpd_mgr@enflow.test",        tenantId: "tenant-1" },
  ksu_mgr:         { email: "rbac-test-ksu_mgr@enflow.test",         tenantId: "tenant-1" },
  project_mgr:     { email: "rbac-test-project_mgr@enflow.test",     tenantId: "tenant-1" },
  legal_mgr:       { email: "rbac-test-legal_mgr@enflow.test",       tenantId: "tenant-1" },
  procurement_mgr: { email: "rbac-test-procurement_mgr@enflow.test", tenantId: "tenant-1" },
  isab_mgr:        { email: "rbac-test-isab_mgr@enflow.test",        tenantId: "tenant-1" },
};

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
const ND = { sales_mgr: "deny", sales_support: "deny", finance_mgr: "deny", igpd_mgr: "deny", ksu_mgr: "deny", project_mgr: "deny", legal_mgr: "deny", procurement_mgr: "deny", isab_mgr: "deny" } as const; // gate'li (GM/özel) → yeni roller deny
const NA = { sales_mgr: "allow", sales_support: "allow", finance_mgr: "allow", igpd_mgr: "allow", ksu_mgr: "allow", project_mgr: "allow", legal_mgr: "allow", procurement_mgr: "allow", isab_mgr: "allow" } as const; // gate'siz (tenantMiddleware) → tümü allow
// contract-workflows 7-rol gate: GM+KSU+SALES_MGR+PROJECT_MGR+LEGAL_MGR+FINANCE_MGR+IGPD_MGR
const NCW = { sales_mgr: "allow", sales_support: "deny", finance_mgr: "allow", igpd_mgr: "allow", ksu_mgr: "allow", project_mgr: "allow", legal_mgr: "allow", procurement_mgr: "deny", isab_mgr: "deny" } as const;

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
    body: { name: "RBAC Test", email: "rbac-test@example.com", role: "SALES_REP", permissions: [] },
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
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "deny", ...ND },
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
    name: "Arşiv listesi",
    method: "GET",
    path: "/api/archive",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny", ...ND },
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
const UH = { sales_mgr: "hidden", sales_support: "hidden", finance_mgr: "hidden", igpd_mgr: "hidden", ksu_mgr: "hidden", project_mgr: "hidden", legal_mgr: "hidden", procurement_mgr: "hidden", isab_mgr: "hidden" } as const;
// Presales üst menü: PRESALES_VIEW veya COST_ANALYSIS_VIEW → yalnız sales_mgr (gerçek izinleri içeriyor)
const UPRES = { ...UH, sales_mgr: "visible" } as const;
// CRM üst menü: CRM_VIEW → sales_mgr (gerçek) + igpd_mgr (seed CRM_VIEW)
const UCRM = { ...UH, sales_mgr: "visible", igpd_mgr: "visible" } as const;

export const uiMatrix: UiCase[] = [
  {
    name: "Test Ortamı bölümü (sadece GM)",
    sidebarText: "Güvenlik Testi",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", ...UH },
  },
  {
    name: "Ayarlar menüsü",
    sidebarText: "Ayarlar",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden", ...UH },
  },
  {
    // "Presales & Dizayn" üst menüsü, alt öğelerinden HERHANGİ BİRİ erişilebilir
    // olduğunda görünür (bkz. Sidebar.tsx — parent OR child mantığı). Alt öğeler:
    // "BoM & Tasarım" (PRESALES_VIEW) + "Maliyet Analizi" (COST_ANALYSIS_VIEW).
    // sales_rep'te COST_ANALYSIS_VIEW olduğu için üst menü görünür — bu bir açık
    // değil, Maliyet Analizi'ne erişimin doğru sonucu. PRESALES_VIEW (BoM) leaf'i
    // ayrıca gizli kalır.
    name: "Presales menüsü",
    sidebarText: "Presales",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", ...UPRES },
  },
  {
    name: "CRM menüsü",
    sidebarText: "CRM",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible", ...UCRM },
  },
];
