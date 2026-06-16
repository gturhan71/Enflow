export interface WorkflowStep {
  id: string;
  workflowId?: string;
  unitId: string;
  type: 'AUTO' | 'MANUAL';
  description: string;
  order: number;
  nextStepId: string | null;
}

export interface ApprovalStage {
  id: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: string;
  note?: string;
  order?: number;
  approvedAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  stages: ApprovalStage[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions: string[];
  unitId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  tenantId?: string;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface Opportunity {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedCloseDate?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
  description?: string;
  lostReason?: string;
  technicalStatus?: string;
  bomStatus?: string;
  tenantId?: string;
  customerId: string;
  assignedToId: string;
  createdById?: string;
  presalesId?: string;
  createdAt?: string;
  updatedAt?: string;
  customer?: Customer;
  assignedTo?: User;
  createdBy?: User;
  bomItems?: BoMItem[];
  costItems?: CostItem[];
  costConfig?: CostConfig;
}

export interface Customer {
  id: string;
  name: string;
  shortName?: string;
  industry?: string;
  website?: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxOffice?: string;
  taxNumber?: string;
  chamberOfCommerce?: string;
  tradeRegistryNo?: string;
  riskScore: number;
  creditLimit: number;
  currency: 'USD' | 'EUR' | 'TRY';
  techStack?: string;
  socialMedia?: string;
  notes?: string;
  status: 'ACTIVE' | 'PASSIVE';
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  name: string;
  description?: string;
}

export interface CostRequirement {
  id: string;
  projectId: string;
  description: string;
  category: 'LABOR' | 'LOGISTICS' | 'TRAVEL' | 'OUTSOURCING' | 'OTHER';
  identifiedBy: string;
  costedBy?: string;
  estimatedCost?: number;
  status: 'IDENTIFIED' | 'COSTED' | 'APPROVED';
}

export interface BoMItem {
  id: string;
  opportunityId?: string;
  projectId?: string;
  partNumber: string;
  description: string;
  quantity: number;
  purchaseCost: number;
  marginPercentage: number;
  unitSalePrice?: number;
  totalSalePrice?: number;
  vendor?: string;
  currency?: string;
  source?: 'API' | 'EXCEL' | 'MANUAL';
  status?: 'PENDING_MATCH' | 'MATCHED';
}

export interface CostItem {
  id: string;
  description: string;
  category: 'LABOR' | 'LOGISTICS' | 'TRAVEL' | 'OTHER';
  amount: number;
  currency?: string;
  opportunityId: string;
  tenantId?: string;
}

export interface CostConfig {
  baseCurrency: string;
  rates: Record<string, number>;
  marginMode: 'PER_ITEM' | 'PROJECT_WIDE';
  globalMargin: number;
}

export type SubscriptionPlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface Subscription {
  id: string;
  plan: SubscriptionPlanType;
  tenantId: string;
  licenseModel?: string | null;
  licenseExpiryDate?: string | null;
  licensedUserLimit?: number | null;
  licensedStorageLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcurementNote {
  id: string;
  date: string;
  note: string;
  author: string;
}

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
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  slaBusinessDays?: number; // verilirse backend dueDate'i otomatik bu kadar iş günü sonrasına hesaplar
  relatedModule?: string;
  relatedItemId?: string;
  createdAt?: string;
}

export interface Tenant {
  id: string;
  name: string;
}

export interface CorporateDocument {
  id: string;
  name: string;
  category: 'LEGAL' | 'ISO' | 'CERTIFICATE' | 'FINANCIAL' | 'WORK_EXPERIENCE';
  expiryDate: string;
  fileUrl: string;
  tags: string[];
}

export interface NextcloudConfig {
  url: string;
  adminUser?: string;
  adminPass?: string;
  username?: string;
  appPassword?: string;
  basePath?: string;
  isEnabled?: boolean;
}

export interface ExchangeConfig {
  serverUrl?: string;
  server?: string;
  domain?: string;
  email?: string;
  adminEmail?: string;
  password?: string;
  adminPass?: string;
  isEnabled?: boolean;
  syncEmails?: boolean;
  syncCalendar?: boolean;
}

export interface WhatsAppConfig {
  phoneNumberId?: string;
  apiKey?: string;
  phoneNumber?: string;
  accessToken?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  isEnabled?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'URGENT' | 'SUCCESS' | 'WARNING';
  isRead: boolean;
  timestamp: string;
  scheduledAt?: string;
  relatedModule?: string;
  relatedItemId?: string;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  customerId?: string;
  createdById?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'SENT';
  version?: number;
  openForNegotiation?: boolean;
  content?: string | Record<string, unknown>;
  items?: BoMItem[];
  totalPrice?: number;
  description?: string;
  terms?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApprovalChain {
  id: string;
  entityType?: string; // OPPORTUNITY | CONTRACT_WORKFLOW_SIGNING | ...
  entityId: string;
  stages: ApprovalStage[];
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
}

export interface WorkflowLog {
  id: string;
  itemId: string;
  fromUnitId: string;
  toUnitId: string;
  assignedBy: string;
  assignedTo: string;
  note: string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'APPROVED';
}

export type LicenseModel = 'KOBI' | 'PAY_AS_YOU_GO' | 'ON_PREMISE';

export interface SubscriptionPlan {
  id: string;
  name: string;
  model: LicenseModel;
  price: number;
  features: string[];
  limits: {
    users: number;
    storage: number;
  };
  isActive: boolean;
}

export interface UsageMetric {
  id: string;
  type: string;
  count: number;
  costPerUnit: number;
  totalCost: number;
}

export interface LicenseData {
  companyName: string;
  model: LicenseModel;
  expiryDate: string;
  issuedAt: string;
  isTrial?: boolean;
  limits: {
    users: number;
    storage: number;
  };
  signature: string;
}

export interface ArchiveItem {
  id: string;
  boxNo: string;
  shelfNo: string;
  category: string;
  description?: string;
  owner: string;
  date: string;
  status: string;
  tags?: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisResultProduct {
  pn: string;
  description: string;
  quantity: number;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  specDetails: string;
  extractedProducts: AnalysisResultProduct[];
}

// ── Satınalma Modülü ──────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  taxNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  iban?: string | null;
  bankName?: string | null;
  categories: string; // JSON string[]
  rating?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseStatus =
  | 'DRAFT'
  | 'PENDING_UNIT'
  | 'PENDING_PROCUREMENT'
  | 'PENDING_GM'
  | 'PO_ISSUED'
  | 'IN_DELIVERY'
  | 'INVOICED'
  | 'CLOSED'
  | 'REJECTED';

export type PurchaseSourceType = 'MANUAL' | 'BOM' | 'PROJECT' | 'UNIT';
export type PurchaseUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface PurchaseItem {
  id: string;
  purchaseRequestId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimatedUnitPrice?: number | null;
  currency: string;
  actualUnitPrice?: number | null;
  createdAt: string;
}

export interface PurchaseQuote {
  id: string;
  purchaseRequestId: string;
  vendorId?: string | null;
  vendor?: Vendor | null;
  vendorName: string;
  totalAmount: number;
  currency: string;
  totalAmountTRY?: number | null;
  deliveryDays?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRecord {
  id: string;
  purchaseRequestId: string;
  deliveredAt: string;
  receivedBy?: string | null;
  quantityOrdered?: number | null;
  quantityReceived?: number | null;
  quantityDamaged?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  tenantId: string;
  title: string;
  description?: string | null;
  sourceType: PurchaseSourceType;
  sourceBomId?: string | null;
  projectId?: string | null;
  requestedBy: string;
  requestedByName?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  status: PurchaseStatus;
  urgency: PurchaseUrgency;
  neededBy?: string | null;
  budgetAmount?: number | null;
  currency: string;
  budgetAmountTRY?: number | null;
  selectedVendorId?: string | null;
  selectedVendorName?: string | null;
  poNumber?: string | null;
  poIssuedAt?: string | null;
  invoiceNo?: string | null;
  invoiceAmount?: number | null;
  invoiceDate?: string | null;
  invoicePaidAt?: string | null;
  approvedByUnit?: string | null;
  approvedByProcurement?: string | null;
  approvedByGM?: string | null;
  rejectedBy?: string | null;
  rejectionNote?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItem[];
  quotes: PurchaseQuote[];
  deliveries: DeliveryRecord[];
}
