import { AsyncLocalStorage } from 'node:async_hooks';

// PostgreSQL Row-Level Security (RLS) için istek-bazlı tenant bağlamı. `prismaClient.ts`
// her Postgres sorgusunu bu context'i okuyup `SET LOCAL app.tenant_id` / `app.bypass_rls`
// ile bir transaction'a sararak DB seviyesinde izolasyon uygular (bkz.
// docs/VERITABANI_GUVENLIGI_PLAN.md Faz 3). SQLite'ta bu context hiçbir şeyi etkilemez —
// prismaClient RLS sarmalayıcısı yalnız Postgres'te devrededir.
interface TenantContext {
  tenantId?: string;
  bypassRls?: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

// Prisma sorguları TEMBELDİR: `prisma.x.findUnique()` bir PrismaPromise döner ve
// sorgu ancak `.then` çağrıldığında (await) çalışır. `runWith*(() => prisma.x.op())`
// biçiminde senkron ok fonksiyonu verilirse await storage.run kapsamının DIŞINDA
// olur → sorgu context'siz çalışır → RLS 0 satır döner (login/tenantMiddleware
// Postgres'te bu yüzden kırıktı). Dönen değer thenable ise `.then`'i context İÇİNDE
// çağırıp sorguyu burada tetikleriz; çağıranın dönüş tipi/await'i değişmez.
function runInContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, () => {
    const result = fn();
    if (result !== null && typeof result === 'object' && typeof (result as { then?: unknown }).then === 'function') {
      return (result as unknown as PromiseLike<unknown>).then((v) => v) as unknown as T;
    }
    return result;
  });
}

// Normal istek yolu — tenantMiddleware, req.tenantId çözüldükten sonra bunun içinde
// next()'i çağırır. fn içindeki TÜM Prisma sorguları bu tenantId'ye RLS ile kısıtlanır.
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return runInContext({ tenantId }, fn);
}

// KASITLI cross-tenant / tenant-öncesi yollar İÇİN (login email araması, yeni tenant
// bootstrap'ı, platform-tickets-admin, geri yükleme). Şüpheye düşüldüğünde KULLANMAYIN —
// RLS'in güvenli varsayılanı "context yok → 0 satır"dır; bypass yalnız gerçekten
// cross-tenant olması GEREKEN, bilinen ve dokümante edilmiş yollarda kullanılmalıdır.
export function runWithRlsBypass<T>(fn: () => T): T {
  return runInContext({ bypassRls: true }, fn);
}
