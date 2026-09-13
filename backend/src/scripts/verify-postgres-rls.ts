// Enflow — PostgreSQL Row-Level Security (RLS) canlı doğrulama (Faz 3)
// ─────────────────────────────────────────────────────────────────────────────
// Kullanım: pnpm verify:postgres-rls  (backend/ içinde; DATABASE_URL Postgres'e
// işaret ederken, `apply:postgres-rls` ÇALIŞTIRILDIKTAN SONRA). Runtime (en-az
// yetkili) kimlik bilgileriyle çalıştırılmalı — asıl amaç UYGULAMANIN GERÇEKTE
// KULLANDIĞI rolün RLS'e tabi olduğunu doğrulamak (migrator/superuser bağlantısı
// RLS'i owner-bypass ile atlayabilir, FORCE ROW LEVEL SECURITY bunu engeller ama
// test yine de gerçek rolle en anlamlısı).
//
// İki ADIM: (1) iki geçici test tenant'ı + birer Customer satırı oluşturur
// (bypass ile — testin kendisi cross-tenant bir kurulum işlemidir), (2) tenant
// A context'iyle tenant B'nin satırını sorgular (0 satır beklenir) + HİÇ context
// yokken herhangi bir tenant'ın satırını sorgular (0 satır beklenir — fail-closed).
// Sonunda İKİ test tenant'ını da bypass ile temizler (başarılı/başarısız fark etmez).
//
// Tek kaynak tasarım: docs/VERITABANI_GUVENLIGI_PLAN.md Faz 3.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const log = (m = '') => console.log(m);
const ok = (m: string) => log(`✓ ${m}`);
const err = (m: string) => log(`✗ ${m}`);

const connectionString = process.env.DATABASE_URL || '';

async function main() {
  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    err('DATABASE_URL PostgreSQL değil — bu doğrulama yalnız Postgres için.');
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const suffix = Date.now();
  const tenantAId = `rls-verify-a-${suffix}`;
  const tenantBId = `rls-verify-b-${suffix}`;
  let failures = 0;

  try {
    // ── Kurulum (bypass — cross-tenant, testin kendisi) ─────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      await tx.tenant.create({ data: { id: tenantAId, name: 'RLS Verify A' } });
      await tx.tenant.create({ data: { id: tenantBId, name: 'RLS Verify B' } });
      await tx.customer.create({ data: { id: `${tenantAId}-cust`, name: 'A Müşteri', tenantId: tenantAId } });
      await tx.customer.create({ data: { id: `${tenantBId}-cust`, name: 'B Müşteri', tenantId: tenantBId } });
    });
    ok('İki test tenantı + birer Customer satırı oluşturuldu (bypass).');

    // ── Test 1: tenant A context'inde tenant B'nin satırı görünmemeli ───────
    const crossTenantRows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
      return tx.customer.findMany({ where: { id: `${tenantBId}-cust` } });
    });
    if (crossTenantRows.length === 0) {
      ok('Test 1 GEÇTİ: tenant A context\'inde tenant B\'nin satırı 0 satır döndü.');
    } else {
      err(`Test 1 BAŞARISIZ: tenant A context'inde tenant B'nin satırı GÖRÜNDÜ (${crossTenantRows.length} satır) — RLS izolasyonu ÇALIŞMIYOR.`);
      failures++;
    }

    // ── Test 1b: tenant A kendi satırını görebilmeli (yanlış-pozitif kontrolü) ──
    const ownRows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
      return tx.customer.findMany({ where: { id: `${tenantAId}-cust` } });
    });
    if (ownRows.length === 1) {
      ok('Test 1b GEÇTİ: tenant A kendi satırını görebiliyor (RLS aşırı-kısıtlamıyor).');
    } else {
      err(`Test 1b BAŞARISIZ: tenant A kendi satırını GÖREMEDİ (${ownRows.length} satır) — RLS politikası hatalı/eksik.`);
      failures++;
    }

    // ── Test 2: context YOKKEN (SET hiç yapılmadan) hiçbir tenant'ın satırı
    // görünmemeli — fail-closed güvenli varsayılan.
    const noContextRows = await prisma.customer.findMany({
      where: { id: { in: [`${tenantAId}-cust`, `${tenantBId}-cust`] } },
    });
    if (noContextRows.length === 0) {
      ok('Test 2 GEÇTİ: context yokken 0 satır (fail-closed doğrulandı).');
    } else {
      err(`Test 2 BAŞARISIZ: context yokken ${noContextRows.length} satır göründü — RLS FORCE edilmemiş veya bağlantı rolü owner/superuser (RLS'i atlar).`);
      failures++;
    }
  } catch (e) {
    err(`Doğrulama sırasında hata: ${(e as Error).message}`);
    failures++;
  } finally {
    // ── Temizlik (bypass) — başarılı/başarısız fark etmez ────────────────────
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
        await tx.customer.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
        await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      });
    } catch { /* temizlik hatası ana sonucu değiştirmez, ama elle kontrol gerekebilir */ }
    await prisma.$disconnect();
  }

  if (failures > 0) {
    err(`${failures} test BAŞARISIZ — RLS güvenilir DEĞİL, production'a alınmamalı.`);
    process.exit(1);
  }
  ok('Tüm testler GEÇTİ.');
}

main();
