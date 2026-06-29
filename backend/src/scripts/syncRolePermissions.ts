/**
 * Görev-görünürlüğü izin senkronu (ADDITIVE) — governance/role-matrix.ts
 * tek kaynağında `TODO_VIEW` tanımlı her rolün DB kullanıcılarına bu izni
 * EKLER. Gerekçe: herhangi bir kullanıcı bir başka kişiye görev atayabildiği
 * için (kişi-bazlı atama), atanan herkesin "Görevler & Takip" modülünde
 * kendi görevlerini görmesi gerekir. Hiçbir izni SİLMEZ; yalnız TODO_VIEW
 * ekler (diğer izinler RBAC süitince yönetildiğinden dokunulmaz). GM ('*')
 * atlanır — superuser hasPermission ile zaten her zaman true döner.
 *
 * Çalıştır:  pnpm sync:roles            (uygula)
 *            pnpm sync:roles --dry       (yalnız raporla)
 */
import { prisma } from '../prismaClient';
import { ROLE_MATRIX } from '../../../governance/role-matrix';

const DRY = process.argv.includes('--dry');

function parsePerms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

async function main() {
  const byRole = new Map(ROLE_MATRIX.map((r) => [r.role, r.modules]));
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, permissions: true } });

  let changed = 0;
  for (const u of users) {
    const spec = byRole.get(u.role);
    if (!spec || spec.includes('*')) continue; // matriste yok ya da GM superuser
    if (!spec.includes('TODO_VIEW')) continue; // bu rol görev görmez (ör. ADMIN/AUDITOR)
    const current = parsePerms(u.permissions);
    const missing = current.includes('TODO_VIEW') ? [] : ['TODO_VIEW'];
    if (missing.length === 0) continue;

    const next = Array.from(new Set([...current, ...missing])).sort();
    console.log(`${u.email} (${u.role}) + [${missing.join(', ')}]`);
    if (!DRY) {
      await prisma.user.update({ where: { id: u.id }, data: { permissions: JSON.stringify(next) } });
    }
    changed++;
  }

  console.log(`\n${DRY ? '[DRY] ' : ''}${changed} kullanıcı ${DRY ? 'güncellenirdi' : 'güncellendi'}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
