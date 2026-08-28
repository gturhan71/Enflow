/**
 * RBAC test kullanıcılarında rol modeline (roleDefaultPermissions.ts — `pnpm
 * audit:roles` kanonik kaynağı) aykırı, zamanla birikmiş "drift" izinleri temizler.
 * Bu drift, RBAC UI süitinde false "UI AÇIĞI" üretiyordu (menü, rolün sahip
 * OLMAMASI gereken izinle görünüyor).
 *
 * Kapsam bilinçli olarak DAR: yalnız RBAC süitinde çakışma yaratan kesin
 * off-model izinler kaldırılır. Geniş "hepsini defaults'a resetle" YAPILMAZ
 * (bazı rbac.config beklentileri seed'e göre yazılmış olabilir). Gerçek GM'e
 * dokunulmaz. İdempotent — izin zaten yoksa kullanıcı atlanır.
 *
 * Çalıştır:  npx ts-node --transpile-only src/scripts/sync-rbac-testuser-perms.ts [--dry]
 */
import { prisma } from '../prismaClient';

const DRY = process.argv.includes('--dry');

// email → rol modelinde OLMAYAN, kaldırılacak izinler
const OFF_MODEL: Record<string, string[]> = {
  'mehmetkoc@enflow.com': ['DMO_VIEW', 'SERVICE_TICKETS_VIEW'], // SALES_REP
  'backup@t-ecosystem.com': ['DMO_VIEW'],                       // BACKUP_ADMIN
};

function parsePerms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } }
  return [];
}

async function main() {
  let changed = 0;
  for (const [email, drop] of Object.entries(OFF_MODEL)) {
    const u = await prisma.user.findFirst({ where: { email }, select: { id: true, role: true, permissions: true } });
    if (!u) { console.log(`${email} — kullanıcı yok, atlandı`); continue; }
    const have = parsePerms(u.permissions);
    const removing = have.filter((p) => drop.includes(p));
    if (removing.length === 0) { console.log(`${email} — drift yok, atlandı`); continue; }
    const next = have.filter((p) => !drop.includes(p)).sort();
    console.log(`${email} (${u.role})  −[${removing.join(', ')}]`);
    if (!DRY) await prisma.user.update({ where: { id: u.id }, data: { permissions: JSON.stringify(next) } });
    changed++;
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}${changed} kullanıcı ${DRY ? 'güncellenirdi' : 'güncellendi'}.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
