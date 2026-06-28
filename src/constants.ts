import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileSearch,
  FileText,
  ShoppingCart,
  Archive,
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
  BarChart3,
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
  DatabaseBackup
} from 'lucide-react';

import { 
  CorporateDocument, 
  Unit, 
  Permission, 
  User, 
  BoMItem, 
  CostRequirement,
  Contract,
  ContractDocumentRequirement,
  ProjectTask,
  TodoTask,
  Opportunity,
  Project,
  Tenant,
  Notification
} from './types';

export const APP_VERSION = 'v1.2.0';

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
  IGPD_MGR: 'İş Geliştirme & Pazarlama Direktörü (İGPD)',
  KGD_MGR: 'Kalite Güvence Direktörü (KGD)',
  KSU_MGR: 'Kontrat & Sözleşme Uzmanı (KSU)',
  ISAB_MGR: 'İhale Satın Alma Birimi Yöneticisi (İSAB)',
  LEGAL_MGR: 'Hukuk Müdürü / Şirket Avukatı',
  BACKUP_ADMIN: 'Yedek Yöneticisi'
};

export const MOCK_TENANTS: Tenant[] = [
  { id: 'tenant-1', name: 'TechCorp A.Ş.' },
  { id: 'tenant-2', name: 'Global Endüstri A.Ş.' },
  { id: 'tenant-3', name: 'Enflow Demo' }
];

export const NAV_ITEMS = [
  // ── İş akışı sırasına göre düzenlenmiş ──────────────────────────────────
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPermission: 'DASHBOARD_VIEW' },
  { id: 'management-reports', label: 'Yönetim Raporları', icon: BarChart3, requiredPermission: 'MANAGEMENT_REPORTS_VIEW' },
  { id: 'visit-plan', label: 'Ziyaret Planı', icon: Calendar, requiredPermission: 'VISIT_PLAN_VIEW' },
  {
    id: 'crm',
    label: 'CRM & Müşteri',
    icon: Users,
    requiredPermission: 'CRM_VIEW',
    subItems: [
      { id: 'crm-dashboard',    label: 'Genel Bakış',        requiredPermission: 'CRM_VIEW' },
      { id: 'crm-opportunities', label: 'Fırsatlar',        requiredPermission: 'CRM_OPPS_VIEW' },
      { id: 'crm-cost',         label: 'Maliyet Analizi',    requiredPermission: 'COST_ANALYSIS_VIEW' },
      { id: 'crm-proposals',    label: 'Teklifler',          requiredPermission: 'CRM_PROPOSALS_VIEW' },
      { id: 'crm-customers',    label: 'Müşteriler',         requiredPermission: 'CRM_CUSTOMERS_VIEW' },
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
  { id: 'procurement',       label: 'Satın Alma',          icon: ShoppingCart,  requiredPermission: 'PROCUREMENT_VIEW' },
  { id: 'project-mgmt',      label: 'Proje Yönetimi',      icon: Kanban,        requiredPermission: 'PROJECT_MGMT_VIEW' },
  { id: 'finance',           label: 'Finans',              icon: Banknote,      requiredPermission: 'FINANCE_VIEW' },
  { id: 'todo',              label: 'Görevler & Takip',    icon: ListTodo,      requiredPermission: 'TODO_VIEW' },
  { id: 'documents',         label: 'Şirket Evrakları',    icon: FileText,      requiredPermission: 'DOCUMENTS_VIEW' },
  { id: 'archive',           label: 'Fiziksel Arşiv',      icon: Archive,       requiredPermission: 'ARCHIVE_VIEW' },
  { id: 'corporate-governance', label: 'Genel Hususlar',   icon: ShieldCheck,   requiredPermission: 'CORPORATE_GOV_VIEW' },
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
    ],
  },
];

// Test Ortamı'ndan ana sidebar'a tanıtılabilecek modüller
// (yeni bir beta modül geliştirildikçe buraya eklenir)
export const PROMOTABLE_TEST_MODULES: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  description: string;
}[] = [];

