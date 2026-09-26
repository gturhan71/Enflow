import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLibpqUrl, redactUrl, waitForHealth } from './core.mjs';

test('toLibpqUrl Prisma parametrelerini ayıklar, libpq olanları korur', () => {
  assert.equal(toLibpqUrl('postgresql://u:p@h:5432/db?schema=public&sslmode=require'), 'postgresql://u:p@h:5432/db?sslmode=require');
});

test('redactUrl parolayı maskeler', () => {
  assert.equal(redactUrl('postgresql://u:secret@h/db'), 'postgresql://u:****@h/db');
  assert.equal(redactUrl('çöp'), '<url>');
});

function clock() { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; }
const res = (ok, body) => ({ ok, json: async () => body });

test('waitForHealth: sağlıklı yanıta dek bekler', async () => {
  const c = clock(); let calls = 0;
  const fetchImpl = async () => (++calls < 3 ? Promise.reject(new Error('ECONNREFUSED')) : res(true, { db: 'ok' }));
  assert.equal(await waitForHealth('x', { fetchImpl, ...c, timeoutMs: 60_000, intervalMs: 1_000 }), true);
  assert.equal(calls, 3);
});

test('waitForHealth: 503/db down süre dolunca false', async () => {
  const c = clock();
  const fetchImpl = async () => res(false, { db: 'down' });
  assert.equal(await waitForHealth('x', { fetchImpl, ...c, timeoutMs: 5_000, intervalMs: 1_000 }), false);
});

test('waitForHealth: 200 ama db down → sağlıksız', async () => {
  const c = clock();
  assert.equal(await waitForHealth('x', { fetchImpl: async () => res(true, { db: 'down' }), ...c, timeoutMs: 3_000, intervalMs: 1_000 }), false);
});
