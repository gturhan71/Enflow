import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { previewDocumentNumber } from '../services/documentNumberService';

const router: Router = Router();

// ── Doküman Kodlama Profili ─────────────────────────────────────────────────
// Her tenant'ın TEK bir profili olur. Hiçbir varsayılan önek/kategori gömülü
// değildir — tenant kendi notasyonunu girene kadar docNumber üretilmez.

// GET / → profil + kategori sözlüğü + canlı önizleme (yoksa profile:null)
router.get('/profile', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const [profile, categories] = await Promise.all([
    prisma.documentCodingProfile.findUnique({ where: { tenantId } }),
    prisma.documentCategoryCode.findMany({ where: { tenantId }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const preview = profile
    ? await previewDocumentNumber(tenantId, categories[0]?.code || 'ORN')
    : null;
  res.json({ profile, categories, preview });
}));

// PUT /profile → profili oluştur/güncelle (upsert)
router.put('/profile', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const { companyCode, separator, includeYear, sequenceDigits, isActive } = req.body;

  const data = {
    companyCode: typeof companyCode === 'string' ? companyCode.trim() : '',
    separator: typeof separator === 'string' && separator.length > 0 ? separator : '-',
    includeYear: includeYear !== false,
    sequenceDigits: Math.min(10, Math.max(1, Number(sequenceDigits) || 5)),
    isActive: isActive !== false,
  };

  const profile = await prisma.documentCodingProfile.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
  const preview = await previewDocumentNumber(tenantId, 'ORN');
  res.json({ profile, preview });
}));

// ── Kategori Sözlüğü ────────────────────────────────────────────────────────

router.get('/categories', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.documentCategoryCode.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(categories);
}));

router.post('/categories', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { code, label, sortOrder } = req.body;
  if (!code || !label) return res.status(400).json({ error: 'Kategori kodu ve açıklaması zorunlu.' });

  const exists = await prisma.documentCategoryCode.findFirst({
    where: { tenantId: req.tenantId, code: String(code).trim() },
  });
  if (exists) return res.status(409).json({ error: 'Bu kategori kodu zaten tanımlı.' });

  const category = await prisma.documentCategoryCode.create({
    data: {
      tenantId: req.tenantId,
      code: String(code).trim(),
      label: String(label).trim(),
      sortOrder: Number(sortOrder) || 0,
    },
  });
  res.json(category);
}));

router.put('/categories/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { code, label, sortOrder } = req.body;

  const record = await prisma.documentCategoryCode.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kategori bulunamadı.' });

  const category = await prisma.documentCategoryCode.update({
    where: { id },
    data: {
      code: code !== undefined ? String(code).trim() : record.code,
      label: label !== undefined ? String(label).trim() : record.label,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : record.sortOrder,
    },
  });
  res.json(category);
}));

router.delete('/categories/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.documentCategoryCode.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'Kategori bulunamadı.' });
  await prisma.documentCategoryCode.delete({ where: { id } });
  res.json({ message: 'Kategori silindi.' });
}));

export default router;
