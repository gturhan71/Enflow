// Enflow — Tek seferlik: DEFAULT_WORKFLOW_TEMPLATE'e eklenen İGB (OPPORTUNITY_APPROVAL)
// ve KY (CONTRACT_TO_PROJECT) swimlane adımlarını, bu süreçleri ZATEN kurgulamış
// tenant'lara geriye dönük işler. applyDefaultWorkflowTemplate yalnız HENÜZ
// kurgulanmamış süreçleri doldurduğu için (immutable kural: harita tenant'ındır),
// var olan Workflow kayıtlarına şablon değişikliği otomatik yansımaz — bu script
// o boşluğu kapatır. İdempotent — ilgili rol zaten bir adımda varsa o tenant/süreç atlanır.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-workflow-igpd-kgd-steps.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

interface Plan {
  processKey: string;
  unitName: string; // DEFAULT_UNITS'teki tam isim — Unit.name eşleşmesi buradan
  role: string;
  description: string;
  insertAtOrder: number; // yeni adım bu order'a yerleşir, >= bu order olan mevcut adımlar +1 kayar
}

const PLANS: Plan[] = [
  { processKey: 'OPPORTUNITY_APPROVAL', unitName: 'İGB — İş Geliştirme Birimi', role: 'IGPD_MGR', description: 'İGB iş geliştirme uygunluk onayı', insertAtOrder: 1 },
  { processKey: 'CONTRACT_TO_PROJECT', unitName: 'KY — Kalite Yönetimi', role: 'KGD_MGR', description: 'KY kalite güvence ön kontrolü', insertAtOrder: 0 },
];

async function main() {
  let patched = 0;
  let skipped = 0;

  for (const plan of PLANS) {
    const workflows = await prisma.workflow.findMany({
      where: { processKey: plan.processKey },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    for (const wf of workflows) {
      const alreadyHasRole = wf.steps.some(s => s.role === plan.role);
      if (alreadyHasRole) {
        console.log(`  ⏭  ${plan.processKey} (tenant ${wf.tenantId}) — ${plan.role} zaten var, atlandı.`);
        skipped++;
        continue;
      }

      const unit = await prisma.unit.findFirst({ where: { tenantId: wf.tenantId, name: plan.unitName } });
      if (!unit) {
        console.log(`  ⚠  ${plan.processKey} (tenant ${wf.tenantId}) — birim bulunamadı ("${plan.unitName}"), atlandı. Önce Ayarlar → Birimler'den ekleyin.`);
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // insertAtOrder ve sonrasındaki mevcut adımları bir kaydır.
        const toShift = wf.steps.filter(s => s.order >= plan.insertAtOrder).sort((a, b) => b.order - a.order);
        for (const s of toShift) {
          await tx.workflowStep.update({ where: { id: s.id }, data: { order: s.order + 1 } });
        }
        await tx.workflowStep.create({
          data: {
            workflowId: wf.id,
            unitId: unit.id,
            role: plan.role,
            type: 'MANUAL',
            description: plan.description,
            order: plan.insertAtOrder,
            approvalMode: 'ANY',
          },
        });
      });

      console.log(`  ✔ ${plan.processKey} (tenant ${wf.tenantId}) — ${plan.role} adımı order=${plan.insertAtOrder}'e eklendi, sonraki adımlar kaydırıldı.`);
      patched++;
    }
  }

  console.log(patched === 0 ? '\nİşlenecek kayıt yok.' : `\n${patched} workflow güncellendi, ${skipped} atlandı.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
