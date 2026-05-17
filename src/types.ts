export type UserRole = 'SALES_SUPPORT' | 'SALES_REP' | 'SALES_MANAGER' | 'UNIT_MANAGER' | 'GENERAL_MANAGER' | 'PRESALES_ENG' | 'PROCUREMENT_MGR';

export interface Unit {
  id: string;
  name: string;
  managerId?: string;
  description?: string;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  unitId?: string;
  tenantId?: string;
  permissions?: string[];
  status: 'ACTIVE' | 'INACTIVE';
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
  bomItems?: BoMItem[];
}

export interface Customer {
  id: string;
  name: string;
  shortName?: string;
  industry: string;
  website?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  taxOffice?: string;
  taxNumber?: string;
  riskScore: number;
  creditLimit: number;
  currency: string;
  techStack?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  type: 'VISIT' | 'OFFER' | 'APPROVAL' | 'CONTRACT' | 'DELIVERY' | 'NOTE';
  title: string;
  description: string;
  date: string;
  userId: string;
}

export interface SpecificationRequirement {
  id: string;
  projectId: string;
  itemNumber: string;
  description: string;
  isMet: boolean;
}

export interface CostRequirement {
  id: string;
  projectId: string;
  requirementId?: string;
  description: string;
  category: 'LABOR' | 'LOGISTICS' | 'OUTSOURCING' | 'OTHER';
  identifiedBy: string;
  costedBy?: string;
  estimatedCost?: number;
  status: 'IDENTIFIED' | 'COSTED' | 'APPROVED';
}

export interface BoMItem {
  id: string;
  projectId?: string;
  opportunityId?: string;
  requirementId?: string;
  partNumber: string;
  description: string;
  quantity: number;
  purchaseCost: number;
  marginPercentage: number;
  unitSalePrice: number;
  totalSalePrice: number;
  vendor: string;
  source: 'API' | 'EXCEL' | 'MANUAL';
  status: 'PENDING_MATCH' | 'MATCHED';
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
  procurementNotes?: { id: string; date: string; note: string; author: string }[];
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

export interface Contract {
  id: string;
  projectId?: string;
  opportunityId?: string;
  status: 'DRAFT' | 'PENDING_DOCUMENTS' | 'SIGNED' | 'COMPLETED';
  signedDate?: string;
  endDate?: string; // Geçerlilik süresi
  guaranteeAmount?: number;
  guaranteeExpiry?: string;
}

export interface ContractDocumentRequirement {
  id: string;
  contractId: string;
  name: string;
  description?: string;
  status: 'PENDING' | 'UPLOADED' | 'APPROVED';
  fileUrl?: string;
  dueDate?: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assignedTo?: string;
  dueDate?: string;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  distributorId: string;
  status: 'ORDERED' | 'SHIPPED' | 'IN_WAREHOUSE' | 'DELIVERED';
  etaDate: string;
}

export interface NextcloudConfig {
  url: string;
  adminUser: string;
  adminPass: string;
  basePath: string;
  isEnabled: boolean;
}

export interface ExchangeConfig {
  serverUrl: string;
  domain: string;
  adminEmail: string;
  adminPass: string;
  syncEmails: boolean;
  syncCalendar: boolean;
  isEnabled: boolean;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  isEnabled: boolean;
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  unitId: string;
  assignedBy: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string;
  createdAt: string;
  relatedModule?: 'PROJECT' | 'OPPORTUNITY' | 'CONTRACT' | 'PROCUREMENT' | 'GENERAL';
  relatedItemId?: string;
  progressNotes?: { date: string; note: string; author: string }[];
}

export interface WorkflowLog {
  id: string;
  itemId: string; // Opportunity or Project ID
  fromUnitId: string;
  toUnitId: string;
  assignedBy: string;
  assignedTo: string;
  note: string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'WHATSAPP' | 'EMAIL' | 'SYSTEM';
  isRead: boolean;
  timestamp: string;
}

export interface ArchiveItem {
  id: string;
  boxNo: string;
  shelfNo: string;
  category: string;
  description: string;
  owner: string;
  date: string;
  status: 'IN_ARCHIVE' | 'BORROWED' | 'DISPOSED';
  tags: string[];
}

export interface AnalysisResult {
  title: string;
  summary: string;
  specDetails: string;
  extractedProducts: {
    pn: string;
    description: string;
    quantity: number;
  }[];
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  unitId: string;
  order: number;
  type: 'AUTO' | 'MANUAL';
  description: string;
  nextStepId: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}
