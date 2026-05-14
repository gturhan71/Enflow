const API_BASE_URL = 'http://localhost:3001/api';

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

  async getUnits() {
    return this.fetchWithAuth('/units');
  }

  async createUser(userData: any) {
    return this.fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
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
}

export const apiService = new ApiService();
