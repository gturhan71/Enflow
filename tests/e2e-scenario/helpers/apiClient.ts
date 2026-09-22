/** Gercek HTTP cagrisi yapan ince istemci — "act" adimi HER ZAMAN bunun uzerinden gecer. */
export class ApiClient {
  constructor(private baseUrl: string, private token?: string) {}

  withToken(token: string): ApiClient {
    return new ApiClient(this.baseUrl, token);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : undefined;
    return { status: res.status, body: parsed as T };
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}
