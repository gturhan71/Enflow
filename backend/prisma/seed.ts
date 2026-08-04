import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
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

  // 2b. Kurumsal süreç swimlane birimleri (Faz 0 — onay zinciri altyapısı)
  const financeUnit = await prisma.unit.create({
    data: {
      name: 'Finans',
      tenantId: tenant.id,
      description: 'Maliyet ve finansman değerlendirmesi.',
    },
  });

  const igpdUnit = await prisma.unit.create({
    data: {
      name: 'İGB — İş Geliştirme Birimi',
      tenantId: tenant.id,
      description: 'Fırsat programı yönetimi, ziyaret planı ve onay takibi.',
    },
  });

  const topManagementUnit = await prisma.unit.create({
    data: {
      name: 'Üst Yönetim (GMÜ)',
      tenantId: tenant.id,
      description: 'Genel müdür üst yönetim onay aşaması.',
    },
  });

  const ksuUnit = await prisma.unit.create({
    data: {
      name: 'KSU — Kontrat & Sözleşme Uzmanlığı',
      tenantId: tenant.id,
      description: 'Sözleşme evrak kontrolü ve imza süreci doğrulaması.',
    },
  });

  const kgdUnit = await prisma.unit.create({
    data: {
      name: 'KY — Kalite Yönetimi',
      tenantId: tenant.id,
      description: 'Öğrenilmiş dersler, risk/fırsat ve kurumsal metrik raporlaması.',
    },
  });

  const isabUnit = await prisma.unit.create({
    data: {
      name: 'İYB — İhale Yönetim Birimi',
      tenantId: tenant.id,
      description: 'İhale takip ve EKAP süreçleri.',
    },
  });

  // 3. Create Admin User (Gökhan Turhan)
  const gokhan = await prisma.user.create({
    data: {
      name: 'Gökhan Turhan',
      email: 'gokhan@t-ecosystem.com',
      // Dev/seed varsayılan parolası (üretimde değiştirin).
      password: await bcrypt.hash(process.env.DEFAULT_SEED_PASSWORD || '123456', 10),
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
