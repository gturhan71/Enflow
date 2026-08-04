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
