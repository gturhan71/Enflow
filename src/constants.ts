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
  Calendar
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
  Tenant
} from './types';

export const APP_VERSION = 'v1.2.0';

export const MOCK_TENANTS: Tenant[] = [
  { id: 'tenant-1', name: 'TechCorp A.Ş.' },
  { id: 'tenant-2', name: 'Global Endüstri A.Ş.' },
  { id: 'tenant-3', name: 'Enflow Demo' }
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'crm', label: 'CRM & Müşteri', icon: Users },
  { id: 'presales', label: 'Presales & Dizayn', icon: FileSearch },
  { id: 'sales-support', label: 'Satış Destek', icon: FileCheck },
  { id: 'procurement', label: 'Satın Alma', icon: ShoppingCart },
  { id: 'archive', label: 'Fiziksel Arşiv', icon: Archive },
  { id: 'documents', label: 'Şirket Evrakları', icon: FileText },
  { id: 'cost-analysis', label: 'Maliyet Analizi', icon: BarChart3 },
  { id: 'contracts', label: 'Sözleşme Yönetimi', icon: FileSignature },
  { id: 'project-mgmt', label: 'Proje Yönetimi', icon: Kanban },
  { id: 'todo', label: 'Görevler & Takip', icon: ListTodo },
  { id: 'settings', label: 'Şirket Ayarları', icon: Settings },
];

export const MOCK_CUSTOMERS = [
  { id: 'c1', name: 'Global Bank A.Ş.', industry: 'Finance', riskScore: 12, contactPerson: 'Ahmet Yılmaz', email: 'ahmet@globalbank.com' },
  { id: 'c2', name: 'Tekno Lojistik', industry: 'Logistics', riskScore: 45, contactPerson: 'Ayşe Demir', email: 'ayse@teknolojistik.com' },
];

export const MOCK_PROJECTS: Project[] = [
  { 
    id: 'p1', 
    name: 'Veri Merkezi Modernizasyonu', 
    customerId: 'c1', 
    status: 'IN_PROGRESS', 
    totalValue: 450000, 
    avgMargin: 14.5, 
    deadline: '2026-06-15',
    ownerId: 'u1',
    managerId: 'user1',
    progress: 35
  },
  { 
    id: 'p2', 
    name: 'Siber Güvenlik Altyapısı', 
    customerId: 'c2', 
    status: 'AWAITING_APPROVAL', 
    totalValue: 125000, 
    avgMargin: 9.2, 
    deadline: '2026-05-20',
    ownerId: 'u2'
  }
];

export const MOCK_DOCUMENTS: CorporateDocument[] = [
  { id: 'd1', name: 'İmza Sirküleri 2026', category: 'LEGAL', expiryDate: '2026-12-31', fileUrl: '#', tags: ['Yasal', 'İmza'] },
  { id: 'd2', name: 'ISO 27001:2022 Sertifikası', category: 'ISO', expiryDate: '2026-04-20', fileUrl: '#', tags: ['Güvenlik', 'ISO'] },
  { id: 'd3', name: 'Vergi Levhası 2025', category: 'LEGAL', expiryDate: '2026-05-31', fileUrl: '#', tags: ['Yasal', 'Finans'] },
  { id: 'd4', name: 'Dell Platinum Partner Belgesi', category: 'CERTIFICATE', expiryDate: '2027-01-15', fileUrl: '#', tags: ['Üretici', 'Dell'] },
];

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
  { id: 'user1', name: 'Gökhan Turhan', email: 'gokhanturhan71@gmail.com', role: 'GENERAL_MANAGER', unitId: 'u4', status: 'ACTIVE', permissions: ['PROJECT_CREATE', 'COST_VIEW', 'OFFER_APPROVE', 'DOC_DELETE'] },
  { id: 'user2', name: 'Mehmet Öz', email: 'mehmet@idarihafiza.com', role: 'PRESALES_ENG', unitId: 'u2', status: 'ACTIVE', permissions: ['PROJECT_CREATE', 'COST_VIEW'] },
  { id: 'user3', name: 'Canan Can', email: 'canan@idarihafiza.com', role: 'SALES_SUPPORT', unitId: 'u1', status: 'ACTIVE', permissions: ['PROJECT_CREATE'] },
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
  { id: 'cr1', projectId: 'p1', description: 'Sunucu Odası Kurulum İşçiliği', category: 'LABOR', identifiedBy: 'user2', status: 'IDENTIFIED' },
  { id: 'cr2', projectId: 'p1', description: 'Şehir Dışı Nakliye ve Sigorta', category: 'LOGISTICS', identifiedBy: 'user2', status: 'COSTED', estimatedCost: 1200, costedBy: 'user3' },
  { id: 'cr3', projectId: 'p1', description: 'Dış Kaynak Firewall Konfigürasyon', category: 'OUTSOURCING', identifiedBy: 'user2', status: 'IDENTIFIED' },
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
  { id: 't1', projectId: 'p1', title: 'Saha Keşfi', description: 'Veri merkezi fiziksel alan ölçümleri.', status: 'DONE', assignedTo: 'user2' },
  { id: 't2', projectId: 'p1', title: 'Donanım Montajı', description: 'Server rack kurulumu.', status: 'IN_PROGRESS', assignedTo: 'user2', dueDate: '2026-05-10' },
  { id: 't3', projectId: 'p1', title: 'UAT Testleri', description: 'Kullanıcı kabul testlerinin yapılması.', status: 'TODO', assignedTo: 'user2', dueDate: '2026-06-01' },
];

export const MOCK_TODO_TASKS: TodoTask[] = [
  { 
    id: 'todo1', 
    title: 'Haftalık Satış Raporu', 
    description: 'Tüm bölge satışlarının konsolide raporu hazırlanacak.', 
    unitId: 'u1', 
    assignedBy: 'user1', 
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
    assignedBy: 'user1', 
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
    assignedBy: 'user1', 
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
    assignedTo: 'user3',
    createdBy: 'user1',
    technicalStatus: 'IN_PROGRESS',
    bomStatus: 'DRAFT',
    presalesId: 'user2'
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
    assignedTo: 'user3',
    createdBy: 'user2',
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
    assignedTo: 'user3',
    createdBy: 'user1',
    technicalStatus: 'COMPLETED',
    bomStatus: 'APPROVED',
    presalesId: 'user2'
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
    assignedTo: 'user3',
    createdBy: 'user1',
    technicalStatus: 'COMPLETED',
    bomStatus: 'APPROVED',
    presalesId: 'user2'
  }
];
