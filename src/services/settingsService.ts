import { apiClient } from './apiClient';
import { Unit, User, Notification, Workflow } from '../types';

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

  async createUnit(unitData: Omit<Unit, 'id'>) {
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

  async createUser(userData: Omit<User, 'id'>) {
    return apiClient.fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id: string, userData: Partial<User>) {
    return apiClient.fetchWithAuth(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(id: string, opts?: { transferToUserId?: string; hardDelete?: boolean }) {
    return apiClient.fetchWithAuth(`/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(opts || {}),
    });
  },

  async getOwnedItems(userId: string) {
    return apiClient.fetchWithAuth(`/users/${userId}/owned-items`);
  },

  async transferUserOwnership(userId: string, data: { toUserId: string; categoryKeys?: string[] }) {
    return apiClient.fetchWithAuth(`/users/${userId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
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

  async activateLicense(licenseKey: string) {
    return apiClient.fetchWithAuth('/tenants/activate-license', {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
    });
  },

  async getUsage() {
    return apiClient.fetchWithAuth('/usage');
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId?: string) {
    return apiClient.fetchWithAuth(`/notifications${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`);
  },

  async createNotification(data: Omit<Notification, 'id'>) {
    return apiClient.fetchWithAuth('/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateNotification(id: string, data: Partial<Notification>) {
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
  // Tenant'ın TÜM süreçlerini (sabit taksonomideki + tenant'ın Tasarımcı'da
  // kendi tanımladığı özel/custom süreçler) listeler — Designer'ın "+ Yeni
  // Süreç" sekmesi keşfi için.
  async getWorkflows(): Promise<Workflow[]> {
    return apiClient.fetchWithAuth('/workflows');
  },

  async createWorkflow(data: Omit<Workflow, 'id'>) {
    return apiClient.fetchWithAuth('/workflows', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateWorkflow(id: string, data: Partial<Workflow>) {
    return apiClient.fetchWithAuth(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Süreç Motoru (Faz A) — belirli bir processKey'e ait iş akışını getirir
  // (yoksa 404 fırlatır — Tasarımcı UI bunu "henüz yapılandırılmadı" olarak yakalar).
  async getWorkflowByProcessKey(processKey: string) {
    return apiClient.fetchWithAuth(`/workflows/by-process/${processKey}`);
  },

  async deleteWorkflow(id: string) {
    return apiClient.fetchWithAuth(`/workflows/${id}`, { method: 'DELETE' });
  },
};
