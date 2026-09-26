import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { setupScenarioEnv, teardownScenarioEnv, type ScenarioEnv } from '../helpers/scenarioSetup';

// /uploads erişimi: oturum zorunlu + dosya bir kiracının kaydına bağlıysa yalnız o kiracı erişir.
describe('/uploads koruması', () => {
  const PORT = 3115;
  let env: ScenarioEnv;
  let otherToken: string;
  const uploadsDir = path.resolve(__dirname, '../../../backend/uploads/contracts/__e2e_guard__');
  const ownedName = 'owned.txt';
  const looseName = 'loose.txt';

  const get = async (p: string, token?: string) => {
    const res = await fetch(`${env.backend.baseUrl}${p}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: res.status, text: await res.text() };
  };

  beforeAll(async () => {
    env = await setupScenarioEnv('uploads-guard', PORT);
    const { bootstrapTenant } = await import('../../../backend/src/services/bootstrapTenant');
    const b = await bootstrapTenant({
      companyName: 'Diğer Kiracı U', tenantId: 'uploads-guard-other',
      admin: { name: 'Other GM', email: `other-u-${Date.now()}@e2e.test`, password: 'test1234' },
    });
    otherToken = b.token;

    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, ownedName), 'GİZLİ SÖZLEŞME İÇERİĞİ');
    fs.writeFileSync(path.join(uploadsDir, looseName), 'bağlı olmayan dosya');
    const wf = await env.prisma.contractWorkflow.create({ data: { tenantId: env.tenantId, title: 'Upload WF', updatedAt: new Date() } });
    await env.prisma.contractWorkflowDoc.create({
      data: { workflowId: wf.id, tenantId: env.tenantId, name: 'Evrak', docType: 'OTHER', status: 'UPLOADED', fileUrl: `/uploads/contracts/__e2e_guard__/${ownedName}` },
    });
  });
  afterAll(async () => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    await teardownScenarioEnv(env);
  });

  const owned = `/uploads/contracts/__e2e_guard__/${ownedName}`;
  const loose = `/uploads/contracts/__e2e_guard__/${looseName}`;

  it('oturumsuz istek 401 (dosya içeriği sızmaz)', async () => {
    const r = await get(owned);
    expect(r.status).toBe(401);
    expect(r.text).not.toContain('GİZLİ');
  });

  it('sahibi kiracı erişir (200)', async () => {
    const r = await get(owned, env.gmToken);
    expect(r.status).toBe(200);
    expect(r.text).toContain('GİZLİ SÖZLEŞME İÇERİĞİ');
  });

  it('başka kiracının dosyasına erişemez (403, içerik sızmaz)', async () => {
    const r = await get(owned, otherToken);
    expect(r.status).toBe(403);
    expect(r.text).not.toContain('GİZLİ');
  });

  it('hiçbir kayda bağlı olmayan dosya oturumlu kullanıcıya açık (meşru indirmeleri kırmamak için)', async () => {
    expect((await get(loose, env.gmToken)).status).toBe(200);
    expect((await get(loose)).status).toBe(401);
  });

  it('indirme başlıkları korunur: attachment + nosniff', async () => {
    const res = await fetch(`${env.backend.baseUrl}${owned}`, { headers: { Authorization: `Bearer ${env.gmToken}` } });
    expect(res.headers.get('content-disposition')).toBe('attachment');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('yol geçişi (..) reddedilir', async () => {
    const r = await get('/uploads/contracts/__e2e_guard__/..%2f..%2f..%2fpackage.json', env.gmToken);
    expect([400, 403, 404]).toContain(r.status);
    expect(r.text).not.toContain('"name"');
  });
});
