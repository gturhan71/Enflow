import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIsolatedTestDb, destroyTestDb } from '../helpers/testDb';
import { startBackend, type RunningBackend } from '../helpers/backendProcess';
import { getPrisma, type Db } from '../helpers/prisma';
import { ApiClient } from '../helpers/apiClient';
import { bootstrapTenant } from '../fixtures/tenantFactory';

// Senaryo: BACKUP-PLATFORM-SCOPE-TENANT-ISOLATION
// Hata (2026-09-26, 10x avı): tenant-1'in GM'si `POST /api/backup/jobs` (scope varsayılan PLATFORM)
// ile TÜM kiracıların verisini (kullanıcı parola hash'leri dahil) tek dosyada alıp indirebiliyordu.
// Oracle: çok kiracılı kurulumda PLATFORM kapsamı API'den kullanılamaz; varsayılan TENANT olur ve
// indirilen dosya yalnız çağıran kiracının satırlarını içerir. Tek kiracılıda eski davranış korunur.
describe('BACKUP-PLATFORM-SCOPE-TENANT-ISOLATION', () => {
  const PORT = 3106;
  let dbHandle: { absPath: string; databaseUrl: string };
  let backend: RunningBackend;
  let prisma: Db;
  let api: ApiClient;
  let tenantId: string;
  let backupDir: string;

  beforeAll(async () => {
    dbHandle = createIsolatedTestDb('backup-scope-isolation');
    backend = await startBackend({ databaseUrl: dbHandle.databaseUrl, port: PORT });
    prisma = await getPrisma(dbHandle.databaseUrl);
    const boot = await bootstrapTenant(new ApiClient(backend.baseUrl), 'E2E Backup Tenant 1');
    tenantId = boot.tenantId;
    api = new ApiClient(backend.baseUrl).withToken(boot.token);
    backupDir = mkdtempSync(join(tmpdir(), 'e2e-backup-'));
    await prisma.customer.create({ data: { id: 'own-c1', name: 'Kendi Müşterim', tenantId } });
  });

  afterAll(async () => {
    await backend?.stop();
    if (dbHandle?.absPath) destroyTestDb(dbHandle.absPath);
    if (backupDir) rmSync(backupDir, { recursive: true, force: true });
  });

  let singleTenantPlatformJobId = '';

  it('TEK kiracı: varsayılan PLATFORM yedeği çalışır (eski davranış korunur)', async () => {
    const { status, body } = await api.post<{ id: string; scope: string; status: string }>('/backup/jobs', { kind: 'DATA', location: backupDir });
    expect(status).toBe(200);
    expect(body.scope).toBe('PLATFORM');
    expect(body.status).toBe('COMPLETED');
    singleTenantPlatformJobId = body.id;
  });

  describe('ÇOK kiracı (ikinci kiracı + verisi eklendi)', () => {
    beforeAll(async () => {
      await prisma.tenant.create({ data: { id: 'other-tenant', name: 'Başka Şirket' } });
      await prisma.customer.create({ data: { id: 'other-c1', name: 'GIZLI-BASKA-KIRACI-MUSTERISI', tenantId: 'other-tenant' } });
    });

    it('scope belirtilmezse varsayılan TENANT olur; indirilen dosya YALNIZ kendi kiracısını içerir', async () => {
      const { status, body } = await api.post<{ id: string; scope: string; status: string }>('/backup/jobs', { kind: 'DATA', location: backupDir });
      expect(status).toBe(200);
      expect(body.scope).toBe('TENANT');
      const dl = await fetch(`${backend.baseUrl}/api/backup/jobs/${body.id}/download`, { headers: { Authorization: `Bearer ${(api as unknown as { token: string }).token}` } });
      expect(dl.status).toBe(200);
      const text = await dl.text();
      expect(text).toContain('Kendi Müşterim');
      expect(text).not.toContain('GIZLI-BASKA-KIRACI-MUSTERISI');
      expect(text).not.toContain('other-tenant');
    });

    it('açıkça PLATFORM istenirse 403', async () => {
      const { status, body } = await api.post<{ error: string }>('/backup/jobs', { scope: 'PLATFORM', kind: 'DATA', location: backupDir });
      expect(status).toBe(403);
      expect(body.error).toMatch(/PLATFORM/);
    });

    it('tek kiracıyken alınmış eski PLATFORM yedeği artık indirilemez / geri yüklenemez (403)', async () => {
      const dl = await api.get<{ error: string }>(`/backup/jobs/${singleTenantPlatformJobId}/download`);
      expect(dl.status).toBe(403);
      const an = await api.post<{ error: string }>('/backup/restore/analyze', { backupId: singleTenantPlatformJobId });
      expect(an.status).toBe(403);
    });

    it('zamanlanmış ayarda PLATFORM kaydedilemez (400)', async () => {
      const { status } = await api.put('/backup/settings', { enabled: true, intervalHours: 24, scope: 'PLATFORM' });
      expect(status).toBe(400);
    });
  });
});
