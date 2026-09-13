// Enflow — PostgreSQL Row-Level Security (RLS) uygulayıcı (Faz 3)
// ─────────────────────────────────────────────────────────────────────────────
// Kullanım: pnpm apply:postgres-rls  (backend/ içinde; DATABASE_URL Postgres'e
// işaret ederken, MİGRATOR kimlik bilgileriyle — RLS politikaları DDL'dir, runtime
// (en-az-yetki) rolünün bunu çalıştırma yetkisi yoktur, bkz. install/wizard.mjs).
//
// Prisma'nın Postgres yolu `db push` kullanır (migration dosyası YOK — bkz.
// install/POSTGRES_MIGRATION_PLAN.md), bu yüzden RLS SQL'i buradan ayrı,
// idempotent bir adım olarak uygulanır: tekrar çalıştırmak GÜVENLİDİR
// (DROP POLICY IF EXISTS + yeniden CREATE).
//
// Tek kaynak tasarım: docs/VERITABANI_GUVENLIGI_PLAN.md Faz 3.
//
// Kapsam: `Tenant` (RLS'in kendisi, tenantId sütunu yok) ve `SchedulerLock`
// (tenant'tan bağımsız zamanlayıcı kilidi) İSTİSNA. Diğer tüm modeller:
// - `tenantId` sütunu DOĞRUDAN varsa → basit politika.
// - Yoksa (BoMItem, WorkflowLog, ProjectMilestone, vb.) → INDIRECT haritasındaki
//   FK zinciri üzerinden EXISTS/JOIN politikası (schema.prisma değişirse bu harita
//   da güncellenmeli — `--check` bayrağı DMMF'e karşı eksik/fazla model olup
//   olmadığını doğrular, hiçbir SQL çalıştırmaz).

import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const log = (m = '') => console.log(m);
const ok = (m: string) => log(`✓ ${m}`);
const warn = (m: string) => log(`⚠ ${m}`);
const err = (m: string) => log(`✗ ${m}`);

const CHECK_ONLY = process.argv.includes('--check');

// RLS kapsamı DIŞINDA — bilinçli (bkz. yukarıdaki not).
const EXEMPT = new Set(['Tenant', 'SchedulerLock']);

// tenantId'ye DOLAYLI bağlı modeller (schema.prisma'da doğrudan tenantId sütunu
// yok) — FK zinciri üzerinden EXISTS politikası. Tek-seviye: fkField → parentModel
// (parentModel'in KENDİSİ tenantId taşır). İki-seviye (PurchaseQuoteItem): fkField
// → parentModel → parentFk → grandparentModel (grandparentModel tenantId taşır).
interface IndirectSpec {
  fkField: string;
  parentModel: string;
  parentFk?: string;
  grandparentModel?: string;
}
const INDIRECT: Record<string, IndirectSpec> = {
  BoMItem: { fkField: 'opportunityId', parentModel: 'Opportunity' },
  WorkflowLog: { fkField: 'opportunityId', parentModel: 'Opportunity' },
  ProjectMilestone: { fkField: 'projectId', parentModel: 'Project' },
  ProjectCostItem: { fkField: 'projectId', parentModel: 'Project' },
  WorkflowStep: { fkField: 'workflowId', parentModel: 'Workflow' },
  PurchaseItem: { fkField: 'purchaseRequestId', parentModel: 'PurchaseRequest' },
  PurchaseQuote: { fkField: 'purchaseRequestId', parentModel: 'PurchaseRequest' },
  ApprovalStage: { fkField: 'chainId', parentModel: 'ApprovalChain' },
  DeliveryRecord: { fkField: 'purchaseRequestId', parentModel: 'PurchaseRequest' },
  TenderChecklistItem: { fkField: 'tenderId', parentModel: 'Tender' },
  DmoOrderItem: { fkField: 'orderId', parentModel: 'DmoOrder' },
  ProjectUnitParticipation: { fkField: 'projectId', parentModel: 'Project' },
  PurchaseQuoteItem: { fkField: 'purchaseQuoteId', parentModel: 'PurchaseQuote', parentFk: 'purchaseRequestId', grandparentModel: 'PurchaseRequest' },
};

