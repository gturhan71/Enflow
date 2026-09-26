#!/usr/bin/env node
// `pnpm start` öncesi (prestart): dist/ yoksa ya da src/'den eskiyse backend'i derler.
// Neden: `start` artık `node dist/index.js` (ADR-001). Eski bir kurulum, eski upgrade-tool
// ile ilk kez yükseltildiğinde (o araç backend'i derlemez) ya da biri `git pull` sonrası
// `pnpm start` dediğinde dist/ eksik/bayat kalır → "Cannot find module" ile açılmaz.
// Servisler (systemd/launchd/WinSW) `node dist/index.js`'i DOĞRUDAN çalıştırır — bu betikten
// geçmez; onlar için derleme kurulum/upgrade adımındadır.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** dist/index.js yoksa VEYA src/ altındaki herhangi bir .ts ondan yeniyse true. */
export function needsBuild(backendDir) {
  const out = join(backendDir, 'dist', 'index.js');
  if (!existsSync(out)) return { build: true, reason: 'dist/index.js yok' };
  const builtAt = statSync(out).mtimeMs;
  const stack = [join(backendDir, 'src')];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated' && e.name !== '__tests__') stack.push(p); }
      else if (e.name.endsWith('.ts') && statSync(p).mtimeMs > builtAt) return { build: true, reason: `${p.slice(backendDir.length + 1)} dist'ten yeni` };
    }
  }
  return { build: false };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const r = needsBuild(backendDir);
  if (r.build) {
    process.stdout.write(`[prestart] backend derleniyor (${r.reason})…\n`);
    const b = spawnSync('pnpm', ['build'], { cwd: backendDir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (b.status !== 0) { process.stderr.write('[prestart] derleme başarısız — başlatılamıyor.\n'); process.exit(b.status ?? 1); }
  }
}
