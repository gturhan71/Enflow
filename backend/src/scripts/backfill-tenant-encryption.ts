// Enflow — Tek seferlik: mevcut düz-metin hassas alanları (Tenant YZ apiKey, Vendor
// iban/bankName, Customer taxNumber/taxOffice) tenant-başına DEK ile şifreler.
// add_tenant_dek migration'ından SONRA çalıştırılır. İdempotent — zaten şifreli (enc:v1:
// önekli) değerleri atlar, tekrar çalıştırmak güvenlidir.
//
// Çalıştırma:  npx ts-node src/scripts/backfill-tenant-encryption.ts
import { prisma } from '../prismaClient';
import { encryptForTenant, isEncrypted } from '../services/tenantEncryption';

async function backfillVendors(tenantId: string): Promise<number> {
  const vendors = await prisma.vendor.findMany({
    where: { tenantId, OR: [{ iban: { not: null } }, { bankName: { not: null } }] },
    select: { id: true, iban: true, bankName: true },
  });
  let n = 0;
  for (const v of vendors) {
    const needsIban = v.iban && !isEncrypted(v.iban);
    const needsBankName = v.bankName && !isEncrypted(v.bankName);
    if (!needsIban && !needsBankName) continue;
    await prisma.vendor.update({
      where: { id: v.id },
      data: {
        iban: needsIban ? await encryptForTenant(tenantId, v.iban) : undefined,
        bankName: needsBankName ? await encryptForTenant(tenantId, v.bankName) : undefined,
      },
    });
    n++;
  }
  return n;
}

async function backfillCustomers(tenantId: string): Promise<number> {
  const customers = await prisma.customer.findMany({
    where: { tenantId, OR: [{ taxNumber: { not: null } }, { taxOffice: { not: null } }] },
    select: { id: true, taxNumber: true, taxOffice: true },
  });
  let n = 0;
  for (const c of customers) {
    const needsTaxNumber = c.taxNumber && !isEncrypted(c.taxNumber);
    const needsTaxOffice = c.taxOffice && !isEncrypted(c.taxOffice);
    if (!needsTaxNumber && !needsTaxOffice) continue;
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        taxNumber: needsTaxNumber ? await encryptForTenant(tenantId, c.taxNumber) : undefined,
        taxOffice: needsTaxOffice ? await encryptForTenant(tenantId, c.taxOffice) : undefined,
      },
    });
    n++;
  }
  return n;
}

async function backfillAiApiKey(tenantId: string, moduleSettings: string): Promise<boolean> {
  let ms: Record<string, unknown>;
  try { ms = JSON.parse(moduleSettings || '{}'); } catch { return false; }
  const ai = ms.ai as { apiKey?: string } | undefined;
  if (!ai?.apiKey || isEncrypted(ai.apiKey)) return false;
  ai.apiKey = (await encryptForTenant(tenantId, ai.apiKey)) || '';
  await prisma.tenant.update({ where: { id: tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
  return true;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, moduleSettings: true } });
  if (tenants.length === 0) {
    console.log('Hiç tenant yok. Yapılacak işlem yok.');
    return;
  }
  for (const t of tenants) {
    const vendorCount = await backfillVendors(t.id);
    const customerCount = await backfillCustomers(t.id);
    const aiKeyEncrypted = await backfillAiApiKey(t.id, t.moduleSettings);
    console.log(`  ✔ ${t.name} (${t.id}) — vendor: ${vendorCount}, customer: ${customerCount}, YZ apiKey: ${aiKeyEncrypted ? 'şifrelendi' : 'değişmedi'}`);
  }
  console.log(`\n${tenants.length} tenant tarandı.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
