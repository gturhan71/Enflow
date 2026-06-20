import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(vendors);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxNo, address, phone, email, contactName, iban, bankName, categories, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Tedarikçi adı zorunludur.' });

  const vendor = await prisma.vendor.create({
    data: {
      tenantId: req.tenantId,
      name,
      taxNo: taxNo || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      contactName: contactName || null,
      iban: iban || null,
      bankName: bankName || null,
      categories: JSON.stringify(categories ?? []),
      notes: notes || null,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'VENDOR', entityId: vendor.id, details: { name: vendor.name } });
  res.status(201).json(vendor);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxNo, address, phone, email, contactName, iban, bankName, categories, rating, notes, isActive } = req.body;
  const vendor = await prisma.vendor.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      name,
      taxNo: taxNo ?? null,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      contactName: contactName ?? null,
      iban: iban ?? null,
      bankName: bankName ?? null,
      categories: categories !== undefined ? JSON.stringify(categories) : undefined,
      rating: rating ?? null,
      notes: notes ?? null,
      isActive: isActive ?? true,
    },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'VENDOR', entityId: String(req.params.id), details: { name: vendor.name } });
  res.json(vendor);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  // Soft delete
  await prisma.vendor.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { isActive: false },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'VENDOR', entityId: String(req.params.id) });
  res.json({ ok: true });
}));

export default router;
