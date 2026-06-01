import { prisma } from './prismaClient';

const LIMITS: Record<string, Record<string, number>> = {
  STARTER: { INTEGRATION_SYNC: 100, STORAGE_GB: 5 },
  PROFESSIONAL: { INTEGRATION_SYNC: 1000, STORAGE_GB: 50 },
  ENTERPRISE: { INTEGRATION_SYNC: 1000000, STORAGE_GB: 1000 }, // Using a high number for unlimited
};

export async function checkLimit(tenantId: string, feature: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const plan = subscription?.plan || 'STARTER';
  
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usage = await prisma.usageMetric.findUnique({ 
    where: { tenantId_feature_period: { tenantId, feature, period } } 
  });

  const currentCount = usage?.count || 0;
  const planLimits = LIMITS[plan] || LIMITS.STARTER;
  const limit = planLimits[feature] || 0;
  
  return currentCount < limit;
}

export async function incrementUsage(tenantId: string, feature: string) {
  const period = new Date().toISOString().slice(0, 7);
  await prisma.usageMetric.upsert({
    where: { tenantId_feature_period: { tenantId, feature, period } },
    update: { count: { increment: 1 } },
    create: { tenantId, feature, period, count: 1 }
  });
}
