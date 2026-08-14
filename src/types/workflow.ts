export type ApprovalMode = 'ANY' | 'ALL';

// Süreç motorunun (processEngine.ts) tenant-yapılandırılabilir süreç anahtarları.
// LIVE_PROCESS_KEYS'te olanlar gerçek bir iş modülü tarafından advanceProcess ile
// çağrılıyor; diğerleri Tasarımcı'da taslak olarak kurgulanabilir ama henüz hiçbir
// route bunları tetiklemiyor (yol haritası — bkz. plan Faz B "Kapsam Dışı").
export const PROCESS_KEYS = [
  'OPPORTUNITY_APPROVAL',
  'CONTRACT_SIGNING',
  'TENDER_SUBMIT_APPROVAL',
  'TENDER_TO_CONTRACT',
  'CONTRACT_TO_PROJECT',
  'CONTRACT_TO_PROCUREMENT',
  'PURCHASE_APPROVAL',
  'PURCHASE_TO_COST_ITEM',
  'PURCHASE_TO_INVOICE',
  'PROJECT_TO_INVOICE',
  'OPPORTUNITY_TO_PROJECT',
  'CRM_HANDOFF',
  'PRESALES_HANDOFF',
] as const;
export type ProcessKey = typeof PROCESS_KEYS[number];
export const PROCESS_KEY_LABEL: Record<ProcessKey, string> = {
  OPPORTUNITY_APPROVAL: 'Fırsat Onayı',
  CONTRACT_SIGNING: 'Sözleşme İmza',
  TENDER_SUBMIT_APPROVAL: 'Teklif Onayı (ihaleye teslim)',
  TENDER_TO_CONTRACT: 'İhale → Sözleşme',
  CONTRACT_TO_PROJECT: 'Sözleşme → Proje',
  CONTRACT_TO_PROCUREMENT: 'Sözleşme → Satınalma',
  PURCHASE_APPROVAL: 'Satınalma Onayı',
  PURCHASE_TO_COST_ITEM: 'Satınalma → Maliyet Kalemi',
  PURCHASE_TO_INVOICE: 'Satınalma → Fatura',
  PROJECT_TO_INVOICE: 'Proje → Fatura (kapanış)',
  OPPORTUNITY_TO_PROJECT: 'Fırsat → Proje',
  CRM_HANDOFF: 'CRM Devri (birimler arası)',
  PRESALES_HANDOFF: 'Presales Devri (teknik analiz sonrası)',
};
// advanceProcess tarafından gerçekten çağrılan (canlı) süreçler.
export const LIVE_PROCESS_KEYS: ProcessKey[] = [
  'OPPORTUNITY_APPROVAL', 'CONTRACT_SIGNING', 'TENDER_SUBMIT_APPROVAL', 'TENDER_TO_CONTRACT',
  'CONTRACT_TO_PROJECT', 'CONTRACT_TO_PROCUREMENT', 'OPPORTUNITY_TO_PROJECT', 'PURCHASE_APPROVAL',
  'PURCHASE_TO_COST_ITEM', 'PURCHASE_TO_INVOICE', 'PROJECT_TO_INVOICE', 'CRM_HANDOFF', 'PRESALES_HANDOFF',
];

// Süreç motorunun AUTO adımlarda çalıştırabileceği kayıtlı eylemler
// (processEngine.ts STAGE_ACTIONS ile birebir).
export const STAGE_ACTION_KEYS = [
  'CREATE_PROJECT_FROM_ENTITY',
  'CREATE_CONTRACT_FROM_TENDER',
  'CREATE_PURCHASE_COST_ITEM',
  'CREATE_PURCHASE_REQUEST_FROM_CONTRACT',
  'COPY_FIELDS_TO_TASK',
  'SUBMIT_TENDER',
  'CREATE_SALES_INVOICE_FOR_PROJECT',
  'CREATE_INVOICE_FROM_PURCHASE',
] as const;
export type StageActionKey = typeof STAGE_ACTION_KEYS[number];
export const STAGE_ACTION_LABEL: Record<StageActionKey, string> = {
  CREATE_PROJECT_FROM_ENTITY: 'Proje kaydı oluştur',
  CREATE_CONTRACT_FROM_TENDER: 'Sözleşme kaydı oluştur',
  CREATE_PURCHASE_COST_ITEM: 'Maliyet kalemi oluştur',
  CREATE_PURCHASE_REQUEST_FROM_CONTRACT: 'Satınalma talebi oluştur',
  COPY_FIELDS_TO_TASK: 'Seçili alanları göreve kopyala (veri aktarımı)',
  SUBMIT_TENDER: 'Teklifi teslim et',
  CREATE_SALES_INVOICE_FOR_PROJECT: 'Satış faturası oluştur (proje kapanışı)',
  CREATE_INVOICE_FROM_PURCHASE: 'Fatura kaydı oluştur (yakında)',
};
export const LIVE_STAGE_ACTION_KEYS: StageActionKey[] = [
  'CREATE_PROJECT_FROM_ENTITY', 'CREATE_CONTRACT_FROM_TENDER', 'CREATE_PURCHASE_COST_ITEM',
  'CREATE_PURCHASE_REQUEST_FROM_CONTRACT', 'COPY_FIELDS_TO_TASK', 'SUBMIT_TENDER', 'CREATE_SALES_INVOICE_FOR_PROJECT',
];

