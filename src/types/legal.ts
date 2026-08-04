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
