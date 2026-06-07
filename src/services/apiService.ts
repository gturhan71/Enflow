import { apiClient } from './apiClient';
import { crmService } from './crmService';
import { projectService } from './projectService';
import { taskService } from './taskService';
import { documentService } from './documentService';
import { settingsService } from './settingsService';

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
  async createCustomer(data: any) { return crmService.createCustomer(data); }
  async updateCustomer(id: string, data: any) { return crmService.updateCustomer(id, data); }
  async deleteCustomer(id: string) { return crmService.deleteCustomer(id); }

  // --- OPPORTUNITIES ---
  async getOpportunities() { return crmService.getOpportunities(); }
  async createOpportunity(data: any) { return crmService.createOpportunity(data); }
  async updateOpportunity(id: string, data: any) { return crmService.updateOpportunity(id, data); }
  async deleteOpportunity(id: string) { return crmService.deleteOpportunity(id); }
  async saveBoMItems(oppId: string, items: any[]) { return crmService.saveBoMItems(oppId, items); }
  async saveCostItems(oppId: string, items: any[]) { return crmService.saveCostItems(oppId, items); }
  async requestProposalApproval(oppId: string, data: any) { return crmService.requestProposalApproval(oppId, data); }
  async approveProposal(oppId: string, data: any) { return crmService.approveProposal(oppId, data); }
  async revertOpportunityApproval(oppId: string) { return crmService.revertOpportunityApproval(oppId); }

  // --- PROPOSALS ---
  async getProposals() { return crmService.getProposals(); }
  async createProposal(data: any) { return crmService.createProposal(data); }
  async updateProposal(id: string, data: any) { return crmService.updateProposal(id, data); }
  async deleteProposal(id: string) { return crmService.deleteProposal(id); }

  async saveCRMData(_data: { opportunities: any[]; customers: any[]; proposals: any[] }) {
    return Promise.resolve({ success: true });
  }

  // --- PROJECTS ---
  async getProjects() { return projectService.getProjects(); }
  async createProject(data: any) { return projectService.createProject(data); }
  async updateProject(id: string, data: any) { return projectService.updateProject(id, data); }
  async deleteProject(id: string) { return projectService.deleteProject(id); }

  // --- TASKS ---
  async getTasks() { return taskService.getTasks(); }
  async createTask(data: any) { return taskService.createTask(data); }
  async updateTask(id: string, data: any) { return taskService.updateTask(id, data); }
  async deleteTask(id: string) { return taskService.deleteTask(id); }

  // --- DOCUMENTS ---
  async getDocuments() { return documentService.getDocuments(); }
  async createDocument(data: any) { return documentService.createDocument(data); }
  async updateDocument(id: string, data: any) { return documentService.updateDocument(id, data); }
  async deleteDocument(id: string) { return documentService.deleteDocument(id); }

  // --- ARCHIVE ---
  async getArchiveItems() { return documentService.getArchiveItems(); }
  async createArchiveItem(data: any) { return documentService.createArchiveItem(data); }
  async updateArchiveItem(id: string, data: any) { return documentService.updateArchiveItem(id, data); }
  async deleteArchiveItem(id: string) { return documentService.deleteArchiveItem(id); }

  // --- CONTRACTS ---
  async getContracts() { return documentService.getContracts(); }
  async createContract(data: any) { return documentService.createContract(data); }
  async updateContract(id: string, data: any) { return documentService.updateContract(id, data); }
  async deleteContract(id: string) { return documentService.deleteContract(id); }

  // --- UNITS ---
  async getUnits() { return settingsService.getUnits(); }
  async createUnit(data: any) { return settingsService.createUnit(data); }
  async deleteUnit(id: string, transferId?: string) { return settingsService.deleteUnit(id, transferId); }

  // --- USERS ---
  async getUsers() { return settingsService.getUsers(); }
  async createUser(data: any) { return settingsService.createUser(data); }
  async updateUser(id: string, data: any) { return settingsService.updateUser(id, data); }
  async deleteUser(id: string) { return settingsService.deleteUser(id); }

  // --- SUBSCRIPTION & USAGE ---
  async getSubscription() { return settingsService.getSubscription(); }
  async updateTenantSubscription(tenantId: string, plan: string) { return settingsService.updateTenantSubscription(tenantId, plan); }
  async getUsage() { return settingsService.getUsage(); }

  // --- TENANTS ---
  async getTenants() { return settingsService.getTenants(); }
  async createTenant(data: any) { return settingsService.createTenant(data); }
  async updateTenant(id: string, data: any) { return settingsService.updateTenant(id, data); }

  // --- NOTIFICATIONS ---
  async getNotifications() { return settingsService.getNotifications(); }
  async createNotification(data: any) { return settingsService.createNotification(data); }
  async updateNotification(id: string, data: any) { return settingsService.updateNotification(id, data); }
  async deleteNotification(id: string) { return settingsService.deleteNotification(id); }
  async getNotificationLogs() { return settingsService.getNotificationLogs(); }

  // --- WORKFLOWS ---
  async getWorkflows() { return settingsService.getWorkflows(); }
  async createWorkflow(data: any) { return settingsService.createWorkflow(data); }
  async updateWorkflow(id: string, data: any) { return settingsService.updateWorkflow(id, data); }
}

export const apiService = new ApiService();
