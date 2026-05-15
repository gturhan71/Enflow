const API_BASE_URL = 'http://localhost:3002/api';

class ApiService {
  private tenantId: string | null = null;
  private token: string | null = null;

  setAuth(tenantId: string, token: string) {
    this.tenantId = tenantId;
    this.token = token;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId || '',
      'Authorization': `Bearer ${this.token}`
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  async login(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) throw new Error('Giriş başarısız.');
    return response.json();
  }

  async getTenants() {
    const response = await fetch(`${API_BASE_URL}/tenants`);
    if (!response.ok) throw new Error('Şirket listesi yüklenemedi.');
    return response.json();
  }

  // --- UNITS ---
  async getUnits() {
    return this.fetchWithAuth('/units');
  }

  async createUnit(unitData: any) {
    return this.fetchWithAuth('/units', {
      method: 'POST',
      body: JSON.stringify(unitData)
    });
  }

  // --- USERS ---
  async getUsers() {
    return this.fetchWithAuth('/users');
  }

  async createUser(userData: any) {
    return this.fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUser(id: string, userData: any) {
    return this.fetchWithAuth(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(id: string) {
    return this.fetchWithAuth(`/users/${id}`, {
      method: 'DELETE'
    });
  }

  // --- CUSTOMERS ---
  async getCustomers() {
    return this.fetchWithAuth('/customers');
  }

  async createCustomer(data: any) {
    return this.fetchWithAuth('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.fetchWithAuth(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCustomer(id: string) {
    return this.fetchWithAuth(`/customers/${id}`, {
      method: 'DELETE'
    });
  }

  // --- OPPORTUNITIES ---
  async getOpportunities() {
    return this.fetchWithAuth('/opportunities');
  }

  async createOpportunity(data: any) {
    return this.fetchWithAuth('/opportunities', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateOpportunity(id: string, data: any) {
    return this.fetchWithAuth(`/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteOpportunity(id: string) {
    return this.fetchWithAuth(`/opportunities/${id}`, {
      method: 'DELETE'
    });
  }

  // --- PROJECTS ---
  async getProjects() {
    return this.fetchWithAuth('/projects');
  }

  async createProject(data: any) {
    return this.fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProject(id: string, data: any) {
    return this.fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProject(id: string) {
    return this.fetchWithAuth(`/projects/${id}`, {
      method: 'DELETE'
    });
  }

  // --- TASKS ---
  async getTasks() {
    return this.fetchWithAuth('/tasks');
  }

  async createTask(data: any) {
    return this.fetchWithAuth('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTask(id: string, data: any) {
    return this.fetchWithAuth(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteTask(id: string) {
    return this.fetchWithAuth(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }

  // --- CONTRACTS ---
  async getContracts() {
    return this.fetchWithAuth('/contracts');
  }

  async createContract(data: any) {
    return this.fetchWithAuth('/contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateContract(id: string, data: any) {
    return this.fetchWithAuth(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteContract(id: string) {
    return this.fetchWithAuth(`/contracts/${id}`, {
      method: 'DELETE'
    });
  }

  // --- ARCHIVE ---
  async getArchiveItems() {
    return this.fetchWithAuth('/archive');
  }

  async createArchiveItem(data: any) {
    return this.fetchWithAuth('/archive', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateArchiveItem(id: string, data: any) {
    return this.fetchWithAuth(`/archive/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteArchiveItem(id: string) {
    return this.fetchWithAuth(`/archive/${id}`, {
      method: 'DELETE'
    });
  }

  // --- NOTIFICATIONS ---
  async getNotifications() {
    return this.fetchWithAuth('/notifications');
  }

  async createNotification(data: any) {
    return this.fetchWithAuth('/notifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateNotification(id: string, data: any) {
    return this.fetchWithAuth(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteNotification(id: string) {
    return this.fetchWithAuth(`/notifications/${id}`, {
      method: 'DELETE'
    });
  }

  // --- DOCUMENTS ---
  async getDocuments() {
    return this.fetchWithAuth('/documents');
  }

  async createDocument(data: any) {
    return this.fetchWithAuth('/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDocument(id: string, data: any) {
    return this.fetchWithAuth(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteDocument(id: string) {
    return this.fetchWithAuth(`/documents/${id}`, {
      method: 'DELETE'
    });
  }

  async forgotPassword(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'İşlem başarısız.');
    }
    return response.json();
  }

  // --- WORKFLOWS ---
  async getWorkflows() {
    return this.fetchWithAuth('/workflows');
  }

  async createWorkflow(data: any) {
    return this.fetchWithAuth('/workflows', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWorkflow(id: string, data: any) {
    return this.fetchWithAuth(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

export const apiService = new ApiService();
