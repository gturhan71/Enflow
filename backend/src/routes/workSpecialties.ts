// Profesyonel Hizmetler teknisyen uzmanlık taksonomisi — tenant bazlı
// (bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md). `productTaxonomy.ts` ile aynı
// desen: düzenleme GM-only, okuma tüm tenant kullanıcılarına açık (WorkOrder
// modülünde teknisyen ataması/filtresi herkes için görünür olmalı).
import { Router, Request, Response } from 'express';
import { prisma, runManagedTransaction } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

const editRoles = requireRole(['GENERAL_MANAGER']);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const specialties = await prisma.workSpecialty.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(specialties);
}));

router.post('/', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'Uzmanlık alanı adı zorunludur.' });
  const specialty = await prisma.workSpecialty.create({ data: { tenantId: req.tenantId, name: name.trim() } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'WORK_SPECIALTY', entityId: specialty.id, details: { name: specialty.name } });
  res.status(201).json(specialty);
}));

router.put('/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };
  const specialty = await prisma.workSpecialty.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { name: name?.trim() || undefined, isActive: isActive ?? undefined },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'WORK_SPECIALTY', entityId: String(req.params.id), details: { name: specialty.name } });
  res.json(specialty);
}));

router.delete('/:id', editRoles, asyncHandler(async (req: Request, res: Response) => {
  // Soft delete — WorkOrder.requiredSpecialtyId onDelete:SetNull; hard-delete
  // veri kaybettirmez ama geçmiş kayıtların etiketini sessizce sıfırlar.
  await prisma.workSpecialty.update({ where: { id: String(req.params.id), tenantId: req.tenantId }, data: { isActive: false } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'WORK_SPECIALTY', entityId: String(req.params.id) });
  res.json({ ok: true });
}));

// ── Teknisyen ↔ Uzmanlık ataması ────────────────────────────────────────────
router.get('/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const owns = await prisma.user.findFirst({ where: { id: userId, tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const rows = await prisma.userWorkSpecialty.findMany({ where: { userId }, select: { specialtyId: true } });
  res.json(rows.map((r) => r.specialtyId));
}));

router.put('/users/:userId', editRoles, asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  const { specialtyIds } = req.body as { specialtyIds?: string[] };
  const owns = await prisma.user.findFirst({ where: { id: userId, tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const ids = Array.isArray(specialtyIds) ? specialtyIds : [];
  // Gönderilen id'lerin gerçekten bu tenant'a ait olduğunu doğrula (IDOR koruması).
  const validIds = ids.length
    ? (await prisma.workSpecialty.findMany({ where: { id: { in: ids }, tenantId: req.tenantId }, select: { id: true } })).map((s) => s.id)
    : [];

  await runManagedTransaction(async (tx) => {
    await tx.userWorkSpecialty.deleteMany({ where: { userId } });
    if (validIds.length) {
      await tx.userWorkSpecialty.createMany({ data: validIds.map((specialtyId) => ({ userId, specialtyId })) });
    }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'USER_WORK_SPECIALTY', entityId: userId, details: { specialtyIds: validIds } });
  res.json(validIds);
}));

export default router;
