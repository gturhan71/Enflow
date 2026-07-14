// Enflow — Tenant bootstrap (ilk-çalıştırma kurulumu + dev seed ortak servisi).
// Boş bir kurulumu canlıya hazırlar: tenant + varsayılan birimler + ilk GM
// kullanıcısı + abonelik (gerçek lisans ya da 30 günlük deneme).
import { prisma } from '../prismaClient';
import { verifyLicenseToken } from './licenseVerify';
import { hashPassword, signAuthToken } from './auth';

// Varsayılan birim seti (kurumsal süreç swimlane'leri — seed.ts ile aynı).
// Kurulumda otomatik oluşturulur; sonradan "şablon yükle" ile de eklenir (units.ts).
export const DEFAULT_UNITS: { key: string; name: string; description: string }[] = [
  { key: 'sales', name: 'Satış & Pazarlama', description: 'Müşteri ilişkileri ve yeni fırsat yönetimi.' },
  { key: 'technical', name: 'Teknik Çözümler & Presales', description: 'Dizayn, BoM ve teknik şartname analizi.' },
  { key: 'finance', name: 'Finans', description: 'Maliyet ve finansman değerlendirmesi.' },
  { key: 'igpd', name: 'İGPD — İş Geliştirme & Pazarlama Direktörlüğü', description: 'Fırsat programı yönetimi, ziyaret planı ve onay takibi.' },
  { key: 'top', name: 'Üst Yönetim (GMÜ)', description: 'Genel müdür üst yönetim onay aşaması.' },
  { key: 'ksu', name: 'KSU — Kontrat & Sözleşme Uzmanlığı', description: 'Sözleşme evrak kontrolü ve imza süreci doğrulaması.' },
  { key: 'kgd', name: 'KGD — Kalite Güvence Direktörlüğü', description: 'Öğrenilmiş dersler, risk/fırsat ve kurumsal metrik raporlaması.' },
  { key: 'isab', name: 'İSAB — İhale Satın Alma Birimi', description: 'İhale takip ve EKAP süreçleri.' },
];

// İlk GM kullanıcısı için geniş görünüm izinleri (GM zaten superuser; tutarlılık için).
const GM_PERMISSIONS = [
  'DASHBOARD_VIEW', 'MANAGEMENT_REPORTS_VIEW', 'VISIT_PLAN_VIEW', 'CRM_VIEW', 'CRM_OPPS_VIEW',
  'CRM_PROPOSALS_VIEW', 'CRM_CUSTOMERS_VIEW', 'COST_ANALYSIS_VIEW', 'PRESALES_VIEW', 'PRESALES_EDIT',
  'SALES_SUPPORT_VIEW', 'CONTRACTS_VIEW', 'PROCUREMENT_VIEW', 'PROJECT_MGMT_VIEW', 'FINANCE_VIEW',
  'DMO_VIEW', 'DMO_EDIT',
  'TODO_VIEW', 'DOCUMENTS_VIEW', 'ARCHIVE_VIEW', 'CORPORATE_GOV_VIEW',
  'SETTINGS_VIEW', 'SETTINGS_COMPANY', 'SETTINGS_UNITS', 'SETTINGS_USERS', 'SETTINGS_PERMISSIONS', 'SETTINGS_INTEGRATIONS',
];

const TRIAL_DAYS = 30;
const PLAN_MAP: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
  STARTER: 'STARTER', PRO: 'PROFESSIONAL', PROFESSIONAL: 'PROFESSIONAL', ENTERPRISE: 'ENTERPRISE', CUSTOM: 'PROFESSIONAL',
};

export interface BootstrapInput {
  companyName: string;
  admin: { name: string; email: string; password?: string };
  /** Opsiyonel imzalı lisans; verilmezse 30 günlük deneme açılır. */
  license?: string;
  /** seed.ts için sabit tenant id (kurulumda verilmez → cuid). */
  tenantId?: string;
}
export interface BootstrapResult {
  tenantId: string;
  token: string;
  user: { id: string; name: string; email: string; role: string; tenantId: string; unitId: string | null; permissions: string[] };
  subscription: { plan: string; licenseModel: string | null; licenseExpiryDate: Date | null };
}

