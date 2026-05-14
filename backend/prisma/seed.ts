import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({
  url: connectionString,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: 'tenant-1',
      name: 'T-Ecosystem Teknoloji',
    },
  });

  // 2. Create Units
  const salesUnit = await prisma.unit.create({
    data: {
      name: 'Satış & Pazarlama',
      tenantId: tenant.id,
      description: 'Müşteri ilişkileri ve yeni fırsat yönetimi.',
    },
  });

  const technicalUnit = await prisma.unit.create({
    data: {
      name: 'Teknik Çözümler & Presales',
      tenantId: tenant.id,
      description: 'Dizayn, BoM ve teknik şartname analizi.',
    },
  });

  // 3. Create Admin User (Gökhan Turhan)
  const gokhan = await prisma.user.create({
    data: {
      name: 'Gökhan Turhan',
      email: 'gokhan@t-ecosystem.com',
      role: 'GENERAL_MANAGER',
      permissions: JSON.stringify(['DASHBOARD_VIEW', 'CRM_VIEW', 'CRM_EDIT', 'PRESALES_VIEW', 'PRESALES_EDIT', 'SETTINGS_VIEW', 'ARCHIVE_VIEW', 'DOCUMENTS_VIEW']),
      tenantId: tenant.id,
      unitId: salesUnit.id,
    },
  });

  // Update unit manager
  await prisma.unit.update({
    where: { id: salesUnit.id },
    data: { managerId: gokhan.id },
  });

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
