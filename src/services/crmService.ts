import { apiClient } from './apiClient';

export const crmService = {
  // --- CUSTOMERS ---
  async getCustomers() {
    return apiClient.fetchWithAuth('/customers');
  },

  async createCustomer(data: any) {
    return apiClient.fetchWithAuth('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id: string, data: any) {
    return apiClient.fetchWithAuth(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(id: string) {
    return apiClient.fetchWithAuth(`/customers/${id}`, {
      method: 'DELETE'
    });
  },

  // --- OPPORTUNITIES ---
  async getOpportunities() {
    return apiClient.fetchWithAuth('/opportunities');
  },

  async createOpportunity(data: any) {
    return apiClient.fetchWithAuth('/opportunities', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateOpportunity(id: string, data: any) {
    return apiClient.fetchWithAuth(`/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteOpportunity(id: string) {
    return apiClient.fetchWithAuth(`/opportunities/${id}`, {
      method: 'DELETE'
    });
  },

  async saveBoMItems(opportunityId: string, items: any[]) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/bom`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  },

  async saveCostItems(opportunityId: string, items: any[]) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/costs`, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  },

  async requestProposalApproval(opportunityId: string, data: { note: string; managerId: string }) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/request-approval`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async approveProposal(opportunityId: string, data: { note: string }) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async revertOpportunityApproval(opportunityId: string) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/revert-approval`, {
      method: 'POST'
    });
  },

  // --- PROPOSALS ---
  async getProposals() {
    return apiClient.fetchWithAuth('/proposals');
  },

  async createProposal(data: any) {
    return apiClient.fetchWithAuth('/proposals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProposal(id: string, data: any) {
    return apiClient.fetchWithAuth(`/proposals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProposal(id: string) {
    return apiClient.fetchWithAuth(`/proposals/${id}`, {
      method: 'DELETE'
    });
  }
};
