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
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcurementNote {
  id: string;
  date: string;
  note: string;
  author: string;
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  status: 'DRAFT' | 'ANALYSIS' | 'AWAITING_APPROVAL' | 'APPROVED' | 'WON' | 'LOST' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  totalValue: number;
  avgMargin: number;
  deadline: string;
  ownerId: string;
  managerId?: string;
  progress?: number;
  opportunityId?: string;
  procurementNotes?: ProcurementNote[];
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
