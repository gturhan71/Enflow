import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url: connectionString });
const prisma = new PrismaClient({ adapter });

async function seed() {
  const tenantId = 'tenant-1'; // Default tenant

  const docs = [
    { id: 'd1', name: 'İmza Sirküleri 2026', category: 'LEGAL', expiryDate: '2026-12-31T00:00:00Z', fileUrl: '#', tags: 'Yasal, İmza' },
    { id: 'd2', name: 'ISO 27001:2022 Sertifikası', category: 'ISO', expiryDate: '2026-04-20T00:00:00Z', fileUrl: '#', tags: 'Güvenlik, ISO' },
    { id: 'd3', name: 'Vergi Levhası 2025', category: 'LEGAL', expiryDate: '2026-05-31T00:00:00Z', fileUrl: '#', tags: 'Yasal, Finans' },
    { id: 'd4', name: 'Dell Platinum Partner Belgesi', category: 'CERTIFICATE', expiryDate: '2027-01-15T00:00:00Z', fileUrl: '#', tags: 'Üretici, Dell' },
  ];

  console.log('🌱 Seeding corporate documents...');

  for (const doc of docs) {
    await prisma.corporateDocument.upsert({
      where: { id: doc.id },
      update: {
        name: doc.name,
        category: doc.category,
        expiryDate: new Date(doc.expiryDate),
        fileUrl: doc.fileUrl,
        tags: doc.tags,
        tenantId
      },
      create: {
        id: doc.id,
        name: doc.name,
        category: doc.category,
        expiryDate: new Date(doc.expiryDate),
        fileUrl: doc.fileUrl,
        tags: doc.tags,
        tenantId
      }
    });
  }

  console.log('✅ Seeding complete.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
