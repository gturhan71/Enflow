import { apiClient } from './apiClient';

export const projectService = {
  async getProjects() {
    return apiClient.fetchWithAuth('/projects');
  },

  async createProject(data: any) {
    return apiClient.fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProject(id: string, data: any) {
    return apiClient.fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id: string) {
    return apiClient.fetchWithAuth(`/projects/${id}`, {
      method: 'DELETE'
    });
  }
};
