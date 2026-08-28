// Enflow — Tek seferlik: DEFAULT_WORKFLOW_TEMPLATE'in PURCHASE_TO_INVOICE sürecine
// eklenen AUTO adımı (CREATE_INVOICE_FROM_PURCHASE, B-09), bu süreci ZATEN kurgulamış
// tenant'lara geriye dönük işler. applyDefaultWorkflowTemplate yalnız HENÜZ kurgulanmamış
// süreçleri doldurduğu için (immutable kural: harita tenant'ındır), var olan Workflow
// kayıtlarına şablon değişikliği otomatik yansımaz — bu script o boşluğu kapatır.
// İdempotent — AUTO adım zaten varsa o tenant atlanır.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-workflow-purchase-invoice-auto.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const workflows = await prisma.workflow.findMany({
    where: { processKey: 'PURCHASE_TO_INVOICE' },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  let patched = 0;
  let skipped = 0;

  for (const wf of workflows) {
    const alreadyHasAuto = wf.steps.some((s) => s.actionKey === 'CREATE_INVOICE_FROM_PURCHASE');
    if (alreadyHasAuto) {
      console.log(`  ⏭  PURCHASE_TO_INVOICE (tenant ${wf.tenantId}) — AUTO adım zaten var, atlandı.`);
      skipped++;
      continue;
    }

    const unit = await prisma.unit.findFirst({ where: { tenantId: wf.tenantId, name: 'Finans' } });
    if (!unit) {
      console.log(`  ⚠  PURCHASE_TO_INVOICE (tenant ${wf.tenantId}) — "Finans" birimi bulunamadı, atlandı.`);
      skipped++;
      continue;
    }

    const maxOrder = wf.steps.length ? Math.max(...wf.steps.map((s) => s.order)) : -1;
    await prisma.workflowStep.create({
      data: {
        workflowId: wf.id,
        unitId: unit.id,
        role: null,
        type: 'AUTO',
        description: 'Satınalma faturasını sonlandır',
        actionKey: 'CREATE_INVOICE_FROM_PURCHASE',
        order: maxOrder + 1,
        approvalMode: 'ANY',
      },
    });

    console.log(`  ✔ PURCHASE_TO_INVOICE (tenant ${wf.tenantId}) — AUTO adım order=${maxOrder + 1}'e eklendi.`);
    patched++;
  }

  console.log(patched === 0 ? '\nİşlenecek kayıt yok.' : `\n${patched} workflow güncellendi, ${skipped} atlandı.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
