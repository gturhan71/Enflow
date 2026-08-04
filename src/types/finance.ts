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
  customerId?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
  docNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: Payment[];
  issueRateToTRY?: number | null; // B-18 — yabancı para birimli faturada kesim kuru
}
// B-18 — döviz kur farkı: fatura kesim kuru ile tahsilat kurunun farkı (gerçek TRY kâr/zarar).
export interface FxAdjustment {
  id: string;
  invoiceId: string;
  invoice?: { id: string; invoiceNo?: string | null; projectId?: string | null; customerName?: string | null; vendorName?: string | null };
  paymentId: string;
  currency: string;
  amountFx: number;
  issueRate: number;
  paymentRate: number;
  gainLossTRY: number;
  createdAt?: string;
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
