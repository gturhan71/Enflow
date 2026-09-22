import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createOpportunity } from '../fixtures/opportunityFixture';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';
import { getChain, approveStageAtOrder } from '../helpers/approvalDriver';

// Faz 3 — docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 2 (rol x onay çapraz doğrulama).
// role-matrix.ts'in `approvalIn` alanı 7 rol icin BOS, 4 rol icin YANLIS/eksik
// entityType tasiyor (statik kod okumasiyla tespit edildi) — bu dosya, o iddiaya
// gerek KALMADAN, gercek calisma-zamani davranisini dogrudan kanitlar: doğru rol
// onaylayabiliyor mu, YANLIS rol 403 aliyor mu.
describe('Faz 3 — rol × onay çapraz doğrulama (çalışma zamanı)', () => {
  const PORT = 3104;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('role-approval-crosscheck', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('ROLE-SALES_MGR-XCHECK: OPPORTUNITY_APPROVAL#0 yalniz SALES_MGR onaylayabilir, IGPD_MGR 403 alir', async () => {
    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const igpdUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.igpd);
    const salesMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId });
    const wrongRoleUser = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'IGPD_MGR', unitId: igpdUnitId });

    const { opp } = await createOpportunity(env.prisma, { tenantId: env.tenantId, assignedToId: salesMgr.id, createdById: env.gmUserId, status: 'NEGOTIATION' });
    const trigger = await env.api.withToken(salesMgr.token).post(`/opportunities/${opp.id}/request-approval`);
    expect(trigger.status).toBe(200);

    const chain = await getChain(env.api, salesMgr.token, 'OPPORTUNITY', opp.id);
    const stage0 = chain.stages.find((s) => s.order === 0)!;

    const wrongTry = await env.api.withToken(wrongRoleUser.token).post(`/approval-chains/${chain.id}/stages/${stage0.id}/approve`, {});
    expect(wrongTry.status).toBe(403);

    const correct = await approveStageAtOrder(env.api, salesMgr.token, 'OPPORTUNITY', opp.id, 0);
    expect(correct.stages.find((s) => s.order === 0)?.status).toBe('APPROVED');
  });

  it('ROLE-IGPD_MGR-XCHECK: OPPORTUNITY_APPROVAL#1 yalniz IGPD_MGR onaylayabilir, SALES_MGR 403 alir', async () => {
    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const igpdUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.igpd);
    const salesMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId, name: 'E2E Sales Mgr 2' });
    const igpdMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'IGPD_MGR', unitId: igpdUnitId, name: 'E2E IGPD Mgr 2' });

    const { opp } = await createOpportunity(env.prisma, { tenantId: env.tenantId, assignedToId: salesMgr.id, createdById: env.gmUserId, status: 'NEGOTIATION', title: 'E2E Fırsat — rol çapraz 2' });
    await env.api.withToken(salesMgr.token).post(`/opportunities/${opp.id}/request-approval`);
    await approveStageAtOrder(env.api, salesMgr.token, 'OPPORTUNITY', opp.id, 0);

    const chain = await getChain(env.api, salesMgr.token, 'OPPORTUNITY', opp.id);
    const stage1 = chain.stages.find((s) => s.order === 1)!;

    const wrongTry = await env.api.withToken(salesMgr.token).post(`/approval-chains/${chain.id}/stages/${stage1.id}/approve`, {});
    expect(wrongTry.status).toBe(403);

    const correct = await approveStageAtOrder(env.api, igpdMgr.token, 'OPPORTUNITY', opp.id, 1);
    expect(correct.stages.find((s) => s.order === 1)?.status).toBe('APPROVED');
  });

  it('ROLE-PROCUREMENT_MGR-XCHECK: PURCHASE_APPROVAL#1 yalniz PROCUREMENT_MGR onaylayabilir, SALES_MGR 403 alir; #0 yalniz "top" birimine bagli GM onaylayabilir', async () => {
    const procurementUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.procurement);
    const salesUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
    const procurementMgr = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'PROCUREMENT_MGR', unitId: procurementUnitId });
    const wrongRoleUser = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'SALES_MGR', unitId: salesUnitId, name: 'E2E Wrong Role' });

    const pr = await env.prisma.purchaseRequest.create({
      data: { tenantId: env.tenantId, title: 'E2E PR — rol çapraz', requestedBy: env.gmUserId, status: 'DRAFT' },
    });

    // NOT (ayri bir bulgu — bkz. rapor): /purchase-requests/:id/approve DRAFT
    // durumundayken zinciri yalnizca ORUSTURUR (hicbir asamayi onaylamaz) ama
    // PR.status'u yine de kosulsuz PENDING_UNIT'e ilerletir — T4'teki (contract-
    // workflow /transfer) ile AYNI sinif "status zincirden bagimsiz ilerliyor"
    // deseni. Bu testte o quirk'i devreye sokmamak icin stage0'i DOGRUDAN generic
    // ucla onayliyoruz (chain'i baslatmak icin tetikleyici cagri yine de gerekli).
    const trigger = await env.api.withToken(env.gmToken).post(`/purchase-requests/${pr.id}/approve`, {});
    expect(trigger.status).toBe(200);

    // Stage0 ("Birim onayı", role:null, unitKey:'top') — yalnız 'top' birimine
    // uye biri (GM) onaylayabilir; birim-uyeligi kosulu (resolveEffectiveApprover).
    const afterStage0 = await approveStageAtOrder(env.api, env.gmToken, 'PURCHASE_REQUEST', pr.id, 0);
    expect(afterStage0.stages.find((s) => s.order === 0)?.status).toBe('APPROVED');

    const chain = await getChain(env.api, env.gmToken, 'PURCHASE_REQUEST', pr.id);
    const stage1 = chain.stages.find((s) => s.order === 1)!;
    expect(stage1.role).toBe('PROCUREMENT_MGR');

    const wrongTry = await env.api.withToken(wrongRoleUser.token).post(`/approval-chains/${chain.id}/stages/${stage1.id}/approve`, {});
    expect(wrongTry.status).toBe(403);

    const correct = await approveStageAtOrder(env.api, procurementMgr.token, 'PURCHASE_REQUEST', pr.id, 1);
    expect(correct.stages.find((s) => s.order === 1)?.status).toBe('APPROVED');
  });
});
