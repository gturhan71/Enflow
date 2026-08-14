import { prisma } from './prismaClient';

// STORAGE_GB, Int32 UsageMetric.count sütununa sığması için MEGABAYT biriminde
// tutulur (1000 GB ENTERPRISE limiti bile ~1M MB — Int32 sınırının (~2.1 milyar)
// çok altında; ham byte tutmak taşardı). Çağıran taraf (enforceStorageLimit)
// dosya boyutunu MB'a yuvarlayıp `amount` olarak geçer.
const LIMITS: Record<string, Record<string, number>> = {
  STARTER: { INTEGRATION_SYNC: 100, STORAGE_GB: 5 * 1024 },
  PROFESSIONAL: { INTEGRATION_SYNC: 1000, STORAGE_GB: 50 * 1024 },
  ENTERPRISE: { INTEGRATION_SYNC: 1000000, STORAGE_GB: 1000 * 1024 }, // Using a high number for unlimited
};

export async function checkLimit(tenantId: string, feature: string, amount = 1): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const plan = subscription?.plan || 'STARTER';

  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usage = await prisma.usageMetric.findUnique({
    where: { tenantId_feature_period: { tenantId, feature, period } }
  });

  const currentCount = usage?.count || 0;
  const planLimits = LIMITS[plan] || LIMITS.STARTER;
  const limit = planLimits[feature] || 0;

  return currentCount + amount <= limit;
}

export async function incrementUsage(tenantId: string, feature: string, amount = 1) {
  const period = new Date().toISOString().slice(0, 7);
  await prisma.usageMetric.upsert({
    where: { tenantId_feature_period: { tenantId, feature, period } },
    update: { count: { increment: amount } },
    create: { tenantId, feature, period, count: amount }
  });
}
