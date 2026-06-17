import { prisma } from '../prismaClient';

/**
 * Özgün, tenant-yapılandırılabilir doküman numarası üretir (Faz 3).
 *
 * ÖNEMLİ: Hiçbir üçüncü-taraf notasyonu gömülü DEĞİLDİR. Format tamamen
 * tenant'ın `DocumentCodingProfile` kaydından türetilir:
 *   {companyCode}{sep}{categoryCode}[{sep}{year}]{sep}{sıra}
 * örn. profil { companyCode: "ACME", separator: "-", includeYear: true,
 * sequenceDigits: 5 } ve categoryCode "SOZ" için → "ACME-SOZ-2026-00001".
 *
 * Tenant bir profil tanımlamamışsa veya profil pasifse `null` döner —
 * docNumber zorunlu bir alan değildir, boş kalabilir.
 *
 * Sayaç `DocumentSequence` üzerinde tenant+kategori+yıl bazında atomik
 * olarak (transaction içinde upsert + increment) artırılır.
 */
export async function nextDocumentNumber(
  tenantId: string,
  categoryCode: string
): Promise<string | null> {
  const profile = await prisma.documentCodingProfile.findUnique({ where: { tenantId } });
  if (!profile || !profile.isActive) return null;
  if (!categoryCode) return null;

  const year = new Date().getFullYear();

  // Atomik sayaç: aynı (tenant, kategori, yıl) için satır yoksa oluştur,
  // varsa lastNumber'ı 1 artır. Transaction yarış koşulunu engeller.
  const seqNumber = await prisma.$transaction(async (tx) => {
    const existing = await tx.documentSequence.findUnique({
      where: { tenantId_categoryCode_year: { tenantId, categoryCode, year } },
    });
    if (!existing) {
      await tx.documentSequence.create({
        data: { tenantId, categoryCode, year, lastNumber: 1 },
      });
      return 1;
    }
    const updated = await tx.documentSequence.update({
      where: { tenantId_categoryCode_year: { tenantId, categoryCode, year } },
      data: { lastNumber: { increment: 1 } },
    });
    return updated.lastNumber;
  });

  const sep = profile.separator || '-';
  const seq = String(seqNumber).padStart(Math.max(1, profile.sequenceDigits || 5), '0');

  const parts: string[] = [];
  if (profile.companyCode) parts.push(profile.companyCode);
  parts.push(categoryCode);
  if (profile.includeYear) parts.push(String(year));
  parts.push(seq);

  return parts.join(sep);
}

/**
 * Üretilecek numaranın bir ÖNİZLEMESİNİ döndürür (sayaç artırmadan).
 * Ayarlar ekranında formatı canlı göstermek için kullanılır.
 */
export async function previewDocumentNumber(
  tenantId: string,
  categoryCode = 'ORN'
): Promise<string | null> {
  const profile = await prisma.documentCodingProfile.findUnique({ where: { tenantId } });
  if (!profile) return null;

  const year = new Date().getFullYear();
  const sep = profile.separator || '-';
  const seq = String(1).padStart(Math.max(1, profile.sequenceDigits || 5), '0');

  const parts: string[] = [];
  if (profile.companyCode) parts.push(profile.companyCode);
  parts.push(categoryCode);
  if (profile.includeYear) parts.push(String(year));
  parts.push(seq);

  return parts.join(sep);
}
