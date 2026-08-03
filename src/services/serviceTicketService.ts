import { apiClient } from './apiClient';
import { ServiceTicket } from '../types';

export const serviceTicketService = {
  async getServiceTickets(filters?: { status?: string; projectId?: string; priority?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.projectId) params.set('projectId', filters.projectId);
    if (filters?.priority) params.set('priority', filters.priority);
    const qs = params.toString();
    return apiClient.fetchWithAuth(`/service-tickets${qs ? `?${qs}` : ''}`);
  },

  async createServiceTicket(data: Partial<ServiceTicket>) {
    return apiClient.fetchWithAuth('/service-tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateServiceTicket(id: string, data: Partial<ServiceTicket>) {
    return apiClient.fetchWithAuth(`/service-tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async resolveServiceTicket(id: string, resolutionNotes?: string, costAmount?: number, costCurrency?: string) {
    return apiClient.fetchWithAuth(`/service-tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNotes, costAmount, costCurrency })
    });
  },

  async deleteServiceTicket(id: string) {
    return apiClient.fetchWithAuth(`/service-tickets/${id}`, {
      method: 'DELETE'
    });
  }
};
