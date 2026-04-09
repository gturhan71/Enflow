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
  permissions?: string[]; // Array of permission codes
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Customer {
  id: string;
  name: string;
  industry: string;
  riskScore: number;
  contactPerson: string;
  email: string;
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
}

export interface Opportunity {
  id: string;
  title: string;
  customerId: string;
  value: number;
  probability: number; // 0-100
  expectedCloseDate: string;
  status: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
  description: string;
  assignedTo: string; // Sales Rep User ID
  createdBy: string; // User ID
  presalesId?: string; // Presales Team Leader ID
  technicalStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  bomStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}
