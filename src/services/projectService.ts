import { apiClient } from './apiClient';
import { Project } from '../types';

export const projectService = {
  async getProjects() {
    return apiClient.fetchWithAuth('/projects');
  },

  async createProject(data: Omit<Project, 'id'>) {
    return apiClient.fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProject(id: string, data: Partial<Project>) {
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
