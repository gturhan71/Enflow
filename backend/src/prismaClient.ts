import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import { roundMoneyData } from './services/moneyRounding';

dotenv.config({ quiet: true });

// DB seçimi DATABASE_URL şemasından türetilir: postgres(ql):// → PostgreSQL (pg
// adapter), aksi halde SQLite/libSQL (file:/libsql:). Tek kod tabanı iki veritabanını
// destekler; kurulum sihirbazı .env + schema provider'ını buna göre yazar.
const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = /^postgres(ql)?:\/\//i.test(connectionString);
// timeout=busy_timeout (ms, libsql Config) — SQLite varsayılanı 0 (anında SQLITE_BUSY);
// eşzamanlı yazımda kısa bekleme ile hata oranını düşürür. Postgres'te karşılığı yok.
const adapter = isPostgres
  ? new PrismaPg({ connectionString })
  : new PrismaLibSql({ url: connectionString, timeout: 5000 });

// Para temiz-yuvarlama: tüm yazımlarda para alanları 2 ondalığa (kuruş) yuvarlanır.
// Tek noktadan global; hiçbir route'u değiştirmeden kirli-float depolamasını önler.
const WRITE_OPS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
export const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (WRITE_OPS.has(operation) && args && typeof args === 'object') {
          const a = args as { data?: unknown; create?: unknown; update?: unknown };
          if (operation === 'upsert') {
            roundMoneyData(model, a.create);
            roundMoneyData(model, a.update);
          } else if (operation === 'createMany') {
            if (Array.isArray(a.data)) a.data.forEach(d => roundMoneyData(model, d));
            else roundMoneyData(model, a.data);
          } else {
            roundMoneyData(model, a.data);
          }

          // Görev kişi-bazlı atama: TodoTask oluşturulurken assignedToUserId yoksa
          // hedef birimin yöneticisine çöz (sistem hand-off'ları da kişiye gider).
          if (model === 'TodoTask' && (operation === 'create' || operation === 'createMany')) {
            const rows = operation === 'createMany'
              ? (Array.isArray(a.data) ? a.data : [a.data])
              : [a.data];
            for (const row of rows as Array<Record<string, unknown> | undefined>) {
              if (row && !row.assignedToUserId && typeof row.unitId === 'string') {
                try {
                  const unit = await prisma.unit.findUnique({ where: { id: row.unitId }, select: { managerId: true } });
                  if (unit?.managerId) row.assignedToUserId = unit.managerId;
                } catch { /* yut — atama çözülemezse null kalır (birim fallback) */ }
              }
            }
          }
        }
        return query(args);
      },
    },
  },
});

// WAL modu dosya header'ına kalıcı yazılır (bir kerelik yeter) — rollback-journal
// varsayılanının aksine yazım sırasında okumaları bloklamaz. Postgres'te anlamsız.
if (!isPostgres) {
  prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => { /* dosya kilitliyse bir sonraki bağlantıda tekrar denenir */ });
}
