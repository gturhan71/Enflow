import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { DEFAULT_UNITS } from '../services/bootstrapTenant';

const GM = requireRole(['GENERAL_MANAGER']);
// Birim listesi okuma — GM + Presales + Yedek Yöneticisi (salt-okunur akış dahli)
const GM_OR_PRESALES = requireRole(['GENERAL_MANAGER', 'PRESALES_ENG', 'BACKUP_ADMIN']);
const router: Router = Router();

const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');

router.get('/', tenantMiddleware, GM_OR_PRESALES, asyncHandler(async (req: Request, res: Response) => {
  const units = await prisma.unit.findMany({
    where: { tenantId: req.tenantId },
    include: { users: true }
  });
  res.json(units);
}));

// Varsayılan şablonu yükle (idempotent): eksik şablon birimlerini ekler. Mevcut
// birimlere dokunmaz (isimle eşleşeni atlar). Faz B öncesi burada ayrıca
// "varsayılan iş akışı" da otomatik üretilirdi (ensureDefaultWorkflow) — bu,
// Süreç Motoru'nun "tenant açıkça kurgulamadıkça hiçbir süreç yok" ilkesiyle
// çelişen ölü/çelişkili koddu, kaldırıldı (bkz. workflowTemplateService.ts silme
// gerekçesi). Birimler eklendikten sonra tenant kendi süreçlerini Ayarlar →
// İş Akışı Tasarımcısı'ndan kurgular.
router.post('/seed-defaults', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unit.findMany({ where: { tenantId: req.tenantId }, select: { name: true } });
  const have = new Set(existing.map((u) => norm(u.name)));

  const created: { id: string; name: string }[] = [];
  for (const u of DEFAULT_UNITS) {
    if (have.has(norm(u.name))) continue; // mevcut birime dokunma
    const unit = await prisma.unit.create({ data: { name: u.name, description: u.description, tenantId: req.tenantId } });
    created.push({ id: unit.id, name: unit.name });
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'SEED_TEMPLATE', entityType: 'UNIT', entityId: req.tenantId, details: { addedUnits: created.length } });
  res.json({ addedUnits: created, addedCount: created.length });
}));

router.post('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, managerId, parentId } = req.body;
  const unit = await prisma.unit.create({
    data: { name, description, managerId: managerId || null, parentId: parentId || null, tenantId: req.tenantId }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'UNIT', entityId: unit.id, details: { name: unit.name } });
  res.json(unit);
}));

router.put('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.unit.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Birim bulunamadı.' });
  const { name, description, managerId, parentId } = req.body;
  // kendine parent olamaz
  const safeParent = parentId && parentId !== id ? parentId : (parentId === null || parentId === '' ? null : existing.parentId);
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (managerId !== undefined) data.managerId = managerId || null;
  if (parentId !== undefined) data.parentId = safeParent;
  const unit = await prisma.unit.update({ where: { id }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'UNIT', entityId: id, details: { name: unit.name, parentId: unit.parentId } });
  res.json(unit);
}));

router.delete('/:id', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;
  const { transferToUnitId } = req.body;

  const unit = await prisma.unit.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { users: true, steps: true } } }
  });

  if (!unit) return res.status(404).json({ error: 'Birim bulunamadı.' });

  if (unit._count.users > 0 && !transferToUnitId) {
    return res.status(400).json({
      error: 'TRANSFER_REQUIRED',
      message: `Bu birime kayıtlı ${unit._count.users} kullanıcı var. Silmeden önce kullanıcıları başka bir birime taşımalısınız.`
    });
  }

  if (unit._count.steps > 0) {
    return res.status(400).json({ error: 'Bu birim bir iş akışında kullanılıyor. Önce iş akışından çıkarın.' });
  }

  await prisma.$transaction(async (tx) => {
    if (transferToUnitId && unit._count.users > 0) {
      await tx.user.updateMany({
        where: { unitId: id, tenantId },
        data: { unitId: transferToUnitId }
      });
    }
    await tx.unit.delete({ where: { id } });
  });

  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'UNIT', entityId: id, details: { name: unit.name, transferToUnitId: transferToUnitId || null } });
  res.json({ message: 'Kullanıcılar başarıyla taşındı ve birim silindi.' });
}));

// ── Birim Bütçesi (UnitBudget) — Faz 1 (maliyet merkezi) ─────────────────────
const BUDGET_ROLES = requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']);
const bnum = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

router.get('/budgets', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const budgets = await prisma.unitBudget.findMany({ where: { tenantId: req.tenantId }, orderBy: { periodStart: 'desc' } });
  res.json(budgets);
}));

router.get('/:id/budget', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const budgets = await prisma.unitBudget.findMany({ where: { tenantId: req.tenantId, unitId: String(req.params.id) }, orderBy: { periodStart: 'desc' } });
  res.json(budgets);
}));

router.post('/:id/budget', tenantMiddleware, BUDGET_ROLES, asyncHandler(async (req: Request, res: Response) => {
  const unitId = String(req.params.id);
  const unit = await prisma.unit.findFirst({ where: { id: unitId, tenantId: req.tenantId } });
  if (!unit) return res.status(404).json({ error: 'Birim bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const personnelBudget = bnum(b.personnelBudget), opexBudget = bnum(b.opexBudget);
  const budget = await prisma.unitBudget.create({
    data: {
      tenantId: req.tenantId, unitId,
      periodStart: new Date(String(b.periodStart)), periodEnd: new Date(String(b.periodEnd)),
      personnelBudget, opexBudget, totalBudget: personnelBudget + opexBudget,
      periodCost: bnum(b.periodCost), notes: b.notes ? String(b.notes) : null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'UNIT_BUDGET', entityId: budget.id, details: { unitId, totalBudget: budget.totalBudget } });
  res.json(budget);
}));

router.put('/budgets/:bid', tenantMiddleware, BUDGET_ROLES, asyncHandler(async (req: Request, res: Response) => {
  const bid = String(req.params.bid);
  const rec = await prisma.unitBudget.findFirst({ where: { id: bid, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Bütçe bulunamadı.' });
  const b = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const k of ['personnelBudget', 'opexBudget', 'periodCost']) if (b[k] !== undefined) data[k] = bnum(b[k]);
  for (const k of ['periodStart', 'periodEnd']) if (b[k] !== undefined) data[k] = new Date(String(b[k]));
  if (b.notes !== undefined) data.notes = b.notes === null ? null : String(b.notes);
  const pb = data.personnelBudget !== undefined ? Number(data.personnelBudget) : rec.personnelBudget;
  const ob = data.opexBudget !== undefined ? Number(data.opexBudget) : rec.opexBudget;
  data.totalBudget = pb + ob;
  const budget = await prisma.unitBudget.update({ where: { id: bid }, data });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'UNIT_BUDGET', entityId: bid });
  res.json(budget);
}));

router.delete('/budgets/:bid', tenantMiddleware, BUDGET_ROLES, asyncHandler(async (req: Request, res: Response) => {
  const bid = String(req.params.bid);
  const rec = await prisma.unitBudget.findFirst({ where: { id: bid, tenantId: req.tenantId } });
  if (!rec) return res.status(404).json({ error: 'Bütçe bulunamadı.' });
  await prisma.unitBudget.delete({ where: { id: bid } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'UNIT_BUDGET', entityId: bid });
  res.json({ message: 'Bütçe silindi.' });
}));

export default router;
