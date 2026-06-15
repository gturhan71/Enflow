import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';

const router: Router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Şirket adı zorunludur.' });

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({ data: { name } });
    await tx.subscription.create({ data: { tenantId: newTenant.id, plan: 'STARTER' } });
    return newTenant;
  });

  res.json(tenant);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const tenant = await prisma.tenant.update({
    where: { id: req.params.id as string },
    data: { name }
  });
  res.json(tenant);
}));

router.put('/:id/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const { plan } = req.body;

  if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ error: 'Geçersiz plan tipi.' });
  }

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: tenantId as string },
    update: { plan },
    create: { tenantId: tenantId as string, plan }
  });

  res.json(subscription);
}));

// ── Lisans aktivasyonu ─────────────────────────────────────────────────────
router.post('/activate-license', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body as { licenseKey: string };
  if (!licenseKey) return res.status(400).json({ error: 'Lisans anahtarı zorunludur.' });

  let payload: {
    tenantId: string;
    companyName: string;
    model: string;
    expiryDate: string;
    isTrial?: boolean;
    limits: { users: number; storage: number };
    signature: string;
  };

  try {
    payload = JSON.parse(Buffer.from(licenseKey, 'base64').toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Geçersiz lisans anahtarı formatı.' });
  }

  // Tenant uniqueness check — anahtar başka bir tenant için üretilmiş
  if (payload.tenantId !== req.tenantId) {
    return res.status(403).json({ error: 'Bu lisans anahtarı şirketiniz için üretilmemiş.' });
  }

  // Expiry check
  if (new Date(payload.expiryDate) < new Date()) {
    return res.status(400).json({ error: 'Bu lisans anahtarının süresi dolmuştur.' });
  }

  // Model → Plan mapping
  const planMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    KOBI: 'STARTER',
    PAY_AS_YOU_GO: 'PROFESSIONAL',
    ON_PREMISE: 'ENTERPRISE',
  };
  const plan = planMap[payload.model];
  if (!plan) return res.status(400).json({ error: 'Bilinmeyen lisans modeli.' });

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: req.tenantId },
    update: {
      plan,
      licenseKey,
      licenseModel: payload.model,
      licenseExpiryDate: new Date(payload.expiryDate),
      licensedUserLimit: payload.limits.users,
      licensedStorageLimit: payload.limits.storage,
    },
    create: {
      tenantId: req.tenantId,
      plan,
      licenseKey,
      licenseModel: payload.model,
      licenseExpiryDate: new Date(payload.expiryDate),
      licensedUserLimit: payload.limits.users,
      licensedStorageLimit: payload.limits.storage,
    },
  });

  res.json(subscription);
}));

// ── Modül ayarları (GM only) ────────────────────────────────────────────────
const GM = requireRole(['GENERAL_MANAGER']);

router.get('/module-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadı.' });
  try {
    res.json(JSON.parse(tenant.moduleSettings || '{}'));
  } catch {
    res.json({});
  }
}));

router.put('/module-settings', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const { promotedModules } = req.body as { promotedModules: string[] };
  if (!Array.isArray(promotedModules)) return res.status(400).json({ error: 'promotedModules array zorunlu.' });
  const updated = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { moduleSettings: JSON.stringify({ promotedModules }) },
  });
  res.json(JSON.parse(updated.moduleSettings));
}));

export default router;
