export type ProjectType    = 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'MIXED';
export type ProjectStatus  = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
export type MilestoneType  =
  | 'PLANNING' | 'PROCUREMENT' | 'SHIPMENT' | 'INSTALLATION'
  | 'DEVELOPMENT' | 'TESTING' | 'ACCEPTANCE' | 'INVOICING'
  | 'COLLECTION' | 'WARRANTY' | 'DELIVERY' | 'CUSTOM';
export type CostCategory   = 'PROCUREMENT' | 'TRAVEL' | 'EXTERNAL_SERVICE' | 'OTHER';
export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  milestoneType: MilestoneType;
  status: MilestoneStatus;
  progress: number;
  assignedToId?: string | null;
  assignedToName?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  budgetAmount?: number | null;
  actualCost?: number | null;
  currency: string;
  isParallel: boolean;
  requiresApproval: boolean;
  approvedById?: string | null;
  approvedAt?: string | null;
  order: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectCostItem {
  id: string;
  projectId: string;
  category: CostCategory;
  description: string;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  amountTRY: number;
  milestoneId?: string | null;
  purchaseRequestId?: string | null;
  date?: string | null;
  invoiceNo?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Project {
  id: string;
  code?: string | null; // insan-okunur proje kodu — örn. 2026-HW-00012 (backend otomatik üretir)
  name: string;
  type: ProjectType;
  description?: string | null;
  status: ProjectStatus;
  phase: string;
  customerId?: string | null;
  customerName?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  ownerId?: string | null;
  pmId?: string | null;
  pmName?: string | null;
  managerId?: string | null;
  totalValue: number;
  contractCurrency: string;
  budgetTotal: number;
  avgMargin: number;
  progress: number;
  startDate?: string | null;
  plannedEndDate?: string | null;
  actualEndDate?: string | null;
  deadline?: string | null;
  procurementNotes?: string | null;
  milestones: ProjectMilestone[];
  projectCostItems: ProjectCostItem[];
  // Profesyonel Hizmetler — salt-okunur özet (bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md).
  // Asıl CRUD yüzeyi ProfessionalServicesModule/work-orders'ta.
  workOrders?: {
    id: string; workOrderNo?: string | null; title: string; type: WorkOrderType;
    status: WorkOrderStatus; priority: WorkOrderPriority; scheduledDate?: string | null;
    assignedTechnician?: { id: string; name: string } | null;
  }[];
  createdAt?: string;
  updatedAt?: string;
}
// B-22 — Garanti/Servis: ACCEPTANCE sonrası arıza/yedek-parça/bakım talepleri + SLA.
export type ServiceTicketCategory = 'FAULT' | 'SPARE_PART' | 'MAINTENANCE' | 'OTHER';
export type ServiceTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ServiceTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_PART' | 'RESOLVED' | 'CLOSED';
export const SERVICE_TICKET_CATEGORY_LABEL: Record<ServiceTicketCategory, string> = {
  FAULT: 'Arıza', SPARE_PART: 'Yedek Parça', MAINTENANCE: 'Bakım', OTHER: 'Diğer',
};
export const SERVICE_TICKET_PRIORITY_LABEL: Record<ServiceTicketPriority, string> = {
  LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};
export const SERVICE_TICKET_STATUS_LABEL: Record<ServiceTicketStatus, string> = {
  OPEN: 'Açık', IN_PROGRESS: 'İşlemde', WAITING_PART: 'Parça Bekliyor', RESOLVED: 'Çözüldü', CLOSED: 'Kapandı',
};
// Arıza açılırken müşteriden alınan log dosyası/ekran görüntüsü/geri bildirim —
// teknisyene sevk edildiğinde WorkOrder.sourceTicket üzerinden canlı görünür.
export interface ServiceTicketAttachment {
  id: string;
  serviceTicketId: string;
  fileUrl: string;
  fileName: string;
  description?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  createdAt?: string;
}
export interface ServiceTicket {
  id: string;
  tenantId?: string;
  projectId: string;
  project?: { id: string; name: string; code?: string | null; customerName?: string | null };
  title: string;
  description?: string | null;
  category: ServiceTicketCategory;
  priority: ServiceTicketPriority;
  status: ServiceTicketStatus;
  reportedAt?: string;
  reportedByContactId?: string | null;
  reportedByName?: string | null;
  assignedToUserId?: string | null;
  unitId?: string | null;
  slaHours?: number | null;
  dueAt?: string | null;
  escalatedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  costAmount?: number | null;
  costCurrency?: string | null;
  brandId?: string | null;
  brand?: { id: string; name: string } | null;
  productCategoryId?: string | null;
  productCategory?: { id: string; name: string } | null;
  attachments?: ServiceTicketAttachment[]; // yalnız GET /service-tickets/:id detayında dolu
  createdAt?: string;
  updatedAt?: string;
}

// Profesyonel Hizmetler (post-sales) — iş emri. ServiceTicket'tan FARKLI:
// ServiceTicket müşteri arıza/garanti BİLDİRİMİ, WorkOrder sahaya giden
// teknisyenin YÜRÜTME kaydı (dispatch/takvim/kapanış kanıtı). Bkz.
// docs/PROFESYONEL_HIZMETLER_PLAN.md.
export type WorkOrderType = 'INSTALLATION' | 'REPAIR' | 'MAINTENANCE' | 'OTHER';
export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type WorkOrderStatus = 'DRAFT' | 'PENDING_SCHEDULE' | 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING_PART' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';
export const WORK_ORDER_TYPE_LABEL: Record<WorkOrderType, string> = {
  INSTALLATION: 'Kurulum', REPAIR: 'Arıza', MAINTENANCE: 'Bakım', OTHER: 'Diğer',
};
export const WORK_ORDER_PRIORITY_LABEL: Record<WorkOrderPriority, string> = {
  LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};
// Önceliğe bağlı varsayılan "tamamlanma hedefi" (saat) — sevkiyat formunda
// yalnız ÖNERİ olarak otomatik doldurulur, zorunlu değil, elle değiştirilebilir/
// boşaltılabilir (dueAt opsiyonel kalmaya devam eder). Kullanıcı kararı (2026-10-12).
export const WORK_ORDER_SLA_DEFAULT_HOURS: Record<WorkOrderPriority, number> = {
  URGENT: 4, HIGH: 8, NORMAL: 24, LOW: 72,
};
export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  DRAFT: 'Taslak', PENDING_SCHEDULE: 'Sevk Bekliyor', SCHEDULED: 'Planlandı', IN_PROGRESS: 'Sahada',
  WAITING_PART: 'Parça Bekliyor', COMPLETED: 'Tamamlandı', CLOSED: 'Kapandı', CANCELLED: 'İptal',
};
export interface WorkOrder {
  id: string;
  tenantId?: string;
  workOrderNo?: string | null;
  type: WorkOrderType;
  title: string;
  description?: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  customerId?: string | null;
  customer?: { id: string; name: string } | null;
  customerName?: string | null;
  projectId?: string | null;
  project?: { id: string; name: string; code?: string | null; status?: ProjectStatus; progress?: number } | null;
  openPurchaseRequestCount?: number | null; // yalnız GET /work-orders/:id detayında dolu
  serviceTicketId?: string | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  requiredSpecialtyId?: string | null;
  requiredSpecialty?: { id: string; name: string } | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: { id: string; name: string } | null;
  scheduledDate?: string | null;
  // SLA (Faz 4) — sevk edilirken girilir; proje bağlı işte sözleşmeden kopyalanabilir
  // ya da münferit girilebilir, tek kaynak her zaman dueAt. Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md.
  slaHours?: number | null;
  dueAt?: string | null;
  contractDeliverySla?: { dueAt: string | null; penaltyDailyRatePct: number | null } | null; // yalnız GET /:id — salt-okunur öneri
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  // Bilgi amaçlı maliyet tahmini (işçilik+malzeme) — costAmount'a otomatik yazılmaz,
  // yalnız GET /:id'de ve yöneticiye döner. technicianCostRate yalnız GM/OPERATIONS_MGR'a.
  estimatedLaborCost?: number | null;
  estimatedMaterialCost?: number | null;
  estimatedTotalCost?: number | null;
  technicianCostRate?: number | null;
  technicianCostRateUnit?: string | null;
  completionNotes?: string | null;
  customerSignOffAt?: string | null;
  customerSignOffName?: string | null;
  customerSignOffFileUrl?: string | null;
  customerSatisfactionScore?: number | null; // CSAT — opsiyonel, 1-5, yalnız /complete'te girilir
  costAmount?: number | null;
  costCurrency?: string | null;
  servicePlanId?: string | null; // Faz 2 — ServiceWorkPlan'a opsiyonel bağlanma
  materialRequests?: WorkOrderMaterialRequest[]; // Faz 3 — yalnız GET /work-orders/:id detayında dolu
  attachments?: WorkOrderAttachment[]; // bağlam dosyaları — yalnız GET /work-orders/:id detayında dolu
  sourceTicket?: WorkOrderSourceTicket | null; // ServiceTicket'tan sevk edildiyse canlı bağlam — yalnız GET /work-orders/:id detayında dolu
  createdAt?: string;
  updatedAt?: string;
}
// Teknisyenin işi doğru yapabilmesi için gereken bağlam dosyaları (log,
// ekran görüntüsü, saha fotoğrafı) — kapanış kanıtından (customerSignOffFileUrl,
// tek/zorunlu) farklı, serbest sayıda/opsiyonel destekleyici belge.
export interface WorkOrderAttachment {
  id: string;
  workOrderId: string;
  fileUrl: string;
  fileName: string;
  description?: string | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  createdAt?: string;
}
// Bu iş emri bir ServiceTicket'tan sevk edildiyse, o talebin güncel hâli —
// kim bildirdi/nasıl ulaşılır, hangi marka-ürün, hangi dosyalar eklenmiş.
export interface WorkOrderSourceTicket {
  id: string;
  title: string;
  description?: string | null;
  reportedByName?: string | null;
  reportedByContactId?: string | null;
  reportedByContact?: { name: string; phone: string | null; email: string | null } | null;
  brand?: { id: string; name: string } | null;
  productCategory?: { id: string; name: string } | null;
  attachments: ServiceTicketAttachment[];
}
// Profesyonel Hizmetler — Faz 3: dış kaynak malzeme/hizmet talebi. PurchaseRequest'in
// 9 statülü tam onay zincirinin KASITLI DIŞINDA, hafif/tek-adımlı (yalnız birim
// yöneticisi onayı). Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md Kullanıcı Kararı 4.
export type WorkOrderMaterialStatus = 'REQUESTED' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'REJECTED';
export const WORK_ORDER_MATERIAL_STATUS_LABEL: Record<WorkOrderMaterialStatus, string> = {
  REQUESTED: 'Onay Bekliyor', APPROVED: 'Onaylandı', ORDERED: 'Sipariş Edildi', RECEIVED: 'Teslim Alındı', REJECTED: 'Reddedildi',
};
export interface WorkOrderMaterialRequest {
  id: string;
  tenantId?: string;
  workOrderId: string;
  description: string;
  vendorId?: string | null;
  vendor?: { id: string; name: string } | null;
  vendorName?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  currency: string;
  status: WorkOrderMaterialStatus;
  requestedById?: string | null;
  requestedByName?: string | null;
  approvedByUnitManagerId?: string | null;
  rejectionNote?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface WorkOrderSummary {
  total: number;
  open: number;
  completed: number;
  avgResolutionDays: number | null;
  avgSatisfaction: number | null; // CSAT ortalaması (1-5)
  satisfactionCount: number;
  byTechnician: { userId: string; name: string; open: number; completed: number }[];
}
// Sevkiyat için teknisyen listesi — uzmanlık + güncel açık iş sayısı (kapasite-
// farkındalıklı dispatch, sert kısıt değil) + (yalnız GM/OPERATIONS_MGR'a) maliyet.
export interface WorkOrderTechnician {
  id: string;
  name: string;
  unitId?: string | null;
  specialties: { id: string; name: string }[];
  openCount: number;
  costRate?: number | null;
  costRateUnit?: string | null;
  costCurrency?: string | null;
}
// Faz 5 — Ekip Utilizasyonu (aylık). %doluluk = 8 saat/iş günü varsayımıyla;
// estimatedLaborCost yalnız GM/OPERATIONS_MGR'a döner. Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md.
export interface UtilizationRow {
  id: string;
  name: string;
  specialties: { id: string; name: string }[];
  openCount: number;
  completedCount: number;
  totalHours: number;
  capacityHours: number;
  utilizationPct: number | null;
  onTimeCount: number;
  lateCount: number;
  slaPerformancePct: number | null;
  estimatedLaborCost?: number | null;
}
export interface UtilizationReportData {
  month: string;
  capacityDays: number;
  capacityHours: number;
  technicians: UtilizationRow[];
}
// Profesyonel Hizmetler — haftalık teknisyen dağıtım planı (Faz 2). WorkOrder'a
// bağlanması opsiyonel gruplamadır — bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md.
export type ServiceWorkPlanStatus = 'DRAFT' | 'APPROVED' | 'COMPLETED';
export const SERVICE_WORK_PLAN_STATUS_LABEL: Record<ServiceWorkPlanStatus, string> = {
  DRAFT: 'Taslak', APPROVED: 'Onaylandı', COMPLETED: 'Tamamlandı',
};
export interface ServiceWorkPlanWorkOrder {
  id: string; workOrderNo?: string | null; title: string; type: WorkOrderType; status: WorkOrderStatus;
  priority: WorkOrderPriority; scheduledDate?: string | null; customerName?: string | null;
  assignedTechnician?: { id: string; name: string } | null;
}
export interface ServiceWorkPlan {
  id: string;
  tenantId?: string;
  weekOf: string;
  unitId?: string | null;
  preparedById: string;
  preparedByName?: string | null;
  status: ServiceWorkPlanStatus;
  notes?: string | null;
  workOrders: ServiceWorkPlanWorkOrder[];
  createdAt?: string;
  updatedAt?: string;
}
// Platform Ticket — tenant'ın Enflow'a (vendor'a) gönderdiği ürün geri bildirimi/
// hata/iyileştirme/mimari değişiklik talebi. ServiceTicket'tan FARKLI bir domain:
// bu, tenant'ın kendi müşterisine değil, Enflow'un kendisine açtığı bir talep.
// category/priority/scope YALNIZ dış (repo dışı) bir triage aracı tarafından
// doldurulur — kullanıcı title+description'a ek olarak yalnız kendi ilk izlenimini
// (reportedType) bildirir; nihai sınıflandırma (category) bundan bağımsızdır.
export type PlatformTicketScope = 'TENANT_SPECIFIC' | 'PLATFORM_WIDE';
export type PlatformTicketReportedType = 'BUG' | 'IMPROVEMENT' | 'COMMENT';
export type PlatformTicketCategory = 'BUG' | 'IMPROVEMENT' | 'ARCHITECTURE_CHANGE';
export type PlatformTicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PlatformTicketStatus = 'NEW' | 'TRIAGED' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
export const PLATFORM_TICKET_SCOPE_LABEL: Record<PlatformTicketScope, string> = {
  TENANT_SPECIFIC: 'Bu şirkete özel', PLATFORM_WIDE: 'Platform geneli',
};
export const PLATFORM_TICKET_REPORTED_TYPE_LABEL: Record<PlatformTicketReportedType, string> = {
  BUG: 'Hata', IMPROVEMENT: 'İyileştirme', COMMENT: 'Yorum',
};
export const PLATFORM_TICKET_CATEGORY_LABEL: Record<PlatformTicketCategory, string> = {
  BUG: 'Hata', IMPROVEMENT: 'İyileştirme', ARCHITECTURE_CHANGE: 'Mimari Değişiklik',
};
export const PLATFORM_TICKET_PRIORITY_LABEL: Record<PlatformTicketPriority, string> = {
  CRITICAL: 'Kritik', HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük',
};
export const PLATFORM_TICKET_STATUS_LABEL: Record<PlatformTicketStatus, string> = {
  NEW: 'Yeni', TRIAGED: 'Değerlendirildi', PLANNED: 'Planlandı', IN_PROGRESS: 'Uygulanıyor', DONE: 'Tamamlandı', REJECTED: 'Reddedildi',
};
export interface PlatformTicket {
  id: string;
  tenantId?: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  reportedType: PlatformTicketReportedType;
  scope?: PlatformTicketScope | null;
  category?: PlatformTicketCategory | null;
  priority?: PlatformTicketPriority | null;
  status: PlatformTicketStatus;
  targetTimeline?: string | null;
  resolutionNote?: string | null;
  metadata?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface Contract {
  id: string;
  title?: string;
  opportunityId?: string;
  projectId?: string;
  status: 'DRAFT' | 'SIGNED' | 'EXPIRED' | 'TERMINATED';
  signedDate?: string;
  endDate?: string;
  guaranteeAmount: number;
  guaranteeExpiry?: string;
}
export interface ContractDocumentRequirement {
  id: string;
  contractId: string;
  type?: string;
  name?: string;
  description?: string;
  status: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'APPROVED';
  dueDate?: string;
  fileUrl?: string;
}
export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;
  status: 'TODO' | 'DOING' | 'DONE' | 'IN_PROGRESS';
  dueDate?: string;
}
export interface TodoTask {
  id: string;
  title: string;
  description?: string;
  unitId: string;
  assignedBy: string;
  assignedToUserId?: string | null;
  actionKey?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  slaBusinessDays?: number; // verilirse backend dueDate'i otomatik bu kadar iş günü sonrasına hesaplar
  relatedModule?: string;
  relatedItemId?: string;
  agentRunId?: string | null;
  progressNotes?: { date: string; note: string; author: string }[];
  createdAt?: string;
  completedAt?: string | null;
}
