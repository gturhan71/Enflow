// Enflow — Tek seferlik: teklif üretilmiş (en az bir Proposal kaydı olan) VE status=WON
// olan, ama probability henüz %100'e çekilmemiş fırsatları düzeltir. Bundan sonraki WIN
// geçişleri PUT /api/opportunities/:id içinde otomatik %100'e çekiliyor (bkz. routes/opportunities.ts);
// bu script yalnız o kural eklenmeden ÖNCE oluşmuş mevcut kayıtları geriye dönük düzeltir.
// İdempotent — tekrar çalıştırmak zararsız (ikinci çalıştırmada eşleşen kayıt kalmaz.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-won-probability.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const candidates = await prisma.opportunity.findMany({
    where: { status: 'WON', probability: { not: 100 } },
    select: { id: true, tenantId: true, title: true, probability: true },
  });

  let fixed = 0;
  for (const opp of candidates) {
    const hasProposal = await prisma.proposal.findFirst({ where: { tenantId: opp.tenantId, opportunityId: opp.id }, select: { id: true } });
    if (!hasProposal) continue;
    await prisma.opportunity.update({ where: { id: opp.id }, data: { probability: 100 } });
    console.log(`  ✔ ${opp.title} (${opp.id}) — olasılık %${opp.probability} → %100`);
    fixed++;
  }

  if (fixed === 0) {
    console.log('Düzeltilecek kayıt yok — tüm WON + teklifli fırsatların olasılığı zaten %100.');
  } else {
    console.log(`\n${fixed} fırsatın olasılığı %100'e düzeltildi.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
