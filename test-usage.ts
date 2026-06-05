import { incrementUsage, checkLimit } from './backend/src/usageService';
import { prisma } from './backend/src/prismaClient';

async function testUsageTracking() {
  const tenantId = 'tenant_test_123';
  const feature = 'INTEGRATION_SYNC';

  console.log('--- Kullanım Takibi Testi Başlıyor ---');

  // Önce temiz bir başlangıç için veritabanını temizle
  await prisma.usageMetric.deleteMany({ where: { tenantId } });
  await prisma.subscription.upsert({
    where: { tenantId },
    update: { plan: 'STARTER' },
    create: { tenantId, plan: 'STARTER' }
  });
  console.log('Test ortamı hazırlandı (STARTER planı).');

  // 100 kez increment et (STARTER sınırı 100)
  for (let i = 0; i < 100; i++) {
    await incrementUsage(tenantId, feature);
  }
  console.log('100 kez kullanım kaydedildi.');

  // Limit kontrolü yap (100 olmalı)
  const canUse100 = await checkLimit(tenantId, feature);
  console.log(`100 kullanımda limit aşımı var mı? (Beklenen: false/limit dolu): ${!canUse100}`);

  // 101. kez denemeyi kontrol et
  const canUse101 = await checkLimit(tenantId, feature);
  console.log(`101. kullanım için limit durumu: ${canUse101}`);
  
  if (canUse101 === false) {
    console.log('Test Başarılı: Limit kontrolü doğru çalışıyor.');
  } else {
    console.error('Test Başarısız: Limit kontrolü hatalı.');
  }
}

testUsageTracking()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
