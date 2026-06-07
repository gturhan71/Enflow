import { apiClient } from './apiClient';

export const settingsService = {
  // --- TENANTS ---
  async getTenants() {
    return apiClient.fetchWithAuth('/tenants');
  },

  async createTenant(data: { name: string }) {
    return apiClient.fetchWithAuth('/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTenant(id: string, data: { name: string }) {
    return apiClient.fetchWithAuth(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // --- UNITS ---
  async getUnits() {
    return apiClient.fetchWithAuth('/units');
  },

  async createUnit(unitData: any) {
    return apiClient.fetchWithAuth('/units', {
      method: 'POST',
      body: JSON.stringify(unitData)
    });
  },

  async deleteUnit(id: string, transferToUnitId?: string) {
    return apiClient.fetchWithAuth(`/units/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ transferToUnitId })
    });
  },

  // --- USERS ---
  async getUsers() {
    return apiClient.fetchWithAuth('/users');
  },

  async createUser(userData: any) {
    return apiClient.fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id: string, userData: any) {
    return apiClient.fetchWithAuth(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(id: string) {
    return apiClient.fetchWithAuth(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // --- SUBSCRIPTIONS & USAGE ---
  async getSubscription() {
    return apiClient.fetchWithAuth('/subscription');
  },

  async updateTenantSubscription(tenantId: string, plan: string) {
    return apiClient.fetchWithAuth(`/tenants/${tenantId}/subscription`, {
      method: 'PUT',
      body: JSON.stringify({ plan })
    });
  },

  async getUsage() {
    return apiClient.fetchWithAuth('/usage');
  },

  // --- NOTIFICATIONS ---
  async getNotifications() {
    return apiClient.fetchWithAuth('/notifications');
  },

  async createNotification(data: any) {
    return apiClient.fetchWithAuth('/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateNotification(id: string, data: any) {
    return apiClient.fetchWithAuth(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteNotification(id: string) {
    return apiClient.fetchWithAuth(`/notifications/${id}`, {
      method: 'DELETE'
    });
  },

  async getNotificationLogs() {
    return apiClient.fetchWithAuth('/logs/notifications');
  },

  // --- WORKFLOWS ---
  async getWorkflows() {
    return apiClient.fetchWithAuth('/workflows');
  },

  async createWorkflow(data: any) {
    return apiClient.fetchWithAuth('/workflows', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateWorkflow(id: string, data: any) {
    return apiClient.fetchWithAuth(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};
