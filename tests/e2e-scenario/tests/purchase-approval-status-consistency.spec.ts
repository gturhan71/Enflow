import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { deactivateUser } from '../fixtures/staffingFactory';
import { hashTestPassword } from '../helpers/authHelpers';

// Oracle: docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md Tablo 1 satir 8 (PURCHASE_APPROVAL) + §6.2.
// Asama sirasi: (role:null,"Birim onayı",unit=top)(0) -> PROCUREMENT_MGR(1) -> GENERAL_MANAGER(2).
// DUZELTME UYGULANDI (backend/src/routes/purchaseRequests.ts /:id/approve): PR.status
// artik "pr.status + 1 sabit adim" DEGIL, advanceProcess SONRASI zincirin GERCEK
// durumundan turetiliyor.
describe('PE-08 PURCHASE_APPROVAL — status tutarlılığı (regresyon koruması)', () => {
  const PORT = 3105;
  let env: ScenarioEnv;

  beforeAll(async () => { env = await setupScenarioEnv('purchase-approval-status', PORT); });
  afterAll(async () => teardownScenarioEnv(env));

  it('PE-08-ALL-ORPHAN: tum 3 asama da bos koltuk (agent yok/ADVISORY) -> tek /approve cagrisinda DRAFT dogrudan PO_ISSUED\'a atlar (eski kodda yanlislikla PENDING_UNIT\'te kalirdi)', async () => {
    // GM'i devre disi birak -> stage0 (unit=top, role:null) VE stage2 (GENERAL_MANAGER)
    // orphan olur (agent yok, her ikisi de SKIPPED beklenir). PROCUREMENT_MGR de hic
    // staflanmiyor (agent yok -> SKIPPED). Uc asama da AYNI cagrida cozulmeli.
    await deactivateUser(env.prisma, env.gmUserId);

    // Tetikleyici cagriyi yapacak notr bir kullanici (rol kapisi yok, herhangi
    // authenticated aktif kullanici yeterli — bkz. purchaseRequests.ts router.use).
    const hashed = await hashTestPassword('test1234');
    const requester = await env.prisma.user.create({
      data: { tenantId: env.tenantId, name: 'E2E Requester', email: `requester-${Date.now()}@e2e.test`, password: hashed, role: 'SALES_REP', status: 'ACTIVE', permissions: '[]' },
    });
    const login = await env.api.post<{ token: string }>('/auth/login', { email: requester.email, password: 'test1234' });
    expect(login.status).toBe(200);

    const pr = await env.prisma.purchaseRequest.create({
      data: { tenantId: env.tenantId, title: 'E2E PR — tam boş koltuk', requestedBy: requester.id, status: 'DRAFT' },
    });

    const res = await env.api.withToken(login.body.token).post<{ status: string; poNumber?: string | null }>(`/purchase-requests/${pr.id}/approve`, {});
    expect(res.status).toBe(200);

    // DUZELTME DOGRULAMASI: eski kodda burada 'PENDING_UNIT' donerdi (yanlis —
    // zincir aslinda AYNI cagrida tamamen COMPLETED olmustu). Artik gercek durumu
    // yansitiyor.
    expect(res.body.status).toBe('PO_ISSUED');
    expect(res.body.poNumber).toBeTruthy();

    // NOT: PR.status===PO_ISSUED oldugu icin PURCHASE_TO_COST_ITEM sureci de AYNI
    // cagrida tetiklendi — ayni entityType/entityId icin BIRDEN FAZLA chain var,
    // bu yuzden processKey'e gore ACIKCA filtreleniyor (generic getChain() en
    // SON olusan chain'i donerdi, PURCHASE_APPROVAL'i degil).
    const chain = await env.prisma.approvalChain.findFirstOrThrow({
      where: { tenantId: env.tenantId, entityType: 'PURCHASE_REQUEST', entityId: pr.id, processKey: 'PURCHASE_APPROVAL' },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    expect(chain.status).toBe('COMPLETED');
    expect(chain.stages).toHaveLength(3);
    for (const s of chain.stages) {
      expect(s.status, `order ${s.order} (role=${s.role}) beklenmedik durumda`).toBe('SKIPPED');
    }
  });
});
