export interface WorkflowStep {
  id: string;
  workflowId?: string;
  unitId: string;
  type: 'AUTO' | 'MANUAL';
  description: string;
  order: number;
  nextStepId: string | null;
  enabled?: boolean;
  requiresCompletion?: boolean;
  completionNote?: string | null;
}

export interface ApprovalStage {
  id: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  approverId?: string;
  note?: string;
  order?: number;
  approvedAt?: string;
  agentRunId?: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  steps: WorkflowStep[];
  stages: ApprovalStage[];
}

export interface ResolveNextStepResult {
  nextStep: { id: string; unitId: string; unitName: string | null; description: string } | null;
  fallbackUsed: boolean;
  removedUnitName: string | null;
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
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST' | 'WITHDRAWN';
  description?: string;
  lostReason?: string;
  agentTriage?: {
    crm?: { recommendation: string; issues?: string[]; at: string };
    igpd?: { recommendation: string; expectedValue: number; valueTier: string; at: string };
  } | null;
  technicalStatus?: string;
  bomStatus?: string;
  procurementMethod?: string; // OPEN|RESTRICTED|NEGOTIATED|DIRECT|PRIVATE — Satış Destek tetikleyici
  targetBidDate?: string;     // son teklif/dönüşüm tarihi
  bomEvaluation?: string;     // JSON — BoM tedarikçi teklif değerlendirme snapshot'ı
  tenantId?: string;
  customerId: string;
  assignedToId: string;
  createdById?: string;
  presalesId?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
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
  managerId?: string | null;
  parentId?: string | null;
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
  lineKey?: string;
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
  source?: string;
  status?: 'PENDING_MATCH' | 'MATCHED';
}

export interface DashboardPayload {
  kpis: { winRate: number; pipelineValue: number; won: { count: number; value: number }; lost: { count: number; value: number }; withdrawnCount: number; activeOpps: number };
  timeSensitive: {
    tenderDeadlines: { id: string; name: string; ikn?: string | null; submissionDeadline: string | null; daysLeft: number | null }[];
    guaranteeExpiries: { id: string; type: string; amount: number; currency: string; expiryDate: string | null; daysLeft: number | null }[];
    guaranteeRequests: { id: string; type: string; amount: number; currency: string; isIndefinite?: boolean; tenderId?: string | null; expiryDate?: string | null }[];
    costApprovalsPending: { id: string; title: string; value: number }[];
    invoicesDue: { id: string; invoiceNo?: string | null; amount: number; currency: string; dueDate: string | null; overdue: boolean }[];
    milestonesDue: { id: string; title: string; projectName?: string | null; plannedEnd: string | null; daysLeft: number | null }[];
  };
  management: {
    bottlenecks: { role: string; label?: string; pendingCount: number; oldestWaitingDays: number }[];
    tenderPipeline: { active: number; submitted: number; won: number; lost: number; withdrawn: number };
    bomHandoffs: { count: number; recent: { id: string; oppTitle: string; itemCount: number; handoffCount: number; lastHandoffAt: string }[] };
    financing: { receivableByCurrency: Record<string, number>; overdueByCurrency: Record<string, number> };
    purchaseRequests: Record<string, number>;
    projects: { active: number; avgMargin: number };
  };
  personal: { myOpportunities: { id: string; title: string; value: number; status: string; technicalStatus?: string }[]; myTasksPending: number; unreadNotifications: number };
}

export type TechnicalCompliance = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';

export interface BomHandoff {
  id: string;
  opportunityId: string;
  oppTitle: string;
  customerName?: string | null;
  handedOffById?: string | null;
  handedOffByName?: string | null;
  handoffCount: number;
  itemCount: number;
  totalsByCurrency?: string | null; // JSON {TRY:x,USD:y}
  snapshot?: string | null;          // JSON { items:[...], evaluation:{...}|null }
  firstHandoffAt?: string;
  lastHandoffAt?: string;
}

export interface BoMLineQuote {
  id: string;
  tenantId?: string;
  opportunityId: string;
  lineKey: string;
  componentName?: string | null;
  vendorId?: string | null;
  vendorName: string;
  unitPrice: number;
  currency: string;
  technicalCompliance: TechnicalCompliance;
  specSummary?: string | null;
  deliveryDays?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  isSelected: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: string;
}

export interface CostItem {
  id: string;
  description: string;
  category: string; // CostCategory (procurementCosts.ts) — DB'de String
  amount: number;
  currency?: string;
  opportunityId: string;
  tenantId?: string;
  auto?: boolean;   // usule göre otomatik gelen masraf kalemi mi
}

