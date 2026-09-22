import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createPoIssuedPurchaseRequest } from '../fixtures/purchaseRequestFixture';
import { getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';
import { activateAgent } from '../fixtures/agentEntitlementFactory';
import { getChain } from '../helpers/approvalDriver';

// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1 satir 10 (PURCHASE_TO_INVOICE, T6)
// + Tablo 3 §3.3 (agent hucre matrisi).
// Asama sirasi: FINANCE_MGR(0) -> AUTO CREATE_INVOICE_FROM_PURCHASE(1).
// AGENT_FINANCE ADVISORY-only (pluginCatalog.ts allowedModes:['ADVISORY']).
describe('PE-10 PURCHASE_TO_INVOICE (T6) + agent güvenlik sınırı', () => {
  const PORT = 3103;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('purchase-to-invoice', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('PE-10-SKIP: FINANCE_MGR bos + AGENT_FINANCE gercekci ADVISORY modda -> asama SKIPPED, finans onayi olmadan fatura yine de olusur', async () => {
    const financeUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.finance);
    await activateAgent(env.prisma, env.tenantId, 'AGENT_FINANCE', { mode: 'ADVISORY' }); // catalog varsayilani, gercekci durum

    const pr = await createPoIssuedPurchaseRequest(env.prisma, { tenantId: env.tenantId, unitId: financeUnitId, requestedBy: env.gmUserId });

    const res = await env.api.withToken(env.gmToken).post<{ status: string; invoiceNo?: string }>(`/purchase-requests/${pr.id}/invoice`, {
      invoiceNo: 'FAT-E2E-001', invoiceAmount: 50_000, invoiceDate: new Date().toISOString(),
    });

    // 202 donerse zincir hala PENDING'dir (onay bekliyor) — ama beklenen (skip-logic
    // dogruysa): FINANCE_MGR orphan+ADVISORY-only agent -> SKIPPED -> AUTO hemen calisir -> 200.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INVOICED');

    const chain = await getChain(env.api, env.gmToken, 'PURCHASE_REQUEST', pr.id);
    expect(chain.status).toBe('COMPLETED');
    expect(chain.stages.find((s) => s.order === 0)?.status).toBe('SKIPPED');

    const invoice = await env.prisma.invoice.findFirst({ where: { tenantId: env.tenantId, purchaseRequestId: pr.id, type: 'PURCHASE' } });
    expect(invoice).not.toBeNull();
    expect(invoice?.amount).toBe(50_000);
  });

  it('PE-SECURITY-01: AGENT_FINANCE entitlement (hata/migration simülasyonu) AUTONOMOUS olsa bile "asla otonom değil" garantisi artık kullanım-anında da tutuyor (regresyon koruması)', async () => {
    const financeUnitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.finance);
    // ONEMLI: normal API (PUT /plugins/entitlements/:key) bunu REDDEDER
    // (entitlementService.ts updateEntitlement -> plugin.allowedModes kontrolu).
    // Burada KASITLI olarak o kapiyi atlayip DOGRUDAN Prisma ile yaziyoruz — bu,
    // "ileride bir bug/migration bu satiri boyle yazarsa ne olur" sorusunu test
    // ediyor, gercek bir UI akisini degil.
    await env.prisma.pluginEntitlement.upsert({
      where: { tenantId_pluginKey: { tenantId: env.tenantId, pluginKey: 'AGENT_FINANCE' } },
      create: { tenantId: env.tenantId, pluginKey: 'AGENT_FINANCE', status: 'ACTIVE', mode: 'AUTONOMOUS', activatedAt: new Date() },
      update: { status: 'ACTIVE', mode: 'AUTONOMOUS' },
    });

    const pr = await createPoIssuedPurchaseRequest(env.prisma, { tenantId: env.tenantId, unitId: financeUnitId, requestedBy: env.gmUserId, title: 'E2E Satınalma — güvenlik testi' });

    const res = await env.api.withToken(env.gmToken).post<{ status: string }>(`/purchase-requests/${pr.id}/invoice`, {
      invoiceNo: 'FAT-E2E-002', invoiceAmount: 50_000, invoiceDate: new Date().toISOString(),
    });
    expect(res.status).toBe(200);

    const chain = await getChain(env.api, env.gmToken, 'PURCHASE_REQUEST', pr.id);
    const financeStage = chain.stages.find((s) => s.order === 0);

    // DUZELTME DOGRULAMASI (approvalChainService.ts autoSkipOrphanStages, ~satır 133):
    // entitlement.mode=AUTONOMOUS olsa bile plugin.allowedModes AGENT_FINANCE icin
    // yalniz ['ADVISORY'] tasidigindan agent artik bu asamayi ONAYLAYAMIYOR — SKIPPED
    // olarak kaliyor (runAgent()'teki allowedAuto kilidiyle simetrik hale getirildi).
    expect(financeStage?.status).toBe('SKIPPED');

    const agentRun = await env.prisma.agentRun.findFirst({ where: { tenantId: env.tenantId, pluginKey: 'AGENT_FINANCE', entityType: 'APPROVAL_STAGE' } });
    expect(agentRun).toBeNull(); // agent bu asama icin hic "onaylamadi" — RATIFIED bir AgentRun olusmamali
  });
});
