// Enflow — Tek seferlik: trackingCode alanı eklenmeden ÖNCE oluşmuş mevcut fırsatlara
// geriye dönük takip kodu atar. add_opportunity_tracking_code migration'ından SONRA
// çalıştırılır. İdempotent — trackingCode zaten dolu kayıtları atlar, tekrar çalıştırmak
// güvenlidir. Kod, fırsatın GERÇEK açılış tarihini (createdAt) kullanır — "bugün" değil.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-opportunity-tracking-codes.ts
import { prisma } from '../prismaClient';
import { nextOpportunityTrackingCode } from '../services/documentNumberService';

async function main() {
  const candidates = await prisma.opportunity.findMany({
    where: { trackingCode: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, tenantId: true, title: true, createdAt: true },
  });

  if (candidates.length === 0) {
    console.log('Takip kodu eksik fırsat yok — tüm fırsatlar zaten kodlu.');
    return;
  }

  let fixed = 0;
  for (const opp of candidates) {
    const trackingCode = await nextOpportunityTrackingCode(opp.tenantId, opp.createdAt);
    await prisma.opportunity.update({ where: { id: opp.id }, data: { trackingCode } });
    console.log(`  ✔ ${opp.title} (${opp.id}) → ${trackingCode}`);
    fixed++;
  }

  console.log(`\n${fixed} fırsata geriye dönük takip kodu atandı.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
