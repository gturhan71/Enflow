const API_BASE_URL = '/api';

// Oturum httpOnly çerezde (`enflow_session`) — JavaScript OKUYAMAZ (XSS token'ı çalamaz). Tarayıcı çerezi
// `credentials: 'same-origin'` ile kendisi ekler; burada yalnız tenant doğrulaması + CSRF başlığı gönderilir
// (sunucu: çerezle gelen durum-değiştiren isteklerde X-Enflow-CSRF zorunlu, bkz. backend services/session.ts).
export const activeTenantId = (): string => localStorage.getItem('enflow_active_tenant_id') || '';
export const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
  'x-tenant-id': activeTenantId(),
  'X-Enflow-CSRF': '1',
  ...extra,
});

/** Oturum süresi doldu/geçersiz (401) → App dinler, girişe yönlendirir. */
export const SESSION_EXPIRED_EVENT = 'enflow:session-expired';
let expiredNotified = false;
export const resetSessionExpiredNotice = () => { expiredNotified = false; };
function notifyIfExpired(res: Response): Response {
  if (res.status === 401 && !expiredNotified) {
    expiredNotified = true;
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return res;
}

/** Kimlikli `fetch` — çerez + tenant + CSRF başlıkları otomatik (FormData/blob/SSE çağrıları için). */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: { ...authHeaders(), ...((init.headers as Record<string, string> | undefined) ?? {}) },
  });
  return notifyIfExpired(res);
}

class ApiClient {
  private tenantId: string | null = null;

  setAuth(tenantId: string) {
    this.tenantId = tenantId;
  }

  async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...((options.headers as Record<string, string> | undefined) ?? {}),
        'Content-Type': 'application/json',
        ...(this.tenantId ? { 'x-tenant-id': this.tenantId } : {}),
      },
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

  // Dashboard gerçek-zamanlılık (SSE) — fetch + ReadableStream (çerez + tenant + CSRF başlıkları authFetch'te).
  // Her "data:" satırında onMessage çağrılır; frontend tam veriyi ayrıca REST'ten çeker.
  async streamDashboard(onMessage: () => void, signal: AbortSignal): Promise<void> {
    const response = await authFetch(`${API_BASE_URL}/reports/dashboard/stream`, { signal });
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const evt of events) {
        if (evt.startsWith('data:')) onMessage();
      }
    }
  }

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Enflow-Client': 'web' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      let msg = 'Giriş başarısız.';
      try { msg = (await response.json()).error || msg; } catch { /* yut */ }
      throw new Error(msg);
    }
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
