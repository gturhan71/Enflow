/**
 * Tek seferlik (idempotent): Kârlılık modülü için eklenen `PROFITABILITY_VIEW`
 * iznini, `governance/role-matrix.ts` tek kaynağında bu izne sahip rollerin
 * ZATEN VAR OLAN DB kullanıcılarına EKLER (yeni izinler yalnız kullanıcı
 * oluşturulurken atandığından, mevcut kurulumlara otomatik yansımaz).
 *
 * ADDITIVE — hiçbir izni silmez. GM ('*' / superuser) atlanır (hasPermission
 * zaten her zaman true). İzin zaten varsa kullanıcı atlanır.
 *
 * Çalıştır:  npx ts-node --transpile-only src/scripts/backfill-profitability-view-permission.ts
 *            (--dry ile yalnız raporlar)
 */
import { prisma } from '../prismaClient';
import { ROLE_MATRIX } from '../../../governance/role-matrix';

const PERM = 'PROFITABILITY_VIEW';
const DRY = process.argv.includes('--dry');

function parsePerms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

async function main() {
  const rolesWithPerm = new Set(
    ROLE_MATRIX.filter((r) => r.modules.includes(PERM) && !r.modules.includes('*')).map((r) => r.role),
  );
  if (rolesWithPerm.size === 0) {
    console.log(`⚠ role-matrix'te ${PERM} tanımlı rol yok — script no-op.`);
    await prisma.$disconnect();
    return;
  }
  console.log(`${PERM} tanımlı roller: ${[...rolesWithPerm].join(', ')}`);

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, permissions: true } });
  let changed = 0;
  for (const u of users) {
    if (!rolesWithPerm.has(u.role)) continue;
    const current = parsePerms(u.permissions);
    if (current.includes(PERM)) continue;
    const next = Array.from(new Set([...current, PERM])).sort();
    console.log(`  ${u.email} (${u.role}) + ${PERM}`);
    if (!DRY) {
      await prisma.user.update({ where: { id: u.id }, data: { permissions: JSON.stringify(next) } });
    }
    changed++;
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}${changed} kullanıcı ${DRY ? 'güncellenirdi' : 'güncellendi'}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
