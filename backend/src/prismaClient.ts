import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import { roundMoneyData } from './services/moneyRounding';
import { getTenantContext } from './services/tenantContext';

dotenv.config({ quiet: true });

// DB seçimi DATABASE_URL şemasından türetilir: postgres(ql):// → PostgreSQL (pg
// adapter), aksi halde SQLite/libSQL (file:/libsql:). Tek kod tabanı iki veritabanını
// destekler; kurulum sihirbazı .env + schema provider'ını buna göre yazar.
const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = /^postgres(ql)?:\/\//i.test(connectionString);
// timeout=busy_timeout (ms, libsql Config) — SQLite varsayılanı 0 (anında SQLITE_BUSY);
// eşzamanlı yazımda kısa bekleme ile hata oranını düşürür. Postgres'te karşılığı yok.
// Havuz boyutu (yalnız Postgres): önceden kod seviyesinde belirlenmiyordu, node-postgres
// varsayılanına (10) sessizce kalıyordu. Çoklu replikada replika_sayısı × bu değer,
// Postgres'in max_connections'ını aşabilir — artık env'den görünür/ayarlanabilir
// (bkz. docs/SYSTEM_REQUIREMENTS.md Senaryo 4, docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz B / S-05).
const adapter = isPostgres
  ? new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX) || 10 })
  : new PrismaLibSql({ url: connectionString, timeout: 5000 });

// Para temiz-yuvarlama: tüm yazımlarda para alanları 2 ondalığa (kuruş) yuvarlanır.
// Tek noktadan global; hiçbir route'u değiştirmeden kirli-float depolamasını önler.
const WRITE_OPS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
// Prisma delegate adı: model adının yalnız ilk harfi küçültülür (BoMItem → boMItem).
const uncapitalize = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Katman 1: para yuvarlama + TodoTask atama çözümü. Bilerek RLS katmanından (aşağıda)
// AYRI tutulur — `basePrisma`'nın `$allOperations` gövdesi kendi `$transaction`'ını
// ÇAĞIRMAZ; bu sayede TypeScript'in "prisma kendi initializer'ında referans veriliyor"
// döngüsel tip çıkarımına (TS7022 — `.$transaction`'ın jenerik imzası tam istemci tipini
// gerektirdiğinden yalnız BU özel çağrı döngüsellik yaratıyor, düz `.model.op()` çağrıları
// yaratmıyor) düşmeden `basePrisma.$transaction` aşağıda güvenle kullanılabilir.
const basePrisma = new PrismaClient({ adapter }).$extends({
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
                  const unit = await basePrisma.unit.findUnique({ where: { id: row.unitId }, select: { managerId: true } });
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

// Katman 2: PostgreSQL Row-Level Security (Faz 3, docs/VERITABANI_GUVENLIGI_PLAN.md) —
// tenant-context (AsyncLocalStorage) VARSA operasyonu `basePrisma.$transaction` ile
// kendi transaction'ına sarıp `SET LOCAL` ile DB oturum değişkenini set eder; hiçbir
// route/servis değişmeden şeffaf çalışır. SQLite'ta veya context yokken (script/seed)
// davranış AYNEN öncekiyle bire bir. `tx` `basePrisma`'dan geldiği için bu RLS katmanını
// TAŞIMAZ — iç `tx.model.op()` çağrıları bu hook'u yeniden tetiklemez (double-wrap /
// atomiklik kırılması riski yapısal olarak yok, ek bir "zaten sarılı" bayrağı gerekmez).
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (isPostgres) {
          const ctx = getTenantContext();
          if (ctx && (ctx.tenantId || ctx.bypassRls)) {
            return basePrisma.$transaction(async (tx) => {
              if (ctx.bypassRls) {
                await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
              } else {
                await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const delegate = (tx as any)[uncapitalize(model)];
              return delegate[operation](args);
            });
          }
        }
        return query(args);
      },
    },
  },
});

// `basePrisma` bir uzantılı (extended) istemci olduğundan `$transaction`'ının `tx`
// parametre tipi jenerik `Prisma.TransactionClient`'tan YAPISAL olarak farklıdır
// (uzantı-farkında dahili tipler içerir) — aşağıdaki tip, gerçek imzadan türetilir
// (elle yazılan bir tip her Prisma sürümünde kayabilir, bu her zaman doğru kalır).
type ManagedTxCallback = Parameters<typeof basePrisma.$transaction>[0];
export type ManagedTx = Parameters<Extract<ManagedTxCallback, (...args: never[]) => unknown>>[0];

// Kodun genelinde birçok yerde `prisma.$transaction(async (tx) => {...})` çok-adımlı
// atomik işlemler için kullanılıyordu (bkz. docs/VERITABANI_GUVENLIGI_PLAN.md Faz 3 —
// bootstrapTenant.ts, personnelTransferService.ts, vb., hepsi bu yardımcıya geçirildi).
// Mevcut tenant-context'e göre `SET LOCAL`'i transaction başında BİR KEZ uygular;
// `tx` (yukarıdaki gibi) `basePrisma`'dan geldiğinden içindeki `tx.model.op()`
// çağrıları RLS katmanını yeniden tetiklemez — atomiklik korunur. Postgres dışında
// (SQLite) davranış birebir `prisma.$transaction` ile aynıdır.
export async function runManagedTransaction<T>(
  callback: (tx: ManagedTx) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  if (!isPostgres) return basePrisma.$transaction(callback, options);
  const ctx = getTenantContext();
  return basePrisma.$transaction(async (tx) => {
    if (ctx?.bypassRls) {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    } else if (ctx?.tenantId) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    }
    return callback(tx);
  }, options);
}

// WAL modu dosya header'ına kalıcı yazılır (bir kerelik yeter) — rollback-journal
// varsayılanının aksine yazım sırasında okumaları bloklamaz. Postgres'te anlamsız.
if (!isPostgres) {
  prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => { /* dosya kilitliyse bir sonraki bağlantıda tekrar denenir */ });
}
