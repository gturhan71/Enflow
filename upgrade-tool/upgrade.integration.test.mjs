// runUpgrade entegrasyon testi — GERÇEK kod, yerel bare git deposu + sahte `pnpm` (PATH'te).
// 10x avı (2026-09-26) regresyonları: yükseltme sırasında yazılan kullanıcı verisi rollback'te silinmesin;
// restart hatası başarılı yükseltmeyi geri aldırmasın; sağlıksız açılışta kod geri alınsın.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import http from 'node:http';
import { runUpgrade } from './core.mjs';

const skip = process.platform === 'win32' ? 'POSIX pnpm shim' : false;
const WRITE = 'user-write-during-upgrade';

const G = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// Sahte pnpm: `build` ve `prisma migrate` sırasında canlı servisin yazdığı veriyi (dev.db'ye satır) simüle eder;
// FAIL_BUILD / FAIL_MIGRATE dosyası varsa o adım hata verir.
function shimDir() {
  const d = mkdtempSync(join(tmpdir(), 'pnpm-shim-'));
  writeFileSync(join(d, 'pnpm'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const a = process.argv.slice(2), cwd = process.cwd();
const db = path.join(cwd.endsWith('backend') ? cwd : path.join(cwd, 'backend'), 'dev.db');
// yalnız BİR KEZ yazar (rollback'in kendi build'leri silinen veriyi geri eklemesin)
const flag = db + '.live-written';
const live = () => { if (fs.existsSync(db) && !fs.existsSync(flag)) { fs.appendFileSync(db, '${WRITE}\\n'); fs.writeFileSync(flag, '1'); } };
if (a[0] === 'prisma' && a[1] === 'migrate') { live(); if (fs.existsSync('FAIL_MIGRATE')) { console.error('migration hatası'); process.exit(1); } }
if (a[0] === 'build') { live(); if (fs.existsSync('FAIL_BUILD')) { console.error('error TS2322: derleme hatası'); process.exit(2); } }
process.exit(0);
`);
  chmodSync(join(d, 'pnpm'), 0o755);
  return d;
}

function makeEnv(port) {
  const T = mkdtempSync(join(tmpdir(), 'upg-int-'));
  const remote = join(T, 'remote.git'), dev = join(T, 'dev'), home = join(T, 'home');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  mkdirSync(join(dev, 'backend'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', dev]);
  writeFileSync(join(dev, '.gitignore'), 'node_modules/\nbackend/.env\nbackend/dev.db*\nbackend/dist/\nbackend/backups/\nupdate-status.json\n');
  writeFileSync(join(dev, 'package.json'), '{"name":"x"}');
  writeFileSync(join(dev, 'backend', 'package.json'), '{"version":"1.0.0"}');
  writeFileSync(join(dev, 'marker.txt'), 'v1');
  G(dev, 'add', '-A'); G(dev, 'commit', '-qm', 'v1'); G(dev, 'remote', 'add', 'origin', remote); G(dev, 'push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', remote, home]);
  writeFileSync(join(home, 'backend', '.env'), `DATABASE_URL="file:./dev.db"\nPORT=${port}\n`);
  writeFileSync(join(home, 'backend', 'dev.db'), 'seed\n');
  const publish = (files) => {
    for (const [f, c] of Object.entries(files)) { mkdirSync(join(dev, f, '..'), { recursive: true }); writeFileSync(join(dev, f), c); }
    G(dev, 'add', '-A'); G(dev, 'commit', '-qm', 'vN'); G(dev, 'push', '-q', 'origin', 'main');
  };
  return { home, publish, head: () => G(home, 'rev-parse', 'HEAD'), db: () => readFileSync(join(home, 'backend', 'dev.db'), 'utf-8') };
}

function healthServer(status = 200) {
  return new Promise((resolve) => {
    const s = http.createServer((_q, r) => { r.writeHead(status, { 'content-type': 'application/json' }); r.end(JSON.stringify({ status: 'ok', db: 'ok', uptimeSec: 0 })); });
    s.listen(0, '127.0.0.1', () => resolve({ port: s.address().port, close: () => s.close() }));
  });
}

async function scenario({ files, restartCommand, healthStatus = 200 }) {
  const shim = shimDir();
  const prevPath = process.env.PATH, prevOff = process.env.ENFLOW_OFFLINE;
  process.env.PATH = shim + delimiter + prevPath; process.env.ENFLOW_OFFLINE = '1';
  const hs = await healthServer(healthStatus);
  try {
    const env = makeEnv(hs.port);
    const before = env.head();
    env.publish(files);
    const lines = [];
    const res = await runUpgrade(env.home, { channel: 'commit', restartCommand, healthTimeoutMs: 1500, log: (m) => lines.push(m) });
    return { env, before, res, log: lines.join('\n'), status: existsSync(join(env.home, 'update-status.json')) ? JSON.parse(readFileSync(join(env.home, 'update-status.json'), 'utf-8')) : null };
  } finally { hs.close(); process.env.PATH = prevPath; if (prevOff === undefined) delete process.env.ENFLOW_OFFLINE; else process.env.ENFLOW_OFFLINE = prevOff; }
}

test('build hatası: kod geri alınır, DB\'ye dokunulmadığı için yükseltme sırasında yazılan veri KORUNUR', { skip }, async () => {
  const { env, before, res, log } = await scenario({ files: { 'backend/FAIL_BUILD': '1', 'marker.txt': 'v2' }, restartCommand: 'true' });
  assert.equal(res.ok, false);
  assert.equal(env.head(), before, 'kod eski sürüme dönmeli');
  assert.ok(env.db().includes(WRITE), 'yükseltme sırasında yazılan kullanıcı verisi silinmemeli (eski hata: yedek geri yükleniyordu)');
  assert.match(log, /geri yükleme gerekmez|DOKUNULMADI/);
});

test('migration hatası: DB OTOMATİK geri yüklenmez, hazır komut loglanır', { skip }, async () => {
  const { env, before, res, log } = await scenario({ files: { 'backend/FAIL_MIGRATE': '1', 'marker.txt': 'v2' }, restartCommand: 'true' });
  assert.equal(res.ok, false);
  assert.equal(env.head(), before);
  assert.ok(env.db().includes(WRITE), 'DB otomatik geri yüklenmemeli');
  assert.match(log, /OTOMATİK GERİ YÜKLENMEDİ/);
  assert.match(log, /cp ".*pre-upgrade-\d+" ".*dev\.db"/);
});

test('restart komutu başarısız: başarılı yükseltme GERİ ALINMAZ (ok:true, restartFailed, elle komut)', { skip }, async () => {
  const { env, before, res, status } = await scenario({ files: { 'marker.txt': 'v2' }, restartCommand: 'exit 1' });
  assert.equal(res.ok, true);
  assert.equal(res.restartFailed, true);
  assert.notEqual(env.head(), before, 'yeni sürümde kalmalı');
  assert.ok(res.manual.includes('exit 1'));
  assert.ok(env.db().includes(WRITE));
  assert.equal(status.update.applied, true);
  assert.equal(status.update.needsRestart, true);
});

test('sağlıklı restart: tam başarı', { skip }, async () => {
  const { env, before, res } = await scenario({ files: { 'marker.txt': 'v2' }, restartCommand: 'true' });
  assert.equal(res.ok, true);
  assert.equal(res.restartFailed, undefined);
  assert.notEqual(env.head(), before);
});

test('sağlıksız açılış (health 503): kod geri alınır, veri korunur', { skip }, async () => {
  const { env, before, res, log } = await scenario({ files: { 'marker.txt': 'v2' }, restartCommand: 'true', healthStatus: 503 });
  assert.equal(res.ok, false);
  assert.equal(env.head(), before);
  assert.ok(env.db().includes(WRITE));
  assert.match(log, /sağlıklı açılmadı/);
});
