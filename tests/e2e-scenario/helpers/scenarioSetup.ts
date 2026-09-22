import { createIsolatedTestDb, destroyTestDb } from './testDb';
import { startBackend, type RunningBackend } from './backendProcess';
import { getPrisma, type Db } from './prisma';
import { ApiClient } from './apiClient';
import { bootstrapTenant } from '../fixtures/tenantFactory';

export interface ScenarioEnv {
  dbHandle: { absPath: string; databaseUrl: string };
  backend: RunningBackend;
  prisma: Db;
  api: ApiClient;
  tenantId: string;
  gmToken: string;
  gmUserId: string;
}

/**
 * Ortak on-kosul: izole DB+backend + tenant bootstrap + TUM 14 surecin
 * (docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1) varsayilan sablonla kurulmasi.
 * `bootstrapTenant` (POST /api/setup/init) bunu OTOMATIK yapmiyor —
 * `applyDefaultWorkflowTemplate` var olan surecleri asla ezmedigi icin bos bir
 * tenant'ta GM'in ELLE tetiklemesi gerekiyor (routes/workflows.ts
 * POST /apply-default-template, requireRole(['GENERAL_MANAGER'])) — bu yuzden
 * bootstrap GM'i pasiflestirmeden ONCE cagirilmali.
 */
export async function setupScenarioEnv(label: string, port: number): Promise<ScenarioEnv> {
  const dbHandle = createIsolatedTestDb(label);
  const backend = await startBackend({ databaseUrl: dbHandle.databaseUrl, port });
  const prisma = await getPrisma(dbHandle.databaseUrl);
  const api = new ApiClient(backend.baseUrl);

  const boot = await bootstrapTenant(api, `E2E ${label}`);
  const gmToken = boot.token;

  const applied = await api.withToken(gmToken).post<{ createdProcesses?: string[]; error?: string }>('/workflows/apply-default-template');
  if (applied.status !== 200) throw new Error(`apply-default-template basarisiz (${applied.status}): ${JSON.stringify(applied.body)}`);

  return { dbHandle, backend, prisma, api, tenantId: boot.tenantId, gmToken, gmUserId: boot.user.id };
}

export async function teardownScenarioEnv(env: Partial<Pick<ScenarioEnv, 'backend' | 'dbHandle'>> | undefined) {
  await env?.backend?.stop();
  if (env?.dbHandle?.absPath) destroyTestDb(env.dbHandle.absPath);
}
