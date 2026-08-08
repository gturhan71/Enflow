export type ProjectType    = 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'MIXED';
export type ProjectStatus  = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
export type MilestoneType  =
  | 'PLANNING' | 'PROCUREMENT' | 'SHIPMENT' | 'INSTALLATION'
  | 'DEVELOPMENT' | 'TESTING' | 'ACCEPTANCE' | 'INVOICING'
  | 'COLLECTION' | 'WARRANTY' | 'CUSTOM';
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
