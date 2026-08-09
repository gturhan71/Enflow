// Enflow — migrateToPostgres.ts'in dahili alt-süreç yardımcısı (doğrudan çalıştırılmaz).
// ─────────────────────────────────────────────────────────────────────────────
// Neden ayrı süreç: migrateToPostgres.ts önce KAYNAK (sqlite) `@prisma/client`'ı
// import edip export alır, SONRA schema.prisma'yı postgresql'e çevirip yeniden
// generate eder. Aynı Node süreci `@prisma/client`'ı bir kez require ettiği için
// disk'teki yeni (postgresql) üretimi görmez — Node require cache'i eski (sqlite)
// bağlanmış modülü tutar. Bu script TAZE bir süreçte çalışır → disk'teki GÜNCEL
// (postgresql) client'ı doğru yükler. Girdi: argv[2]=veri JSON dosyası,
// argv[3]=sonuç yazılacak JSON dosyası. DATABASE_URL env'den (hedef Postgres).
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadModelsIntoTarget, LogicalPayloadData } from '../services/restoreService';

async function main() {
  const [, , dataFile, resultFile] = process.argv;
  if (!dataFile || !resultFile) throw new Error('Kullanım: _migrateLoadTarget.ts <dataFile> <resultFile>');
  const { data } = JSON.parse(readFileSync(dataFile, 'utf-8')) as { data: LogicalPayloadData };

  const targetPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const restored = await targetPrisma.$transaction(
      (tx) => loadModelsIntoTarget(tx as unknown as Parameters<typeof loadModelsIntoTarget>[0], data, 'POSTGRES'),
      { timeout: 300_000, maxWait: 30_000 },
    );
    writeFileSync(resultFile, JSON.stringify(restored));
  } finally {
    await targetPrisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
