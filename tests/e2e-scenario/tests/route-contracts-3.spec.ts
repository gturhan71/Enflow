import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';

// P1-5 route sözleşmeleri (3): projects / tasks / workflows — kimlik, doğrulama, rol kapısı,
// tenant izolasyonu, mass-assignment ve iş kuralları. (Not: her spec dosyası kendi DB/Prisma'sını kurar.)
describe('Route sözleşmeleri — projects / tasks / workflows', () => {
  const PORT = 3113;
  let env: ScenarioEnv;
  let otherToken: string;
  let otherTenantId: string;

  beforeAll(async () => {
    env = await setupScenarioEnv('route-contracts-3', PORT);
    const { bootstrapTenant } = await import('../../../backend/src/services/bootstrapTenant');
    const b = await bootstrapTenant({
      companyName: 'Diğer Kiracı 3', tenantId: 'route-contracts-other-3',
      admin: { name: 'Other GM', email: `other3-${Date.now()}@e2e.test`, password: 'test1234' },
    });
    otherToken = b.token;
    otherTenantId = b.tenantId;
  });
  afterAll(async () => teardownScenarioEnv(env));

  const gm = () => env.api.withToken(env.gmToken);
  const otherApi = () => env.api.withToken(otherToken);
  const userWithRole = async (role: string, unitKey: string) => {
    const unit = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY[unitKey]);
    return { ...(await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role, unitId: unit })), unit };
  };

  describe('kimlik doğrulama', () => {
    for (const path of ['/workflows', '/tasks', '/projects', '/projects/summary/all']) {
      it(`GET ${path} — tokensiz 401`, async () => { expect((await env.api.get(path)).status).toBe(401); });
    }
  });

  describe('workflows (süreç tasarımcısı)', () => {
    let wfId: string;
    let unitId: string;
    beforeAll(async () => { unitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales); });

    it('GM özel süreç oluşturur (denetim izi); aynı processKey 409; geçersiz entityType 400', async () => {
      const step = { unitId, type: 'MANUAL', description: 'Adım 1', role: 'SALES_MGR' };
      const r = await gm().post<{ id: string }>('/workflows', { name: 'Kontrat Süreci', processKey: 'CUSTOM_KONTRAT', entityType: 'PROJECT', steps: [step] });
      expect(r.status).toBe(200);
      wfId = r.body.id;
      expect((await gm().post('/workflows', { name: 'Yinelenen', processKey: 'CUSTOM_KONTRAT', steps: [step] })).status).toBe(409);
      expect((await gm().post('/workflows', { name: 'Kötü', entityType: 'YOK', steps: [step] })).status).toBe(400);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'WORKFLOW', entityId: wfId, action: 'CREATE' } });
      expect(log).not.toBeNull();
    });

    it('YETKİ: rolsüz kullanıcı süreç tanımı OLUŞTURAMAZ/DEĞİŞTİREMEZ/SİLEMEZ (onay adımlarını kaldırıp onayı atlatabilir)', async () => {
      const p = await userWithRole('PRESALES_ENG', 'technical');
      const api = env.api.withToken(p.token);
      const step = { unitId, type: 'AUTO', description: 'Onaysız', role: null };
      expect([401, 403]).toContain((await api.post('/workflows', { name: 'Sahte', steps: [step] })).status);
      expect([401, 403]).toContain((await api.put(`/workflows/${wfId}`, { name: 'Ele geçirildi', steps: [step] })).status);
      expect([401, 403]).toContain((await api.delete(`/workflows/${wfId}`)).status);
      const row = await env.prisma.workflow.findUnique({ where: { id: wfId } });
      expect(row?.name).toBe('Kontrat Süreci');
    });

    it('izolasyon: başka kiracı PUT/DELETE 404', async () => {
      expect((await otherApi().put(`/workflows/${wfId}`, { name: 'x', steps: [] })).status).toBe(404);
      expect((await otherApi().delete(`/workflows/${wfId}`)).status).toBe(404);
    });

    it('trigger: entityId zorunlu 400, bilinen süreç modülden tetiklenir 403, bilinmeyen 404', async () => {
      expect((await gm().post('/workflows/CUSTOM_KONTRAT/trigger', {})).status).toBe(400);
      expect((await gm().post('/workflows/OPPORTUNITY_TO_PROJECT/trigger', { entityId: 'x' })).status).toBe(403);
      expect((await gm().post('/workflows/YOK_BOYLE/trigger', { entityId: 'x' })).status).toBe(404);
    });

    it('GM siler', async () => {
      expect((await gm().delete(`/workflows/${wfId}`)).status).toBe(200);
      expect(await env.prisma.workflow.findUnique({ where: { id: wfId } })).toBeNull();
    });
  });

  describe('tasks', () => {
    let salesMgr: { id: string; token: string; unit: string };
    let taskId: string;
    beforeAll(async () => { salesMgr = await userWithRole('SALES_MGR', 'sales'); });

    it('oluşturur: tenant sunucudan atanır (gövdedeki tenantId yok sayılır); SLA iş günü → dueDate; atanana bildirim', async () => {
      const r = await gm().post<{ id: string; tenantId: string; dueDate: string | null }>('/tasks', {
        title: 'Kontrat Görevi', unitId: salesMgr.unit, assignedBy: env.gmUserId, assignedToUserId: salesMgr.id,
        slaBusinessDays: 3, tenantId: otherTenantId,
      });
      expect(r.status).toBe(200);
      expect(r.body.tenantId).toBe(env.tenantId);
      expect(r.body.dueDate).toBeTruthy();
      taskId = r.body.id;
      const n = await env.prisma.notification.findFirst({ where: { tenantId: env.tenantId, userId: salesMgr.id, type: 'TASK' } });
      expect(n).not.toBeNull();
    });

    it('MASS-ASSIGNMENT: PUT gövdesindeki tenantId görevi başka kiracıya TAŞIYAMAZ', async () => {
      const r = await gm().put(`/tasks/${taskId}`, { tenantId: otherTenantId, title: 'Taşındı' });
      expect([200, 400, 403]).toContain(r.status);
      const row = await env.prisma.todoTask.findUnique({ where: { id: taskId } });
      expect(row?.tenantId).toBe(env.tenantId);
    });

    it('COMPLETED → completedAt set; yeniden açılınca temizlenir', async () => {
      await gm().put(`/tasks/${taskId}`, { status: 'COMPLETED' });
      expect((await env.prisma.todoTask.findUnique({ where: { id: taskId } }))?.completedAt).not.toBeNull();
      await gm().put(`/tasks/${taskId}`, { status: 'IN_PROGRESS' });
      expect((await env.prisma.todoTask.findUnique({ where: { id: taskId } }))?.completedAt).toBeNull();
    });

    it('listeleme: GM hepsini, ilgisiz rol yalnız kendi/birim görevlerini görür', async () => {
      const outsider = await userWithRole('PRESALES_ENG', 'technical');
      const all = await gm().get<{ id: string }[]>('/tasks');
      expect(all.body.find((t) => t.id === taskId)).toBeTruthy();
      const mine = await env.api.withToken(outsider.token).get<{ id: string }[]>('/tasks');
      expect(mine.body.find((t) => t.id === taskId)).toBeUndefined();
    });

    it('atama yetkisi: ilgisiz kullanıcı başkasının görevini başkasına ATAYAMAZ (403)', async () => {
      const outsider = await userWithRole('PRESALES_ENG', 'technical');
      const r = await env.api.withToken(outsider.token).put(`/tasks/${taskId}`, { assignedToUserId: outsider.id });
      expect(r.status).toBe(403);
    });

    it('izolasyon: başka kiracı PUT/DELETE 404, başka kiracı listesinde yok', async () => {
      expect((await otherApi().put(`/tasks/${taskId}`, { title: 'x' })).status).toBe(404);
      expect((await otherApi().delete(`/tasks/${taskId}`)).status).toBe(404);
      const l = await otherApi().get<{ id: string }[]>('/tasks');
      expect(l.body.find((t) => t.id === taskId)).toBeUndefined();
    });

    it('siler ve denetim izi yazar', async () => {
      expect((await gm().delete(`/tasks/${taskId}`)).status).toBe(200);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'TASK', entityId: taskId, action: 'DELETE' } });
      expect(log).not.toBeNull();
    });
  });

  describe('projects', () => {
    let pid: string;
    it('GM proje oluşturur (201): tip şablonundan milestone üretir, kod atanır, denetim izi', async () => {
      const r = await gm().post<{ id: string; code?: string; milestones: unknown[] }>('/projects', { name: 'Kontrat Projesi', type: 'SOFTWARE', totalValue: 1000 });
      expect(r.status).toBe(201);
      pid = r.body.id;
      expect(r.body.milestones.length).toBeGreaterThan(0);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'PROJECT', entityId: pid, action: 'CREATE' } });
      expect(log).not.toBeNull();
    });

    it('alt kaynak doğrulaması: milestone başlık, maliyet açıklama zorunlu (400)', async () => {
      expect((await gm().post(`/projects/${pid}/milestones`, {})).status).toBe(400);
      expect((await gm().post(`/projects/${pid}/costs`, {})).status).toBe(400);
      expect((await gm().post(`/projects/${pid}/milestones`, { title: 'Ek Aşama' })).status).toBe(201);
      expect((await gm().post(`/projects/${pid}/costs`, { description: 'Kalem', plannedAmount: 10 })).status).toBe(201);
    });

    it('izolasyon: başka kiracı proje ve TÜM alt kaynaklarında 404, veri korunur', async () => {
      for (const [m, path] of [
        ['get', `/projects/${pid}`], ['put', `/projects/${pid}`], ['delete', `/projects/${pid}`],
        ['get', `/projects/${pid}/milestones`], ['post', `/projects/${pid}/milestones`],
        ['get', `/projects/${pid}/costs`], ['post', `/projects/${pid}/costs`],
        ['get', `/projects/${pid}/handover-docs`], ['get', `/projects/${pid}/participations`],
      ] as const) {
        const api = otherApi();
        const r = m === 'get' ? await api.get(path) : m === 'delete' ? await api.delete(path) : m === 'put' ? await api.put(path, { name: 'x' }) : await api.post(path, { title: 'x', description: 'x' });
        expect(r.status, `${m.toUpperCase()} ${path}`).toBe(404);
      }
      expect((await env.prisma.project.findUnique({ where: { id: pid } }))?.name).toBe('Kontrat Projesi');
    });

    it('katılım payı yalnız GM/FINANCE_MGR; ilgisiz rol 403', async () => {
      const p = await userWithRole('PRESALES_ENG', 'technical');
      const unitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
      expect((await env.api.withToken(p.token).post(`/projects/${pid}/participations`, { unitId, coefficient: 0.5 })).status).toBe(403);
      expect((await gm().post(`/projects/${pid}/participations`, { unitId, coefficient: 2 })).status).toBe(200);
      const row = await env.prisma.projectUnitParticipation.findFirst({ where: { projectId: pid, unitId } });
      expect(row?.coefficient).toBe(1);   // katsayı [0,1] aralığına kırpılır
      expect((await gm().post(`/projects/${pid}/participations`, {})).status).toBe(400);
    });

    it('IDOR: başka kiracının GM\'i katılım payını SİLEMEZ (404), kayıt korunur', async () => {
      const unitId = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY.sales);
      const part = await env.prisma.projectUnitParticipation.findFirst({ where: { projectId: pid, unitId } });
      expect(part).not.toBeNull();
      expect((await otherApi().delete(`/projects/${pid}/participations/${part!.id}`)).status).toBe(404);
      expect(await env.prisma.projectUnitParticipation.findUnique({ where: { id: part!.id } })).not.toBeNull();
    });

    it('YETKİ: proje modülü izni olmayan rol projeyi DEĞİŞTİREMEZ/SİLEMEZ', async () => {
      const p = await userWithRole('PRESALES_ENG', 'technical');
      const api = env.api.withToken(p.token);
      expect([401, 403]).toContain((await api.put(`/projects/${pid}`, { name: 'Ele geçirildi' })).status);
      expect([401, 403]).toContain((await api.delete(`/projects/${pid}`)).status);
      expect((await env.prisma.project.findUnique({ where: { id: pid } }))?.name).toBe('Kontrat Projesi');
    });

    it('GM siler (denetim izi)', async () => {
      expect((await gm().delete(`/projects/${pid}`)).status).toBe(200);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'PROJECT', entityId: pid, action: 'DELETE' } });
      expect(log).not.toBeNull();
    });
  });
});
