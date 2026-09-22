import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestDb, destroyTestDb } from '../helpers/testDb';
import { startBackend, type RunningBackend } from '../helpers/backendProcess';
import { getPrisma, type Db } from '../helpers/prisma';
import { ApiClient } from '../helpers/apiClient';
import { bootstrapTenant } from '../fixtures/tenantFactory';
import { seedPurchaseRequestWithQuotes } from '../fixtures/procurementFixture';
import { activateAgent } from '../fixtures/agentEntitlementFactory';
import { assertSeatEmpty, getUnitId } from '../fixtures/staffingFactory';

// Senaryo: AGENT-PROCUREMENT-AUTONOMOUS-ACTIVE-EMPTY
// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md §3.3 (hucre matrisi, 3. satir).
// Kullanicinin oncelikli sorusu: PROCUREMENT_MGR koltugu hic doldurulmamis bir
// tenant'ta, AGENT_PROCUREMENT AUTONOMOUS lisansliyken, bir satinalma talebi
// GERCEKTEN dogru tedarikciyi secip zinciri ilerletiyor mu — yoksa yalniz
// dokumantasyonda mi oyle iddia ediliyor?
describe('AGENT-PROCUREMENT-AUTONOMOUS-ACTIVE-EMPTY', () => {
  const PORT = 3099;

  let dbHandle: { absPath: string; databaseUrl: string };
  let backend: RunningBackend;
  let prisma: Db;
  let api: ApiClient;
  let tenantId: string;
  let gmToken: string;
  let gmUserId: string;

  beforeAll(async () => {
    dbHandle = createIsolatedTestDb('agent-orphan-seat');
    backend = await startBackend({ databaseUrl: dbHandle.databaseUrl, port: PORT });
    prisma = await getPrisma(dbHandle.databaseUrl);
    api = new ApiClient(backend.baseUrl);

    const boot = await bootstrapTenant(api, 'E2E Agent Orphan Seat Tenant');
    tenantId = boot.tenantId;
    gmToken = boot.token;
    gmUserId = boot.user.id;
  });

  afterAll(async () => {
    await backend?.stop();
    if (dbHandle?.absPath) destroyTestDb(dbHandle.absPath);
  });

  it('PROCUREMENT_MGR koltugu bos + AGENT_PROCUREMENT AUTONOMOUS -> en iyi AGIRLIKLI skorlu teklif otomatik secilir, insan onayi beklemez', async () => {
    // ── Arrange ──────────────────────────────────────────────────────────
    await assertSeatEmpty(prisma, tenantId, 'PROCUREMENT_MGR');
    const procurementUnitId = await getUnitId(prisma, tenantId, 'Satın Alma');
    const { pr, vendorA, vendorB, quoteA, quoteB } = await seedPurchaseRequestWithQuotes(prisma, {
      tenantId,
      unitId: procurementUnitId,
      requestedBy: gmUserId,
    });
    await activateAgent(prisma, tenantId, 'AGENT_PROCUREMENT', { mode: 'AUTONOMOUS' });

    // ── Act — gercek HTTP cagrisi, gercek bir tetikleyicinin (kullanici/otomasyon) yapacagi ──
    const authedApi = api.withToken(gmToken);
    const { status, body: run } = await authedApi.post<{
      id: string; status: string; mode: string; actionTaken: string | null; handoffTaskId: string | null;
    }>(`/plugins/agents/AGENT_PROCUREMENT/run`, { entityId: pr.id, triggeredById: gmUserId });

    // ── Assert — HTTP yaniti ─────────────────────────────────────────────
    expect(status).toBe(201);
    expect(run.status).toBe('RATIFIED');
    expect(run.mode).toBe('AUTONOMOUS');
    expect(run.actionTaken).toBeTruthy();
    expect(run.actionTaken).toContain(vendorB.name);
    // Bos koltuk: devredilecek gercek kisi yok -> devir gorevi OLUSMAMALI (sessizce
    // yanlis birime dusmek yerine) — virtualAgentService.ts targetUser?.unitId guard'i.
    expect(run.handoffTaskId).toBeNull();

    // ── Assert — DB durumu (oracle) ──────────────────────────────────────
    const refreshedA = await prisma.purchaseQuote.findUniqueOrThrow({ where: { id: quoteA.id } });
    const refreshedB = await prisma.purchaseQuote.findUniqueOrThrow({ where: { id: quoteB.id } });
    expect(refreshedA.isSelected).toBe(false);
    expect(refreshedB.isSelected).toBe(true);

    const refreshedPr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: pr.id } });
    expect(refreshedPr.selectedVendorId).toBe(vendorB.id);
    expect(refreshedPr.selectedVendorName).toBe(vendorB.name);

    const persistedRun = await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(persistedRun.status).toBe('RATIFIED');
    expect(persistedRun.pluginKey).toBe('AGENT_PROCUREMENT');
    expect(persistedRun.handoffTaskId).toBeNull();

    const logs = await prisma.activityLog.findMany({ where: { tenantId, agentRunId: run.id }, orderBy: { timestamp: 'asc' } });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('AGENT_RUN');
    expect(actions).toContain('AGENT_ACTION');
    for (const log of logs) expect(log.actorType).toBe('AGENT');
  });
});
