import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { needsBuild } from './ensure-build.mjs';

function fixture() {
  const d = mkdtempSync(join(tmpdir(), 'ensure-build-'));
  mkdirSync(join(d, 'src', 'routes'), { recursive: true });
  mkdirSync(join(d, 'dist'), { recursive: true });
  return d;
}
const at = (p, sec) => utimesSync(p, sec, sec);

test('dist/index.js yoksa derle', () => {
  const d = fixture();
  writeFileSync(join(d, 'src', 'index.ts'), '');
  assert.deepEqual(needsBuild(d), { build: true, reason: 'dist/index.js yok' });
});

test('dist güncelse derleme', () => {
  const d = fixture();
  writeFileSync(join(d, 'src', 'index.ts'), ''); at(join(d, 'src', 'index.ts'), 1000);
  writeFileSync(join(d, 'dist', 'index.js'), ''); at(join(d, 'dist', 'index.js'), 2000);
  assert.deepEqual(needsBuild(d), { build: false });
});

test('alt dizindeki .ts dist\'ten yeniyse derle', () => {
  const d = fixture();
  writeFileSync(join(d, 'dist', 'index.js'), ''); at(join(d, 'dist', 'index.js'), 2000);
  writeFileSync(join(d, 'src', 'routes', 'x.ts'), ''); at(join(d, 'src', 'routes', 'x.ts'), 3000);
  assert.equal(needsBuild(d).build, true);
  assert.match(needsBuild(d).reason, /routes.x\.ts/);
});

test('generated/ ve __tests__/ bayatlığı sayılmaz', () => {
  const d = fixture();
  mkdirSync(join(d, 'src', 'generated'), { recursive: true });
  mkdirSync(join(d, 'src', 'services', '__tests__'), { recursive: true });
  writeFileSync(join(d, 'dist', 'index.js'), ''); at(join(d, 'dist', 'index.js'), 2000);
  writeFileSync(join(d, 'src', 'generated', 'g.ts'), ''); at(join(d, 'src', 'generated', 'g.ts'), 9000);
  writeFileSync(join(d, 'src', 'services', '__tests__', 't.ts'), ''); at(join(d, 'src', 'services', '__tests__', 't.ts'), 9000);
  assert.deepEqual(needsBuild(d), { build: false });
});
