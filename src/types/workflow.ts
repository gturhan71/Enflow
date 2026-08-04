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
