import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { prisma } from '../prismaClient';

const router: Router = Router();
const GM = requireRole(['GENERAL_MANAGER']);

const TEST_DIR     = path.join(__dirname, '../../../tests/rbac');
const RESULTS_FILE = path.join(TEST_DIR, 'test-results/results.json');

// ── GET /api/admin/security-test/results ─────────────────────────────────
router.get('/results', tenantMiddleware, GM, asyncHandler(async (_req: Request, res: Response) => {
  if (!fs.existsSync(RESULTS_FILE)) {
    return res.json({ hasResults: false });
  }
  const raw = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  res.json({ hasResults: true, data: raw });
}));

// ── POST /api/admin/security-test/run ─────────────────────────────────────
router.post('/run', tenantMiddleware, GM, asyncHandler(async (_req: Request, res: Response) => {
  if (!fs.existsSync(TEST_DIR)) {
    return res.status(404).json({ error: 'Test dizini bulunamadı: ' + TEST_DIR });
  }

  await new Promise<void>((resolve, reject) => {
    exec(
      'pnpm test',
      { cwd: TEST_DIR, timeout: 150_000 },
      (error, _stdout, stderr) => {
        // Playwright test başarısız olduğunda exit code 1 döner — bu normal.
        // Gerçek hata: test çalıştırılamadı (ENOENT, timeout, vb.)
        if (error && error.code !== 1 && !fs.existsSync(RESULTS_FILE)) {
          reject(new Error(stderr || error.message));
        } else {
          resolve();
        }
      }
    );
  });

  if (!fs.existsSync(RESULTS_FILE)) {
    return res.status(500).json({ error: 'Test çalıştı ancak sonuç dosyası oluşturulamadı.' });
  }

  const raw = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  res.json({ hasResults: true, data: raw });
}));

// ── DELETE /api/admin/security-test/cleanup ───────────────────────────────
// Test koşusundan kalan tüm "RBAC Test*" kayıtlarını siler.
router.delete('/cleanup', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tid = req.tenantId;

  // Sipariş kalemleri (DmoOrderItem), DmoOrder silinince onCascade ile gitmiyorsa
  // önce onları temizle (FK hatasını önlemek için orders'tan önce silinir).
  const dmoOrderIds = (
    await prisma.dmoOrder.findMany({
      where: { tenantId: tid, orderNo: { startsWith: 'RBAC-TEST' } },
      select: { id: true },
    })
  ).map((o) => o.id);

  const [
    users, opportunities, contractWorkflows, units,
    dmoOrderItems, dmoOrders, dmoAgreements, dmoCatalogItems,
  ] = await Promise.all([
    prisma.user.deleteMany({
      where: { tenantId: tid, email: { contains: 'rbac-test' } },
    }),
    prisma.opportunity.deleteMany({
      where: { tenantId: tid, title: { startsWith: 'RBAC Test' } },
    }),
    prisma.contractWorkflow.deleteMany({
      where: { tenantId: tid, title: { startsWith: 'RBAC Test' } },
    }),
    prisma.unit.deleteMany({
      where: { tenantId: tid, name: { startsWith: 'RBAC Test' } },
    }),
    // 2026-08-03 eklendi — DMO Birimi RBAC senaryoları için:
    prisma.dmoOrderItem.deleteMany({
      where: { orderId: { in: dmoOrderIds } },
    }),
    prisma.dmoOrder.deleteMany({
      where: { tenantId: tid, orderNo: { startsWith: 'RBAC-TEST' } },
    }),
    prisma.dmoFrameworkAgreement.deleteMany({
      where: { tenantId: tid, agreementNo: { startsWith: 'RBAC-TEST' } },
    }),
    prisma.dmoCatalogItem.deleteMany({
      where: { tenantId: tid, dmoCode: { startsWith: 'RBAC-TEST' } },
    }),
  ]);

  res.json({
    deleted: {
      users: users.count,
      opportunities: opportunities.count,
      contractWorkflows: contractWorkflows.count,
      units: units.count,
      dmoOrderItems: dmoOrderItems.count,
      dmoOrders: dmoOrders.count,
      dmoAgreements: dmoAgreements.count,
      dmoCatalogItems: dmoCatalogItems.count,
    },
  });
}));

export default router;
