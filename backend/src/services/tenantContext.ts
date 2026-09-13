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

// Normal istek yolu — tenantMiddleware, req.tenantId çözüldükten sonra bunun içinde
// next()'i çağırır. fn içindeki TÜM Prisma sorguları bu tenantId'ye RLS ile kısıtlanır.
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

// KASITLI cross-tenant / tenant-öncesi yollar İÇİN (login email araması, yeni tenant
// bootstrap'ı, platform-tickets-admin, geri yükleme). Şüpheye düşüldüğünde KULLANMAYIN —
// RLS'in güvenli varsayılanı "context yok → 0 satır"dır; bypass yalnız gerçekten
// cross-tenant olması GEREKEN, bilinen ve dokümante edilmiş yollarda kullanılmalıdır.
export function runWithRlsBypass<T>(fn: () => T): T {
  return storage.run({ bypassRls: true }, fn);
}
