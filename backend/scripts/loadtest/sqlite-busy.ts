// Enflow — eşzamanlı yazımda SQLITE_BUSY oranı ölçümü (S-09, bkz.
// docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz C). Yalnız dev-dependency; üretim
// koduna girmez, elle çalıştırılır:
//   cd backend && pnpm test:load:sqlite-busy
// Ortam değişkenleri: TENANT_ID, CONCURRENCY
//
// Oluşturduğu test verisini (title == RUN_MARKER) betik sonunda kendisi siler —
// dev veritabanında kalıcı iz bırakmaz.

import { prisma } from '../../src/prismaClient';

const TENANT_ID = process.env.TENANT_ID || 'tenant-1';
const CONCURRENCY = Number(process.env.CONCURRENCY) || 50;
const RUN_MARKER = `[loadtest] sqlite-busy ${Date.now()}`;

function isBusyError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /SQLITE_BUSY|database is locked/i.test(msg);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) throw new Error(`Tenant bulunamadı: ${TENANT_ID}`);
  const user = await prisma.user.findFirst({ where: { tenantId: TENANT_ID } });
  if (!user) throw new Error(`Tenant'ta kullanıcı yok: ${TENANT_ID}`);

  console.log(`[sqlite-busy] tenant=${TENANT_ID} concurrency=${CONCURRENCY}`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () =>
      prisma.notification.create({
        data: { tenantId: TENANT_ID, userId: user.id, title: RUN_MARKER, message: 'yük testi', type: 'INFO' },
      })
    )
  );

  const ok = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const busy = failed.filter(r => isBusyError(r.reason)).length;
  const otherErrors = failed.length - busy;

  console.log(`[sqlite-busy] başarılı: ${ok}/${CONCURRENCY}`);
  console.log(`[sqlite-busy] SQLITE_BUSY: ${busy}/${CONCURRENCY} (${((busy / CONCURRENCY) * 100).toFixed(1)}%)`);
  if (otherErrors > 0) console.log(`[sqlite-busy] diğer hata: ${otherErrors}`);

  const deleted = await prisma.notification.deleteMany({ where: { tenantId: TENANT_ID, title: RUN_MARKER } });
  console.log(`[sqlite-busy] test verisi temizlendi: ${deleted.count} kayıt`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
