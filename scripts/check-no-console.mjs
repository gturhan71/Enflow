#!/usr/bin/env node
// Regresyon guard'ı: YENİ console.* çağrısı eklenmesin (mevcut borç Faz 1'de temizlenecek).
// check-no-mock.mjs'in ALLOW-list deseniyle aynı; farkı: sıfır-tolerans değil, BASELINE-tolerans —
// mevcut dosyalardaki sayı artarsa (veya baseline'da olmayan yeni bir dosyada console.* görülürse) FAIL.
// Sayı azalırsa (Faz 1 temizliği) sorun değil — guard buna izin verir, baseline'ı güncellemeyi zorlamaz.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// Sanctioned console wrapper'lar / operatör-yüzlü CLI script'leri — guard kapsamı dışı.
const EXCLUDE_FILES = new Set([join(ROOT, 'src/utils/logger.ts'), join(ROOT, 'backend/src/utils/logger.ts')]);
const EXCLUDE_DIRS = [join(ROOT, 'backend/src/scripts')]; // CLI araçları: stdout'a rapor basmak amaçlı, prod istek/yanıt akışı değil

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (EXCLUDE_DIRS.some((d) => p.startsWith(d))) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function countConsole(file) {
  const code = readFileSync(file, 'utf-8')
    .split('\n')
    .map((ln) => ln.replace(/\/\/.*$/, '')) // satır-sonu yorumlarını at (kaba ama yeterli)
    .join('\n');
  const matches = code.match(/\bconsole\.(log|debug|info|warn|error|trace)\s*\(/g);
  return matches ? matches.length : 0;
}

// Faz 1b'de (2026-08) tüm mevcut borç logger'a taşındı — baseline sıfırlandı.
// Bundan sonra src/utils/logger.ts ve backend/src/utils/logger.ts DIŞINDA
// (+ backend/src/scripts/ CLI araçları hariç) HİÇBİR console.* eklenemez.
const BASELINE = {};

const offenders = [];
let cleanedUp = 0;
for (const dir of ['src', 'backend/src']) {
  for (const file of walk(join(ROOT, dir))) {
    if (EXCLUDE_FILES.has(file)) continue;
    const rel = relative(ROOT, file);
    const count = countConsole(file);
    if (count === 0) continue;
    const allowed = BASELINE[rel] ?? 0;
    if (count > allowed) {
      offenders.push(`${rel}: ${count} console.* (izinli: ${allowed}) — ${count - allowed} yeni çağrı`);
    } else if (count < allowed) {
      cleanedUp += allowed - count;
    }
  }
}

if (offenders.length) {
  console.error(`\n✗ check:no-console — ${offenders.length} dosyada YENİ console.* çağrısı bulundu:`);
  offenders.forEach((o) => console.error('  ' + o));
  console.error('\nutils/logger (FE) / backend logger (BE, Faz 1) kullanın. Mevcut borç bu guard\'ı bloklamaz,');
  console.error('yalnız ARTIŞ bloklanır — baseline\'ın üzerine çıkmayın.\n');
  process.exit(1);
}
console.log(
  cleanedUp > 0
    ? `✓ check:no-console — yeni console.* yok (${cleanedUp} çağrı temizlenmiş, baseline güncellenebilir).`
    : "✓ check:no-console — yeni console.* yok (mevcut borç sabit, artmadı)."
);
