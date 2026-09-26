import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';

// P1-5 route sözleşme testleri: kritik router'ların HTTP kontratı — kimlik doğrulama, doğrulama (400),
// rol kapısı, tenant izolasyonu (başka kiracı 404 / listede görmez), alan şifreleme (DB'de enc:v1:) ve
// denetim izi. Backend gerçek bir süreçte, izole SQLite'ta koşar (tests/e2e-scenario altyapısı).
describe('Route sözleşmeleri', () => {
  const PORT = 3111;
  let env: ScenarioEnv;
  let otherToken: string;
  let other: string;

  beforeAll(async () => {
    env = await setupScenarioEnv('route-contracts', PORT);
    // İkinci kiracı: aynı DB'de, servis katmanıyla (POST /setup/init kurulu sistemde 403 döner)
    const { bootstrapTenant } = await import('../../../backend/src/services/bootstrapTenant');
    const b = await bootstrapTenant({
      companyName: 'Diğer Kiracı', tenantId: 'route-contracts-other',
      admin: { name: 'Other GM', email: `other-${Date.now()}@e2e.test`, password: 'test1234' },
    });
    otherToken = b.token;
    other = b.tenantId;
  });
  afterAll(async () => teardownScenarioEnv(env));

  const gm = () => env.api.withToken(env.gmToken);
  const otherApi = () => env.api.withToken(otherToken);

  describe('kimlik doğrulama', () => {
    const LISTS = ['/customers', '/vendors', '/purchase-requests', '/tenders', '/finance/invoices', '/projects',
      '/opportunities', '/contract-workflows', '/approval-chains', '/tasks'];
    for (const path of LISTS) {
      it(`GET ${path} — tokensiz 401`, async () => {
        const r = await env.api.get(path);
        expect(r.status).toBe(401);
      });
      it(`GET ${path} — GM 200`, async () => {
        const r = await gm().get(path);
        expect(r.status).toBe(200);
      });
    }
  });

  describe('customers', () => {
    let id: string;

    it('oluşturur; vergi no DB\'de şifreli, API düz metin döner; denetim izi yazılır', async () => {
      const r = await gm().post<{ id: string; taxNumber: string }>('/customers', { name: 'Kontrat Müşteri A.Ş.', taxNumber: '1234567890', taxOffice: 'Kadıköy' });
      expect(r.status).toBe(200);
      expect(r.body.taxNumber).toBe('1234567890');
      id = r.body.id;
      const row = await env.prisma.customer.findUnique({ where: { id } });
      expect(row?.taxNumber?.startsWith('enc:v1:')).toBe(true);
      expect(row?.taxOffice?.startsWith('enc:v1:')).toBe(true);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'CUSTOMER', entityId: id, action: 'CREATE' } });
      expect(log).not.toBeNull();
    });

    it('listede düz metin döner', async () => {
      const r = await gm().get<{ id: string; taxNumber: string }[]>('/customers');
      expect(r.body.find((c) => c.id === id)?.taxNumber).toBe('1234567890');
    });

    it('geçersiz parentId 400', async () => {
      const r = await gm().post('/customers', { name: 'Yetim Şube', parentId: 'yok-boyle-id' });
      expect(r.status).toBe(400);
    });

    it('rol kapısı: PRESALES oluşturamaz (403)', async () => {
      const unit = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.technical);
      const u = await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role: 'PRESALES_ENG', unitId: unit });
      const r = await env.api.withToken(u.token).post('/customers', { name: 'İzinsiz' });
      expect(r.status).toBe(403);
    });

    it('izolasyon: başka kiracı listede görmez, PUT/DELETE 404', async () => {
      const list = await otherApi().get<{ id: string }[]>('/customers');
      expect(list.body.find((c) => c.id === id)).toBeUndefined();
      expect((await otherApi().put(`/customers/${id}`, { name: 'Ele geçirildi' })).status).toBe(404);
      expect((await otherApi().delete(`/customers/${id}`)).status).toBe(404);
      const row = await env.prisma.customer.findUnique({ where: { id } });
      expect(row?.name).toBe('Kontrat Müşteri A.Ş.');
    });

    it('günceller ve siler (denetim izi ile)', async () => {
      expect((await gm().put(`/customers/${id}`, { name: 'Kontrat Müşteri Yeni' })).status).toBe(200);
      expect((await gm().delete(`/customers/${id}`)).status).toBe(200);
      expect(await env.prisma.customer.findUnique({ where: { id } })).toBeNull();
      const actions = (await env.prisma.activityLog.findMany({ where: { tenantId: env.tenantId, entityType: 'CUSTOMER', entityId: id } })).map((l) => l.action).sort();
      expect(actions).toEqual(['CREATE', 'DELETE', 'UPDATE']);
    });
  });

  describe('vendors', () => {
    let id: string;
    it('ad zorunlu (400)', async () => {
      expect((await gm().post('/vendors', {})).status).toBe(400);
    });
    it('oluşturur; IBAN DB\'de şifreli, API düz döner', async () => {
      const r = await gm().post<{ id: string; iban: string }>('/vendors', { name: 'Kontrat Tedarikçi', iban: 'TR000000000000000000000001', bankName: 'Banka' });
      expect(r.status).toBe(201);
      expect(r.body.iban).toBe('TR000000000000000000000001');
      id = r.body.id;
      const row = await env.prisma.vendor.findUnique({ where: { id } });
      expect(row?.iban?.startsWith('enc:v1:')).toBe(true);
    });
    it('izolasyon: başka kiracı listede görmez', async () => {
      const list = await otherApi().get<{ id: string }[]>('/vendors');
      expect(list.body.find((v) => v.id === id)).toBeUndefined();
    });
  });

  describe('tenders', () => {
    let id: string;
    it('ad zorunlu (400)', async () => {
      expect((await gm().post('/tenders', {})).status).toBe(400);
    });
    it('teslim süresi verilince 4 aşamalı takvim üretir', async () => {
      const r = await gm().post<{ id: string }>('/tenders', { name: 'Kontrat İhale', expectedDeliveryDays: 60 });
      expect(r.status).toBe(200);
      id = r.body.id;
      const steps = await env.prisma.deliveryTimelineStep.findMany({ where: { tenderId: id }, orderBy: { sortOrder: 'asc' } });
      expect(steps.length).toBe(4);
    });
    it('izolasyon: başka kiracı GET/PUT/DELETE 404', async () => {
      expect((await otherApi().get(`/tenders/${id}`)).status).toBe(404);
      expect((await otherApi().put(`/tenders/${id}`, { name: 'x' })).status).toBe(404);
      expect((await otherApi().delete(`/tenders/${id}`)).status).toBe(404);
    });
  });

  describe('purchase-requests', () => {
    let id: string;
    it('başlık zorunlu (400)', async () => {
      expect((await gm().post('/purchase-requests', {})).status).toBe(400);
    });
    it('kalemlerle oluşturur (201) ve denetim izi yazar', async () => {
      const r = await gm().post<{ id: string; items: unknown[] }>('/purchase-requests', { title: 'Kontrat PR', items: [{ name: 'Kalem', quantity: 3 }] });
      expect(r.status).toBe(201);
      expect(r.body.items.length).toBe(1);
      id = r.body.id;
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'PURCHASE_REQUEST', entityId: id } });
      expect(log?.action).toBe('CREATE');
    });
    it('izolasyon: başka kiracı GET 404, onaylayamaz', async () => {
      expect((await otherApi().get(`/purchase-requests/${id}`)).status).toBe(404);
      const a = await otherApi().post(`/purchase-requests/${id}/approve`, {});
      expect([403, 404]).toContain(a.status);
      const row = await env.prisma.purchaseRequest.findUnique({ where: { id } });
      expect(row?.status).toBe('DRAFT');
    });
  });

  describe('tenant sızıntısı taraması', () => {
    it('ikinci kiracının listeleri, birinci kiracıya ait hiçbir kayıt içermez', async () => {
      for (const path of ['/customers', '/vendors', '/purchase-requests', '/tenders', '/finance/invoices', '/projects', '/opportunities', '/tasks']) {
        const r = await otherApi().get<unknown[] | { data?: unknown[] }>(path);
        expect(r.status, path).toBe(200);
        const rows = Array.isArray(r.body) ? r.body : (r.body.data ?? []);
        for (const row of rows as { tenantId?: string }[]) expect(row.tenantId === undefined || row.tenantId === other, path).toBe(true);
      }
    });
  });
});
