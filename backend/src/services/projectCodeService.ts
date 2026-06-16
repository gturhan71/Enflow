import { prisma } from '../prismaClient';

const TYPE_ABBR: Record<string, string> = {
  HARDWARE: 'HW',
  SOFTWARE: 'SW',
  SERVICE: 'SVC',
  MIXED: 'MIX',
};

/**
 * İnsan-okunur proje kodu üretir: {YIL}-{TİP}-{SIRA} — örn. 2026-HW-00012.
 * Sıra numarası, tenant + yıl bazında o yıla ait proje sayısı + 1'dir.
 * Not: SQLite/tek-instance ölçeğinde yeterli; yüksek eşzamanlılıkta atomik
 * bir sayaç tablosuna geçilmeli (bkz. Faz 3 DocumentSequence pattern'i).
 */
export async function nextProjectCode(tenantId: string, type: string): Promise<string> {
  const year = new Date().getFullYear();
  const abbr = TYPE_ABBR[type] || 'GEN';
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const countThisYear = await prisma.project.count({
    where: { tenantId, createdAt: { gte: yearStart, lt: yearEnd } },
  });

  const seq = String(countThisYear + 1).padStart(5, '0');
  return `${year}-${abbr}-${seq}`;
}
