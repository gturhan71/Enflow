export type ApprovalMode = 'ANY' | 'ALL';

// Süreç motorunun (processEngine.ts) tenant-yapılandırılabilir süreç anahtarları.
// LIVE_PROCESS_KEYS'te olanlar gerçek bir iş modülü tarafından advanceProcess ile
// çağrılıyor; diğerleri Tasarımcı'da taslak olarak kurgulanabilir ama henüz hiçbir
// route bunları tetiklemiyor (yol haritası — bkz. plan Faz B "Kapsam Dışı").
export const PROCESS_KEYS = [
  'OPPORTUNITY_APPROVAL',
  'CONTRACT_SIGNING',
  'TENDER_TO_CONTRACT',
  'CONTRACT_TO_PROJECT',
  'CONTRACT_TO_PROCUREMENT',
  'PURCHASE_APPROVAL',
  'PURCHASE_TO_COST_ITEM',
  'PURCHASE_TO_INVOICE',
  'OPPORTUNITY_TO_PROJECT',
  'CRM_HANDOFF',
  'PRESALES_HANDOFF',
] as const;
export type ProcessKey = typeof PROCESS_KEYS[number];
export const PROCESS_KEY_LABEL: Record<ProcessKey, string> = {
  OPPORTUNITY_APPROVAL: 'Fırsat Onayı',
  CONTRACT_SIGNING: 'Sözleşme İmza',
  TENDER_TO_CONTRACT: 'İhale → Sözleşme',
  CONTRACT_TO_PROJECT: 'Sözleşme → Proje',
  CONTRACT_TO_PROCUREMENT: 'Sözleşme → Satınalma',
  PURCHASE_APPROVAL: 'Satınalma Onayı',
  PURCHASE_TO_COST_ITEM: 'Satınalma → Maliyet Kalemi',
  PURCHASE_TO_INVOICE: 'Satınalma → Fatura',
  OPPORTUNITY_TO_PROJECT: 'Fırsat → Proje',
  CRM_HANDOFF: 'CRM Devri (birimler arası)',
  PRESALES_HANDOFF: 'Presales Devri (teknik analiz sonrası)',
};
// advanceProcess tarafından gerçekten çağrılan (canlı) süreçler.
export const LIVE_PROCESS_KEYS: ProcessKey[] = [
  'OPPORTUNITY_APPROVAL', 'CONTRACT_SIGNING', 'TENDER_TO_CONTRACT', 'CONTRACT_TO_PROJECT',
  'CONTRACT_TO_PROCUREMENT', 'OPPORTUNITY_TO_PROJECT', 'PURCHASE_APPROVAL', 'PURCHASE_TO_COST_ITEM',
  'PURCHASE_TO_INVOICE', 'CRM_HANDOFF', 'PRESALES_HANDOFF',
];

// Süreç motorunun AUTO adımlarda çalıştırabileceği kayıtlı eylemler
// (processEngine.ts STAGE_ACTIONS ile birebir).
export const STAGE_ACTION_KEYS = [
  'CREATE_PROJECT_FROM_ENTITY',
  'CREATE_CONTRACT_FROM_TENDER',
  'CREATE_PURCHASE_COST_ITEM',
  'CREATE_PURCHASE_REQUEST_FROM_CONTRACT',
  'CREATE_INVOICE_FROM_PURCHASE',
] as const;
export type StageActionKey = typeof STAGE_ACTION_KEYS[number];
export const STAGE_ACTION_LABEL: Record<StageActionKey, string> = {
  CREATE_PROJECT_FROM_ENTITY: 'Proje kaydı oluştur',
  CREATE_CONTRACT_FROM_TENDER: 'Sözleşme kaydı oluştur',
  CREATE_PURCHASE_COST_ITEM: 'Maliyet kalemi oluştur',
  CREATE_PURCHASE_REQUEST_FROM_CONTRACT: 'Satınalma talebi oluştur',
  CREATE_INVOICE_FROM_PURCHASE: 'Fatura kaydı oluştur (yakında)',
};
export const LIVE_STAGE_ACTION_KEYS: StageActionKey[] = [
  'CREATE_PROJECT_FROM_ENTITY', 'CREATE_CONTRACT_FROM_TENDER', 'CREATE_PURCHASE_COST_ITEM',
  'CREATE_PURCHASE_REQUEST_FROM_CONTRACT',
];

export interface WorkflowStep {
  id: string;
  workflowId?: string;
  unitId: string;
  role?: string | null;
  // VEKİL — birim boşsa (aktif kimse yoksa) düşülecek kişi (değişmez kural #2).
  delegateUserId?: string | null;
  approvalMode?: ApprovalMode;
  actionKey?: string | null;
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
  role: string | null;
  unitId?: string | null;
  delegateUserId?: string | null;
  mode?: ApprovalMode;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  approverId?: string;
  note?: string;
  order?: number;
  approvedAt?: string;
  agentRunId?: string | null;
  escalatedToRole?: string | null;
  dueDate?: string | null;
}
export interface Workflow {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  processKey?: string | null;
  steps: WorkflowStep[];
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
