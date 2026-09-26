// upgrade-tool arayüz sunucusu güvenlik testi — GERÇEK süreç (node server.mjs), izole state dizini.
// 10x avı (2026-09-26): kimlik doğrulama yoktu (yerel kullanıcı → restartCommand yazıp yükseltmede komut
// çalıştırabilirdi) ve Host başlığı denetlenmiyordu (DNS rebinding).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
let child, port, token, state, base;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const call = (path, { method = 'GET', headers = {}, body } = {}) =>
  fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

before(async () => {
  port = await freePort();
  state = mkdtempSync(join(tmpdir(), 'gui-state-'));
  const home = mkdtempSync(join(tmpdir(), 'gui-home-'));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [join(HERE, 'server.mjs')], { env: { ...process.env, PORT: String(port), ENFLOW_UPGRADE_STATE_DIR: state, ENFLOW_HOME: home, ENFLOW_OFFLINE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  token = await new Promise((resolve, reject) => {
    let out = '';
    const t = setTimeout(() => reject(new Error('sunucu başlamadı: ' + out)), 10_000);
    child.stdout.on('data', (d) => { out += d; const m = /#token=([0-9a-f]{64})/.exec(out); if (m) { clearTimeout(t); resolve(m[1]); } });
    child.on('exit', () => reject(new Error('sunucu erken çıktı: ' + out)));
  });
});
after(() => { child?.kill(); });

test('token yok / yanlış → 401; doğru token → 200', async () => {
  assert.equal((await call('/api/status')).status, 401);
  assert.equal((await call('/api/status', { headers: { 'X-Enflow-Token': 'x'.repeat(64) } })).status, 401);
  assert.equal((await call('/api/status', { headers: { 'X-Enflow-Token': token } })).status, 200);
});

test('tüm mutasyon uçları token ister (PUT settings, POST upgrade, POST check)', async () => {
  assert.equal((await call('/api/settings', { method: 'PUT', body: { restartCommand: 'touch /tmp/x' } })).status, 401);
  assert.equal((await call('/api/upgrade', { method: 'POST' })).status, 401);
  assert.equal((await call('/api/check', { method: 'POST' })).status, 401);
});

test('Host başlığı loopback değilse 403 (token olsa bile) — DNS rebinding', async () => {
  // fetch Host başlığını değiştirmeye izin vermez → ham http isteği
  const res = await new Promise((resolve, reject) => {
    const req = (async () => {
      const http = await import('node:http');
      const r = http.request({ host: '127.0.0.1', port, path: '/api/status', headers: { Host: 'attacker.example:' + port, 'X-Enflow-Token': token } }, (m) => { m.resume(); resolve(m.statusCode); });
      r.on('error', reject); r.end();
    })();
    req.catch(reject);
  });
  assert.equal(res, 403);
});

test('HTML token istemeden servis edilir ve token İÇERMEZ', async () => {
  const r = await call('/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(!html.includes(token));
  assert.match(r.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
});

test('ayar patch\'i allowlist\'li: bilinmeyen anahtar / yanlış tip yok sayılır; migratorUrl yanıtta maskeli', async () => {
  const h = { 'X-Enflow-Token': token };
  const r = await call('/api/settings', { method: 'PUT', headers: h, body: { channel: 'tag', evil: 'x', autoCheckHours: 'çok', migratorUrl: 'postgresql://m:gizli@h/db', __proto__: { polluted: 1 } } });
  assert.equal(r.status, 200);
  const cfg = await r.json();
  assert.equal(cfg.channel, 'tag');
  assert.equal(cfg.evil, undefined);
  assert.equal(cfg.autoCheckHours, 6, 'yanlış tipli değer uygulanmamalı');
  assert.equal(cfg.migratorUrl, '********');
  assert.equal(({}).polluted, undefined);
  const saved = readFileSync(join(state, 'config.json'), 'utf-8');
  assert.ok(saved.includes('gizli'), 'diskte gerçek değer (0600) — GUI yanıtında değil');
});

test('token ve config dosyaları 0600', { skip: process.platform === 'win32' }, () => {
  assert.equal((statSync(join(state, '.gui-token')).mode & 0o777).toString(8), '600');
  assert.equal((statSync(join(state, 'config.json')).mode & 0o777).toString(8), '600');
  assert.equal(readFileSync(join(state, '.gui-token'), 'utf-8').trim(), token);
});
