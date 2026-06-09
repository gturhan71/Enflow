import { apiClient } from './apiClient';
import { TodoTask } from '../types';

export const taskService = {
  async getTasks() {
    return apiClient.fetchWithAuth('/tasks');
  },

  async createTask(data: Omit<TodoTask, 'id'>) {
    return apiClient.fetchWithAuth('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTask(id: string, data: Partial<TodoTask>) {
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
