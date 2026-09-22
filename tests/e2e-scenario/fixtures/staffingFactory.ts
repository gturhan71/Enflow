import type { Db } from '../helpers/prisma';
import type { ApiClient } from '../helpers/apiClient';
import { hashTestPassword } from '../helpers/authHelpers';

/** DEFAULT_UNITS key -> ad (backend/src/services/bootstrapTenant.ts ile birebir). */
export const UNIT_NAME_BY_KEY: Record<string, string> = {
  sales: 'Satış & Pazarlama',
  technical: 'Teknik Çözümler & Presales',
  finance: 'Finans',
  igpd: 'İGB — İş Geliştirme Birimi',
  top: 'Üst Yönetim (GMÜ)',
  ksu: 'KSU — Kontrat & Sözleşme Uzmanlığı',
  kgd: 'KY — Kalite Yönetimi',
  isab: 'İYB — İhale Yönetim Birimi',
  procurement: 'Satın Alma',
  project: 'Proje Yönetimi',
  legal: 'Hukuk',
};

/**
 * "Bos koltuk" senaryosunun on-kosulunu dogrular — o role hic ACTIVE kullanici
 * atanmamis mi (autoSkipOrphanStages'in kullandigi ayni sorgu:
 * backend/src/services/approvalChainService.ts). Bootstrap sonrasi bu her zaman
 * dogru olmali (yalniz GENERAL_MANAGER olusur) ama gelecekte bootstrapTenant
 * degisirse (ör. ek varsayilan kullanici eklenirse) bu regresyonu erken yakalar.
 */
export async function assertSeatEmpty(prisma: Db, tenantId: string, role: string): Promise<void> {
  const count = await prisma.user.count({ where: { tenantId, role, status: 'ACTIVE' } });
  if (count > 0) throw new Error(`Beklenen bos koltuk dolu cikti: ${role} icin ${count} aktif kullanici var.`);
}

/** DEFAULT_UNITS adiyla (bootstrapTenant.ts) olusturulmus birimin id'sini bulur. */
export async function getUnitId(prisma: Db, tenantId: string, unitName: string): Promise<string> {
  const unit = await prisma.unit.findFirst({ where: { tenantId, name: unitName } });
  if (!unit) throw new Error(`Birim bulunamadi: ${unitName}`);
  return unit.id;
}

/**
 * Bir role gercekten ACTIVE bir kullanici atar VE o kullanicinin gercek
 * (POST /api/auth/login ile alinan) JWT'sini doner — koltugu "dolu" yapan
 * asil budur (autoSkipOrphanStages ayni sorguyla kontrol eder). Kullanici
 * DOGRUDAN Prisma ile yaratilir (POST /api/users GM yetkisi ister — GM'in
 * bilerek pasif oldugu senaryolarda bu API'ye erisim yoktur), ama login
 * GERCEK API cagrisidir — token sahte degildir.
 */
export async function createStaffedUser(
  prisma: Db,
  api: ApiClient,
  params: { tenantId: string; role: string; unitId: string; name?: string },
): Promise<{ id: string; email: string; token: string }> {
  const email = `${params.role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;
  const password = 'test1234';
  const hashed = await hashTestPassword(password);
  const user = await prisma.user.create({
    data: {
      tenantId: params.tenantId,
      name: params.name ?? `E2E ${params.role}`,
      email,
      password: hashed,
      role: params.role,
      unitId: params.unitId,
      status: 'ACTIVE',
      permissions: '[]',
    },
  });
  const { status, body } = await api.post<{ token: string; error?: string }>('/auth/login', { email, password });
  if (status !== 200) throw new Error(`createStaffedUser login basarisiz (${params.role}, ${status}): ${JSON.stringify(body)}`);
  return { id: user.id, email, token: body.token };
}

/** Koltugu "bosaltir" — kisi ayrildi/rolden alindi senaryosu (status pasif -> orphan sayilir). */
export async function deactivateUser(prisma: Db, userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } });
}
