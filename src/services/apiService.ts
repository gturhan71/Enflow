import { apiClient } from './apiClient';
import { crmService } from './crmService';
import { projectService } from './projectService';
import { taskService } from './taskService';
import { documentService } from './documentService';
import { settingsService } from './settingsService';
import {
  Customer, Opportunity, BoMItem, CostItem, Proposal,
  Project, TodoTask, CorporateDocument, ArchiveItem, Contract,
  Unit, User, Notification, Workflow, ApprovalChain
} from '../types';

class ApiService {
  setAuth(tenantId: string, token: string) {
    apiClient.setAuth(tenantId, token);
  }

  async login(email: string) {
    return apiClient.login(email);
  }

  async forgotPassword(email: string) {
    return apiClient.forgotPassword(email);
  }

  // --- İLK-ÇALIŞTIRMA KURULUMU (auth gerektirmez; boş-DB-kilitli) ---
  async getSetupStatus(): Promise<{ initialized: boolean }> {
    const r = await fetch('/api/setup/status');
    if (!r.ok) throw new Error('Kurulum durumu alınamadı.');
    return r.json();
  }
  async runSetup(payload: { company: { name: string }; admin: { name: string; email: string }; license?: string }): Promise<{ tenantId: string; token: string; user: { id: string; name: string; email: string; role: string; tenantId: string; unitId: string | null; permissions: string[] } }> {
    const r = await fetch('/api/setup/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || 'Kurulum başarısız.');
    return data;
  }

  // --- CUSTOMERS ---
  async getCustomers() { return crmService.getCustomers(); }
  async createCustomer(data: Partial<Customer>) { return crmService.createCustomer(data); }
  async updateCustomer(id: string, data: Partial<Customer>) { return crmService.updateCustomer(id, data); }
  async deleteCustomer(id: string) { return crmService.deleteCustomer(id); }

  // --- OPPORTUNITIES ---
  async getOpportunities() { return crmService.getOpportunities(); }
  async createOpportunity(data: Partial<Opportunity>) { return crmService.createOpportunity(data); }
  async updateOpportunity(id: string, data: Partial<Opportunity>) { return crmService.updateOpportunity(id, data); }
  async deleteOpportunity(id: string) { return crmService.deleteOpportunity(id); }
  async saveBoMItems(oppId: string, items: BoMItem[], opts?: { handoff?: boolean }) { return crmService.saveBoMItems(oppId, items, opts); }
  async saveCostItems(oppId: string, items: CostItem[]) { return crmService.saveCostItems(oppId, items); }
  async requestProposalApproval(oppId: string, data: { note: string; managerId: string }) { return crmService.requestProposalApproval(oppId, data); }
  async approveProposal(oppId: string, data: { note: string }) { return crmService.approveProposal(oppId, data); }
  async revertOpportunityApproval(oppId: string) { return crmService.revertOpportunityApproval(oppId); }
  async getBomQuotes(oppId: string) { return apiClient.fetchWithAuth(`/bom-quotes?opportunityId=${encodeURIComponent(oppId)}`); }
  async addBomQuote(data: Record<string, unknown>) { return apiClient.fetchWithAuth('/bom-quotes', { method: 'POST', body: JSON.stringify(data) }); }
  async updateBomQuote(qid: string, data: Record<string, unknown>) { return apiClient.fetchWithAuth(`/bom-quotes/${qid}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteBomQuote(qid: string) { return apiClient.fetchWithAuth(`/bom-quotes/${qid}`, { method: 'DELETE' }); }
  async selectBomQuote(qid: string) { return apiClient.fetchWithAuth(`/bom-quotes/${qid}/select`, { method: 'POST' }); }
  async getBomHandoffs(params?: { start?: string; end?: string }) {
    const qs = params?.start && params?.end ? `?start=${params.start}&end=${params.end}` : '';
    return apiClient.fetchWithAuth(`/reports/bom-handoffs${qs}`);
  }
  async getDashboard() { return apiClient.fetchWithAuth('/reports/dashboard'); }
  // Büyüme Analitiği Faz 1 — salt-okunur raporlar
  async getAging(): Promise<import('../types').AgingReport> { return apiClient.fetchWithAuth('/finance/aging'); }
  async getFunnel(): Promise<import('../types').FunnelReport> { return apiClient.fetchWithAuth('/reports/funnel'); }
  async getTenderAnalytics(): Promise<import('../types').TenderAnalytics> { return apiClient.fetchWithAuth('/reports/tender-analytics'); }
  async getBomVariance(): Promise<import('../types').BomVarianceReport> { return apiClient.fetchWithAuth('/reports/bom-variance'); }
  // Finans — Vade & Finansman Etkisi
  async getFinanceSettings() { return apiClient.fetchWithAuth('/finance/settings'); }
  async updateFinanceSettings(data: { interestRates: Record<string, number> }) { return apiClient.fetchWithAuth('/finance/settings', { method: 'PUT', body: JSON.stringify(data) }); }
  async getCollectionInstallments(oppId: string) { return apiClient.fetchWithAuth(`/finance/collection-installments?opportunityId=${encodeURIComponent(oppId)}`); }
  async addCollectionInstallment(data: Record<string, unknown>) { return apiClient.fetchWithAuth('/finance/collection-installments', { method: 'POST', body: JSON.stringify(data) }); }
  async deleteCollectionInstallment(id: string) { return apiClient.fetchWithAuth(`/finance/collection-installments/${id}`, { method: 'DELETE' }); }
  async updatePaymentTerm(data: { kind: string; itemId: string; paymentTermDays: number | null }) { return apiClient.fetchWithAuth('/finance/payment-term', { method: 'PUT', body: JSON.stringify(data) }); }
  async getFinancingEffect(oppId: string, referenceStart?: string) { return apiClient.fetchWithAuth(`/finance/financing-effect?opportunityId=${encodeURIComponent(oppId)}${referenceStart ? `&referenceStart=${referenceStart}` : ''}`); }
  async applyFinancingEffect(data: { opportunityId: string; referenceStart?: string }) { return apiClient.fetchWithAuth('/finance/financing-effect/apply', { method: 'POST', body: JSON.stringify(data) }); }
  async submitCostApproval(oppId: string) { return crmService.submitCostApproval(oppId); }
  async approveCost(oppId: string, data: { decision: 'APPROVE' | 'REJECT'; note?: string }) { return crmService.approveCost(oppId, data); }

  // --- PROPOSALS ---
  async getProposals() { return crmService.getProposals(); }
  async createProposal(data: Omit<Proposal, 'id'>) { return crmService.createProposal(data); }
  async updateProposal(id: string, data: Partial<Proposal>) { return crmService.updateProposal(id, data); }
  async deleteProposal(id: string) { return crmService.deleteProposal(id); }

  async saveCRMData(_data: { opportunities: Opportunity[]; customers: Customer[]; proposals: Proposal[] }) {
    return Promise.resolve({ success: true });
  }

  // --- PROJECTS ---
  async getProjects(params?: { status?: string; type?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/projects${qs}`);
  }
  async getProject(id: string) { return apiClient.fetchWithAuth(`/projects/${id}`); }
  async createProject(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/projects', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateProject(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteProject(id: string) {
    return apiClient.fetchWithAuth(`/projects/${id}`, { method: 'DELETE' });
  }
  async getProjectsSummary() { return apiClient.fetchWithAuth('/projects/summary/all'); }

  // --- PROJECT MILESTONES ---
  async getProjectMilestones(projectId: string) { return apiClient.fetchWithAuth(`/projects/${projectId}/milestones`); }
  async createProjectMilestone(projectId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateProjectMilestone(projectId: string, msId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/milestones/${msId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteProjectMilestone(projectId: string, msId: string) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/milestones/${msId}`, { method: 'DELETE' });
  }

  // --- PROJECT COST ITEMS ---
  async getProjectCosts(projectId: string) { return apiClient.fetchWithAuth(`/projects/${projectId}/costs`); }
  async createProjectCost(projectId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/costs`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateProjectCost(projectId: string, costId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/costs/${costId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteProjectCost(projectId: string, costId: string) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/costs/${costId}`, { method: 'DELETE' });
  }

  // --- TASKS ---
  async getTasks() { return taskService.getTasks(); }
  async createTask(data: Partial<TodoTask>) { return taskService.createTask(data); }
  async updateTask(id: string, data: Partial<TodoTask>) { return taskService.updateTask(id, data); }
  async deleteTask(id: string) { return taskService.deleteTask(id); }

  // --- DOCUMENTS ---
  async getDocuments() { return documentService.getDocuments(); }
  async createDocument(data: Partial<Omit<CorporateDocument, 'tags'>> & { tags?: string }) { return documentService.createDocument(data); }
  async updateDocument(id: string, data: Partial<CorporateDocument>) { return documentService.updateDocument(id, data); }
  async deleteDocument(id: string) { return documentService.deleteDocument(id); }

  // --- ARCHIVE ---
  async getArchiveItems() { return documentService.getArchiveItems(); }
  async createArchiveItem(data: Partial<ArchiveItem>) { return documentService.createArchiveItem(data); }
  async updateArchiveItem(id: string, data: Partial<ArchiveItem>) { return documentService.updateArchiveItem(id, data); }
  async deleteArchiveItem(id: string) { return documentService.deleteArchiveItem(id); }

  // --- CONTRACTS ---
  async getContracts() { return documentService.getContracts(); }
  async createContract(data: Omit<Contract, 'id'>) { return documentService.createContract(data); }
  async updateContract(id: string, data: Partial<Contract>) { return documentService.updateContract(id, data); }
  async deleteContract(id: string) { return documentService.deleteContract(id); }

  // --- UNITS ---
  async getUnits() { return settingsService.getUnits(); }
  async createUnit(data: Omit<Unit, 'id'>) { return settingsService.createUnit(data); }
  async updateUnit(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteUnit(id: string, transferId?: string) { return settingsService.deleteUnit(id, transferId); }
  // Varsayılan şablonu yükle: eksik birimleri ekler + varsayılan iş akışını oluşturur (idempotent).
  async seedDefaultTemplate(): Promise<{ addedUnits: { id: string; name: string }[]; addedCount: number; workflowId: string; workflowName: string }> {
    return apiClient.fetchWithAuth('/units/seed-defaults', { method: 'POST', body: JSON.stringify({}) });
  }

  // --- USERS ---
  async getUsers() { return settingsService.getUsers(); }
  async createUser(data: Omit<User, 'id'>) { return settingsService.createUser(data); }
  async updateUser(id: string, data: Partial<User>) { return settingsService.updateUser(id, data); }
  async deleteUser(id: string) { return settingsService.deleteUser(id); }

  // --- SUBSCRIPTION & USAGE ---
  async getSubscription() { return settingsService.getSubscription(); }
  async updateTenantSubscription(tenantId: string, plan: string) { return settingsService.updateTenantSubscription(tenantId, plan); }
  async activateLicense(licenseKey: string) { return settingsService.activateLicense(licenseKey); }
  async getUsage() { return settingsService.getUsage(); }

  // --- TENANTS ---
  async getTenants() { return settingsService.getTenants(); }
  async createTenant(data: { name: string }) { return settingsService.createTenant(data); }
  async updateTenant(id: string, data: { name: string }) { return settingsService.updateTenant(id, data); }

  // --- NOTIFICATIONS ---
  async getNotifications(userId?: string) { return settingsService.getNotifications(userId); }
  async createNotification(data: Omit<Notification, 'id'>) { return settingsService.createNotification(data); }
  async updateNotification(id: string, data: Partial<Notification>) { return settingsService.updateNotification(id, data); }
  async deleteNotification(id: string) { return settingsService.deleteNotification(id); }
  async getNotificationLogs() { return settingsService.getNotificationLogs(); }

  // --- WORKFLOWS ---
  async getWorkflows() { return settingsService.getWorkflows(); }
  async createWorkflow(data: Omit<Workflow, 'id'>) { return settingsService.createWorkflow(data); }
  async updateWorkflow(id: string, data: Partial<Workflow>) { return settingsService.updateWorkflow(id, data); }
  async getDefaultWorkflow() { return settingsService.getDefaultWorkflow(); }
  async resolveNextStep(workflowId: string, stepId: string) { return settingsService.resolveNextStep(workflowId, stepId); }

  // --- MODULE SETTINGS ---
  async getModuleSettings(): Promise<{ promotedModules: string[] }> {
    return apiClient.fetchWithAuth('/tenants/module-settings');
  }
  async updateModuleSettings(promotedModules: string[]): Promise<{ promotedModules: string[] }> {
    return apiClient.fetchWithAuth('/tenants/module-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promotedModules }),
    });
  }

  // --- YZ ENTEGRASYONU (sağlayıcıdan bağımsız — tenant kendi key'i) ---
  // Sır içermez, tüm roller okuyabilir — modül-bazlı YZ kapısı için.
  async getAIStatus(): Promise<{ configured: boolean }> {
    return apiClient.fetchWithAuth('/tenants/ai-status');
  }
  // GM-only — Entegrasyonlar kartı için (maskeli).
  async getAISettings(): Promise<{ baseUrl: string; model: string; label: string; hasKey: boolean }> {
    return apiClient.fetchWithAuth('/tenants/ai-settings');
  }
  async updateAISettings(data: { baseUrl: string; model: string; label?: string; apiKey?: string }): Promise<{ baseUrl: string; model: string; label: string; hasKey: boolean }> {
    return apiClient.fetchWithAuth('/tenants/ai-settings', { method: 'PUT', body: JSON.stringify(data) });
  }
  async presalesSpecExtract(data: { text: string; opportunityId?: string }): Promise<{ usedAI: boolean; title: string; summary: string; specDetails: string; extractedProducts: { pn: string; description: string; quantity: number }[] }> {
    return apiClient.fetchWithAuth('/presales/spec-extract', { method: 'POST', body: JSON.stringify(data) });
  }

  // --- YEDEKLEME / GERİ YÜKLEME (Backup Admin) ---
  async getBackupJobs() { return apiClient.fetchWithAuth('/backup/jobs'); }
  async createBackupJob(data: { scope: string; kind: string; targetType: string; location?: string }) {
    return apiClient.fetchWithAuth('/backup/jobs', { method: 'POST', body: JSON.stringify(data) });
  }
  async getBackupJob(id: string) { return apiClient.fetchWithAuth(`/backup/jobs/${id}`); }
  async verifyBackupJob(id: string) { return apiClient.fetchWithAuth(`/backup/jobs/${id}/verify`, { method: 'POST' }); }
  // Sürüm/güncelleme durumu — ayrı upgrade-tool'un yazdığı update-status.json'u yansıtır.
  async getVersion(): Promise<{ current: { shortSha?: string | null; tag?: string | null; date?: string | null } | null; update: { available?: boolean; applied?: boolean; failed?: boolean; kind?: string; target?: string | null; notes?: string | null; publishedAt?: string | null }; checkedAt: string | null }> {
    return apiClient.fetchWithAuth('/version');
  }
  async getBackupSettings() { return apiClient.fetchWithAuth('/backup/settings'); }
  async updateBackupSettings(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/backup/settings', { method: 'PUT', body: JSON.stringify(data) });
  }
  async analyzeRestore(backupId: string) {
    return apiClient.fetchWithAuth('/backup/restore/analyze', { method: 'POST', body: JSON.stringify({ backupId }) });
  }
  async getRestoreJobs() { return apiClient.fetchWithAuth('/backup/restore'); }
  async getRestoreJob(id: string) { return apiClient.fetchWithAuth(`/backup/restore/${id}`); }
  async confirmRestore(id: string, mode: 'LOGICAL' | 'STATE') {
    return apiClient.fetchWithAuth(`/backup/restore/${id}/confirm`, { method: 'POST', body: JSON.stringify({ mode }) });
  }

  // --- PROCUREMENT ---
  async getVendors() { return apiClient.fetchWithAuth('/vendors'); }
  async createVendor(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/vendors', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateVendor(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteVendor(id: string) {
    return apiClient.fetchWithAuth(`/vendors/${id}`, { method: 'DELETE' });
  }

  async getPurchaseRequests(params?: { status?: string; sourceType?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/purchase-requests${qs}`);
  }
  async getPurchaseRequest(id: string) { return apiClient.fetchWithAuth(`/purchase-requests/${id}`); }
  async createPurchaseRequest(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/purchase-requests', { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePurchaseRequest(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deletePurchaseRequest(id: string) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}`, { method: 'DELETE' });
  }
  async approvePurchaseRequest(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/approve`, { method: 'POST', body: JSON.stringify(data) });
  }
  async rejectPurchaseRequest(id: string, data: { rejectionNote: string }) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/reject`, { method: 'POST', body: JSON.stringify(data) });
  }
  async addPurchaseQuote(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/quotes`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePurchaseQuote(id: string, qid: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/quotes/${qid}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deletePurchaseQuote(id: string, qid: string) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/quotes/${qid}`, { method: 'DELETE' });
  }
  async selectPurchaseQuote(id: string, qid: string) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/quotes/${qid}/select`, { method: 'POST' });
  }
  async addDeliveryRecord(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/delivery`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePurchaseInvoice(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/invoice`, { method: 'POST', body: JSON.stringify(data) });
  }
  async closePurchaseRequest(id: string) {
    return apiClient.fetchWithAuth(`/purchase-requests/${id}/close`, { method: 'POST' });
  }

  // --- APPROVAL CHAINS (Faz 0 — kalıcı onay zinciri) ---
  async getApprovalChain(entityType: string, entityId: string) {
    const chains = await apiClient.fetchWithAuth(`/approval-chains?entityType=${entityType}&entityId=${entityId}`) as unknown[];
    return chains[0] || null;
  }
  async getPendingApprovalChainsForRole(role: string) {
    return apiClient.fetchWithAuth(`/approval-chains?pendingForRole=${role}`) as Promise<ApprovalChain[]>;
  }
  async createApprovalChain(data: { entityType: string; entityId: string; stages: { role: string; order?: number }[] }) {
    return apiClient.fetchWithAuth('/approval-chains', { method: 'POST', body: JSON.stringify(data) });
  }
  async approveApprovalStage(chainId: string, stageId: string, data: { approverId: string; note?: string }) {
    return apiClient.fetchWithAuth(`/approval-chains/${chainId}/stages/${stageId}/approve`, { method: 'POST', body: JSON.stringify(data) });
  }
  async rejectApprovalStage(chainId: string, stageId: string, data: { approverId: string; note?: string }) {
    return apiClient.fetchWithAuth(`/approval-chains/${chainId}/stages/${stageId}/reject`, { method: 'POST', body: JSON.stringify(data) });
  }

  // --- VISIT PLAN & GÜNLÜK RAPOR (Faz 2) ---
  async getVisitPlans(params?: { weekOf?: string; preparedById?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/visits/plans${qs}`);
  }
  async getVisitPlan(id: string) { return apiClient.fetchWithAuth(`/visits/plans/${id}`); }
  async createVisitPlan(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/visits/plans', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateVisitPlan(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/visits/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteVisitPlan(id: string) {
    return apiClient.fetchWithAuth(`/visits/plans/${id}`, { method: 'DELETE' });
  }
  async addVisit(planId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/visits/plans/${planId}/visits`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateVisit(visitId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/visits/visits/${visitId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteVisit(visitId: string) {
    return apiClient.fetchWithAuth(`/visits/visits/${visitId}`, { method: 'DELETE' });
  }
  async getDailyReports(params?: { userId?: string; weekStart?: string; weekEnd?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/visits/daily-reports${qs}`);
  }
  async createDailyReport(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/visits/daily-reports', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateDailyReport(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/visits/daily-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteDailyReport(id: string) {
    return apiClient.fetchWithAuth(`/visits/daily-reports/${id}`, { method: 'DELETE' });
  }
  async shareReportPeriod(data: { userId: string; start: string; end: string }) {
    return apiClient.fetchWithAuth('/visits/daily-reports/share-period', { method: 'POST', body: JSON.stringify(data) });
  }
  async getReportSettings() {
    return apiClient.fetchWithAuth('/visits/report-settings');
  }
  async updateReportSettings(opts: { shareIntervalDays?: number; visitTargetRate?: number }) {
    return apiClient.fetchWithAuth('/visits/report-settings', { method: 'PUT', body: JSON.stringify(opts) });
  }

