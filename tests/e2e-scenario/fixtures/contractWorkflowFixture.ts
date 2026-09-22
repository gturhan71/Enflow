import type { Db } from '../helpers/prisma';

/** SIGNED durumunda dogrudan kurulur — CONTRACT_SIGNING sureci ayri test edildigi icin burada tekrar yurutulmuyor (arrange). */
export async function createSignedContractWorkflow(prisma: Db, params: { tenantId: string; title?: string; contractValue?: number }) {
  return prisma.contractWorkflow.create({
    data: {
      tenantId: params.tenantId,
      title: params.title ?? 'E2E Sözleşme',
      contractValue: params.contractValue ?? 250_000,
      status: 'SIGNED',
      signedDate: new Date(),
    },
  });
}
