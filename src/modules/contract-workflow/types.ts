import { Opportunity, Proposal } from '../../types';

export interface ContractWorkflowDoc {
  id: string;
  workflowId: string;
  name: string;
  docType: string;
  description?: string;
  deadline?: string | null;
  status: string;
  fileUrl?: string | null;
  isRequired: boolean;
  isAiGenerated: boolean;
  sortOrder: number;
  notes?: string;
}

export interface ContractWorkflow {
  id: string;
  title: string;
  opportunityId?: string | null;
  contractValue: number;
  tenderName?: string | null;
  tenderNo?: string | null;
  projectName?: string | null;
  contractText?: string | null;
  specText?: string | null;
  aiAnalysis?: string | null;
  status: string;
  signedDate?: string | null;
  deadline?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  projectId?: string | null;
  procurementRequestId?: string | null;
  documents: ContractWorkflowDoc[];
  createdAt: string;
}

export interface AiAnalysis {
  documents: { name: string; docType: string; description: string; deadline_priority: string; estimated_days: number; notes: string }[];
  tasks: { order: number; title: string; description: string; category: string; priority: string; estimated_days: number }[];
  key_clauses: { clause: string; impact: string; action_required: string }[];
  contract_summary: { project_name?: string; tender_no?: string; type: string; tax_obligations: string[]; key_deadlines: string[]; special_requirements: string[]; project_impacts: string[] };
}

export interface Props {
  opportunities?: Opportunity[];
  proposals?: Proposal[];
  initialItemId?: string | null;
}
