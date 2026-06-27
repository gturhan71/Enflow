// Enflow — Birim & Rol Sorumluluk Matrisi (kanonik kaynak)
// ─────────────────────────────────────────────────────────────────────────────
// Tek deterministik "doğruluk kaynağı": her kullanıcı tipi (rol) için ait olduğu
// birim, erişim, yönetici KARAR mekanizmaları ve personel GÖREVLERİ.
// `governance/audit-roles` bu matrisi canlı config'e karşı denetler.
//
// ⚠️ Bu matris TANIMLAYICI (descriptive) tek kaynaktır; kod davranışını otomatik
// türetmez. Faz 1'de her rol "var olanı göster → ekle → düzelt" ile doldurulur.
// İskelet: modules/endpointDomains/decisionRights/tasks başlangıçta BOŞ.

export type RoleKind = 'MANAGER' | 'STAFF';
export type Staffing = 'HUMAN' | 'AGENT_ONLY' | 'UNSTAFFED';
export type RACI = 'R' | 'A' | 'C' | 'I';
export type AgentMode = 'ADVISORY' | 'AUTONOMOUS';

export interface DecisionRight {
  decision: string;   // karar/onay adı (örn. "Fırsat onayı", "PO açma")
  via: string;        // mekanizma: approvalChain:<entityType> | endpoint:<route> | statusTransition:<x→y>
  threshold?: string; // varsa eşik/escalation
}

export interface RoleTask {
  task: string;
  raci: RACI;
  via: string;        // workflowStep:<x> | endpoint:<route> | module:<x>
}

export interface RoleSpec {
  role: string;             // ROLE_LABELS ile birebir kanonik anahtar
  unit: string;             // ait olduğu birim (Unit.name anahtar kelimesi)
  kind: RoleKind;
  staffing: Staffing;       // gerçek kullanıcı / agent doldurur / boş
  modules: string[];        // NAV id veya permission (örn. CRM_OPPS_VIEW)
  endpointDomains: string[];// backend kapısında bulunması gereken domain (route adı)
  decisionRights: DecisionRight[]; // (MANAGER) karar mekanizmaları
  tasks: RoleTask[];        // (STAFF) akış görevleri
  approvalIn: string[];     // yer aldığı onay zinciri entityType'ları
  agentSubstitute?: { pluginKey: string; modes: AgentMode[] };
  reviewed?: 'DONE' | 'ACCEPTED'; // Faz 1 turunda işlendi (DONE=dolduruldu, ACCEPTED=gerekçeli boş)
  notes?: string;
}

