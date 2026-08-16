import { apiClient } from './apiClient';
import { PlatformTicket } from '../types';

export const platformTicketService = {
  async getPlatformTickets(filters?: { status?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return apiClient.fetchWithAuth(`/platform-tickets${qs ? `?${qs}` : ''}`) as Promise<PlatformTicket[]>;
  },

  async createPlatformTicket(data: { title: string; description: string; reportedType?: string }) {
    return apiClient.fetchWithAuth('/platform-tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    }) as Promise<PlatformTicket>;
  }
};
