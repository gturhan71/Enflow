import type { Db } from '../helpers/prisma';

/**
 * Iki tedarikci teklifi kuran fixture — AGIRLIKLI skorun (fiyat 0.6 + puan 0.25 +
 * teslim 0.15, bkz. virtualAgentService.ts QUOTE_SCORE_WEIGHTS) gercekten
 * kullanildigini kanitlamak icin bilinckli olarak "en ucuz" ile "en yuksek
 * agirlikli skor" FARKLI tedarikcidedir:
 *   Vendor A: 100.000 TRY (en ucuz), rating 2, 30 gun teslim  -> skor 0.725
 *   Vendor B: 110.000 TRY,           rating 5, 5  gun teslim  -> skor 0.9455 (kazanan)
 * Naif "en ucuz fiyat" mantigi A'yi secerdi — agent B'yi secerse, gercekten
 * agirlikli formulu kullandigi kanitlanmis olur.
 */
export async function seedPurchaseRequestWithQuotes(prisma: Db, params: { tenantId: string; unitId: string; requestedBy: string }) {
  const { tenantId, unitId, requestedBy } = params;

  const vendorA = await prisma.vendor.create({ data: { tenantId, name: 'Ucuz Ama Dusuk Puanli Tedarik A.S.', rating: 2 } });
  const vendorB = await prisma.vendor.create({ data: { tenantId, name: 'Guvenilir Hizli Teslimat A.S.', rating: 5 } });

  const pr = await prisma.purchaseRequest.create({
    data: {
      tenantId,
      title: 'E2E — Sunucu + Yedekleme Unitesi',
      requestedBy,
      unitId,
      status: 'DRAFT',
      items: {
        create: [{ name: 'Sunucu', quantity: 2, unit: 'adet', estimatedUnitPrice: 45000, currency: 'TRY' }],
      },
    },
  });

  const quoteA = await prisma.purchaseQuote.create({
    data: { purchaseRequestId: pr.id, vendorId: vendorA.id, vendorName: vendorA.name, totalAmount: 100_000, totalAmountTRY: 100_000, deliveryDays: 30 },
  });
  const quoteB = await prisma.purchaseQuote.create({
    data: { purchaseRequestId: pr.id, vendorId: vendorB.id, vendorName: vendorB.name, totalAmount: 110_000, totalAmountTRY: 110_000, deliveryDays: 5 },
  });

  return { pr, vendorA, vendorB, quoteA, quoteB };
}
