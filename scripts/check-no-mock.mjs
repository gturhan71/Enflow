#!/usr/bin/env node
// Regresyon guard'ı: CANLI UI kodunda hardcoded MOCK_/demo veri KULLANIMI olmasın.
// (Kaynak tanımı src/constants.ts serbest; onu import edip canlı ekranda göstermek yasak.)
// Bell/HandOff/Contract gibi "başka tenant/demo verisi sızıntısı" sınıfını önler.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const ALLOW = new Set([join(SRC, 'constants.ts')]); // MOCK_ tanımlarının kaynağı

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const offenders = [];
for (const file of walk(SRC)) {
  if (ALLOW.has(file)) continue;
  const lines = readFileSync(file, 'utf-8').split('\n');
  lines.forEach((ln, i) => {
    // Yorum satırlarını atla; MOCK_<AD> kullanımını yakala.
    const code = ln.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (/\bMOCK_[A-Z]/.test(code)) offenders.push(`${file.replace(ROOT, '')}:${i + 1}  ${ln.trim().slice(0, 80)}`);
  });
}

if (offenders.length) {
  console.error(`\n✗ check:no-mock — canlı UI'da ${offenders.length} MOCK_ kullanımı bulundu (yasak):`);
  offenders.forEach((o) => console.error('  ' + o));
  console.error('\nGerçek API/prop verisi veya boş-durum kullanın. (Tanım kaynağı: src/constants.ts serbest.)\n');
  process.exit(1);
}
console.log('✓ check:no-mock — canlı UI\'da MOCK_ kullanımı yok.');
