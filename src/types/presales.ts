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
  vatRate?: number; // kalem bazında KDV % — teklif KDV hesabında kullanılır (varsayılan 20)
  source?: string;
  status?: 'PENDING_MATCH' | 'MATCHED';
  brandId?: string | null;
  brand?: { id: string; name: string } | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
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
// Maliyet analizi versiyon geçmişi — her "Kaydet ve Onaya Gönder" işlemi ayrı bir satır
// olarak tutulur (backend/prisma/schema.prisma CostAnalysisVersion). Fırsat kartında
// "kaç kez maliyet analizi yapıldı" bu listeden türetilir.
export interface CostAnalysisVersion {
  id: string;
  tenantId: string;
  opportunityId: string;
  version: number;
  bomItems: BoMItem[];
  costItems: CostItem[];
  costConfig: Record<string, unknown>;
  grandCost: number;
  offer: number;
  marginPct: number;
  belowFloor: boolean;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
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
