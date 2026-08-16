import { prisma } from './prismaClient';
import { DEFAULT_PLAN_LIMITS, PlanId, TRIAL_STORAGE_LIMIT_MB } from './planCatalog';

// STORAGE_GB, Int32 UsageMetric.count sütununa sığması için MEGABAYT biriminde
// tutulur (1000 GB ENTERPRISE limiti bile ~1M MB — Int32 sınırının (~2.1 milyar)
// çok altında; ham byte tutmak taşardı). Çağıran taraf (enforceStorageLimit)
// dosya boyutunu MB'a yuvarlayıp `amount` olarak geçer.
// Plan varsayılanları tek-kaynak planCatalog.ts'ten gelir (src/modules/LicenseTypesModule.tsx
// gösterimiyle senkron tutulmalı — bkz. DEFAULT_PLAN_LIMITS yorumu).
const FEATURE_LIMITS: Record<PlanId, Record<string, number>> = {
  STARTER: { INTEGRATION_SYNC: 100, STORAGE_GB: DEFAULT_PLAN_LIMITS.STARTER.storageGB * 1024 },
  PROFESSIONAL: { INTEGRATION_SYNC: 1000, STORAGE_GB: DEFAULT_PLAN_LIMITS.PROFESSIONAL.storageGB * 1024 },
  ENTERPRISE: { INTEGRATION_SYNC: 1000000, STORAGE_GB: DEFAULT_PLAN_LIMITS.ENTERPRISE.storageGB * 1024 }, // Using a high number for unlimited
};

export async function checkLimit(tenantId: string, feature: string, amount = 1): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const plan = (subscription?.plan as PlanId) || 'STARTER';

  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usage = await prisma.usageMetric.findUnique({
    where: { tenantId_feature_period: { tenantId, feature, period } }
  });

  const currentCount = usage?.count || 0;
  // STORAGE_GB önceliği: (1) 30-günlük deneme → sabit 500 MB, (2) lisansta özel bir
  // storage değeri varsa (örn. CUSTOM SKU) onu GB→MB çevirerek kullan, (3) yoksa plan
  // varsayılanı. Önceden bu üçü de yok sayılıp yalnız sabit plan tablosu kullanılıyordu
  // — hem CUSTOM lisanslar hem de deneme kotası enforcement'ta hiç etkili olmuyordu.
  let limit: number;
  if (feature === 'STORAGE_GB' && subscription?.licenseModel === 'TRIAL') {
    limit = TRIAL_STORAGE_LIMIT_MB;
  } else if (feature === 'STORAGE_GB' && subscription?.licensedStorageLimit) {
    limit = subscription.licensedStorageLimit * 1024;
  } else {
    const planLimits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.STARTER;
    limit = planLimits[feature] || 0;
  }

  return currentCount + amount <= limit;
}

// Kullanıcı koltuğu (seat) kontrolü — licensedUserLimit varsa onu, yoksa plan
// varsayılanını uygular. Önceden hiçbir yerde kontrol edilmiyordu (kullanıcı
// limiti yalnız UI'da gösteriliyordu, oluşturma endpoint'i sınırsızdı).
export async function checkUserSeatLimit(tenantId: string): Promise<{ ok: boolean; limit: number; current: number }> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  const plan = (subscription?.plan as PlanId) || 'STARTER';
  const limit = subscription?.licensedUserLimit ?? DEFAULT_PLAN_LIMITS[plan].users;
  const current = await prisma.user.count({ where: { tenantId, status: 'ACTIVE' } });
  return { ok: current < limit, limit, current };
}

export async function incrementUsage(tenantId: string, feature: string, amount = 1) {
  const period = new Date().toISOString().slice(0, 7);
  await prisma.usageMetric.upsert({
    where: { tenantId_feature_period: { tenantId, feature, period } },
    update: { count: { increment: amount } },
    create: { tenantId, feature, period, count: amount }
  });
}
