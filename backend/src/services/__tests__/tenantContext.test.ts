import { describe, it, expect } from 'vitest';
import { getTenantContext, runWithRlsBypass, runWithTenant } from '../tenantContext';

// PrismaPromise gibi davranan tembel thenable: iş yalnız `.then` çağrılınca yapılır
// ve o ANKİ context'i okur (prismaClient RLS uzantısının gördüğü şey).
function lazyQuery() {
  return {
    then<R>(onFulfilled: (v: ReturnType<typeof getTenantContext>) => R) {
      return Promise.resolve(getTenantContext()).then(onFulfilled);
    },
  };
}

describe('tenantContext — tembel sorgular', () => {
  it('runWithRlsBypass senkron ok + tembel sorgu → bypass görülür', async () => {
    const ctx = await runWithRlsBypass(() => lazyQuery());
    expect(ctx).toEqual({ bypassRls: true });
  });

  it('runWithTenant senkron ok + tembel sorgu → tenantId görülür', async () => {
    const ctx = await runWithTenant('t-1', () => lazyQuery());
    expect(ctx).toEqual({ tenantId: 't-1' });
  });

  it('async fonksiyon yolu değişmedi', async () => {
    const ctx = await runWithTenant('t-2', async () => getTenantContext());
    expect(ctx).toEqual({ tenantId: 't-2' });
  });

  it('senkron, thenable olmayan dönüş aynen geçer (next() yolu)', () => {
    let seen: unknown;
    const r = runWithTenant('t-3', () => { seen = getTenantContext(); return 42; });
    expect(r).toBe(42);
    expect(seen).toEqual({ tenantId: 't-3' });
  });

  it('kapsam dışında context yok', () => {
    expect(getTenantContext()).toBeUndefined();
  });
});
