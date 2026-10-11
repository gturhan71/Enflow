// Enflow — Tek seferlik: "Operasyon" birimi DEFAULT_UNITS'e eklendi (Profesyonel
// Hizmetler/post-sales saha ekibi, bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md) ama
// bootstrapTenant yalnız YENİ tenant'larda çalışır — var olan tenant'lara geriye
// dönük eklemez. Bu script o boşluğu kapatır. İdempotent — birim zaten varsa
// (isim eşleşmesiyle) o tenant atlanır.
//
// Çalıştırma:  npx ts-node --transpile-only src/scripts/backfill-operations-unit.ts
import { prisma } from '../prismaClient';
import { DEFAULT_UNITS } from '../services/bootstrapTenant';

const UNIT = DEFAULT_UNITS.find((u) => u.key === 'operations');
const DRY = process.argv.includes('--dry');

async function main() {
  if (!UNIT) {
    console.log('⚠ DEFAULT_UNITS içinde "operations" anahtarı bulunamadı — script no-op.');
    await prisma.$disconnect();
    return;
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const existing = await prisma.unit.findFirst({ where: { tenantId: tenant.id, name: UNIT.name } });
    if (existing) {
      console.log(`  ⏭  ${tenant.name} — "${UNIT.name}" zaten var, atlandı.`);
      skipped++;
      continue;
    }
    console.log(`  ${DRY ? '[DRY] ' : ''}+ ${tenant.name} — "${UNIT.name}" oluşturuluyor.`);
    if (!DRY) {
      await prisma.unit.create({ data: { tenantId: tenant.id, name: UNIT.name, description: UNIT.description } });
    }
    created++;
  }

  console.log(`\n${DRY ? '[DRY] ' : ''}${created} birim oluşturuldu, ${skipped} tenant atlandı.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