export const MOCK_CUSTOMERS = [
  { id: 'c1', name: 'Global Bank A.Ş.', industry: 'Finance', riskScore: 12, contactPerson: 'Ahmet Yılmaz', email: 'ahmet@globalbank.com' },
  { id: 'c2', name: 'Tekno Lojistik', industry: 'Logistics', riskScore: 45, contactPerson: 'Ayşe Demir', email: 'ayse@teknolojistik.com' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Veri Merkezi Modernizasyonu',
    customerId: 'c1',
    type: 'HARDWARE',
    phase: 'INSTALLATION',
    status: 'IN_PROGRESS',
    totalValue: 450000,
    contractCurrency: 'TRY',
    budgetTotal: 360000,
    avgMargin: 14.5,
    deadline: '2026-06-15',
    plannedEndDate: '2026-06-15',
    ownerId: 'u1',
    managerId: 'cmp5lhehc000259w33zxhyy0p',
    progress: 35,
    milestones: [],
    projectCostItems: [],
  },
  {
    id: 'p2',
    name: 'Siber Güvenlik Altyapısı',
    customerId: 'c2',
    type: 'SERVICE',
    phase: 'PLANNING',
    status: 'PLANNING',
    totalValue: 125000,
    contractCurrency: 'TRY',
    budgetTotal: 100000,
    avgMargin: 9.2,
    deadline: '2026-05-20',
    plannedEndDate: '2026-05-20',
    ownerId: 'u2',
    progress: 0,
    milestones: [],
    projectCostItems: [],
  }
];

export const MOCK_DOCUMENTS: CorporateDocument[] = [];

export const MOCK_WORK_EXPERIENCE = [
  { id: 'w1', name: 'Kamu Hastaneleri Veri Merkezi', customer: 'Sağlık Bakanlığı', value: 12500000, date: '2025-11-10', tags: ['Veri Merkezi', 'Kamu'] },
  { id: 'w2', name: 'Belediye Network Altyapısı', customer: 'X Belediyesi', value: 4200000, date: '2024-08-15', tags: ['Network', 'Kamu'] },
];

export const MOCK_CERTIFICATES = [
  { id: 'cert1', person: 'Mehmet Öz', name: 'CCNP Enterprise', expiryDate: '2026-09-12', status: 'VALID' },
  { id: 'cert2', person: 'Canan Can', name: 'NSE 7 Network Security', expiryDate: '2026-04-15', status: 'WARNING' },
];

export const MOCK_UNITS: Unit[] = [
  { id: 'u1', name: 'Satış & Pazarlama', description: 'Müşteri ilişkileri ve ihale takibi.' },
  { id: 'u2', name: 'Teknik Çözümler', description: 'Presales ve dizayn süreçleri.' },
  { id: 'u3', name: 'Operasyon & Lojistik', description: 'Satın alma ve depo yönetimi.' },
  { id: 'u4', name: 'İdari İşler', description: 'Genel yönetim ve evrak arşivi.' },
];

export const MOCK_PERMISSIONS: Permission[] = [
  { id: 'p1', name: 'Proje Oluşturma', code: 'PROJECT_CREATE', description: 'Yeni proje kaydı açabilir.' },
  { id: 'p2', name: 'Maliyet Görme', code: 'COST_VIEW', description: 'Ürün alış maliyetlerini görebilir.' },
  { id: 'p3', name: 'Teklif Onaylama', code: 'OFFER_APPROVE', description: 'Hazırlanan teklifleri onaylayabilir.' },
  { id: 'p4', name: 'Evrak Silme', code: 'DOC_DELETE', description: 'Arşivdeki evrakları silebilir.' },
];

