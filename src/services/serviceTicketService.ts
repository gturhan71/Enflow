import { apiClient, authFetch } from './apiClient';
import { ServiceTicket, ServiceTicketAttachment } from '../types';

export const serviceTicketService = {
  async getServiceTickets(filters?: { status?: string; projectId?: string; priority?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.projectId) params.set('projectId', filters.projectId);
    if (filters?.priority) params.set('priority', filters.priority);
    const qs = params.toString();
    return apiClient.fetchWithAuth(`/service-tickets${qs ? `?${qs}` : ''}`);
  },

  async getServiceTicket(id: string) {
    return apiClient.fetchWithAuth(`/service-tickets/${id}`);
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
  },

  // ServiceTicket → WorkOrder köprüsü. İdempotent — zaten açılmışsa var olanı döner.
  async dispatchServiceTicket(id: string): Promise<{ workOrder: { id: string }; alreadyExisted: boolean }> {
    return apiClient.fetchWithAuth(`/service-tickets/${id}/dispatch`, { method: 'POST' });
  },

  // Arıza açılırken müşteriden alınan log/ekran görüntüsü/geri bildirim — FormData, authFetch.
  async uploadAttachment(ticketId: string, file: File, description?: string): Promise<ServiceTicketAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    const res = await authFetch(`/api/service-tickets/${ticketId}/attachments`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  async deleteAttachment(ticketId: string, attachmentId: string) {
    return apiClient.fetchWithAuth(`/service-tickets/${ticketId}/attachments/${attachmentId}`, { method: 'DELETE' });
  },
};
