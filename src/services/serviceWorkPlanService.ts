import { apiClient } from './apiClient';
import { ServiceWorkPlan } from '../types';

export const serviceWorkPlanService = {
  async getServiceWorkPlans(filters?: { weekOf?: string; unitId?: string }) {
    const params = new URLSearchParams();
    if (filters?.weekOf) params.set('weekOf', filters.weekOf);
    if (filters?.unitId) params.set('unitId', filters.unitId);
    const qs = params.toString();
    return apiClient.fetchWithAuth(`/service-work-plans${qs ? `?${qs}` : ''}`);
  },

  async createServiceWorkPlan(data: Partial<ServiceWorkPlan>) {
    return apiClient.fetchWithAuth('/service-work-plans', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateServiceWorkPlan(id: string, data: Partial<ServiceWorkPlan>) {
    return apiClient.fetchWithAuth(`/service-work-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteServiceWorkPlan(id: string) {
    return apiClient.fetchWithAuth(`/service-work-plans/${id}`, { method: 'DELETE' });
  },
};
