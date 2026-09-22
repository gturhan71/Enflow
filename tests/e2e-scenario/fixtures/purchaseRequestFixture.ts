import type { Db } from '../helpers/prisma';

/** PO_ISSUED durumunda dogrudan kurulur — PURCHASE_APPROVAL sureci ayri test edildigi icin burada tekrar yurutulmuyor (arrange). */
export async function createPoIssuedPurchaseRequest(prisma: Db, params: { tenantId: string; unitId: string; requestedBy: string; title?: string }) {
  return prisma.purchaseRequest.create({
    data: {
      tenantId: params.tenantId,
      title: params.title ?? 'E2E Satınalma — PO kesilmiş',
      requestedBy: params.requestedBy,
      unitId: params.unitId,
      status: 'PO_ISSUED',
      poNumber: `PO-E2E-${Date.now()}`,
      poIssuedAt: new Date(),
      items: { create: [{ name: 'Malzeme', quantity: 1, unit: 'adet', estimatedUnitPrice: 50_000, currency: 'TRY' }] },
    },
  });
}
