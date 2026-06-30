import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { DEFAULT_UNITS } from '../services/bootstrapTenant';
import { ensureDefaultWorkflow } from '../services/workflowTemplateService';

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

// Varsayılan şablonu yükle (idempotent): eksik şablon birimlerini ekler + varsayılan
// iş akışını oluşturur. Mevcut birimlere/iş akışına dokunmaz (isimle eşleşeni atlar).
router.post('/seed-defaults', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.unit.findMany({ where: { tenantId: req.tenantId }, select: { name: true } });
  const have = new Set(existing.map((u) => norm(u.name)));

  const created: { id: string; name: string }[] = [];
  for (const u of DEFAULT_UNITS) {
    if (have.has(norm(u.name))) continue; // mevcut birime dokunma
    const unit = await prisma.unit.create({ data: { name: u.name, description: u.description, tenantId: req.tenantId } });
    created.push({ id: unit.id, name: unit.name });
  }

  // Varsayılan iş akışı (birimlerden türetilir; zaten varsa mevcudu döner).
  const workflow = await ensureDefaultWorkflow(req.tenantId);

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'SEED_TEMPLATE', entityType: 'UNIT', entityId: req.tenantId, details: { addedUnits: created.length, workflowId: workflow.id } });
  res.json({ addedUnits: created, addedCount: created.length, workflowId: workflow.id, workflowName: workflow.name });
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

export default router;
