import { apiClient } from './apiClient';

export const documentService = {
  // --- DOCUMENTS ---
  async getDocuments() {
    return apiClient.fetchWithAuth('/documents');
  },

  async createDocument(data: any) {
    return apiClient.fetchWithAuth('/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateDocument(id: string, data: any) {
    return apiClient.fetchWithAuth(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteDocument(id: string) {
    return apiClient.fetchWithAuth(`/documents/${id}`, {
      method: 'DELETE'
    });
  },

  // --- ARCHIVE ---
  async getArchiveItems() {
    return apiClient.fetchWithAuth('/archive');
  },

  async createArchiveItem(data: any) {
    return apiClient.fetchWithAuth('/archive', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateArchiveItem(id: string, data: any) {
    return apiClient.fetchWithAuth(`/archive/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteArchiveItem(id: string) {
    return apiClient.fetchWithAuth(`/archive/${id}`, {
      method: 'DELETE'
    });
  },

  // --- CONTRACTS ---
  async getContracts() {
    return apiClient.fetchWithAuth('/contracts');
  },

  async createContract(data: any) {
    return apiClient.fetchWithAuth('/contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateContract(id: string, data: any) {
    return apiClient.fetchWithAuth(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteContract(id: string) {
    return apiClient.fetchWithAuth(`/contracts/${id}`, {
      method: 'DELETE'
    });
  }
};
