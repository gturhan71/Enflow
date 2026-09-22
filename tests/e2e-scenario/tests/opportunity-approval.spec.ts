import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { approveStageAtOrder, getChain } from '../helpers/approvalDriver';
import { createOpportunity } from '../fixtures/opportunityFixture';
import { createStaffedUser, deactivateUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';

// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1, satir 1 (OPPORTUNITY_APPROVAL).
// Aşama sırası: SALES_MGR(0) -> IGPD_MGR(1) -> GENERAL_MANAGER(2).
describe('PE-01 OPPORTUNITY_APPROVAL', () => {
  const PORT = 3100;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('opportunity-approval', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('PE-01-HAPPY: uc asama da dolu -> hepsi insan onayindan gecip chain COMPLETED olur', async () => {
    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const igpdUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.igpd);
    const salesMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId });
    const igpdMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'IGPD_MGR', unitId: igpdUnitId });

    // SoD (Gorev Ayriligi): olusturan kendi kaydini onaylayamaz — createdById
    // hicbir onaylayan (SALES_MGR/IGPD_MGR/GM) ile AYNI olmayan notr bir kayit sahibi.
    const requester = await env.prisma.user.create({
      data: { tenantId: env.tenantId, name: 'E2E Requester', email: `requester-${Date.now()}@e2e.test`, password: 'x', role: 'SALES_REP', status: 'ACTIVE', permissions: '[]' },
    });
    const { opp } = await createOpportunity(env.prisma, {
      tenantId: env.tenantId, assignedToId: salesMgr.id, createdById: requester.id, status: 'NEGOTIATION',
    });

    const trigger = await env.api.withToken(salesMgr.token).post(`/opportunities/${opp.id}/request-approval`);
    expect(trigger.status).toBe(200);

    await approveStageAtOrder(env.api, salesMgr.token, 'OPPORTUNITY', opp.id, 0);
    await approveStageAtOrder(env.api, igpdMgr.token, 'OPPORTUNITY', opp.id, 1);
    const afterIgpd = await getChain(env.api, igpdMgr.token, 'OPPORTUNITY', opp.id);
    expect(afterIgpd.stages.find((s) => s.order === 2)?.status).toBe('PENDING'); // GM sirasi geldi, henuz onaylamadi
    const final = await approveStageAtOrder(env.api, env.gmToken, 'OPPORTUNITY', opp.id, 2);

    expect(final.status).toBe('COMPLETED');
    expect(final.stages.every((s) => s.status === 'APPROVED')).toBe(true);

    const refreshedOpp = await env.prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } });
    expect(refreshedOpp.technicalStatus).toBe('APPROVED');
    expect(refreshedOpp.status).toBe('PROPOSAL');
  });

  it('PE-01-ORPHAN-GM: GM koltugu bos (agent yok) -> insan GM onayi HIC olmadan chain yine de COMPLETED olur', async () => {
    // Kritik iddia (Tablo 3 §3.2): GENERAL_MANAGER icin hicbir sanal agent tanimli
    // degil. Bu test, koltuk bosken zincirin GM onayini beklemeden SESSIZCE
    // ilerleyip ilerlemedigini kanitlar.
    await deactivateUser(env.prisma, env.gmUserId);

    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const igpdUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.igpd);
    const salesMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId, name: 'E2E Sales Mgr 2' });
    const igpdMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'IGPD_MGR', unitId: igpdUnitId, name: 'E2E IGPD Mgr 2' });

    const { opp } = await createOpportunity(env.prisma, {
      tenantId: env.tenantId, assignedToId: salesMgr.id, createdById: env.gmUserId, status: 'NEGOTIATION', title: 'E2E Fırsat — GM boş koltuk',
    });

    const trigger = await env.api.withToken(salesMgr.token).post(`/opportunities/${opp.id}/request-approval`);
    expect(trigger.status).toBe(200);

    await approveStageAtOrder(env.api, salesMgr.token, 'OPPORTUNITY', opp.id, 0);
    // IGPD onayladigi ANDA autoSkipOrphanStages GM'i de degerlendirir (agent yok -> SKIPPED)
    // ve zincir tek cagrida COMPLETED olur — ayrica bir GM eylemi HIC gerekmez.
    const afterIgpdApprove = await approveStageAtOrder(env.api, igpdMgr.token, 'OPPORTUNITY', opp.id, 1);

    expect(afterIgpdApprove.status).toBe('COMPLETED');
    const gmStage = afterIgpdApprove.stages.find((s) => s.order === 2);
    expect(gmStage?.status).toBe('SKIPPED');

    const refreshedOpp = await env.prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } });
    expect(refreshedOpp.technicalStatus).toBe('APPROVED');
  });
});
