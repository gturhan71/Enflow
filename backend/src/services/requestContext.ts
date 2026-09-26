// İstek bağlamı (request-id) — AsyncLocalStorage; logger her satıra `reqId` ekler, böylece bir isteğin
// tüm log satırları (route, servis, hata) tek kimlikle ilişkilendirilir. tenantContext'ten bağımsız.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage<{ reqId: string }>();

// Dışarıdan gelen X-Request-Id yalnız güvenli biçimdeyse (log enjeksiyonu/şişirme önlemi) kabul edilir.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveRequestId(inbound: unknown): string {
  return typeof inbound === 'string' && SAFE_ID.test(inbound) ? inbound : randomUUID();
}

export function runWithRequestId<T>(reqId: string, fn: () => T): T {
  return storage.run({ reqId }, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.reqId;
}
