// Enflow — Tek seferlik: RBAC test suite'inin "presales_eng" personası olarak
// kullandığı tenant-1 kullanıcısının (tests/rbac/rbac.config.ts `roles.presales_eng`)
// rolü dev.db'de bir noktada elle PRESALES_MGR'a değiştirilmiş — units.ts
// GM_OR_PRESALES kapısı (bkz. governance/role-matrix.ts PRESALES_ENG
// endpointDomains:['units']) bu rolü içermediğinden GET /api/units 403
// dönüyordu (api-permissions.spec.ts "Birim listesi" beklenen "allow" yerine
// deny). Bu script SADECE role alanını PRESALES_ENG'e geri alır — permissions
// dizisine ve diğer alanlara dokunmaz. İdempotent (rol zaten PRESALES_ENG ise
// hiçbir şey yapmaz).
//
// Çalıştırma:  npx tsx src/scripts/fix-presales-eng-rbac-test-user-role.ts
import { prisma } from '../prismaClient';

const EMAIL = 'goktugturhan74@gmail.com';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, role: true, tenantId: true } });
  if (!user) {
    console.log(`Kullanıcı bulunamadı: ${EMAIL} — atlandı.`);
    return;
  }
  if (user.role === 'PRESALES_ENG') {
    console.log(`${EMAIL} zaten PRESALES_ENG — değişiklik yok.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: 'PRESALES_ENG' } });
  console.log(`✔ ${EMAIL} (tenant ${user.tenantId}) rolü ${user.role} → PRESALES_ENG olarak düzeltildi.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
