import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';

// P1-5 route sözleşme testleri: kritik router'ların HTTP kontratı — kimlik doğrulama, doğrulama (400),
// rol kapısı, tenant izolasyonu (başka kiracı 404 / listede görmez), alan şifreleme (DB'de enc:v1:) ve
// denetim izi. Backend gerçek bir süreçte, izole SQLite'ta koşar (tests/e2e-scenario altyapısı).
// Not: her spec dosyası kendi Prisma singleton'ını/DB'sini kurar (vitest dosya izolasyonu) — tek dosyada iki describe AYNI DB'yi paylaşır.
// ── P1-5 (2/2): finance / opportunities / contract-workflows / approval-chains ──
describe('Route sözleşmeleri — finance / opportunities / contract-workflows / approval-chains', () => {
  const PORT = 3112;
  let env: ScenarioEnv;
  let otherToken: string;

  beforeAll(async () => {
    env = await setupScenarioEnv('route-contracts-2', PORT);
    const { bootstrapTenant } = await import('../../../backend/src/services/bootstrapTenant');
    const b = await bootstrapTenant({
      companyName: 'Diğer Kiracı 2', tenantId: 'route-contracts-other-2',
      admin: { name: 'Other GM', email: `other2-${Date.now()}@e2e.test`, password: 'test1234' },
    });
    otherToken = b.token;
  });
  afterAll(async () => teardownScenarioEnv(env));

  const gm = () => env.api.withToken(env.gmToken);
  const otherApi = () => env.api.withToken(otherToken);
  const userWithRole = async (role: string, unitKey: string) => {
    const unit = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY[unitKey]);
    return createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role, unitId: unit });
  };

  describe('approval-chains', () => {
    let chainId: string;
    it('doğrulama: entityType/entityId/stage zorunlu (400)', async () => {
      expect((await gm().post('/approval-chains', { entityType: 'OPPORTUNITY' })).status).toBe(400);
    });
    it('GM oluşturur', async () => {
      const r = await gm().post<{ id: string }>('/approval-chains', { entityType: 'OPPORTUNITY', entityId: 'fake-opp-1', stages: [{ role: 'GENERAL_MANAGER' }] });
      expect(r.status).toBe(200);
      chainId = r.body.id;
    });
    it('izolasyon: başka kiracı GET/DELETE 404', async () => {
      expect((await otherApi().get(`/approval-chains/${chainId}`)).status).toBe(404);
      expect((await otherApi().delete(`/approval-chains/${chainId}`)).status).toBe(404);
    });
    it('yetki: onay zincirini rolü olmayan bir kullanıcı SİLEMEZ', async () => {
      const presales = await userWithRole('PRESALES_ENG', 'technical');
      const r = await env.api.withToken(presales.token).delete(`/approval-chains/${chainId}`);
      expect([401, 403]).toContain(r.status);
      expect(await env.prisma.approvalChain.findUnique({ where: { id: chainId } })).not.toBeNull();
    });
    it('yetki: rolü olmayan kullanıcı SAHTE onay zinciri OLUŞTURAMAZ', async () => {
      const presales = await userWithRole('PRESALES_ENG', 'technical');
      const r = await env.api.withToken(presales.token).post('/approval-chains', { entityType: 'OPPORTUNITY', entityId: 'fake-opp-2', stages: [{ role: 'GENERAL_MANAGER' }] });
      expect([401, 403]).toContain(r.status);
    });
  });
  describe('finance/invoices', () => {
    let invId: string;
    it('tutar zorunlu (400)', async () => {
      expect((await gm().post('/finance/invoices', { type: 'SALES' })).status).toBe(400);
    });
    it('geçersiz müşteri 404', async () => {
      expect((await gm().post('/finance/invoices', { amount: 100, customerId: 'yok' })).status).toBe(404);
    });
    it('oluşturur; tutar zorunlu ödeme; fazla ödeme allowOverpayment olmadan 400, ile 200', async () => {
      const c = await gm().post<{ id: string; invoiceNo?: string }>('/finance/invoices', { type: 'SALES', amount: 1000, invoiceNo: 'KNT-1' });
      expect(c.status).toBe(200);
      invId = c.body.id;
      expect((await gm().post(`/finance/invoices/${invId}/payments`, {})).status).toBe(400);
      expect((await gm().post(`/finance/invoices/${invId}/payments`, { amount: 400 })).status).toBe(200);
      const over = await gm().post(`/finance/invoices/${invId}/payments`, { amount: 900 });
      expect(over.status).toBe(400);
      expect((await gm().post(`/finance/invoices/${invId}/payments`, { amount: 900, allowOverpayment: true })).status).toBe(200);
      const pays = await env.prisma.payment.findMany({ where: { invoiceId: invId } });
      expect(pays.length).toBe(2);
      expect(pays.some((p) => (p.notes ?? '').includes('Fazla ödeme'))).toBe(true);
    });
    it('izolasyon: başka kiracı PUT/DELETE/ödeme 404, kayıt korunur', async () => {
      expect((await otherApi().put(`/finance/invoices/${invId}`, { amount: 1 })).status).toBe(404);
      expect((await otherApi().delete(`/finance/invoices/${invId}`)).status).toBe(404);
      expect((await otherApi().get(`/finance/invoices/${invId}/payments`)).status).toBe(404);
      expect((await otherApi().post(`/finance/invoices/${invId}/payments`, { amount: 1 })).status).toBe(404);
      const row = await env.prisma.invoice.findUnique({ where: { id: invId } });
      expect(row?.amount).toBe(1000);
    });
  });

  describe('opportunities', () => {
    let salesRep: { id: string; token: string };
    let customerId: string;
    let oppId: string;
    beforeAll(async () => {
      salesRep = await userWithRole('SALES_REP', 'sales');
      const c = await gm().post<{ id: string }>('/customers', { name: 'Fırsat Müşterisi' });
      customerId = c.body.id;
    });
    it('rol kapısı: GM fırsat oluşturamaz (yalnız SALES_REP)', async () => {
      expect((await gm().post('/opportunities', { title: 'x', customerId })).status).toBe(403);
    });
    it('başlık+müşteri zorunlu, geçersiz status 400', async () => {
      const api = env.api.withToken(salesRep.token);
      expect((await api.post('/opportunities', { title: 'Eksik' })).status).toBe(400);
      expect((await api.post('/opportunities', { title: 'X', customerId, status: 'YOK' })).status).toBe(400);
    });
    it('oluşturan kişiye atanır; takip kodu üretilir; istemci assignedToId yok sayılır', async () => {
      const r = await env.api.withToken(salesRep.token).post<{ id: string; trackingCode: string; assignedToId: string }>('/opportunities',
        { title: 'Kontrat Fırsat', customerId, value: 5000, assignedToId: env.gmUserId });
      expect(r.status).toBe(200);
      expect(r.body.assignedToId).toBe(salesRep.id);
      expect(r.body.trackingCode).toBeTruthy();
      oppId = r.body.id;
    });
    it('izolasyon: başka kiracı PUT 404; geçersiz status 400', async () => {
      expect((await otherApi().put(`/opportunities/${oppId}`, { title: 'Ele geçirildi' })).status).toBe(404);
      expect((await gm().put(`/opportunities/${oppId}`, { status: 'YOK' })).status).toBe(400);
      const row = await env.prisma.opportunity.findUnique({ where: { id: oppId } });
      expect(row?.title).toBe('Kontrat Fırsat');
    });
    it('başka kiracı listede görmez', async () => {
      const l = await otherApi().get<{ id: string }[]>('/opportunities');
      expect(l.body.find((o) => o.id === oppId)).toBeUndefined();
    });
  });

  describe('contract-workflows', () => {
    let id: string;
    it('rol kapısı: PRESALES_ENG erişemez (403)', async () => {
      const p = await userWithRole('PRESALES_ENG', 'technical');
      expect((await env.api.withToken(p.token).get('/contract-workflows')).status).toBe(403);
    });
    it('başlığı ihale adı + İKN\'den oluşturur', async () => {
      const r = await gm().post<{ id: string; title: string }>('/contract-workflows', { tenderName: 'Kontrat İhalesi', tenderNo: '2026/77' });
      expect(r.status).toBe(200);
      expect(r.body.title).toBe('Kontrat İhalesi — İKN: 2026/77');
      id = r.body.id;
    });
    it('izolasyon: başka kiracı GET/PUT/DELETE 404', async () => {
      expect((await otherApi().get(`/contract-workflows/${id}`)).status).toBe(404);
      expect((await otherApi().put(`/contract-workflows/${id}`, { title: 'x' })).status).toBe(404);
      expect((await otherApi().delete(`/contract-workflows/${id}`)).status).toBe(404);
      expect(await env.prisma.contractWorkflow.findUnique({ where: { id } })).not.toBeNull();
    });
    it('siler ve denetim izi yazar', async () => {
      expect((await gm().delete(`/contract-workflows/${id}`)).status).toBe(200);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'CONTRACT_WORKFLOW', entityId: id, action: 'DELETE' } });
      expect(log).not.toBeNull();
    });
  });
});
