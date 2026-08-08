import { apiClient } from './apiClient';
import { Customer, Opportunity, BoMItem, CostItem, Proposal, Contact } from '../types';

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

  // --- KİŞİLER (Contact) ---
  async getContacts(customerId: string) {
    return apiClient.fetchWithAuth(`/customers/${customerId}/contacts`);
  },

  async createContact(customerId: string, data: Partial<Contact>) {
    return apiClient.fetchWithAuth(`/customers/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateContact(customerId: string, contactId: string, data: Partial<Contact>) {
    return apiClient.fetchWithAuth(`/customers/${customerId}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteContact(customerId: string, contactId: string) {
    return apiClient.fetchWithAuth(`/customers/${customerId}/contacts/${contactId}`, {
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

  async checkInOpportunityProgress(id: string, data: { probability?: number; status?: string; note?: string }) {
    return apiClient.fetchWithAuth(`/opportunities/${id}/progress-checkin`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getOpportunityProgressLog(id: string) {
    return apiClient.fetchWithAuth(`/opportunities/${id}/progress-log`);
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

  // Fiyatlama motoru backend'de (salesCosting.ts) — ham girdileri gönderir,
  // sunucu hesaplayıp otoriter değerlerle kaydeder ve döner.
  async saveCostAnalysis(opportunityId: string, data: { bomItems: unknown[]; costItems: unknown[]; costConfig: unknown }) {
    return apiClient.fetchWithAuth(`/opportunities/${opportunityId}/cost-analysis`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getSalesSettings() {
    return apiClient.fetchWithAuth('/sales-settings');
  },

  async updateSalesSettings(data: { marginFloorPct: number }) {
    return apiClient.fetchWithAuth('/sales-settings', {
      method: 'PUT',
      body: JSON.stringify(data)
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
