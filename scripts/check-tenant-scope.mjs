#!/usr/bin/env node
// Regresyon guard'ı: backend route'larında GUARD'SIZ id-only mutasyon olmasın.
// prisma.X.update/delete({ where: { id } }) çağrısı, aynı handler'da tenant-sahiplik
// doğrulaması (findFirst/findUnique + tenantId, VEYA where'de tenantId/relation-filter,
// VEYA updateMany/deleteMany + relation filtresi) OLMADAN kullanılırsa IDOR sızıntısıdır.
// Alan B'de kapatılan sınıfın geri gelmesini önler.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROUTES = join(ROOT, 'backend', 'src', 'routes');

const offenders = [];
for (const name of readdirSync(ROUTES)) {
  if (!name.endsWith('.ts')) continue;
  const file = join(ROUTES, name);
  const L = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < L.length; i++) {
    const ln = L[i];
    // id-only .update(/.delete( where:{ id ... }  (updateMany/deleteMany hariç)
    if (!/\.(update|delete)\(\{\s*where:\s*\{\s*id\b/.test(ln)) continue;
    if (/\.(updateMany|deleteMany)\(/.test(ln)) continue;
    if (/tenantId/.test(ln)) continue;                 // where'de tenantId → güvenli
    if (/prisma\.tenant\.update/.test(ln)) continue;    // kendi tenant kaydı
    if (/req\.tenantId/.test(ln)) continue;
    // handler bağlamı (üstteki router.METHOD'a kadar) tenant guard içeriyor mu?
    let s = i;
    while (s > 0 && !/router\.(get|post|put|delete|patch)/.test(L[s])) s--;
    const ctx = L.slice(s, i).join(' ');
    const guarded =
      /find(First|Unique)[^;]*tenantId/.test(ctx) ||           // parent/self findFirst tenantId
      /ownsProject|ownsPR|owns[A-Z]/.test(ctx) ||               // sahiplik helper'ı
      /findFirst[^;]*(project|opportunity|purchaseRequest|contractWorkflow)\s*:/.test(ctx); // relation-scoped parent
    if (!guarded) offenders.push(`${file.replace(ROOT, '')}:${i + 1}  ${ln.trim().slice(0, 85)}`);
  }
}

if (offenders.length) {
  console.error(`\n✗ check:tenant-scope — ${offenders.length} guard'sız id-only mutasyon (IDOR riski):`);
  offenders.forEach((o) => console.error('  ' + o));
  console.error('\nÖnce parent/self tenant sahipliğini doğrulayın (findFirst {id, tenantId}) veya');
  console.error('updateMany/deleteMany + relation-filter ({ id, project:{ tenantId } }) kullanın.\n');
  process.exit(1);
}
console.log('✓ check:tenant-scope — guard\'sız id-only mutasyon yok.');
