import type { User } from './auth';
import type { BoMItem, CostItem } from './presales';

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
  lastProgressCheckAt?: string | null; // son ilerleme teyidi zamanı — bkz. OpportunityProgressLog
  customer?: Customer;
  assignedTo?: User;
  createdBy?: User;
  bomItems?: BoMItem[];
  costItems?: CostItem[];
  costConfig?: CostConfig;
}

// Fırsat ilerleme teyidi geçmişi — periyodik zorunlu check-in + olasılık/aşama trendi
export interface OpportunityProgressLog {
  id: string;
  tenantId: string;
  opportunityId: string;
  recordedById: string;
  previousStatus: string;
  newStatus: string;
  previousProbability: number;
  newProbability: number;
  changed: boolean;
  note?: string | null;
  createdAt: string;
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
  source?: string;
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
  contacts?: Contact[];
}
// Kurumsal müşteride birden çok kişi (satınalma/teknik/muhasebe farklı kişiler
// olabilir) — Customer.email/phone genel/varsayılan iletişim olarak kalır.
export type ContactRole = 'PURCHASING' | 'TECHNICAL' | 'FINANCE' | 'MANAGEMENT' | 'OTHER';
export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  PURCHASING: 'Satınalma', TECHNICAL: 'Teknik', FINANCE: 'Muhasebe/Finans', MANAGEMENT: 'Yönetim', OTHER: 'Diğer',
};
export interface Contact {
  id: string;
  tenantId?: string;
  customerId: string;
  name: string;
  role: ContactRole;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
export interface Proposal {
  id: string;
  opportunityId: string;
  customerId?: string;
  createdById?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'SENT';
  rejectionReason?: string | null;
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
