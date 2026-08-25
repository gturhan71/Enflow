// Enflow — Tek seferlik: rol bazlı varsayılan izin ataması eklenmeden ÖNCE
// oluşmuş mevcut kullanıcılara eksik varsayılan izinleri tamamlar (bkg.
// services/roleDefaultPermissions.ts). YALNIZ EKLER — hiçbir mevcut izni
// kaldırmaz (admin'in elle yaptığı ek yetkilendirmeler korunur). İdempotent —
// tekrar çalıştırmak zararsız (eksik kalmamışsa hiçbir şey değişmez).
//
// Çalıştırma:  npx ts-node src/scripts/backfill-role-default-permissions.ts
import { prisma } from '../prismaClient';
import { defaultPermissionsForRole } from '../services/roleDefaultPermissions';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, permissions: true } });

  let fixed = 0;
  for (const u of users) {
    let current: string[];
    try { current = JSON.parse(u.permissions); } catch { current = []; }
    if (!Array.isArray(current)) current = [];

    const defaults = defaultPermissionsForRole(u.role);
    const missing = defaults.filter((p) => !current.includes(p));
    if (missing.length === 0) continue;

    const merged = [...current, ...missing];
    await prisma.user.update({ where: { id: u.id }, data: { permissions: JSON.stringify(merged) } });
    console.log(`  ✔ ${u.name} (${u.role}) — eklendi: ${missing.join(', ')}`);
    fixed++;
  }

  if (fixed === 0) {
    console.log('Eksik izinli kullanıcı yok — tüm kullanıcılar rol varsayılanlarını zaten sağlıyor.');
  } else {
    console.log(`\n${fixed} kullanıcının izin listesi tamamlandı.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
