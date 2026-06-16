import { apiClient } from './apiClient';
import { crmService } from './crmService';
import { projectService } from './projectService';
import { taskService } from './taskService';
import { documentService } from './documentService';
import { settingsService } from './settingsService';
import {
  Customer, Opportunity, BoMItem, CostItem, Proposal,
  Project, TodoTask, CorporateDocument, ArchiveItem, Contract,
  Unit, User, Notification, Workflow
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

  // --- CUSTOMERS ---
  async getCustomers() { return crmService.getCustomers(); }
  async createCustomer(data: Omit<Customer, 'id'>) { return crmService.createCustomer(data); }
  async updateCustomer(id: string, data: Partial<Customer>) { return crmService.updateCustomer(id, data); }
  async deleteCustomer(id: string) { return crmService.deleteCustomer(id); }

  // --- OPPORTUNITIES ---
  async getOpportunities() { return crmService.getOpportunities(); }
  async createOpportunity(data: Omit<Opportunity, 'id'>) { return crmService.createOpportunity(data); }
  async updateOpportunity(id: string, data: Partial<Opportunity>) { return crmService.updateOpportunity(id, data); }
  async deleteOpportunity(id: string) { return crmService.deleteOpportunity(id); }
  async saveBoMItems(oppId: string, items: BoMItem[]) { return crmService.saveBoMItems(oppId, items); }
  async saveCostItems(oppId: string, items: CostItem[]) { return crmService.saveCostItems(oppId, items); }
  async requestProposalApproval(oppId: string, data: { note: string; managerId: string }) { return crmService.requestProposalApproval(oppId, data); }
  async approveProposal(oppId: string, data: { note: string }) { return crmService.approveProposal(oppId, data); }
  async revertOpportunityApproval(oppId: string) { return crmService.revertOpportunityApproval(oppId); }

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
  async createTask(data: Omit<TodoTask, 'id'>) { return taskService.createTask(data); }
  async updateTask(id: string, data: Partial<TodoTask>) { return taskService.updateTask(id, data); }
  async deleteTask(id: string) { return taskService.deleteTask(id); }

  // --- DOCUMENTS ---
  async getDocuments() { return documentService.getDocuments(); }
  async createDocument(data: Omit<CorporateDocument, 'id'>) { return documentService.createDocument(data); }
  async updateDocument(id: string, data: Partial<CorporateDocument>) { return documentService.updateDocument(id, data); }
  async deleteDocument(id: string) { return documentService.deleteDocument(id); }

  // --- ARCHIVE ---
  async getArchiveItems() { return documentService.getArchiveItems(); }
  async createArchiveItem(data: Omit<ArchiveItem, 'id'>) { return documentService.createArchiveItem(data); }
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
  async deleteUnit(id: string, transferId?: string) { return settingsService.deleteUnit(id, transferId); }

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
  async getNotifications() { return settingsService.getNotifications(); }
  async createNotification(data: Omit<Notification, 'id'>) { return settingsService.createNotification(data); }
  async updateNotification(id: string, data: Partial<Notification>) { return settingsService.updateNotification(id, data); }
  async deleteNotification(id: string) { return settingsService.deleteNotification(id); }
  async getNotificationLogs() { return settingsService.getNotificationLogs(); }

  // --- WORKFLOWS ---
  async getWorkflows() { return settingsService.getWorkflows(); }
  async createWorkflow(data: Omit<Workflow, 'id'>) { return settingsService.createWorkflow(data); }
  async updateWorkflow(id: string, data: Partial<Workflow>) { return settingsService.updateWorkflow(id, data); }

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
  async createApprovalChain(data: { entityType: string; entityId: string; stages: { role: string; order?: number }[] }) {
    return apiClient.fetchWithAuth('/approval-chains', { method: 'POST', body: JSON.stringify(data) });
  }
  async approveApprovalStage(chainId: string, stageId: string, data: { approverId: string; note?: string }) {
    return apiClient.fetchWithAuth(`/approval-chains/${chainId}/stages/${stageId}/approve`, { method: 'POST', body: JSON.stringify(data) });
  }
  async rejectApprovalStage(chainId: string, stageId: string, data: { approverId: string; note?: string }) {
    return apiClient.fetchWithAuth(`/approval-chains/${chainId}/stages/${stageId}/reject`, { method: 'POST', body: JSON.stringify(data) });
  }
}

export const apiService = new ApiService();