export interface CostConfig {
  baseCurrency: string;
  // Yeni model
  spotRates?: Record<string, number>;
  forwardOverrides?: Record<string, number>;   // döviz başına forward override
  annualDepreciation?: number;                  // yıllık değer-kaybı %
  collectionDate?: string;                      // tahsilat tarihi (forward için)
  targetMargin?: number;                        // satış-üzerinden hedef marj %
  procurementMethod?: string;                   // ProcurementMethod
  methodCostLines?: { label: string; kind: 'PERCENT' | 'FIXED'; value: number; category: string }[];
  // Legacy (geriye uyum)
  rates?: Record<string, number>;
  marginMode?: 'PER_ITEM' | 'PROJECT_WIDE';
  globalMargin?: number;
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
  tags?: string[];
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
  refVendor?: string | null;
  refSource?: string | null;
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

// ── Finans Modülü (Faz 6) ──────────────────────────────────────────────────
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paidAt: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  type: 'SALES' | 'PURCHASE';
  invoiceNo?: string | null;
  amount: number;
  currency: string;
  issueDate?: string | null;
  dueDate?: string | null;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAmount: number;
  paidAt?: string | null;
  projectId?: string | null;
  contractId?: string | null;
  purchaseRequestId?: string | null;
  milestoneId?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
  docNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: Payment[];
}

export interface GuaranteeLetter {
  id: string;
  type: 'BID_BOND' | 'PERFORMANCE' | 'ADVANCE' | 'WARRANTY';
  bankName?: string | null;
  amount: number;
  currency: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  isIndefinite?: boolean;
  status: 'REQUESTED' | 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'CALLED';
  refNo?: string | null;
  projectId?: string | null;
  contractId?: string | null;
  tenderId?: string | null;
  docNumber?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  requestedById?: string | null;
  requestNote?: string | null;
  sampleText?: string | null;
  sampleFileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  totalReceivable: number;
  totalCollected: number;
  overdue: number;
  invoiceCount: number;
  salesCount: number;
  activeGuarantees: number;
  expiringGuarantees: number;
  pendingCostApprovals: number;
}

