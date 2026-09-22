import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createOpportunity } from '../fixtures/opportunityFixture';
import { createStaffedUser, deactivateUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';
import { getChain } from '../helpers/approvalDriver';

// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1, satir 7 (OPPORTUNITY_TO_PROJECT, T1).
// Tek asama: GENERAL_MANAGER(0) -> AUTO CREATE_PROJECT_FROM_ENTITY.
// Kritik soru (Tablo 1 satir 7 notu): GM koltugu bos + agent yokken proje
// GERCEKTEN hic insan onayi olmadan otomatik aciliyor mu?
describe('PE-07 OPPORTUNITY_TO_PROJECT (T1)', () => {
  const PORT = 3101;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('opportunity-to-project', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('PE-07-ORPHAN-GM: GM koltugu bos (agent yok), WON firsat -> proje HIC insan onayi olmadan tek cagrida acilir', async () => {
    await deactivateUser(env.prisma, env.gmUserId);

    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const salesMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId });

    const { opp } = await createOpportunity(env.prisma, {
      tenantId: env.tenantId, assignedToId: salesMgr.id, createdById: salesMgr.id, status: 'WON', title: 'E2E WON Fırsat — GM boş koltuk', value: 750_000,
    });

    // SALES_MGR, OPPORTUNITY_TO_PROJECT_ROLES icinde oldugu icin ucu cagirabilir
    // (bu, GM onay ASAMASINDAN farkli bir yetki — kim tetikleyebilir sorusu).
    const res = await env.api.withToken(salesMgr.token).post<{ id: string; opportunityId: string; pending?: boolean }>('/projects', { opportunityId: opp.id });

    // Eger 202 donerse GM asamasi orphan-skip OLMADAN PENDING kaldi demektir —
    // bu durumda oracle'in "agent yok -> her zaman SKIPPED" iddiasi YANLIS olur.
    expect(res.status).toBe(201);
    expect(res.body.opportunityId).toBe(opp.id);

    const project = await env.prisma.project.findFirst({ where: { tenantId: env.tenantId, opportunityId: opp.id } });
    expect(project).not.toBeNull();
    expect(project?.id).toBe(res.body.id);

    const chain = await getChain(env.api, salesMgr.token, 'OPPORTUNITY', opp.id);
    expect(chain.status).toBe('COMPLETED');
    expect(chain.stages.find((s) => s.order === 0)?.status).toBe('SKIPPED');
  });
});
