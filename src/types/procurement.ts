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
  score?: number | null; // 0-1 ağırlıklı uygunluk skoru (fiyat/puan/teslim süresi) — backend hesaplar
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