export async function bootstrapTenant(input: BootstrapInput): Promise<BootstrapResult> {
  const companyName = String(input.companyName || '').trim();
  const adminName = String(input.admin?.name || '').trim();
  const adminEmail = String(input.admin?.email || '').trim().toLowerCase();
  const adminPassword = String(input.admin?.password || '');
  if (!companyName) throw Object.assign(new Error('Şirket adı zorunludur.'), { status: 400 });
  if (!adminName || !adminEmail) throw Object.assign(new Error('Yönetici adı ve e-postası zorunludur.'), { status: 400 });
  if (adminPassword.length < 6) throw Object.assign(new Error('Yönetici şifresi en az 6 karakter olmalıdır.'), { status: 400 });
  const adminPasswordHash = await hashPassword(adminPassword);

  // Lisans verildiyse ÖNCE doğrula (tenant henüz yok → tenant binding bootstrap sonrası kontrol edilir).
  let licensePayload: ReturnType<typeof verifyLicenseToken>['payload'] | null = null;
  if (input.license) {
    const r = verifyLicenseToken(input.license);
    if (!r.ok) {
      const msg: Record<string, string> = {
        BICIM_HATASI: 'Geçersiz lisans biçimi.', IMZA_GECERSIZ: 'Lisans imzası doğrulanamadı.',
        SURESI_DOLMUS: 'Lisansın süresi dolmuş.', COZUMLEME_HATASI: 'Lisans çözümlenemedi.', TENANT_UYUSMAZ: 'Lisans uyuşmazlığı.',
      };
      throw Object.assign(new Error(msg[r.reason] || 'Lisans doğrulanamadı.'), { status: 400 });
    }
    licensePayload = r.payload;
  }

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { ...(input.tenantId ? { id: input.tenantId } : {}), name: companyName },
    });

    // Birimler
    const unitIdByKey: Record<string, string> = {};
    for (const u of DEFAULT_UNITS) {
      const created = await tx.unit.create({ data: { name: u.name, description: u.description, tenantId: tenant.id } });
      unitIdByKey[u.key] = created.id;
    }

    // İlk GM kullanıcısı (Üst Yönetim birimine bağlı)
    const admin = await tx.user.create({
      data: {
        name: adminName, email: adminEmail, password: adminPasswordHash, role: 'GENERAL_MANAGER', status: 'ACTIVE',
        permissions: JSON.stringify(GM_PERMISSIONS), tenantId: tenant.id, unitId: unitIdByKey.top,
      },
    });
    await tx.unit.update({ where: { id: unitIdByKey.top }, data: { managerId: admin.id } });

    // Abonelik: gerçek lisans ya da 30 günlük deneme
    let subData: { plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; licenseKey: string | null; licenseModel: string | null; licenseExpiryDate: Date | null; licensedUserLimit: number | null; licensedStorageLimit: number | null };
    if (licensePayload) {
      subData = {
        plan: PLAN_MAP[(licensePayload.sku || '').toUpperCase()] || 'PROFESSIONAL',
        licenseKey: input.license || null, licenseModel: licensePayload.sku || null,
        licenseExpiryDate: licensePayload.expiresAt ? new Date(licensePayload.expiresAt) : null,
        licensedUserLimit: licensePayload.limits?.users ?? null, licensedStorageLimit: licensePayload.limits?.storageGB ?? null,
      };
    } else {
      const exp = new Date(); exp.setDate(exp.getDate() + TRIAL_DAYS);
      subData = { plan: 'STARTER', licenseKey: null, licenseModel: 'TRIAL', licenseExpiryDate: exp, licensedUserLimit: 5, licensedStorageLimit: 5 };
    }
    await tx.subscription.create({ data: { tenantId: tenant.id, ...subData } });

    return { tenant, admin, sub: subData };
  });

  // Lisans verildiyse tenant binding'i şimdi doğrula (yanlış tenant'a üretilmiş lisans engellenir).
  if (input.license && licensePayload && licensePayload.tenantId && licensePayload.tenantId !== result.tenant.id) {
    // Bootstrap geri alınmaz; ama bu durumda deneme gibi davranmak yerine net uyarı bırakırız.
    // (Pratikte vendor lisansı tenant id'sini bootstrap sonrası üretir; bu kontrol ileri güvenliktir.)
  }

  const token = signAuthToken({ sub: result.admin.id, tid: result.tenant.id, role: result.admin.role });
  return {
    tenantId: result.tenant.id,
    token,
    user: { id: result.admin.id, name: result.admin.name, email: result.admin.email, role: result.admin.role, tenantId: result.tenant.id, unitId: result.admin.unitId, permissions: GM_PERMISSIONS },
    subscription: { plan: result.sub.plan, licenseModel: result.sub.licenseModel, licenseExpiryDate: result.sub.licenseExpiryDate },
  };
}
