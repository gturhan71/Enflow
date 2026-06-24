import { apiClient } from './apiClient';
import { Customer, Opportunity, BoMItem, CostItem, Proposal } from '../types';

export const crmService = {
  // --- CUSTOMERS ---
  async getCustomers() {
    return apiClient.fetchWithAuth('/customers');
  },

  async createCustomer(data: Partial<Customer>) {
    return apiClient.fetchWithAuth('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id: string, data: Partial<Customer>) {
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

  async createOpportunity(data: Partial<Opportunity>) {
    return apiClient.fetchWithAuth('/opportunities', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateOpportunity(id: string, data: Partial<Opportunity>) {
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

  async saveBoMItems(opportunityId: string, items: BoMItem[], opts?: { handoff?: boolean }) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/bom`, {
      method: 'POST',
      body: JSON.stringify({ items, handoff: opts?.handoff === true })
    });
  },

  async saveCostItems(opportunityId: string, items: CostItem[]) {
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

  async submitCostApproval(opportunityId: string) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/submit-cost-approval`, {
      method: 'POST'
    });
  },

  async approveCost(opportunityId: string, data: { decision: 'APPROVE' | 'REJECT'; note?: string }) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/approve-cost`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- PROPOSALS ---
  async getProposals() {
    return apiClient.fetchWithAuth('/proposals');
  },

  async createProposal(data: Omit<Proposal, 'id'>) {
    return apiClient.fetchWithAuth('/proposals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProposal(id: string, data: Partial<Proposal>) {
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