// ── Hukuk Modülü (Faz 6b) ───────────────────────────────────────────────────
export interface LegalCase {
  id: string;
  type: 'CONTRACT_REVIEW' | 'LEGAL_OPINION' | 'DISPUTE' | 'LITIGATION' | 'OTHER';
  title: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESPONDED' | 'ESCALATED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  summary?: string | null;
  opinion?: string | null;
  assignedToName?: string | null;
  requestedByName?: string | null;
  sourceTaskId?: string | null;
  dueDate?: string | null;
  docNumber?: string | null;
  fileUrl?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalRequest {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  relatedItemId?: string | null;
  converted: boolean;
  createdAt: string;
}

// Faz 6c — İhale / İSAB
export interface TenderChecklistItem {
  id: string;
  tenderId: string;
  name: string;
  isRequired: boolean;
  status: 'PENDING' | 'DONE' | 'WAIVED';
  fileUrl?: string | null;
  sortOrder: number;
  notes?: string | null;
  docType?: string | null;
  deadline?: string | null;
  isAiGenerated?: boolean;
  source?: 'MANUAL' | 'AI' | 'CORPORATE_DOC' | null;
  corporateDocId?: string | null;
}

export interface Tender {
  id: string;
  tenantId: string;
  name: string;
  ikn?: string | null;
  authority?: string | null;
  method: 'OPEN' | 'RESTRICTED' | 'NEGOTIATED' | 'DIRECT' | 'PRIVATE';
  status: 'DRAFT' | 'PREPARING' | 'SUBMITTED' | 'EVALUATING' | 'WON' | 'LOST' | 'CANCELLED' | 'WITHDRAWN';
  submissionDeadline?: string | null;
  submittedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawReason?: string | null;
  estimatedValue: number;
  currency: string;
  opportunityId?: string | null;
  contractWorkflowId?: string | null;
  ekapRef?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  docNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  checklist?: TenderChecklistItem[];
}

// ── Yönetim Raporlama (Faz 7) ────────────────────────────────────────────────
export interface ReportMetric {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface ReportChartSeries {
  title: string;
  type: 'bar' | 'pie' | 'line';
  data: { name: string; value: number }[];
}

export interface UnitMetrics {
  unitKey: string;
  label: string;
  role: string;
  period: { start: string; end: string };
  metrics: ReportMetric[];
  charts: ReportChartSeries[];
}

export interface WorkflowBottleneck {
  role: string;
  pendingCount: number;
  oldestWaitingDays: number;
}

export interface OverviewUnit {
  unitKey: string;
  label: string;
  role: string;
  headline: ReportMetric[];
  charts: ReportChartSeries[];
}

export interface ReportOverview {
  period: { start: string; end: string };
  units: OverviewUnit[];
  bottlenecks: WorkflowBottleneck[];
}

export interface UnitDefinition {
  key: string;
  label: string;
  role: string;
}

export interface UnitReport {
  id: string;
  tenantId: string;
  unitKey: string;
  unitLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'RETURNED';
  authorId?: string | null;
  authorName?: string | null;
  metricsSnapshot?: string | null;
  consolidationSnapshot?: string | null;
  escalatedToId?: string | null;
  escalatedToName?: string | null;
  highlights?: string | null;
  issues?: string | null;
  plannedActions?: string | null;
  risks?: string | null;
  summary?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  docNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Faz 8: Sanal Agent Eklentileri (plugin/entitlement) ──────────────────────
export interface PluginDefinition {
  key: string;
  name: string;
  category: 'VIRTUAL_AGENT';
  description: string;
  unitKey?: string;
  role?: string;
  defaultMode?: 'ADVISORY' | 'AUTONOMOUS';
  allowedModes?: ('ADVISORY' | 'AUTONOMOUS')[];
  entityType?: string;
  priceNote?: string;
  status: 'AVAILABLE' | 'COMING_SOON';
  hasHandler?: boolean;
}

export interface PluginEntitlement {
  id: string;
  tenantId: string;
  pluginKey: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'DISABLED';
  licenseKey?: string | null;
  mode: 'ADVISORY' | 'AUTONOMOUS';
  config?: string | null;
  activatedById?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementWithCatalog {
  plugin: PluginDefinition;
  entitlement: PluginEntitlement | null;
  active: boolean;
}

export interface AgentRun {
  id: string;
  tenantId: string;
  pluginKey: string;
  unitKey: string;
  entityType: string;
  entityId: string;
  mode: 'ADVISORY' | 'AUTONOMOUS';
  status: 'PENDING_RATIFICATION' | 'RATIFIED' | 'REJECTED';
  rationale?: string | null;
  outputJson?: string | null;
  triggeredById?: string | null;
  handoffTaskId?: string | null;
  actionTaken?: string | null;
  ratifiedById?: string | null;
  ratifiedAt?: string | null;
  ratifyNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string | null;
  userId: string;
  actorType?: 'HUMAN' | 'AGENT' | null;
  agentRunId?: string | null;
  tenantId: string;
  timestamp: string;
}

// ── Yedekleme / Geri Yükleme ─────────────────────────────────────────────────
export interface BackupJob {
  id: string;
  tenantId: string;
  scope: 'PLATFORM' | 'TENANT';
  kind: 'FULL' | 'STATE' | 'DATA';
  dbProvider: 'SQLITE' | 'POSTGRES';
  trigger: 'MANUAL' | 'SCHEDULED';
  targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3';
  location?: string | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  sizeBytes: number;
  checksum?: string | null;
  stateRef?: string | null;
  dataRef?: string | null;
  modelCounts?: string | null;
  verifyStatus: 'PENDING' | 'PASSED' | 'FAILED';
  verifyReport?: string | null;
  verifiedAt?: string | null;
  startedByName?: string | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface RestoreJob {
  id: string;
  tenantId: string;
  backupId: string;
  mode: 'LOGICAL' | 'STATE';
  status: 'ANALYZING' | 'AWAITING_CONFIRM' | 'RESTORING' | 'COMPLETED' | 'FAILED';
  diffReport?: string | null;
  preRestoreBackupId?: string | null;
  startedByName?: string | null;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface BackupSettings {
  enabled: boolean;
  intervalHours: number;
  scope: 'PLATFORM' | 'TENANT';
  kind: 'FULL' | 'STATE' | 'DATA';
  targetType: 'LOCAL' | 'NEXTCLOUD' | 'S3';
  location: string;
  nextcloud: { url: string; username: string; folder: string; hasPassword: boolean };
  s3: { endpoint: string; region: string; bucket: string; prefix: string; accessKeyId: string; hasSecret: boolean };
}
