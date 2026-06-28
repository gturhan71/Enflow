import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import { roundMoneyData } from './services/moneyRounding';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url: connectionString });

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
        }
        return query(args);
      },
    },
  },
});
