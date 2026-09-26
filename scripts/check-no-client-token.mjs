#!/usr/bin/env node
// Regresyon guard'ı (P0-3): oturum token'ı tarayıcı JavaScript'inde OLMAMALI.
//  1) `enflow_auth_token` localStorage anahtarı yalnız TEMİZLEME (removeItem) için anılabilir
//  2) 'mock-token' yedek değeri yasak
//  3) `Bearer ${...}` başlığı üretimi yasak (oturum httpOnly çerezde; istekler authFetch/fetchWithAuth ile)
//  4) `document.write(` kullanan dosya kullanıcı verisini kaçışlamak ZORUNDA (escapeHtml/esc importu)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of walk(SRC)) {
  const rel = file.replace(ROOT, '');
  const text = readFileSync(file, 'utf-8');
  text.split('\n').forEach((ln, i) => {
    const code = ln.replace(/\/\/.*$/, '');
    if (/enflow_auth_token/.test(code) && !/removeItem\(\s*['"]enflow_auth_token['"]\s*\)/.test(code)) offenders.push(`${rel}:${i + 1}  localStorage token anahtarı: ${ln.trim().slice(0, 70)}`);
    if (/mock-token/.test(code)) offenders.push(`${rel}:${i + 1}  'mock-token' yedek değeri`);
    if (/Bearer\s*\$\{/.test(code)) offenders.push(`${rel}:${i + 1}  Bearer başlığı üretimi: ${ln.trim().slice(0, 70)}`);
  });
  if (/document\.write\(/.test(text) && !/escapeHtml|\besc\(/.test(text)) offenders.push(`${rel}  document.write kullanıyor ama escapeHtml/esc yok (saklı XSS riski)`);
}

if (offenders.length) {
  console.error('✗ check-no-client-token: oturum token\'ı / kaçışlamasız HTML tespit edildi:\n  ' + offenders.join('\n  '));
  process.exit(1);
}
console.log('✓ check-no-client-token: istemci kodunda token / kaçışlamasız document.write yok.');
