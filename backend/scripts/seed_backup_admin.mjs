import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  'DASHBOARD_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'VISIT_PLAN_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW',
  'COST_ANALYSIS_VIEW', 'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'PRESALES_VIEW', 'SALES_SUPPORT_VIEW',
  'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'FINANCE_VIEW', 'TODO_VIEW',
  'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'CORPORATE_GOV_VIEW', 'BACKUP_VIEW',
];

const email = 'backup@t-ecosystem.com';
const existing = await prisma.user.findUnique({ where: { email } });
const data = {
  name: 'Yedek Yöneticisi',
  email,
  role: 'BACKUP_ADMIN',
  permissions: JSON.stringify(PERMISSIONS),
  status: 'ACTIVE',
  tenantId: 'tenant-1',
};
if (existing) {
  await prisma.user.update({ where: { email }, data: { role: 'BACKUP_ADMIN', permissions: JSON.stringify(PERMISSIONS), status: 'ACTIVE' } });
  console.log('updated backup_admin:', existing.id);
} else {
  const u = await prisma.user.create({ data });
  console.log('created backup_admin:', u.id);
}
await prisma.$disconnect();
