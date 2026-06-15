// global-teardown.ts — RBAC test koşusundan kalan test verilerini siler.
// Playwright tüm testler ve reporter'lar bittikten sonra bu dosyayı çalıştırır.

import fs from 'fs';
import path from 'path';

const authDir  = path.join(__dirname, 'auth');
const apiBase  = process.env.ENFLOW_API_URL ?? 'http://localhost:3002';

async function cleanup() {
  const tokenFile    = path.join(authDir, 'general_manager.token');
  const tenantFile   = path.join(authDir, 'general_manager.tenantId');

  if (!fs.existsSync(tokenFile)) {
    console.log('[teardown] GM token bulunamadı, cleanup atlandı.');
    return;
  }

  const token    = fs.readFileSync(tokenFile,  'utf-8').trim();
  const tenantId = fs.existsSync(tenantFile)
    ? fs.readFileSync(tenantFile, 'utf-8').trim()
    : 'tenant-1';

  try {
    const res = await fetch(`${apiBase}/api/admin/security-test/cleanup`, {
      method: 'DELETE',
      headers: {
        Authorization:  `Bearer ${token}`,
        'x-tenant-id':  tenantId,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[teardown] Cleanup yanıtı: ${res.status} ${res.statusText}`);
      return;
    }

    const result = await res.json() as { deleted: Record<string, number> };
    const totals = Object.entries(result.deleted)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    console.log(`[teardown] ✔ Test verileri silindi — ${totals}`);
  } catch (err) {
    console.warn('[teardown] Cleanup başarısız (backend kapalı olabilir):', (err as Error).message);
  }
}

export default cleanup;