export const MOCK_SYSTEM_USERS: User[] = [
  { id: 'cmp5lhehc000259w33zxhyy0p', name: 'Gökhan Turhan', email: 'gokhan@t-ecosystem.com', role: 'GENERAL_MANAGER', unitId: 'u4', status: 'ACTIVE', permissions: ['PROJECT_CREATE', 'COST_VIEW', 'OFFER_APPROVE', 'DOC_DELETE', 'PRESALES_VIEW', 'PRESALES_EDIT', 'DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'SETTINGS_VIEW', 'PROCUREMENT_VIEW', 'ARCHIVE_VIEW', 'DOCUMENTS_VIEW', 'COST_ANALYSIS_VIEW', 'CONTRACTS_VIEW', 'PROJECT_MGMT_VIEW', 'TODO_VIEW', 'SALES_SUPPORT_VIEW'] },
  { id: 'cmp9s29090002h4o37jgwc4we', name: 'GOKTUG TURHAN', email: 'goktugturhan74@gmail.com', role: 'PRESALES_ENG', unitId: 'u2', status: 'ACTIVE', permissions: ['PROJECT_CREATE', 'COST_VIEW', 'PRESALES_VIEW', 'PRESALES_EDIT', 'DASHBOARD_VIEW'] },
  { id: 'cmp9uzx6e0007erw3ki7ym0cv', name: 'Ali Veli', email: 'aliveli@enflow.com', role: 'SALES_SUPPORT', unitId: 'u1', status: 'ACTIVE', permissions: ['PROJECT_CREATE', 'DASHBOARD_VIEW', 'SALES_SUPPORT_VIEW'] },
];

export const MOCK_BOM_ITEMS: BoMItem[] = [
  { id: 'b1', projectId: 'p1', partNumber: 'DELL-R750-01', description: 'PowerEdge R750 Server', quantity: 2, purchaseCost: 4500, marginPercentage: 15, unitSalePrice: 5294.11, totalSalePrice: 10588.22, vendor: 'Arena', source: 'EXCEL', status: 'MATCHED' },
  { id: 'b2', projectId: 'p1', partNumber: 'CISCO-C9200L', description: 'Catalyst 9200L Switch', quantity: 1, purchaseCost: 2800, marginPercentage: 12, unitSalePrice: 3181.82, totalSalePrice: 3181.82, vendor: 'Index', source: 'EXCEL', status: 'MATCHED' },
  { id: 'b3', opportunityId: 'opp1', partNumber: 'DELL-R750-01', description: 'PowerEdge R750 Server', quantity: 4, purchaseCost: 4500, marginPercentage: 15, unitSalePrice: 5294.11, totalSalePrice: 21176.44, vendor: 'Arena', source: 'MANUAL', status: 'MATCHED' },
  { id: 'b4', opportunityId: 'opp3', partNumber: 'HP-DL380-G10', description: 'ProLiant DL380 Gen10', quantity: 3, purchaseCost: 3800, marginPercentage: 18, unitSalePrice: 4634.14, totalSalePrice: 13902.42, vendor: 'Penta', source: 'MANUAL', status: 'MATCHED' },
  { id: 'b5', opportunityId: 'opp3', partNumber: 'F5-BIG-IP-i2000', description: 'BIG-IP i2000 Series Local Traffic Manager', quantity: 2, purchaseCost: 12500, marginPercentage: 20, unitSalePrice: 15625, totalSalePrice: 31250, vendor: 'Exclusive', source: 'MANUAL', status: 'MATCHED' },
  { id: 'b6', opportunityId: 'opp4', partNumber: 'PAN-PA-3220', description: 'Palo Alto PA-3220 Firewall', quantity: 2, purchaseCost: 18000, marginPercentage: 25, unitSalePrice: 24000, totalSalePrice: 48000, vendor: 'Exclusive', source: 'MANUAL', status: 'MATCHED' },
];

export const MOCK_COST_REQUIREMENTS: CostRequirement[] = [
  { id: 'cr1', projectId: 'p1', description: 'Sunucu Odası Kurulum İşçiliği', category: 'LABOR', identifiedBy: 'cmp9s29090002h4o37jgwc4we', status: 'IDENTIFIED' },
  { id: 'cr2', projectId: 'p1', description: 'Şehir Dışı Nakliye ve Sigorta', category: 'LOGISTICS', identifiedBy: 'cmp9s29090002h4o37jgwc4we', status: 'COSTED', estimatedCost: 1200, costedBy: 'cmp9uzx6e0007erw3ki7ym0cv' },
  { id: 'cr3', projectId: 'p1', description: 'Dış Kaynak Firewall Konfigürasyon', category: 'OUTSOURCING', identifiedBy: 'cmp9s29090002h4o37jgwc4we', status: 'IDENTIFIED' },
];

export const MOCK_CONTRACTS: Contract[] = [
  { id: 'con1', projectId: 'p1', status: 'SIGNED', guaranteeAmount: 45000, guaranteeExpiry: '2027-06-15', endDate: '2027-06-15', signedDate: '2026-04-01' },
];

export const MOCK_CONTRACT_DOCS: ContractDocumentRequirement[] = [
  { id: 'cd1', contractId: 'con1', name: 'Teminat Mektubu', description: 'Banka onaylı kesin teminat mektubu.', status: 'PENDING', dueDate: '2026-04-15' },
  { id: 'cd2', contractId: 'con1', name: 'SGK Borcu Yoktur Yazısı', status: 'APPROVED', fileUrl: '#' },
  { id: 'cd3', contractId: 'con1', name: 'Vergi Borcu Yoktur Yazısı', status: 'UPLOADED', fileUrl: '#' },
  { id: 'cd4', contractId: 'con1', name: 'İş Ortaklığı Beyannamesi', status: 'PENDING', dueDate: '2026-04-12' },
];

export const MOCK_PROJECT_TASKS: ProjectTask[] = [
  { id: 't1', projectId: 'p1', title: 'Saha Keşfi', description: 'Veri merkezi fiziksel alan ölçümleri.', status: 'DONE', assignedTo: 'cmp9s29090002h4o37jgwc4we' },
  { id: 't2', projectId: 'p1', title: 'Donanım Montajı', description: 'Server rack kurulumu.', status: 'IN_PROGRESS', assignedTo: 'cmp9s29090002h4o37jgwc4we', dueDate: '2026-05-10' },
  { id: 't3', projectId: 'p1', title: 'UAT Testleri', description: 'Kullanıcı kabul testlerinin yapılması.', status: 'TODO', assignedTo: 'cmp9s29090002h4o37jgwc4we', dueDate: '2026-06-01' },
];

export const MOCK_TODO_TASKS: TodoTask[] = [
  { 
    id: 'todo1', 
    title: 'Haftalık Satış Raporu', 
    description: 'Tüm bölge satışlarının konsolide raporu hazırlanacak.', 
    unitId: 'u1', 
    assignedBy: 'cmp5lhehc000259w33zxhyy0p', 
    priority: 'HIGH', 
    status: 'PENDING', 
    dueDate: '2026-04-12', 
    createdAt: '2026-04-08' 
  },
  { 
    id: 'todo2', 
    title: 'Envanter Sayımı', 
    description: 'Merkez depo ve şube depolarındaki tüm donanımların sayımı.', 
    unitId: 'u3', 
    assignedBy: 'cmp5lhehc000259w33zxhyy0p', 
    priority: 'URGENT', 
    status: 'IN_PROGRESS', 
    dueDate: '2026-04-10', 
    createdAt: '2026-04-07' 
  },
  { 
    id: 'todo3', 
    title: 'Yeni Personel Eğitimi', 
    description: 'Teknik ekibe yeni katılan arkadaşların presales süreç eğitimi.', 
    unitId: 'u2', 
    assignedBy: 'cmp5lhehc000259w33zxhyy0p', 
    priority: 'MEDIUM', 
    status: 'COMPLETED', 
    dueDate: '2026-04-05', 
    createdAt: '2026-04-01' 
  },
];

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp1',
    title: 'Banka Veri Merkezi Genişletme',
    customerId: 'c1',
    value: 250000,
    probability: 60,
    expectedCloseDate: '2026-05-15',
    status: 'PROPOSAL',
    description: 'Mevcut veri merkezine 4 adet yeni rack kabinet ve soğutma sistemi eklenmesi.',
    assignedToId: 'cmp9uzx6e0007erw3ki7ym0cv',
    createdById: 'cmp5lhehc000259w33zxhyy0p',
    technicalStatus: 'IN_PROGRESS',
    bomStatus: 'DRAFT',
    presalesId: 'cmp9s29090002h4o37jgwc4we'
  },
  {
    id: 'opp2',
    title: 'Lojistik Depo Network Altyapısı',
    customerId: 'c2',
    value: 85000,
    probability: 30,
    expectedCloseDate: '2026-06-01',
    status: 'QUALIFIED',
    description: 'Yeni açılacak depo için kablosuz ağ ve güvenlik kamera altyapısı.',
    assignedToId: 'cmp9uzx6e0007erw3ki7ym0cv',
    createdById: 'cmp9s29090002h4o37jgwc4we',
    technicalStatus: 'PENDING',
    bomStatus: 'DRAFT'
  },
  {
    id: 'opp3',
    title: 'E-Ticaret Sunucu Altyapısı',
    customerId: 'c3',
    value: 120000,
    probability: 80,
    expectedCloseDate: '2026-04-30',
    status: 'NEGOTIATION',
    description: 'Yüksek trafikli e-ticaret sitesi için sunucu ve load balancer konfigürasyonu.',
    assignedToId: 'cmp9uzx6e0007erw3ki7ym0cv',
    createdById: 'cmp5lhehc000259w33zxhyy0p',
    technicalStatus: 'COMPLETED',
    bomStatus: 'APPROVED',
    presalesId: 'cmp9s29090002h4o37jgwc4we'
  },
  {
    id: 'opp4',
    title: 'Kamu Kurumu Siber Güvenlik Altyapısı',
    customerId: 'c1',
    value: 450000,
    probability: 100,
    expectedCloseDate: '2026-03-15',
    status: 'WON',
    description: 'Güvenlik duvarı, IPS/IDS ve SIEM çözümleri entegrasyonu.',
    assignedToId: 'cmp9uzx6e0007erw3ki7ym0cv',
    createdById: 'cmp5lhehc000259w33zxhyy0p',
    technicalStatus: 'COMPLETED',
    bomStatus: 'APPROVED',
    presalesId: 'cmp9s29090002h4o37jgwc4we'
  }
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'cmp5lhehc000259w33zxhyy0p',
    title: 'Yeni Fırsat Atandı',
    message: 'Banka Veri Merkezi Genişletme fırsatı size atandı.',
    type: 'SYSTEM',
    isRead: false,
    timestamp: new Date().toISOString(),
    relatedModule: 'crm-opportunities',
    relatedItemId: 'opp1'
  },
  {
    id: 'n2',
    userId: 'cmp5lhehc000259w33zxhyy0p',
    title: 'Sözleşme Onay Bekliyor',
    message: 'Veri Merkezi Modernizasyonu sözleşmesi onayınızı bekliyor.',
    type: 'URGENT',
    isRead: false,
    timestamp: new Date().toISOString(),
    relatedModule: 'contract',
    relatedItemId: 'con1'
  },
  {
    id: 'n3',
    userId: 'cmp5lhehc000259w33zxhyy0p',
    title: 'Proje Tamamlandı',
    message: 'Kamu Kurumu Siber Güvenlik projesi başarıyla tamamlandı.',
    type: 'SUCCESS',
    isRead: true,
    timestamp: new Date().toISOString(),
    relatedModule: 'project-mgmt',
    relatedItemId: 'opp4'
  },
  {
    id: 'n4',
    userId: 'cmp5lhehc000259w33zxhyy0p',
    title: 'Zamanlanmış Hatırlatıcı',
    message: 'Bu bildirim 1 dakika sonrasına zamanlandı.',
    type: 'WARNING',
    isRead: false,
    timestamp: new Date().toISOString(),
    scheduledAt: new Date(Date.now() + 60000).toISOString(),
    relatedModule: 'dashboard'
  }
];
