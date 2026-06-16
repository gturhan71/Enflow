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
  | "sales_rep";
  // Yeni roller buraya eklenir:
  // | "sales_manager"
  // | "procurement"
  // | "legal"
  // | "project_manager"

export const ROLE_NAMES: RoleName[] = [
  "general_manager",
  "presales_eng",
  "sales_rep",
  // "sales_manager",
  // "procurement",
  // "legal",
  // "project_manager",
];

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
  // Yeni rol örneği (aktif edince üstteki RoleName ve ROLE_NAMES'e de ekle):
  // sales_manager: {
  //   email:    process.env.SALES_MANAGER_EMAIL     ?? "",
  //   tenantId: process.env.SALES_MANAGER_TENANT_ID ?? "tenant-1",
  // },
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
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },
  {
    name: "Yeni kullanıcı oluştur",
    method: "POST",
    path: "/api/users",
    body: { name: "RBAC Test", email: "rbac-test@example.com", role: "SALES_REP", permissions: [] },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },
  {
    name: "Kullanıcı sil",
    method: "DELETE",
    path: `/api/users/${T1_IDS.dummyUserId}`,
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },

  // --- Müşteri Yönetimi ---
  {
    name: "Müşteri listesi",
    method: "GET",
    path: "/api/customers",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow" },
  },
  {
    name: "Müşteri sil",
    method: "DELETE",
    path: `/api/customers/${T1_IDS.dummyUserId}`,
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },

  // --- Fırsatlar ---
  {
    name: "Fırsat listesi",
    method: "GET",
    path: "/api/opportunities",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow" },
  },
  {
    name: "Yeni fırsat oluştur",
    method: "POST",
    path: "/api/opportunities",
    body: { title: "RBAC Test Fırsat", value: 0, status: "LEAD", probability: 10, customerId: "x", assignedToId: "x" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "allow" },
  },

  // --- Teklifler ---
  {
    name: "Teklif listesi",
    method: "GET",
    path: "/api/proposals",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow" },
  },

  // --- Birimler ---
  {
    name: "Birim listesi",
    method: "GET",
    path: "/api/units",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "deny" },
  },
  {
    name: "Birim oluştur",
    method: "POST",
    path: "/api/units",
    body: { name: "RBAC Test Birim" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },

  // --- Görevler ---
  {
    name: "Görev listesi",
    method: "GET",
    path: "/api/tasks",
    expect: { general_manager: "allow", presales_eng: "allow", sales_rep: "allow" },
  },

  // --- Sözleşme Süreci (yüksek hassasiyet) ---
  {
    name: "Sözleşme süreçleri listesi",
    method: "GET",
    path: "/api/contract-workflows",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },
  {
    name: "Sözleşme süreci oluştur",
    method: "POST",
    path: "/api/contract-workflows",
    body: { title: "RBAC Test Sözleşme" },
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
  },

  // --- Arşiv ---
  {
    name: "Arşiv listesi",
    method: "GET",
    path: "/api/archive",
    expect: { general_manager: "allow", presales_eng: "deny", sales_rep: "deny" },
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

export const uiMatrix: UiCase[] = [
  {
    name: "Test Ortamı bölümü (sadece GM)",
    sidebarText: "Güvenlik Testi",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden" },
  },
  {
    name: "Ayarlar menüsü",
    sidebarText: "Ayarlar",
    expect: { general_manager: "visible", presales_eng: "hidden", sales_rep: "hidden" },
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
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible" },
  },
  {
    name: "CRM menüsü",
    sidebarText: "CRM",
    expect: { general_manager: "visible", presales_eng: "visible", sales_rep: "visible" },
  },
];
