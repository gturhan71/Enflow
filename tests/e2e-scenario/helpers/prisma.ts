/**
 * Backend'in KENDI prismaClient.ts modulunu (libsql adapter + para-yuvarlama +
 * RLS extension) doğrudan içe aktarır — Prisma baglanti mantigini burada
 * yeniden yazmiyoruz (adapter/uzanti uyusmazligi riski). `DATABASE_URL`,
 * modul yuklenmeden ONCE set edilir (prismaClient.ts bunu import-zamaninda
 * bir kez okuyor). Vitest her spec dosyasini varsayilan olarak izole modul
 * kaydiyla calistirdigindan (`test.isolate`), farkli dosyalar farkli
 * DATABASE_URL ile guvenle bu fonksiyonu cagirabilir.
 */
export async function getPrisma(databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  const mod = await import('../../../backend/src/prismaClient');
  return mod.prisma;
}

export type Db = Awaited<ReturnType<typeof getPrisma>>;
