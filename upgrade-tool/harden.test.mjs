import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hardenSecretFiles } from './core.mjs';

const skip = process.platform === 'win32' ? 'POSIX izinleri' : false;
const mode = (p) => (statSync(p).mode & 0o777).toString(8);

test('eski (0644) kurulum: .env, backups/ ve içindeki dump/ön-yedekler sıkılaştırılır', { skip }, () => {
  const home = mkdtempSync(join(tmpdir(), 'harden-'));
  mkdirSync(join(home, 'backend', 'backups'), { recursive: true });
  const env = join(home, 'backend', '.env'), dump = join(home, 'backend', 'backups', 'pre-upgrade-1.dump');
  const sq = join(home, 'backend', 'dev.db.pre-upgrade-2'), other = join(home, 'backend', 'backups', 'baska.txt');
  for (const f of [env, dump, sq, other]) { writeFileSync(f, 'x'); chmodSync(f, 0o644); }
  chmodSync(join(home, 'backend', 'backups'), 0o755);
  const fixed = hardenSecretFiles(home);
  assert.equal(mode(env), '600'); assert.equal(mode(dump), '600'); assert.equal(mode(sq), '600');
  assert.equal(mode(join(home, 'backend', 'backups')), '700');
  assert.equal(mode(other), '644', 'ilgisiz dosyaya dokunulmaz');
  assert.equal(fixed.length, 4);
});

test('zaten sıkı ise değişiklik yok; dosya yoksa hata yok', { skip }, () => {
  const home = mkdtempSync(join(tmpdir(), 'harden-'));
  assert.deepEqual(hardenSecretFiles(home), []);
  mkdirSync(join(home, 'backend'), { recursive: true });
  writeFileSync(join(home, 'backend', '.env'), 'x'); chmodSync(join(home, 'backend', '.env'), 0o600);
  assert.deepEqual(hardenSecretFiles(home), []);
});
