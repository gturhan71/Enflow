import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileSearch,
  FileText,
  ShoppingCart,
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Truck,
  Package,
  History,
  FileSignature,
  Kanban,
  Gavel,
  ListTodo,
  Calendar,
  CreditCard,
  Banknote,
  Key,
  FlaskConical,
  ShieldCheck,
  DatabaseBackup,
  Wrench,
  HelpCircle,
  MessageSquarePlus
} from 'lucide-react';

export const APP_VERSION = 'v2.4.0';

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Sistem Yöneticisi',
  GENERAL_MANAGER: 'Genel Müdür',
  SALES_MGR: 'Satış Müdürü',
  SALES_REP: 'Satış Temsilcisi',
  SALES_SUPPORT: 'Satış Destek',
  PRESALES_MGR: 'Presales Müdürü',
  PRESALES_ENG: 'Presales Mühendisi',
  TECHNICAL_SPEC: 'Teknik Uzman',
  PROJECT_MGR: 'Proje Yöneticisi',
  OPERATIONS_MGR: 'Operasyon Müdürü',
  PROCUREMENT_MGR: 'Satın Alma Müdürü',
  FINANCE_MGR: 'Finans Müdürü',
  HR_MGR: 'İnsan Kaynakları Müdürü',
  AUDITOR: 'Denetçi / Auditor',
  IGPD_MGR: 'İş Geliştirme Birimi Yöneticisi (İGB)',
  KGD_MGR: 'Kalite Yönetimi Yöneticisi (KY)',
  KSU_MGR: 'Kontrat & Sözleşme Uzmanı (KSU)',
  ISAB_MGR: 'İhale Yönetim Birimi Yöneticisi (İYB)',
  LEGAL_MGR: 'Hukuk Müdürü / Şirket Avukatı',
  BACKUP_ADMIN: 'Yedek Yöneticisi'
};