const BYPASS = `current_setting('app.bypass_rls', true) = 'on'`;
const TENANT_MATCH = (col: string) => `"${col}" = current_setting('app.tenant_id', true)`;

function directPolicySql(table: string): string {
  const cond = `${BYPASS} OR ${TENANT_MATCH('tenantId')}`;
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenant_isolation ON "${table}";`,
    `CREATE POLICY tenant_isolation ON "${table}" USING (${cond}) WITH CHECK (${cond});`,
  ].join('\n');
}

function indirectPolicySql(table: string, spec: IndirectSpec): string {
  let existsClause: string;
  if (spec.grandparentModel && spec.parentFk) {
    existsClause = `EXISTS (
      SELECT 1 FROM "${spec.parentModel}" p
      JOIN "${spec.grandparentModel}" gp ON gp."id" = p."${spec.parentFk}"
      WHERE p."id" = "${table}"."${spec.fkField}" AND ${TENANT_MATCH('tenantId').replace('"tenantId"', 'gp."tenantId"')}
    )`;
  } else {
    existsClause = `EXISTS (
      SELECT 1 FROM "${spec.parentModel}" p
      WHERE p."id" = "${table}"."${spec.fkField}" AND ${TENANT_MATCH('tenantId').replace('"tenantId"', 'p."tenantId"')}
    )`;
  }
  const cond = `${BYPASS} OR ${existsClause}`;
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS tenant_isolation ON "${table}";`,
    `CREATE POLICY tenant_isolation ON "${table}" USING (${cond}) WITH CHECK (${cond});`,
  ].join('\n');
}

async function main() {
  const models = Prisma.dmmf.datamodel.models;
  const direct: string[] = [];
  const indirect: string[] = [];
  const unmapped: string[] = [];

  for (const model of models) {
    if (EXEMPT.has(model.name)) continue;
    const hasTenantId = model.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar');
    if (hasTenantId) direct.push(model.name);
    else if (INDIRECT[model.name]) indirect.push(model.name);
    else unmapped.push(model.name);
  }

  log(`Toplam model: ${models.length} · doğrudan tenantId: ${direct.length} · dolaylı (INDIRECT harita): ${indirect.length} · istisna: ${EXEMPT.size}`);
  if (unmapped.length) {
    err(`Haritalanmamış model(ler) bulundu (RLS politikası YAZILAMAYACAK): ${unmapped.join(', ')}`);
    err('Bunlar için EXEMPT\'e (tenant\'tan tamamen bağımsızsa) veya INDIRECT haritasına (FK zinciri biliniyorsa) eklenmeli.');
    process.exitCode = 1;
    if (CHECK_ONLY) return;
  } else {
    ok('Tüm modeller haritalandı (doğrudan + dolaylı + istisna) — eksik yok.');
  }

  if (CHECK_ONLY) {
    log('[--check] Yalnız harita doğrulaması yapıldı, SQL çalıştırılmadı.');
    return;
  }

  const connectionString = process.env.DATABASE_URL || '';
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    err('DATABASE_URL PostgreSQL değil — bu script yalnız Postgres dağıtımları için (SQLite\'ta RLS kavramı yok).');
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  const admin = new PrismaClient({ adapter });

  let applied = 0;
  try {
    for (const name of direct) {
      await admin.$executeRawUnsafe(directPolicySql(name));
      applied++;
    }
    for (const name of indirect) {
      await admin.$executeRawUnsafe(indirectPolicySql(name, INDIRECT[name]));
      applied++;
    }
    ok(`RLS politikaları uygulandı: ${applied} tablo (${direct.length} doğrudan + ${indirect.length} dolaylı).`);
    log('Doğrulama için: pnpm apply:postgres-rls --check (yalnız harita) veya verify:postgres-rls (canlı RLS testi).');
  } catch (e) {
    err(`RLS uygulanırken hata: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await admin.$disconnect();
  }
}

main();
