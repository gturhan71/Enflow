import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';
import { encryptForTenant, decryptForTenant } from '../services/tenantEncryption';

const router: Router = Router();
router.use(tenantMiddleware);

// iban/bankName DB'de şifreli saklanır (bkz. tenantEncryption.ts) — listede çözülüp dönülür.
async function decryptVendor<T extends { iban: string | null; bankName: string | null }>(tenantId: string, vendor: T): Promise<T> {
  const [iban, bankName] = await Promise.all([
    decryptForTenant(tenantId, vendor.iban),
    decryptForTenant(tenantId, vendor.bankName),
  ]);
  return { ...vendor, iban, bankName };
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    include: { brands: true },
    orderBy: { name: 'asc' },
  });
  res.json(await Promise.all(vendors.map((v) => decryptVendor(req.tenantId, v))));
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxNo, address, phone, email, contactName, iban, bankName, categories, notes, brandIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Tedarikçi adı zorunludur.' });

  const [encIban, encBankName] = await Promise.all([
    encryptForTenant(req.tenantId, iban || null),
    encryptForTenant(req.tenantId, bankName || null),
  ]);
  const vendor = await prisma.vendor.create({
    data: {
      tenantId: req.tenantId,
      name,
      taxNo: taxNo || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      contactName: contactName || null,
      iban: encIban,
      bankName: encBankName,
      categories: JSON.stringify(categories ?? []),
      notes: notes || null,
      ...(Array.isArray(brandIds) ? { brands: { connect: brandIds.map((id: string) => ({ id })) } } : {}),
    },
    include: { brands: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'VENDOR', entityId: vendor.id, details: { name: vendor.name } });
  res.status(201).json(await decryptVendor(req.tenantId, vendor));
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name, taxNo, address, phone, email, contactName, iban, bankName, categories, rating, notes, isActive, brandIds } = req.body;
  const [encIban, encBankName] = await Promise.all([
    encryptForTenant(req.tenantId, iban ?? null),
    encryptForTenant(req.tenantId, bankName ?? null),
  ]);
  const vendor = await prisma.vendor.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      name,
      taxNo: taxNo ?? null,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      contactName: contactName ?? null,
      iban: encIban,
      bankName: encBankName,
      categories: categories !== undefined ? JSON.stringify(categories) : undefined,
      rating: rating ?? null,
      notes: notes ?? null,
      isActive: isActive ?? true,
      // brandIds gönderildiyse TAMAMEN yerine koy (set) — checkbox listesinin doğal davranışı
      ...(Array.isArray(brandIds) ? { brands: { set: brandIds.map((id: string) => ({ id })) } } : {}),
    },
    include: { brands: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPDATE', entityType: 'VENDOR', entityId: String(req.params.id), details: { name: vendor.name } });
  res.json(await decryptVendor(req.tenantId, vendor));
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