// ── Matris ──────────────────────────────────────────────────────────────────
// Faz 1'de tüm roller dolduruldu (reviewed DONE/ACCEPTED).
// 2026-06-21: 14 eksik rol için gerçek kullanıcılar oluşturuldu → staffing=HUMAN
// (önceki UNSTAFFED/AGENT_ONLY). agentSubstitute artık YEDEK (boş koltuk değil).
// Notlardaki "DB personeli yok" ifadeleri bu tarihten önceki durumu yansıtır.
export const ROLE_MATRIX: RoleSpec[] = [
  {
    role: 'ADMIN', unit: 'Sistem', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['SETTINGS_VIEW', 'SETTINGS_COMPANY', 'SETTINGS_UNITS', 'SETTINGS_USERS', 'SETTINGS_PERMISSIONS', 'SETTINGS_INTEGRATIONS'],
    endpointDomains: [], decisionRights: [], tasks: [], approvalIn: [],
    reviewed: 'ACCEPTED',
    notes: 'Sistem yöneticisi — Ayarlar (şirket/birim/kullanıcı/yetki/entegrasyon) sahibi. Fiilen GENERAL_MANAGER superuser olarak yönetiyor; ayrı DB kullanıcısı/agent YOK (rezerve). Ayar modülleri tasarım gereği yalnız admin/GM.',
  },
  {
    role: 'GENERAL_MANAGER', unit: 'Üst Yönetim', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['*'], // superuser: AuthContext.hasPermission GM için her zaman true
    endpointDomains: ['adminTest', 'archive', 'contractWorkflow', 'customers', 'opportunities', 'plugins', 'tenants', 'units', 'users'],
    decisionRights: [
      { decision: 'Fırsat onayı (swimlane son onay)', via: 'approvalChain:OPPORTUNITY' },
      { decision: 'Teklif onayı (swimlane son onay)', via: 'approvalChain:PROPOSAL' },
      { decision: 'Sözleşme imza onayı', via: 'approvalChain:CONTRACT_WORKFLOW_SIGNING' },
      { decision: 'Kullanıcı / birim / kiracı yönetimi', via: 'endpoint:users,units,tenants' },
      { decision: 'Lisans anahtarı üretimi', via: 'endpoint:plugins/generate-key' },
      { decision: 'Arşiv yönetimi', via: 'endpoint:archive' },
    ],
    tasks: [], approvalIn: ['OPPORTUNITY', 'PROPOSAL', 'CONTRACT_WORKFLOW_SIGNING'],
    reviewed: 'DONE',
    notes: 'Superuser — tüm modüllere erişir. Onay swimlane\'lerinde nihai/üst yönetim onay aşaması.',
  },
  {
    role: 'SALES_MGR', unit: 'Satış', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'COST_ANALYSIS_VIEW', 'SALES_SUPPORT_VIEW', 'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Satınalma talebi birim onayı', via: 'statusTransition:PENDING_UNIT→PENDING_PROCUREMENT (ProcurementModule: SALES_MGR|GM)' },
      { decision: 'Sözleşme yönetimi erişimi (satış tarafı)', via: 'endpoint:contractWorkflow' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_CRM', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'Satış birimi yöneticisi. CRM gözetimi; PR birim onayı. Onay swimlane\'lerinde değil. CRM agent bu koltuğu doldurur.',
  },
  {
    role: 'SALES_REP', unit: 'Satış', kind: 'STAFF', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW', 'CRM_CUSTOMERS_VIEW', 'CRM_PROPOSALS_VIEW', 'COST_ANALYSIS_VIEW', 'VISIT_PLAN_VIEW', 'SALES_SUPPORT_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['customers', 'opportunities'],
    decisionRights: [],
    tasks: [
      { task: 'Fırsat oluşturma / güncelleme', raci: 'R', via: 'endpoint:opportunities' },
      { task: 'Müşteri kaydı yönetimi', raci: 'R', via: 'endpoint:customers' },
      { task: 'Teklif hazırlama / sunma', raci: 'R', via: 'module:crm-proposals' },
      { task: 'Ziyaret planı / günlük rapor', raci: 'R', via: 'module:visit-plan' },
    ],
    approvalIn: [],
    reviewed: 'DONE',
    notes: 'Saha satış temsilcisi — fırsat/müşteri/teklif sahibi (GM_OR_SALES kapısı: customers+opportunities).',
  },
  {
    role: 'SALES_SUPPORT', unit: 'Satış', kind: 'STAFF', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'SALES_SUPPORT_VIEW', 'PROCUREMENT_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'TODO_VIEW'],
    endpointDomains: [],
    decisionRights: [],
    tasks: [
      { task: 'İhale / İSAB takibi (Tender + checklist + teminat)', raci: 'R', via: 'module:sales-support' },
      { task: 'Doküman / arşiv desteği', raci: 'C', via: 'module:documents,archive' },
    ],
    approvalIn: [],
    reviewed: 'DONE',
    notes: 'Satış destek — İhale/İSAB modülü operasyonu; backend rol kapısı yok (frontend SALES_SUPPORT_VIEW).',
  },
  {
    role: 'PRESALES_MGR', unit: 'Presales', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'CRM_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [],
    decisionRights: [
      { decision: 'Teknik / BoM onayı (Presales birim onayı)', via: 'statusTransition:Opportunity.technicalStatus / bomStatus' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_PRESALES', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'Presales birim yöneticisi — teknik/BoM onayı. DB personeli yok; Presales agent bu koltuğu doldurur (BoM tutarlılık denetimi).',
  },
  {
    role: 'PRESALES_ENG', unit: 'Presales', kind: 'STAFF', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'CRM_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['units'], // yalnız GET (liste) — GM_OR_PRESALES; POST/DELETE GM-only
    decisionRights: [],
    tasks: [
      { task: 'BoM (malzeme listesi) hazırlama', raci: 'R', via: 'module:presales' },
      { task: 'Maliyet analizi (döviz/kur/marj)', raci: 'R', via: 'module:presales-cost' },
      { task: 'Teknik şartname analizi (SpecAnalysis)', raci: 'R', via: 'module:presales' },
      { task: 'Teklif teknik içeriği', raci: 'C', via: 'module:crm-proposals' },
    ],
    approvalIn: [],
    reviewed: 'DONE',
    notes: 'Presales mühendisi — BoM/maliyet/teknik şartname sahibi. units.ts GET (read-only) erişimi var.',
  },
  {
    role: 'TECHNICAL_SPEC', unit: 'Presales', kind: 'STAFF', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PRESALES_VIEW', 'TODO_VIEW'],
    endpointDomains: [],
    decisionRights: [],
    tasks: [
      { task: 'Derin teknik uzmanlık / şartname yorumu', raci: 'C', via: 'module:presales' },
      { task: 'Çözüm tasarımı desteği', raci: 'C', via: 'module:presales' },
    ],
    approvalIn: [],
    reviewed: 'DONE',
    notes: 'Teknik uzman — Presales mühendisine danışmanlık. DB personeli yok (tanımlı, atanmamış).',
  },
  {
    role: 'PROJECT_MGR', unit: 'Proje', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Milestone ilerleme/onay yönetimi', via: 'endpoint:projects/:id/milestones' },
      { decision: 'Proje devir paketi (11 evrak) kontrolü', via: 'endpoint:projects/:id/handover-docs' },
      { decision: 'Proje maliyet kalemleri yönetimi', via: 'endpoint:projects/:id/costs' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_PROJECT', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'Proje birim yöneticisi — milestone/devir/maliyet. requiresApproval milestone geçişleri GM onayına gider. DB personeli yok; Project agent doldurur (devir/milestone).',
  },
  {
    role: 'OPERATIONS_MGR', unit: 'Operasyon', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'PROCUREMENT_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [], decisionRights: [], tasks: [], approvalIn: [],
    reviewed: 'ACCEPTED',
    notes: 'Operasyon yöneticisi — tanımlı rol ama sisteme özgü somut karar mekanizması (onay/endpoint kapısı) YOK. DB personeli/agent yok. İleride operasyon akışı tanımlanırsa doldurulacak (ACCEPTED).',
  },
  {
    role: 'PROCUREMENT_MGR', unit: 'Satın Alma', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PROCUREMENT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [],
    decisionRights: [
      { decision: 'Satınalma talebi satınalma aşaması onayı', via: 'statusTransition:PENDING_PROCUREMENT→PENDING_GM (ProcurementModule: PROCUREMENT_MGR|GM)' },
      { decision: 'Tedarikçi / teklif seçimi + PO açma', via: 'endpoint:purchase-requests/:id/quotes/:qid/select + /approve' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_PROCUREMENT', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'Satın Alma birim yöneticisi — PR satınalma aşaması onayı + tedarikçi seçimi/PO. DB personeli yok; Procurement agent doldurur (en-ucuz-teklif otonom).',
  },
  {
    role: 'FINANCE_MGR', unit: 'Finans', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'FINANCE_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Fırsat finansal onayı (swimlane 1. aşama)', via: 'approvalChain:OPPORTUNITY' },
      { decision: 'Teklif finansal onayı (swimlane 1. aşama)', via: 'approvalChain:PROPOSAL' },
      { decision: 'Maliyet onayı', via: 'endpoint:finance/costs/:id/approve' },
      { decision: 'Fatura / tahsilat / teminat yönetimi', via: 'module:finance (Invoice/Payment/GuaranteeLetter)' },
    ],
    tasks: [], approvalIn: ['OPPORTUNITY', 'PROPOSAL'],
    agentSubstitute: { pluginKey: 'AGENT_FINANCE', modes: ['ADVISORY'] }, // PARA — asla otonom
    reviewed: 'DONE',
    notes: 'Finans birim yöneticisi — swimlane finansal onay + maliyet/fatura. DB personeli yok; Finance agent yalnız ADVISORY (para, asla otonom).',
  },
  {
    role: 'HR_MGR', unit: 'İnsan Kaynakları', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [], decisionRights: [], tasks: [], approvalIn: [],
    reviewed: 'ACCEPTED',
    notes: 'İK yöneticisi — tanımlı rol ama sistemde İK modülü/akışı YOK. DB personeli/agent yok. İK modülü eklenirse doldurulacak (ACCEPTED).',
  },
  {
    role: 'AUDITOR', unit: 'Denetim', kind: 'STAFF', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW'],
    endpointDomains: [],
    decisionRights: [],
    tasks: [
      { task: 'Denetim izi inceleme (salt-okunur)', raci: 'I', via: 'endpoint:activity-logs (şu an GM-only Test Ortamı)' },
    ],
    approvalIn: [],
    reviewed: 'ACCEPTED',
    notes: 'Denetçi — salt-okunur denetim izi (ActivityLog). DB personeli yok; ActivityLog UI şu an GM-only. Ayrı AUDITOR erişimi ileride değerlendirilebilir (ACCEPTED).',
  },
  {
    role: 'IGPD_MGR', unit: 'İGPD', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'CRM_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Fırsat İGPD onayı (swimlane 2. aşama)', via: 'approvalChain:OPPORTUNITY' },
      { decision: 'Teklif İGPD onayı (swimlane 2. aşama)', via: 'approvalChain:PROPOSAL' },
      { decision: 'İş geliştirme triyajı (beklenen değer/önceliklendirme)', via: 'agent:AGENT_IGPD → Opportunity.agentTriage' },
    ],
    tasks: [], approvalIn: ['OPPORTUNITY', 'PROPOSAL'],
    agentSubstitute: { pluginKey: 'AGENT_IGPD', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'İş Geliştirme & Pazarlama yöneticisi — swimlane İGPD onayı + BD triyajı (deterministik agent annotation). DB personeli yok; İGPD agent doldurur.',
  },
  {
    role: 'KGD_MGR', unit: 'Kalite Güvence', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'PROJECT_MGMT_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'CORPORATE_GOV_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [],
    decisionRights: [
      { decision: 'Kalite güvence + proje devri onayı', via: 'workflowStep:KGD (Varsayılan İş Akışı "Kalite güvence ve proje devri")' },
    ],
    tasks: [], approvalIn: [],
    reviewed: 'DONE',
    notes: 'Kalite Güvence yöneticisi — proje devri/kalite. Onay zincirinde değil; workflow adımı. DB personeli + agent YOK → workflow adımı manuel/atanmamış.',
  },
  {
    role: 'KSU_MGR', unit: 'Sözleşme', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'CONTRACTS_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Sözleşme imza onayı (1. aşama)', via: 'approvalChain:CONTRACT_WORKFLOW_SIGNING' },
      { decision: 'Fırsat KSU onayı (swimlane son aşama)', via: 'approvalChain:OPPORTUNITY' },
      { decision: 'Teklif KSU onayı (swimlane son aşama)', via: 'approvalChain:PROPOSAL' },
      { decision: 'Sözleşme evrak kontrolü', via: 'module:contract-workflow (ContractWorkflowDoc)' },
    ],
    tasks: [], approvalIn: ['OPPORTUNITY', 'PROPOSAL', 'CONTRACT_WORKFLOW_SIGNING'],
    reviewed: 'DONE',
    notes: 'Kontrat & Sözleşme yöneticisi — 3 onay zincirinde (sözleşme imzanın 1. aşaması). ✅ Artık gerçek personel atandı (sozlesme.uzmani@enflow.com) → imza/onay aşamaları auto-skip OLMUYOR (eski risk çözüldü).',
  },
  {
    role: 'ISAB_MGR', unit: 'İhale Satın Alma', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'SALES_SUPPORT_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: [], // tenders route'u rol kapısı yok (frontend SALES_SUPPORT_VIEW)
    decisionRights: [
      { decision: 'İhale uygunluk/checklist + teminat onayı', via: 'module:sales-support (Tender + checklist + GuaranteeLetter)' },
      { decision: 'İhale WON → Sözleşme tetikleme (T3)', via: 'statusTransition:Tender→WON (contractWorkflow oluştur)' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_TENDER', modes: ['ADVISORY', 'AUTONOMOUS'] },
    reviewed: 'DONE',
    notes: 'İhale Satın Alma birim yöneticisi — Tender/checklist/teminat + WON→Sözleşme (T3). DB personeli yok; Tender agent doldurur (checklist/deadline).',
  },
  {
    role: 'LEGAL_MGR', unit: 'Hukuk', kind: 'MANAGER', staffing: 'HUMAN',
    modules: ['DASHBOARD_VIEW', 'CONTRACTS_VIEW', 'DOCUMENTS_VIEW', 'TODO_VIEW'],
    endpointDomains: ['contractWorkflow'],
    decisionRights: [
      { decision: 'Hukuki görüş / vaka yönetimi', via: 'endpoint:legal/cases (LegalCase opinion/status)' },
      { decision: 'Sözleşme hukuki incelemesi', via: 'module:contract-workflow (LegalView mode=legal)' },
      { decision: 'Hukuki talep işleme', via: 'endpoint:legal/requests (TodoTask relatedModule=LEGAL)' },
    ],
    tasks: [], approvalIn: [],
    agentSubstitute: { pluginKey: 'AGENT_LEGAL', modes: ['ADVISORY'] }, // HUKUK — asla otonom
    reviewed: 'DONE',
    notes: 'Hukuk yöneticisi — hukuki görüş/vaka + sözleşme incelemesi. Onay swimlane\'inde değil (danışman). DB personeli yok; Legal agent yalnız ADVISORY (hukuk, asla otonom).',
  },
  {
    role: 'BACKUP_ADMIN', unit: 'Sistem', kind: 'STAFF', staffing: 'HUMAN',
    // Tüm akışa SALT-OKUNUR dahil: tüm modül *_VIEW izinleri + BACKUP_VIEW.
    modules: [
      'DASHBOARD_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'VISIT_PLAN_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW',
      'COST_ANALYSIS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'PRESALES_VIEW', 'SALES_SUPPORT_VIEW',
      'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'FINANCE_VIEW', 'TODO_VIEW',
      'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'CORPORATE_GOV_VIEW', 'BACKUP_VIEW',
    ],
    endpointDomains: ['backup'],
    decisionRights: [
      { decision: 'Sistem yedeği alma + doğrulama', via: 'endpoint:backup/jobs (+ /jobs/:id/verify)' },
      { decision: 'Yedekten geri yükleme (diff analizi + onaylı)', via: 'endpoint:backup/restore (analyze→confirm)' },
      { decision: 'Yedekleme zamanlaması (aralık/hedef)', via: 'endpoint:backup/settings' },
    ],
    tasks: [
      { task: 'Belirli aralıkla yedek (zamanlayıcı) + arka planda doğrulama', raci: 'R', via: 'service:backupScheduler' },
    ],
    approvalIn: [],
    reviewed: 'DONE',
    notes: 'Yedek Yöneticisi — tüm akışa SALT-OKUNUR dahil (hiçbir modülde/veride mutasyon yapamaz; backend enforceReadOnlyRoles ile zorlanır). Yalnız /api/backup altında yazabilir (yedek/doğrula/restore/ayar).',
  },
];

export const MATRIX_ROLES = new Set(ROLE_MATRIX.map((r) => r.role));
