// Enflow — Tek seferlik: DEFAULT_WORKFLOW_TEMPLATE'e eklenen yeni
// BOM_COST_ANALYSIS_HANDOFF sürecini (Presales BoM devri → fırsat sahibine
// maliyet analizi görevi) ZATEN kurgulanmış (Faz H) tenant'lara geriye dönük
// uygular. `applyDefaultWorkflowTemplate` yalnız HENÜZ kurgulanmamış
// süreçleri doldurur (immutable kural) — bu yeni processKey hiçbir tenant'ta
// yokken, fonksiyonu tekrar çağırmak zaten idempotent (var olan 13+2 süreç
// atlanır, yalnız BOM_COST_ANALYSIS_HANDOFF oluşur). İdempotent — tekrar
// çalıştırmak zararsız.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-bom-cost-analysis-handoff-step.ts
import { prisma } from '../prismaClient';
import { applyDefaultWorkflowTemplate } from '../services/workflowTemplate';

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  if (tenants.length === 0) {
    console.log('Hiç tenant yok. Yapılacak işlem yok.');
    return;
  }

  for (const t of tenants) {
    const result = await applyDefaultWorkflowTemplate(t.id);
    if (result.createdProcesses.includes('BOM_COST_ANALYSIS_HANDOFF')) {
      console.log(`  ✔ ${t.name} (${t.id}) — BOM_COST_ANALYSIS_HANDOFF oluşturuldu.`);
    } else {
      console.log(`  ⏭  ${t.name} (${t.id}) — zaten kurgulanmış, atlandı.`);
    }
  }

  console.log(`\n${tenants.length} tenant tarandı.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