// Jenerik tetikleme + COPY_FIELDS_TO_TASK'ın kullandığı varlık türleri —
// backend'deki processEngine.ts ENTITY_FIELD_SPECS ile birebir aynı (beyaz liste).
export const ENTITY_TYPES = ['OPPORTUNITY', 'CONTRACT_WORKFLOW_SIGNING', 'PROJECT', 'PURCHASE_REQUEST', 'TENDER'] as const;
export type EntityType = typeof ENTITY_TYPES[number];
export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  OPPORTUNITY: 'Fırsat',
  CONTRACT_WORKFLOW_SIGNING: 'Sözleşme',
  PROJECT: 'Proje',
  PURCHASE_REQUEST: 'Satınalma Talebi',
  TENDER: 'İhale',
};
export interface EntityFieldSpec { key: string; label: string }
export const ENTITY_FIELD_SPECS: Record<EntityType, EntityFieldSpec[]> = {
  OPPORTUNITY: [
    { key: 'title', label: 'Başlık' },
    { key: 'value', label: 'Değer' },
    { key: 'probability', label: 'Olasılık (%)' },
    { key: 'status', label: 'Durum' },
    { key: 'expectedCloseDate', label: 'Beklenen Kapanış' },
  ],
  CONTRACT_WORKFLOW_SIGNING: [
    { key: 'title', label: 'Başlık' },
    { key: 'contractValue', label: 'Sözleşme Bedeli' },
    { key: 'tenderNo', label: 'İKN' },
    { key: 'projectName', label: 'Proje Adı' },
    { key: 'deadline', label: 'Son Tarih' },
  ],
  PROJECT: [
    { key: 'name', label: 'Proje Adı' },
    { key: 'code', label: 'Proje Kodu' },
    { key: 'totalValue', label: 'Toplam Değer' },
    { key: 'budgetTotal', label: 'Bütçe' },
    { key: 'status', label: 'Durum' },
  ],
  PURCHASE_REQUEST: [
    { key: 'title', label: 'Başlık' },
    { key: 'budgetAmount', label: 'Bütçe Tutarı' },
    { key: 'currency', label: 'Para Birimi' },
    { key: 'status', label: 'Durum' },
    { key: 'poNumber', label: 'PO Numarası' },
  ],
  TENDER: [
    { key: 'name', label: 'İhale Adı' },
    { key: 'ikn', label: 'İKN' },
    { key: 'estimatedValue', label: 'Tahmini Bedel' },
    { key: 'currency', label: 'Para Birimi' },
    { key: 'submissionDeadline', label: 'Son Teklif Tarihi' },
  ],
};

export interface WorkflowStep {
  id: string;
  workflowId?: string;
  unitId: string;
  role?: string | null;
  // VEKİL — birim boşsa (aktif kimse yoksa) düşülecek kişi (değişmez kural #2).
  delegateUserId?: string | null;
  approvalMode?: ApprovalMode;
  actionKey?: string | null;
  // actionKey'e özel yapılandırma (JSON string) — örn. COPY_FIELDS_TO_TASK için {"fields":["title","value"]}
  actionConfig?: string | null;
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
  // Tenant-özel (custom) süreçler için hedef varlık türü — jenerik tetikleme
  // ucunun (POST /workflows/:processKey/trigger) hangi kayda uygulanacağını bilmesi için.
  entityType?: string | null;
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
