const API_BASE_URL = '/api';

class ApiClient {
  private tenantId: string | null = null;
  private token: string | null = null;

  setAuth(tenantId: string, token: string) {
    this.tenantId = tenantId;
    this.token = token;
  }

  async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const effectiveTenantId = this.tenantId || localStorage.getItem('enflow_active_tenant_id') || '';
    const effectiveToken = this.token || localStorage.getItem('enflow_auth_token') || 'mock-token';

    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-tenant-id': effectiveTenantId,
      'Authorization': `Bearer ${effectiveToken}`
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      } else {
        const text = await response.text();
        throw new Error(`Sunucu hatası (${response.status}). Lütfen daha sonra tekrar deneyin.`);
      }
    }

    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response;
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

export const apiClient = new ApiClient();
