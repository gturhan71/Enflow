// RBAC süiti için DETERMİNİSTİK test fixture'ı (P0-4): boş bir veritabanında tests/rbac/rbac.config.ts'in
// beklediği dünyayı kurar — CI'da ve yerelde temiz DB ile aynı sonucu verir; geliştiricinin dev.db'sine
// bağımlılık YOK. Kaynak tek: rbac.config.ts (roles + crossTenantUser + testPassword) → testler ve fixture
// birbirinden ayrışamaz.
//   - tenant-1: bootstrapTenant (varsayılan birimler + abonelik) + roles içindeki HER rol için kullanıcı
//     (rol = anahtarın büyük harfi; izinler = defaultPermissionsForRole — governance role matrisiyle aynı kaynak)
//   - tenant-1'e PLUGIN_CATALOG'un TÜMÜ lisanslanır (ACTIVE/ADVISORY — dev tenant'ıyla aynı): lisanslı modül
//     uçları (ör. /api/dmo, requireEntitlement) rol kapısından ÖNCE 402 döner; lisans yoksa "[DENY] → 401/403"
//     beklentisi hiçbir zaman sınanamaz (fixture bunu ilk koşuda gösterdi: 85 sahte hata)
//   - tenant2: yalnız izolasyon testinin ihtiyacı olan GM (crossTenantUser)
//   - PERSONA_EXTRA_PERMISSIONS: rbac.config.ts uiMatrix'i bu üç personanın (gerçek dev kullanıcılarından
//     türetilmiş) rol-varsayılanının ÖTESİNDE menü izinleri olduğunu varsayar; fixture bunları açıkça verir
// İdempotent: tenant/kullanıcı varsa dokunmaz. Kullanım: DATABASE_URL=… pnpm seed:rbac
import { roles, crossTenantUser, testPassword } from '../../../tests/rbac/rbac.config';
import { prisma } from '../prismaClient';
import { bootstrapTenant } from '../services/bootstrapTenant';
import { hashPassword } from '../services/auth';
import { defaultPermissionsForRole } from '../services/roleDefaultPermissions';

const PERSONA_EXTRA_PERMISSIONS: Record<string, string[]> = {
  PRESALES_ENG: ['SALES_SUPPORT_VIEW', 'PROJECT_MGMT_VIEW'],
  SALES_REP: ['PROCUREMENT_VIEW', 'ARCHIVE_VIEW'],
  SALES_MGR: ['PRESALES_VIEW', 'VISIT_PLAN_VIEW', 'FINANCE_VIEW', 'ARCHIVE_VIEW'],
};
import { runWithRlsBypass } from '../services/tenantContext';
import { PLUGIN_CATALOG } from '../services/pluginCatalog';
import { logger } from '../utils/logger';

const T1 = roles.general_manager.tenantId;

async function ensureTenant(tenantId: string, companyName: string, adminEmail: string, adminName: string) {
  const exists = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (exists) return false;
  await bootstrapTenant({ companyName, admin: { name: adminName, email: adminEmail, password: testPassword }, tenantId });
  return true;
}

async function main() {
  await runWithRlsBypass(async () => {
    const createdT1 = await ensureTenant(T1, 'RBAC Test Şirketi', roles.general_manager.email, 'RBAC Genel Müdür');
    const createdT2 = await ensureTenant(crossTenantUser.tenantId, 'RBAC Test Şirketi 2', crossTenantUser.email, 'RBAC Tenant2 GM');

    const passwordHash = await hashPassword(testPassword);
    let created = 0;
    for (const [name, r] of Object.entries(roles)) {
      if (name === 'general_manager') continue; // bootstrapTenant zaten oluşturdu
      const email = r.email.toLowerCase();
      if (await prisma.user.findUnique({ where: { email } })) continue;
      const role = name.toUpperCase();
      await prisma.user.create({
        data: {
          name: `RBAC ${name}`, email, password: passwordHash, role, status: 'ACTIVE',
          permissions: JSON.stringify([...new Set([...defaultPermissionsForRole(role), ...(PERSONA_EXTRA_PERMISSIONS[role] ?? [])])]), tenantId: r.tenantId,
        },
      });
      created++;
    }
    for (const p of PLUGIN_CATALOG) {
      await prisma.pluginEntitlement.upsert({
        where: { tenantId_pluginKey: { tenantId: T1, pluginKey: p.key } },
        create: { tenantId: T1, pluginKey: p.key, status: 'ACTIVE', mode: 'ADVISORY', activatedAt: new Date() },
        update: { status: 'ACTIVE' },
      });
    }
    logger.info(`[seed-rbac] tenant-1: ${createdT1 ? 'oluşturuldu' : 'vardı'} · tenant2: ${createdT2 ? 'oluşturuldu' : 'vardı'} · yeni kullanıcı: ${created} · lisanslı eklenti: ${PLUGIN_CATALOG.length}`);
  });
}

main()
  .catch((e: unknown) => { logger.error('[seed-rbac] başarısız', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
