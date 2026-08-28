// Enflow — Rol bazlı varsayılan izin ataması.
//
// Kaynak: governance/role-matrix.ts (ROLE_MATRIX[].modules — kanonik VIEW-seviyeli
// izin listesi, `pnpm audit:roles` ile denetlenir) + iki EDIT-seviyeli izin eklemesi.
// EDIT izinleri (CRM_EDIT, PRESALES_EDIT — NAV_ITEMS'ta yer almayan, yalnız
// permissionTree.ts EXTRA_CHILD_PERMISSIONS'ta tanımlı aksiyon izinleri) yalnızca
// role-matrix'te o rolün 'R' (Responsible) olarak işaretlendiği görevlere sahipse
// eklenir: SALES_REP → "Fırsat oluşturma/güncelleme" (CRM_EDIT), PRESALES_ENG →
// "BoM (malzeme listesi) hazırlama" (PRESALES_EDIT). Diğer roller (ör. SALES_MGR
// "CRM gözetimi", PRESALES_MGR "BoM onayı") görevleri gözetim/onay niteliğinde
// olduğundan EDIT izni verilmez — mevcut, elle yapılandırılmış kullanıcı
// izinleriyle (SALES_REP zaten CRM_EDIT'e sahipti) tutarlı.
//
// Yeni kullanıcı oluşturulurken (users.ts POST /) `permissions` body'de
// gönderilmezse buradan role göre doldurulur. Bu yalnız BAŞLANGIÇ değeridir —
// admin sonradan Ayarlar → Kullanıcı Yönetimi → İzin Ağacı'ndan elle
// genişletebilir/daraltabilir; rol değişikliğinde (PUT /:id) DOKUNULMAZ (mevcut
// izinler korunur, terfi izinleri sessizce daraltmaz).
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['DASHBOARD_VIEW', 'SETTINGS_VIEW', 'SETTINGS_COMPANY', 'SETTINGS_UNITS', 'SETTINGS_USERS', 'SETTINGS_PERMISSIONS', 'SETTINGS_INTEGRATIONS'],
  GENERAL_MANAGER: [
    // Superuser — AuthContext.hasPermission GM için rol bazlı her zaman true döner,
    // bu liste fonksiyonel olarak bağlayıcı değildir; yalnız tutarlılık/gelecek
    // güvenliği için geniş tutulur.
    'DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_EDIT', 'CRM_OPPS_VIEW', 'CRM_CUSTOMERS_VIEW', 'CRM_PROPOSALS_VIEW',
    'PRESALES_VIEW', 'PRESALES_EDIT', 'COST_ANALYSIS_VIEW', 'VISIT_PLAN_VIEW', 'SALES_SUPPORT_VIEW',
    'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'FINANCE_VIEW', 'SERVICE_TICKETS_VIEW',
    'MANAGEMENT_REPORTS_VIEW', 'PROFITABILITY_VIEW', 'CORPORATE_GOV_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'ARCHIVE_EDIT',
    'TODO_VIEW', 'DMO_VIEW', 'BACKUP_VIEW', 'SETTINGS_VIEW', 'SETTINGS_COMPANY', 'SETTINGS_UNITS',
    'SETTINGS_USERS', 'SETTINGS_PERMISSIONS', 'SETTINGS_INTEGRATIONS',
  ],
  SALES_MGR: ['DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'COST_ANALYSIS_VIEW', 'SALES_SUPPORT_VIEW', 'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'PROFITABILITY_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW', 'DMO_VIEW'],
  SALES_REP: ['DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_EDIT', 'CRM_OPPS_VIEW', 'CRM_CUSTOMERS_VIEW', 'CRM_PROPOSALS_VIEW', 'COST_ANALYSIS_VIEW', 'VISIT_PLAN_VIEW', 'SALES_SUPPORT_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  SALES_SUPPORT: ['DASHBOARD_VIEW', 'SALES_SUPPORT_VIEW', 'PROCUREMENT_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'TODO_VIEW'],
  PRESALES_MGR: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'CRM_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  // Bug fix (2026-08-25): PRESALES_ENG'in "BoM (malzeme listesi) hazırlama" R-görevi
  // PRESALES_EDIT gerektirir — önceden eksikti, Presales Müdürü onaylayıp mühendis
  // atasa bile "BoM'u Kaydet & Satışa Devret" butonu PermissionGate ile sessizce
  // gizleniyordu (bkz. PresalesModule.tsx).
  PRESALES_ENG: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'PRESALES_EDIT', 'CRM_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  TECHNICAL_SPEC: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'TODO_VIEW'],
  PROJECT_MGR: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'SERVICE_TICKETS_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'PROFITABILITY_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  OPERATIONS_MGR: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'SERVICE_TICKETS_VIEW', 'PROCUREMENT_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'TODO_VIEW'],
  PROCUREMENT_MGR: ['DASHBOARD_VIEW', 'PROCUREMENT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  // B-11 düzeltmesi: PROCUREMENT_VIEW eklendi — Finans, PURCHASE_TO_INVOICE zincirinde
  // satınalma faturasını onaylıyor ama Satın Alma sekmesi hiç görünmediği için onayladığı
  // talebi görmek/kapatmak için başka bir role muhtaç kalıyordu.
  FINANCE_MGR: ['DASHBOARD_VIEW', 'FINANCE_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'PROFITABILITY_VIEW', 'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  HR_MGR: ['DASHBOARD_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  AUDITOR: ['DASHBOARD_VIEW'],
  IGPD_MGR: ['DASHBOARD_VIEW', 'CRM_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  KGD_MGR: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CORPORATE_GOV_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  KSU_MGR: ['DASHBOARD_VIEW', 'CONTRACTS_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'TODO_VIEW'],
  ISAB_MGR: ['DASHBOARD_VIEW', 'SALES_SUPPORT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  LEGAL_MGR: ['DASHBOARD_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
  BACKUP_ADMIN: [
    'DASHBOARD_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'VISIT_PLAN_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW',
    'COST_ANALYSIS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'PRESALES_VIEW', 'SALES_SUPPORT_VIEW',
    'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'FINANCE_VIEW', 'PROFITABILITY_VIEW', 'TODO_VIEW',
    'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'CORPORATE_GOV_VIEW', 'BACKUP_VIEW',
  ],
};

export function defaultPermissionsForRole(role: string): string[] {
  return ROLE_DEFAULT_PERMISSIONS[role] || ['DASHBOARD_VIEW'];
}