export const NAV_ITEMS = [
  // ── İş akışı sırasına göre düzenlenmiş: Ziyaret → CRM(Fırsat) → Presales
  // (BoM/Maliyet) → [İhale/İYB] → Sözleşme(imza) → Proje → Satınalma →
  // Garanti/Servis → Finans. Ardından paralel kanal (DMO), çalışma araçları
  // (Görevler), raporlama/yönetişim katmanı, en sonda sistem/ayarlar.
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPermission: 'DASHBOARD_VIEW' },
  { id: 'visit-plan', label: 'Ziyaret Planı', icon: Calendar, requiredPermission: 'VISIT_PLAN_VIEW' },
  {
    id: 'crm',
    label: 'CRM & Müşteri',
    icon: Users,
    requiredPermission: 'CRM_VIEW',
    subItems: [
      { id: 'crm-dashboard',    label: 'Genel Bakış',        requiredPermission: 'CRM_VIEW' },
      { id: 'crm-customers',    label: 'Müşteriler',         requiredPermission: 'CRM_CUSTOMERS_VIEW' },
      { id: 'crm-opportunities', label: 'Fırsatlar',        requiredPermission: 'CRM_OPPS_VIEW' },
      { id: 'crm-cost',         label: 'Maliyet Analizi',    requiredPermission: 'COST_ANALYSIS_VIEW' },
      { id: 'crm-proposals',    label: 'Teklifler',          requiredPermission: 'CRM_PROPOSALS_VIEW' },
      { id: 'crm-negotiation',  label: 'Canlı Pazarlıklar',  requiredPermission: 'CRM_OPPS_VIEW' },
    ],
  },
  {
    id: 'presales',
    label: 'Presales & Dizayn',
    icon: FileSearch,
    requiredPermission: 'PRESALES_VIEW',
    subItems: [
      { id: 'presales-bom',  label: 'BoM & Tasarım',    requiredPermission: 'PRESALES_VIEW' },
    ],
  },
  { id: 'sales-support',     label: 'Satış Destek',       icon: FileCheck,    requiredPermission: 'SALES_SUPPORT_VIEW' },
  { id: 'contract-workflow', label: 'Sözleşme Yönetimi',  icon: FileSignature, requiredPermission: 'CONTRACTS_VIEW' },
  { id: 'project-mgmt',      label: 'Proje Yönetimi',      icon: Kanban,        requiredPermission: 'PROJECT_MGMT_VIEW' },
  { id: 'procurement',       label: 'Satın Alma',          icon: ShoppingCart,  requiredPermission: 'PROCUREMENT_VIEW' },
  { id: 'service-tickets',   label: 'Garanti & Servis',    icon: Wrench,        requiredPermission: 'SERVICE_TICKETS_VIEW' },
  { id: 'finance',           label: 'Finans',              icon: Banknote,      requiredPermission: 'FINANCE_VIEW' },
  { id: 'dmo',               label: 'DMO Kataloğu',        icon: Package,       requiredPermission: 'DMO_VIEW', requiredEntitlement: 'DMO_MODULE' },
  { id: 'todo',              label: 'Görevler & Takip',    icon: ListTodo,      requiredPermission: 'TODO_VIEW' },
  // ── Raporlama & yönetişim (akış adımı değil, destek katmanı) ─────────────
  // Yönetim Raporları artık ayrı sekme değil — MANAGEMENT_REPORTS_VIEW izni olan
  // kullanıcılar için doğrudan Dashboard'a gömülü (bkz. src/modules/Dashboard.tsx).
  { id: 'corporate-governance', label: 'Genel Hususlar',   icon: ShieldCheck,   requiredPermission: 'CORPORATE_GOV_VIEW' },
  {
    id: 'documents',
    label: 'Şirket Evrakları',
    icon: FileText,
    requiredPermission: 'DOCUMENTS_VIEW',
    subItems: [
      { id: 'documents', label: 'Kurumsal Evraklar', requiredPermission: 'DOCUMENTS_VIEW' },
      { id: 'archive',   label: 'Fiziksel Arşiv',    requiredPermission: 'ARCHIVE_VIEW' },
    ],
  },
  // ── Sistem ────────────────────────────────────────────────────────────
  { id: 'backup',            label: 'Yedekleme',           icon: DatabaseBackup, requiredPermission: 'BACKUP_VIEW' },
  {
    id: 'settings',
    label: 'Şirket Ayarları',
    icon: Settings,
    requiredPermission: 'SETTINGS_VIEW',
    subItems: [
      { id: 'settings-company',      label: 'Şirket Profili',         requiredPermission: 'SETTINGS_COMPANY' },
      { id: 'settings-units',        label: 'Birimler',               requiredPermission: 'SETTINGS_UNITS' },
      { id: 'settings-users',        label: 'Kullanıcılar',           requiredPermission: 'SETTINGS_USERS' },
      { id: 'settings-workflow',     label: 'İş Akışı',               requiredPermission: 'SETTINGS_PERMISSIONS' },
      { id: 'settings-permissions',  label: 'Yetkiler',               requiredPermission: 'SETTINGS_PERMISSIONS' },
      { id: 'settings-integrations', label: 'Entegrasyonlar',         requiredPermission: 'SETTINGS_INTEGRATIONS' },
      { id: 'settings-subscription',      label: 'Abonelik & Kullanım',       requiredPermission: 'SETTINGS_VIEW' },
      { id: 'settings-license-types',    label: 'Lisans Planları',            requiredPermission: 'SETTINGS_VIEW' },
      { id: 'settings-modules',          label: 'Modüller',                   requiredPermission: 'GENERAL_MANAGER' },
      { id: 'settings-dashboard-templates', label: 'Kokpit Şablonları',       requiredPermission: 'GENERAL_MANAGER' },
      { id: 'settings-product-taxonomy', label: 'Marka & Ürün Grubu',         requiredPermission: 'GENERAL_MANAGER' },
    ],
  },
  { id: 'platform-tickets', label: 'Talep & Geri Bildirim', icon: MessageSquarePlus, requiredPermission: 'DASHBOARD_VIEW' },
  { id: 'help', label: 'Yardım', icon: HelpCircle, requiredPermission: 'DASHBOARD_VIEW' },
];

// Test Ortamı'ndan ana sidebar'a tanıtılabilecek modüller
// (yeni bir beta modül geliştirildikçe buraya eklenir)
export const PROMOTABLE_TEST_MODULES: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  description: string;
}[] = [];
