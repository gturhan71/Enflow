import { apiClient, authFetch } from './apiClient';
import { WorkOrder } from '../types';

export const workOrderService = {
  async getWorkOrders(filters?: { status?: string; unitId?: string; assignedTechnicianId?: string; type?: string; customerId?: string; projectId?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    }
    const qs = params.toString();
    return apiClient.fetchWithAuth(`/work-orders${qs ? `?${qs}` : ''}`);
  },

  async getWorkOrderSummary() {
    return apiClient.fetchWithAuth('/work-orders/summary/all');
  },

  async getWorkOrder(id: string) {
    return apiClient.fetchWithAuth(`/work-orders/${id}`);
  },

  async createWorkOrder(data: Partial<WorkOrder>) {
    return apiClient.fetchWithAuth('/work-orders', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateWorkOrder(id: string, data: Partial<WorkOrder>) {
    return apiClient.fetchWithAuth(`/work-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async scheduleWorkOrder(id: string, assignedTechnicianId: string, scheduledDate: string) {
    return apiClient.fetchWithAuth(`/work-orders/${id}/schedule`, { method: 'POST', body: JSON.stringify({ assignedTechnicianId, scheduledDate }) });
  },

  async startWorkOrder(id: string) {
    return apiClient.fetchWithAuth(`/work-orders/${id}/start`, { method: 'POST' });
  },

  async completeWorkOrder(id: string, data: { completionNotes?: string; customerSignOffName?: string; costAmount?: number; costCurrency?: string }) {
    return apiClient.fetchWithAuth(`/work-orders/${id}/complete`, { method: 'POST', body: JSON.stringify(data) });
  },

  // FormData — apiClient değil, authFetch (bkz. lib/guaranteeText.ts aynı desen).
  async uploadSignOff(id: string, file: File): Promise<WorkOrder> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authFetch(`/api/work-orders/${id}/signoff-upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteWorkOrder(id: string) {
    return apiClient.fetchWithAuth(`/work-orders/${id}`, { method: 'DELETE' });
  },

  // --- Faz 3: Malzeme/Hizmet Talepleri ---
  async createMaterialRequest(workOrderId: string, data: { description: string; vendorId?: string; vendorName?: string; estimatedCost?: number; currency?: string; notes?: string; requestedByName?: string }) {
    return apiClient.fetchWithAuth(`/work-orders/${workOrderId}/materials`, { method: 'POST', body: JSON.stringify(data) });
  },
  async updateMaterialRequest(workOrderId: string, matId: string, data: Partial<{ description: string; vendorId: string | null; vendorName: string; estimatedCost: number | null; actualCost: number | null; currency: string; notes: string; status: string }>) {
    return apiClient.fetchWithAuth(`/work-orders/${workOrderId}/materials/${matId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async approveMaterialRequest(workOrderId: string, matId: string) {
    return apiClient.fetchWithAuth(`/work-orders/${workOrderId}/materials/${matId}/approve`, { method: 'PUT' });
  },
  async rejectMaterialRequest(workOrderId: string, matId: string, rejectionNote?: string) {
    return apiClient.fetchWithAuth(`/work-orders/${workOrderId}/materials/${matId}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionNote }) });
  },
  async deleteMaterialRequest(workOrderId: string, matId: string) {
    return apiClient.fetchWithAuth(`/work-orders/${workOrderId}/materials/${matId}`, { method: 'DELETE' });
  },
};
