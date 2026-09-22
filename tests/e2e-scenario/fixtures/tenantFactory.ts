import type { ApiClient } from '../helpers/apiClient';

export interface BootstrappedTenant {
  tenantId: string;
  token: string;
  user: { id: string; email: string; role: string };
}

/** Gercek POST /api/setup/init akisi — tenant + tum DEFAULT_UNITS + ilk GM kullanicisini kurar. */
export async function bootstrapTenant(api: ApiClient, companyName: string): Promise<BootstrappedTenant> {
  const admin = { name: 'E2E Test GM', email: `gm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`, password: 'test1234' };
  const { status, body } = await api.post<BootstrappedTenant & { error?: string }>('/setup/init', {
    company: { name: companyName },
    admin,
  });
  if (status !== 200) throw new Error(`bootstrapTenant basarisiz (${status}): ${JSON.stringify(body)}`);
  return body;
}