  // --- PROJE DEVİR PAKETİ (Faz 2) ---
  async getProjectHandoverDocs(projectId: string) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/handover-docs`);
  }
  async createProjectHandoverDoc(projectId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/handover-docs`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateProjectHandoverDoc(projectId: string, docId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/handover-docs/${docId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteProjectHandoverDoc(projectId: string, docId: string) {
    return apiClient.fetchWithAuth(`/projects/${projectId}/handover-docs/${docId}`, { method: 'DELETE' });
  }

  // --- DOKÜMAN KODLAMA (Faz 3 — özgün, tenant-yapılandırılabilir) ---
  async getDocCodingProfile() { return apiClient.fetchWithAuth('/document-coding/profile'); }
  async updateDocCodingProfile(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/document-coding/profile', { method: 'PUT', body: JSON.stringify(data) });
  }
  async getDocCategories() { return apiClient.fetchWithAuth('/document-coding/categories'); }
  async createDocCategory(data: { code: string; label: string; sortOrder?: number }) {
    return apiClient.fetchWithAuth('/document-coding/categories', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateDocCategory(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/document-coding/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteDocCategory(id: string) {
    return apiClient.fetchWithAuth(`/document-coding/categories/${id}`, { method: 'DELETE' });
  }

  // --- KURUMSAL YÖNETİM / GENEL HUSUSLAR (Faz 3) ---
  // Lessons Learned
  async getLessons(params?: { projectId?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/corporate-governance/lessons${qs}`);
  }
  async createLesson(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/corporate-governance/lessons', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateLesson(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/corporate-governance/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteLesson(id: string) {
    return apiClient.fetchWithAuth(`/corporate-governance/lessons/${id}`, { method: 'DELETE' });
  }
  // Risk & Opportunity
  async getRisks() { return apiClient.fetchWithAuth('/corporate-governance/risks'); }
  async createRisk(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/corporate-governance/risks', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateRisk(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/corporate-governance/risks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteRisk(id: string) {
    return apiClient.fetchWithAuth(`/corporate-governance/risks/${id}`, { method: 'DELETE' });
  }
  // Corporate Metrics
  async getMetrics() { return apiClient.fetchWithAuth('/corporate-governance/metrics'); }
  async createMetric(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/corporate-governance/metrics', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateMetric(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/corporate-governance/metrics/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteMetric(id: string) {
    return apiClient.fetchWithAuth(`/corporate-governance/metrics/${id}`, { method: 'DELETE' });
  }
  // External Document Register
  async getExternalDocs() { return apiClient.fetchWithAuth('/corporate-governance/external-docs'); }
  async createExternalDoc(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/corporate-governance/external-docs', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateExternalDoc(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/corporate-governance/external-docs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteExternalDoc(id: string) {
    return apiClient.fetchWithAuth(`/corporate-governance/external-docs/${id}`, { method: 'DELETE' });
  }

  // --- FINANCE: Invoices ---
  async getInvoices(params?: { projectId?: string; status?: string; type?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/finance/invoices${qs}`);
  }
  async createInvoice(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/finance/invoices', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateInvoice(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/finance/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteInvoice(id: string) {
    return apiClient.fetchWithAuth(`/finance/invoices/${id}`, { method: 'DELETE' });
  }

  // --- FINANCE: Payments ---
  async getInvoicePayments(invoiceId: string) {
    return apiClient.fetchWithAuth(`/finance/invoices/${invoiceId}/payments`);
  }
  async addInvoicePayment(invoiceId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/finance/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(data) });
  }
  async deletePayment(id: string) {
    return apiClient.fetchWithAuth(`/finance/payments/${id}`, { method: 'DELETE' });
  }

  // --- FINANCE: Guarantee Letters ---
  async getGuarantees(params?: { status?: string; type?: string; projectId?: string; tenderId?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/finance/guarantees${qs}`);
  }
  async createGuarantee(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/finance/guarantees', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateGuarantee(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/finance/guarantees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteGuarantee(id: string) {
    return apiClient.fetchWithAuth(`/finance/guarantees/${id}`, { method: 'DELETE' });
  }

  // --- FINANCE: Cost approvals & summary ---
  async getCostApprovals() { return apiClient.fetchWithAuth('/finance/cost-approvals'); }
  async approveCostItem(id: string, data: { decision: 'APPROVE' | 'REJECT'; approvedById?: string; approvalNote?: string }) {
    return apiClient.fetchWithAuth(`/finance/costs/${id}/approve`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async getFinanceSummary() { return apiClient.fetchWithAuth('/finance/summary'); }

  // --- LEGAL: Cases & requests ---
  async getLegalCases(params?: { status?: string; type?: string; relatedEntityId?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/legal/cases${qs}`);
  }
  async createLegalCase(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/legal/cases', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateLegalCase(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/legal/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteLegalCase(id: string) {
    return apiClient.fetchWithAuth(`/legal/cases/${id}`, { method: 'DELETE' });
  }
  async getLegalRequests() { return apiClient.fetchWithAuth('/legal/requests'); }

  // --- TENDERS: İhale / İSAB ---
  async getTenders(params?: { status?: string; method?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/tenders${qs}`);
  }
  async getTender(id: string) { return apiClient.fetchWithAuth(`/tenders/${id}`); }
  async createTender(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/tenders', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTender(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/tenders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteTender(id: string) {
    return apiClient.fetchWithAuth(`/tenders/${id}`, { method: 'DELETE' });
  }
  async getTenderChecklist(id: string) { return apiClient.fetchWithAuth(`/tenders/${id}/checklist`); }
  async addTenderChecklistItem(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/tenders/${id}/checklist`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTenderChecklistItem(id: string, itemId: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/tenders/${id}/checklist/${itemId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteTenderChecklistItem(id: string, itemId: string) {
    return apiClient.fetchWithAuth(`/tenders/${id}/checklist/${itemId}`, { method: 'DELETE' });
  }
  async analyzeTender(id: string, data: { specText: string }) {
    return apiClient.fetchWithAuth(`/tenders/${id}/analyze`, { method: 'POST', body: JSON.stringify(data) });
  }
  async autoMatchTender(id: string) {
    return apiClient.fetchWithAuth(`/tenders/${id}/auto-match`, { method: 'POST' });
  }
  async submitTender(id: string, data?: { force?: boolean }) {
    return apiClient.fetchWithAuth(`/tenders/${id}/submit`, { method: 'POST', body: JSON.stringify(data || {}) });
  }
  async withdrawTender(id: string, data: { reason: string }) {
    return apiClient.fetchWithAuth(`/tenders/${id}/withdraw`, { method: 'POST', body: JSON.stringify(data) });
  }

  // --- REPORTS: Yönetim Raporlama ---
  async getReportUnits() { return apiClient.fetchWithAuth('/reports/units'); }
  async getReportOverview(params?: { start?: string; end?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/reports/overview${qs}`);
  }
  async getUnitMetrics(unitKey: string, params?: { start?: string; end?: string }) {
    const qs = new URLSearchParams({ unitKey, ...(params || {}) } as Record<string, string>).toString();
    return apiClient.fetchWithAuth(`/reports/unit-metrics?${qs}`);
  }
  async getWorkflowBottlenecks() { return apiClient.fetchWithAuth('/reports/bottlenecks'); }
  async getUnitReports(params?: { unitKey?: string; status?: string; pendingForReviewer?: string; start?: string; end?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/reports/unit-reports${qs}`);
  }
  async getReportConsolidation(unitKey: string, params?: { start?: string; end?: string }) {
    const qs = new URLSearchParams({ unitKey, ...(params || {}) } as Record<string, string>).toString();
    return apiClient.fetchWithAuth(`/reports/report-consolidation?${qs}`);
  }
  async getUnitReport(id: string) { return apiClient.fetchWithAuth(`/reports/unit-reports/${id}`); }
  async createUnitReport(data: Record<string, unknown>) {
    return apiClient.fetchWithAuth('/reports/unit-reports', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateUnitReport(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/reports/unit-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteUnitReport(id: string) {
    return apiClient.fetchWithAuth(`/reports/unit-reports/${id}`, { method: 'DELETE' });
  }
  async submitUnitReport(id: string) {
    return apiClient.fetchWithAuth(`/reports/unit-reports/${id}/submit`, { method: 'POST' });
  }
  async reviewUnitReport(id: string, data: Record<string, unknown>) {
    return apiClient.fetchWithAuth(`/reports/unit-reports/${id}/review`, { method: 'POST', body: JSON.stringify(data) });
  }

  // --- PLUGINS: Sanal Agent Eklentileri (Faz 8 — ticari sürüm dışı upsell) ---
  async getPluginCatalog() { return apiClient.fetchWithAuth('/plugins/catalog'); }
  async getPluginEntitlements() { return apiClient.fetchWithAuth('/plugins/entitlements'); }
  async activatePluginLicense(licenseKey: string, activatedById?: string) {
    return apiClient.fetchWithAuth('/plugins/activate', { method: 'POST', body: JSON.stringify({ licenseKey, activatedById }) });
  }
  async updatePluginEntitlement(pluginKey: string, data: { mode?: string; status?: string; config?: string }) {
    return apiClient.fetchWithAuth(`/plugins/entitlements/${pluginKey}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async disablePluginEntitlement(pluginKey: string) {
    return apiClient.fetchWithAuth(`/plugins/entitlements/${pluginKey}`, { method: 'DELETE' });
  }
  async runAgent(pluginKey: string, entityId: string, triggeredById?: string) {
    return apiClient.fetchWithAuth(`/plugins/agents/${pluginKey}/run`, { method: 'POST', body: JSON.stringify({ entityId, triggeredById }) });
  }
  async getAgentRuns(params?: { status?: string; pluginKey?: string }) {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.fetchWithAuth(`/plugins/runs${qs}`);
  }
  async getAgentRun(id: string) {
    return apiClient.fetchWithAuth(`/plugins/runs/${id}`);
  }
  async ratifyAgentRun(id: string, data: { decision: 'RATIFY' | 'REJECT'; ratifiedById?: string; ratifyNote?: string }) {
    return apiClient.fetchWithAuth(`/plugins/runs/${id}/ratify`, { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Denetim İzi (ActivityLog) ──
  async getActivityLogs(params?: { entityType?: string; entityId?: string; action?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.entityId) q.set('entityId', params.entityId);
    if (params?.action) q.set('action', params.action);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiClient.fetchWithAuth(`/activity-logs${qs ? `?${qs}` : ''}`);
  }
}

export const apiService = new ApiService();
