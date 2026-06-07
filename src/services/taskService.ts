import { apiClient } from './apiClient';

export const taskService = {
  async getTasks() {
    return apiClient.fetchWithAuth('/tasks');
  },

  async createTask(data: any) {
    return apiClient.fetchWithAuth('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTask(id: string, data: any) {
    return apiClient.fetchWithAuth(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteTask(id: string) {
    return apiClient.fetchWithAuth(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }
};
