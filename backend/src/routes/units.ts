import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';

const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_PRESALES = requireRole(['GENERAL_MANAGER', 'PRESALES_ENG']);
const router: Router = Router();

router.get('/', tenantMiddleware, GM_OR_PRESALES, asyncHandler(async (req: Request, res: Response) => {
  const units = await prisma.unit.findMany({
    where: { tenantId: req.tenantId },
    include: { users: true }
  });
  res.json(units);
}));

router.post('/', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, managerId } = req.body;
  const unit = await prisma.unit.create({
    data: { name, description, managerId, tenantId: req.tenantId }
  });
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

  res.json({ message: 'Kullanıcılar başarıyla taşındı ve birim silindi.' });
}));

export default router;
