// Enflow — İlk-çalıştırma kurulum endpoint'leri (AÇIK ama boş-DB-kilitli).
// Boş bir kurulumda ilk tenant + GM kullanıcısını oluşturur. Sistemde en az bir
// kullanıcı varsa init kilitlenir (403) — sonradan kötüye kullanım engellenir.
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler } from '../middleware';
import { bootstrapTenant } from '../services/bootstrapTenant';

const router: Router = Router();

// Sistem kurulu mu? (en az bir TENANT/şirket tanımlıysa kurulu sayılır — başıboş
// kullanıcı kayıtlarından etkilenmez; semantik olarak "bir şirket kurulu mu").
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.count();
  res.json({ initialized: tenants > 0 });
}));

// İlk kurulum — yalnız tenant yokken. Tenant + varsayılan birimler + ilk GM + abonelik (lisans/deneme).
router.post('/init', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.tenant.count();
  if (existing > 0) return res.status(403).json({ error: 'Sistem zaten kurulmuş. Kurulum tekrar çalıştırılamaz.' });

  const { company, admin, license } = req.body as { company?: { name?: string }; admin?: { name?: string; email?: string; password?: string }; license?: string };
  try {
    const result = await bootstrapTenant({
      companyName: company?.name || '',
      admin: { name: admin?.name || '', email: admin?.email || '', password: admin?.password || '' },
      license: license || undefined,
    });
    res.json(result);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    res.status(err.status || 500).json({ error: err.message || 'Kurulum başarısız.' });
  }
}));

export default router;
