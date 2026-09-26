import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';
import { createStaffedUser, getUnitId, UNIT_NAME_BY_KEY } from '../fixtures/staffingFactory';

// P1-5 route sözleşmeleri (4): users / legal / backup — kimlik, rol kapısı, tenant izolasyonu,
// hassas alan sızıntısı (parola hash / gizli anahtar), yedek içeriği izolasyonu.
describe('Route sözleşmeleri — users / legal / backup', () => {
  const PORT = 3114;
  let env: ScenarioEnv;
  let otherToken: string;
  let otherUserId: string;
  let otherUnitId: string;
  const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enflow-rc4-'));

  beforeAll(async () => {
    env = await setupScenarioEnv('route-contracts-4', PORT);
    const { bootstrapTenant } = await import('../../../backend/src/services/bootstrapTenant');
    const b = await bootstrapTenant({
      companyName: 'Diğer Kiracı 4', tenantId: 'route-contracts-other-4',
      admin: { name: 'Other GM', email: `other4-${Date.now()}@e2e.test`, password: 'test1234' },
    });
    otherToken = b.token;
    otherUserId = b.user.id;
    otherUnitId = (await env.prisma.unit.findFirst({ where: { tenantId: b.tenantId } }))!.id;
  });
  afterAll(async () => { await teardownScenarioEnv(env); fs.rmSync(tmpBackupDir, { recursive: true, force: true }); });

  const gm = () => env.api.withToken(env.gmToken);
  const otherApi = () => env.api.withToken(otherToken);
  const userWithRole = async (role: string, unitKey: string) => {
    const unit = await getUnitId(env.prisma, env.tenantId, UNIT_NAME_BY_KEY[unitKey]);
    return { ...(await createStaffedUser(env.prisma, env.api, { tenantId: env.tenantId, role, unitId: unit })), unit };
  };

  describe('kimlik doğrulama', () => {
    for (const path of ['/users', '/users/me', '/legal/cases', '/legal/requests', '/backup/jobs', '/backup/settings']) {
      it(`GET ${path} — tokensiz 401`, async () => { expect((await env.api.get(path)).status).toBe(401); });
    }
  });

  describe('users', () => {
    let sales: { id: string; token: string; unit: string };
    beforeAll(async () => { sales = await userWithRole('SALES_REP', 'sales'); });

    it('liste yalnız GM: parola hash\'i asla dönmez, izinler dizi', async () => {
      const r = await gm().get<Record<string, unknown>[]>('/users');
      expect(r.status).toBe(200);
      for (const u of r.body) {
        expect(u).not.toHaveProperty('password');
        expect(Array.isArray(u.permissions)).toBe(true);
      }
      expect((await env.api.withToken(sales.token).get('/users')).status).toBe(403);
    });

    it('/me: kendi kaydı, parolasız', async () => {
      const r = await env.api.withToken(sales.token).get<Record<string, unknown>>('/users/me');
      expect(r.status).toBe(200);
      expect(r.body.id).toBe(sales.id);
      expect(r.body).not.toHaveProperty('password');
    });

    it('oluşturma doğrulaması: kısa parola 400; rolsüz kullanıcı 403; başarılı → varsayılan izinler + denetim izi', async () => {
      expect((await gm().post('/users', { name: 'A', email: 'a@x.test', role: 'SALES_REP', password: '123' })).status).toBe(400);
      expect((await env.api.withToken(sales.token).post('/users', { name: 'A', email: 'a2@x.test', role: 'SALES_REP', password: '123456' })).status).toBe(403);
      const r = await gm().post<{ id: string; permissions: string[] }>('/users', { name: 'Yeni', email: `yeni-${Date.now()}@x.test`, role: 'SALES_REP', password: '123456' });
      expect(r.status).toBe(200);
      expect(r.body.permissions.length).toBeGreaterThan(0);
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'USER', entityId: r.body.id, action: 'CREATE' } });
      expect(log).not.toBeNull();
    });

    it('başka kiracıda kayıtlı e-posta ile oluşturma 500 değil, açık bir 4xx döner', async () => {
      const email = `dup-${Date.now()}@x.test`;
      await gm().post('/users', { name: 'D1', email, role: 'SALES_REP', password: '123456' });
      const r = await otherApi().post('/users', { name: 'D2', email, role: 'SALES_REP', password: '123456' });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    });

    it('çapraz-kiracı referans: başka kiracının birimi / kullanıcısı atanamaz', async () => {
      const r1 = await gm().post('/users', { name: 'C1', email: `c1-${Date.now()}@x.test`, role: 'SALES_REP', password: '123456', unitId: otherUnitId });
      expect(r1.status, 'yabancı unitId ile oluşturma').toBeGreaterThanOrEqual(400);
      const r2 = await gm().put(`/users/${sales.id}`, { delegateToUserId: otherUserId, delegateUntil: new Date(Date.now() + 86_400_000).toISOString() });
      expect(r2.status, 'yabancı kullanıcıya vekalet').toBeGreaterThanOrEqual(400);
      const row = await env.prisma.user.findUnique({ where: { id: sales.id } });
      expect(row?.delegateToUserId).not.toBe(otherUserId);
    });

    it('devir: yabancı kiracı kullanıcısına devredilemez; kendi hesabı silinemez; izolasyon 404', async () => {
      const r = await gm().post(`/users/${sales.id}/transfer`, { toUserId: otherUserId });
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      const self = await gm().delete(`/users/${env.gmUserId}`);
      expect(self.status, JSON.stringify(self.body)).toBe(400);
      expect((await otherApi().put(`/users/${sales.id}`, { name: 'Ele geçirildi' })).status).toBe(404);
      expect((await otherApi().delete(`/users/${sales.id}`)).status).toBe(404);
      expect((await env.prisma.user.findUnique({ where: { id: sales.id } }))?.name).not.toBe('Ele geçirildi');
    });

    it('lookup: role zorunlu (400); yalnız aktif ve kendi kiracısı; hassas alan yok', async () => {
      expect((await sales_api().get('/users/lookup')).status).toBe(400);
      const r = await sales_api().get<Record<string, unknown>[]>('/users/lookup?role=GENERAL_MANAGER');
      expect(r.status).toBe(200);
      expect(r.body.map((u) => u.id)).toContain(env.gmUserId);
      expect(r.body.map((u) => u.id)).not.toContain(otherUserId);
      for (const u of r.body) expect(Object.keys(u).sort()).toEqual(['id', 'name', 'unitId']);
    });
    const sales_api = () => env.api.withToken(sales.token);

    it('dashboard-layout: geçersiz veri 400; kendi düzenini kaydeder', async () => {
      expect((await sales_api().put('/users/me/dashboard-layout', { widgets: 'x' })).status).toBe(400);
      expect((await sales_api().put('/users/me/dashboard-layout', { widgets: [], order: [] })).status).toBe(200);
    });
  });

  describe('legal (hukuk vakaları — gizli görüşler)', () => {
    let caseId: string;

    it('GM vaka açar; başlık zorunlu; denetim izi', async () => {
      expect((await gm().post('/legal/cases', {})).status).toBe(400);
      const r = await gm().post<{ id: string }>('/legal/cases', { title: 'Kontrat Vakası', opinion: 'GİZLİ HUKUKİ GÖRÜŞ' });
      expect(r.status).toBe(200);
      caseId = r.body.id;
      const log = await env.prisma.activityLog.findFirst({ where: { tenantId: env.tenantId, entityType: 'LEGAL_CASE', entityId: caseId, action: 'CREATE' } });
      expect(log).not.toBeNull();
    });

    it('YETKİ: hukuk/sözleşme yönetimi rolü olmayan kullanıcı vakaları OKUYAMAZ/DEĞİŞTİREMEZ/SİLEMEZ', async () => {
      const rep = await userWithRole('SALES_REP', 'sales');
      const api = env.api.withToken(rep.token);
      expect([401, 403]).toContain((await api.get('/legal/cases')).status);
      expect([401, 403]).toContain((await api.post('/legal/cases', { title: 'İzinsiz' })).status);
      expect([401, 403]).toContain((await api.put(`/legal/cases/${caseId}`, { opinion: 'değişti' })).status);
      expect([401, 403]).toContain((await api.delete(`/legal/cases/${caseId}`)).status);
      expect((await env.prisma.legalCase.findUnique({ where: { id: caseId } }))?.opinion).toBe('GİZLİ HUKUKİ GÖRÜŞ');
    });

    it('LEGAL_MGR erişebilir (rol kapısı onu dışlamaz)', async () => {
      const lm = await userWithRole('LEGAL_MGR', 'legal');
      expect((await env.api.withToken(lm.token).get('/legal/cases')).status).toBe(200);
    });

    it('bağlı sözleşmenin zorunlu evrakı eksikken CLOSED 400; tamamlanınca 200 + closedAt', async () => {
      const wf = await env.prisma.contractWorkflow.create({
        data: { tenantId: env.tenantId, title: 'Hukuk WF', updatedAt: new Date(), documents: { create: [{ name: 'Zorunlu Evrak', docType: 'OTHER', isRequired: true, status: 'PENDING', sortOrder: 0, tenantId: env.tenantId }] } },
        include: { documents: true },
      });
      const c = await gm().post<{ id: string }>('/legal/cases', { title: 'Bağlı Vaka', relatedEntityType: 'CONTRACT_WORKFLOW', relatedEntityId: wf.id });
      expect((await gm().put(`/legal/cases/${c.body.id}`, { status: 'CLOSED' })).status).toBe(400);
      await env.prisma.contractWorkflowDoc.update({ where: { id: wf.documents[0].id }, data: { status: 'UPLOADED' } });
      expect((await gm().put(`/legal/cases/${c.body.id}`, { status: 'CLOSED' })).status).toBe(200);
      expect((await env.prisma.legalCase.findUnique({ where: { id: c.body.id } }))?.closedAt).not.toBeNull();
    });

    it('izolasyon: başka kiracı görmez / değiştiremez / silemez', async () => {
      const l = await otherApi().get<{ id: string }[]>('/legal/cases');
      expect(l.body.find((c) => c.id === caseId)).toBeUndefined();
      expect((await otherApi().put(`/legal/cases/${caseId}`, { title: 'x' })).status).toBe(404);
      expect((await otherApi().delete(`/legal/cases/${caseId}`)).status).toBe(404);
    });
  });

  describe('backup', () => {
    it('rol kapısı: yalnız GM/BACKUP_ADMIN (SALES_REP 403)', async () => {
      const rep = await userWithRole('SALES_REP', 'sales');
      const api = env.api.withToken(rep.token);
      for (const p of ['/backup/jobs', '/backup/settings', '/backup/restore']) expect((await api.get(p)).status, p).toBe(403);
      expect((await api.post('/backup/jobs', { scope: 'TENANT', kind: 'DATA', location: tmpBackupDir })).status).toBe(403);
    });

    let jobId: string;
    it('TENANT kapsamlı DATA yedeği yalnız KENDİ kiracısının satırlarını içerir (başka kiracı sızmaz)', async () => {
      const r = await gm().post<{ id: string; status: string; dataRef: string }>('/backup/jobs', { scope: 'TENANT', kind: 'DATA', targetType: 'LOCAL', location: tmpBackupDir });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('COMPLETED');
      jobId = r.body.id;
      const payload = JSON.parse(fs.readFileSync(r.body.dataRef, 'utf-8')) as { data: Record<string, { tenantId?: string; id?: string }[]> };
      const tenants = new Set<string>();
      for (const rows of Object.values(payload.data)) for (const row of rows) if (row.tenantId) tenants.add(row.tenantId);
      expect([...tenants]).toEqual([env.tenantId]);
      expect(payload.data.User.map((u) => u.id)).not.toContain(otherUserId);
    });

    it('izolasyon: başka kiracı işi göremez, doğrulayamaz, indiremez, geri yükleme analizi yapamaz', async () => {
      const l = await otherApi().get<{ id: string }[]>('/backup/jobs');
      expect(l.body.find((j) => j.id === jobId)).toBeUndefined();
      expect((await otherApi().get(`/backup/jobs/${jobId}`)).status).toBe(404);
      expect((await otherApi().post(`/backup/jobs/${jobId}/verify`, {})).status).toBe(404);
      expect((await otherApi().get(`/backup/jobs/${jobId}/download`)).status).toBe(404);
      expect((await otherApi().post('/backup/restore/analyze', { backupId: jobId })).status).toBe(404);
    });

    it('restore/analyze backupId zorunlu (400)', async () => {
      expect((await gm().post('/backup/restore/analyze', {})).status).toBe(400);
    });

    it('ayarlar: gizli anahtarlar/parolalar yanıtta ASLA dönmez, yalnız hasSecret/hasPassword', async () => {
      const put = await gm().put<Record<string, unknown>>('/backup/settings', {
        enabled: false, targetType: 'S3',
        s3: { bucket: 'b', accessKeyId: 'AKIA-TEST', secretAccessKey: 'SUPER-SECRET-VALUE' },
        nextcloud: { url: 'https://nc.example', username: 'u', appPassword: 'NC-APP-PASSWORD' },
      });
      expect(put.status).toBe(200);
      const get = await gm().get<Record<string, unknown>>('/backup/settings');
      for (const body of [put.body, get.body]) {
        const s = JSON.stringify(body);
        expect(s).not.toContain('SUPER-SECRET-VALUE');
        expect(s).not.toContain('NC-APP-PASSWORD');
      }
      expect((get.body.s3 as { hasSecret: boolean }).hasSecret).toBe(true);
      expect((get.body.nextcloud as { hasPassword: boolean }).hasPassword).toBe(true);
    });

    it('ayarlar: boş sır gönderilince mevcut korunur', async () => {
      await gm().put('/backup/settings', { s3: { bucket: 'b2', secretAccessKey: '' } });
      const get = await gm().get<{ s3: { hasSecret: boolean; bucket: string } }>('/backup/settings');
      expect(get.body.s3.bucket).toBe('b2');
      expect(get.body.s3.hasSecret).toBe(true);
    });
  });
});
