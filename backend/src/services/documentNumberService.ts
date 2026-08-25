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
/**
 * (tenant, kategori, yıl) bazında atomik sayaç artırımı — satır yoksa
 * oluşturur, varsa lastNumber'ı 1 artırır. Transaction yarış koşulunu
 * engeller. `nextDocumentNumber` ve `nextOpportunityTrackingCode` bu tek
 * sayaç mekanizmasını paylaşır.
 */
export async function incrementDocumentSequence(
  tenantId: string,
  categoryCode: string,
  year: number
): Promise<number> {
  return prisma.$transaction(async (tx) => {
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
}

export async function nextDocumentNumber(
  tenantId: string,
  categoryCode: string
): Promise<string | null> {
  const profile = await prisma.documentCodingProfile.findUnique({ where: { tenantId } });
  if (!profile || !profile.isActive) return null;
  if (!categoryCode) return null;

  const year = new Date().getFullYear();
  const seqNumber = await incrementDocumentSequence(tenantId, categoryCode, year);

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
 * Fırsat (Opportunity) için benzersiz, kalıcı bir takip kodu üretir.
 * `nextDocumentNumber`'dan farkı: tenant'ın doküman kodlama profili
 * yoksa/pasifse dahi ASLA null dönmez (her fırsat mutlaka bir kod alır) ve
 * kod fırsatın açılış tarihini GÜN dahil (YYYYMMDD) içerir — yalnız yıl
 * değil (iş kararı: fırsatın ne zaman açıldığı kod üzerinden görünür olmalı).
 * Sayaç yine yıl bazında sıfırlanan `DocumentSequence`'i kullanır
 * (categoryCode='OPP'); kod'daki tarih bölümü ise her zaman gerçek açılış
 * gününü yansıtır.
 */
export async function nextOpportunityTrackingCode(
  tenantId: string,
  createdAt: Date = new Date()
): Promise<string> {
  const CATEGORY_CODE = 'OPP';
  const year = createdAt.getFullYear();
  const yyyymmdd = `${year}${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}`;

  const profile = await prisma.documentCodingProfile.findUnique({ where: { tenantId } });
  const seqNumber = await incrementDocumentSequence(tenantId, CATEGORY_CODE, year);

  if (profile && profile.isActive) {
    const sep = profile.separator || '-';
    const seq = String(seqNumber).padStart(Math.max(1, profile.sequenceDigits || 5), '0');
    const parts: string[] = [];
    if (profile.companyCode) parts.push(profile.companyCode);
    parts.push(CATEGORY_CODE);
    parts.push(yyyymmdd);
    parts.push(seq);
    return parts.join(sep);
  }

  const seq = String(seqNumber).padStart(5, '0');
  return `${CATEGORY_CODE}-${yyyymmdd}-${seq}`;
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
