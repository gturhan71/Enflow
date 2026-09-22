import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createSignedContractWorkflow } from '../fixtures/contractWorkflowFixture';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';
import { getChain, approveStageAtOrder } from '../helpers/approvalDriver';

// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1 satir 5 + §6.1 (CONTRACT_TO_PROJECT, T4).
// Asama sirasi: KGD_MGR(0, agent YOK) -> PROJECT_MGR(1, agent VAR) -> AUTO CREATE_PROJECT_FROM_ENTITY(2).
// DUZELTME UYGULANDI (backend/src/routes/contractWorkflow.ts:596-606): /transfer ucu
// artik ContractWorkflow.status'u yalniz `result.chain.status==='COMPLETED'` ise
// TRANSFERRED yapiyor — eskiden zincir hala PENDING olsa bile kosulsuz yaziyordu.
describe('PE-05 CONTRACT_TO_PROJECT (T4) — statü tutarlılığı', () => {
  const PORT = 3102;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('contract-to-project', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('PE-05-FIX-PENDING: KGD_MGR boş+agent yok (skip) ama PROJECT_MGR dolu+HENÜZ onaylamadı -> zincir PENDING kalır, proje OLUŞMAZ, status TRANSFERRED OLMAZ (regresyon koruması)', async () => {
    const projectUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.project);
    // KGD_MGR bilerek staflanmiyor (bos koltuk, agent da yok -> SKIPPED beklenir).
    const projectMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'PROJECT_MGR', unitId: projectUnitId });

    const wf = await createSignedContractWorkflow(env.prisma, { tenantId: env.tenantId, title: 'E2E Sözleşme — T4 tutarlılık testi (pending)', contractValue: 300_000 });

    const res = await env.api.withToken(projectMgr.token).post<{ success: boolean; project: unknown | null; tasksCreated: number }>(`/contract-workflows/${wf.id}/transfer`);
    expect(res.status).toBe(200);
    expect(res.body.project).toBeNull(); // proje HENUZ olusmamis olmali (PROJECT_MGR onaylamadi)

    const chain = await getChain(env.api, projectMgr.token, 'CONTRACT_WORKFLOW_SIGNING', wf.id);
    expect(chain.status).toBe('PENDING');
    expect(chain.stages.find((s) => s.order === 0)?.status).toBe('SKIPPED'); // KGD_MGR — bos koltuk, agent yok
    expect(chain.stages.find((s) => s.order === 1)?.status).toBe('PENDING'); // PROJECT_MGR — dolu ama henuz onaylamadi

    const refreshedWf = await env.prisma.contractWorkflow.findUniqueOrThrow({ where: { id: wf.id } });
    expect(refreshedWf.projectId).toBeNull();
    // DUZELTME DOGRULAMASI: proje olusmamis + zincir PENDING'ken status ARTIK
    // yanlislikla TRANSFERRED yazilmiyor — SIGNED'da kaliyor.
    expect(refreshedWf.status).toBe('SIGNED');
  });

  it('PE-05-FIX-COMPLETED: PROJECT_MGR de onaylayınca zincir gerçekten COMPLETED olur, proje oluşur, status doğru şekilde TRANSFERRED olur', async () => {
    const projectUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.project);
    const projectMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'PROJECT_MGR', unitId: projectUnitId, name: 'E2E Project Mgr 2' });

    const wf = await createSignedContractWorkflow(env.prisma, { tenantId: env.tenantId, title: 'E2E Sözleşme — T4 tutarlılık testi (completed)', contractValue: 420_000 });

    const first = await env.api.withToken(projectMgr.token).post<{ project: unknown | null }>(`/contract-workflows/${wf.id}/transfer`);
    expect(first.status).toBe(200);
    expect(first.body.project).toBeNull(); // KGD_MGR skip oldu ama PROJECT_MGR henuz onaylamadi

    // PROJECT_MGR gercekten onaylar (generic uc) — bu, walkForward'i AUTO adima kadar ilerletir.
    const afterApprove = await approveStageAtOrder(env.api, projectMgr.token, 'CONTRACT_WORKFLOW_SIGNING', wf.id, 1);
    expect(afterApprove.status).toBe('COMPLETED');

    const refreshedWf = await env.prisma.contractWorkflow.findUniqueOrThrow({ where: { id: wf.id } });
    expect(refreshedWf.status).toBe('TRANSFERRED'); // artik gercekten dogru — proje de var
    expect(refreshedWf.projectId).not.toBeNull();

    const project = await env.prisma.project.findFirst({ where: { id: refreshedWf.projectId! } });
    expect(project).not.toBeNull();
  });
});
