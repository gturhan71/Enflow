import type { Db } from '../helpers/prisma';

export async function createOpportunity(
  prisma: Db,
  params: { tenantId: string; assignedToId: string; createdById: string; status?: string; title?: string; value?: number },
) {
  const customer = await prisma.customer.create({ data: { tenantId: params.tenantId, name: 'E2E Müşteri A.Ş.' } });
  const opp = await prisma.opportunity.create({
    data: {
      tenantId: params.tenantId,
      title: params.title ?? 'E2E Fırsat',
      value: params.value ?? 500_000,
      probability: 50,
      status: params.status ?? 'NEGOTIATION',
      customerId: customer.id,
      assignedToId: params.assignedToId,
      createdById: params.createdById,
    },
  });
  return { opp, customer };
}
