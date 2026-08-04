import { prisma } from '../prismaClient';

/** Fatura statüsü tahsil edilen tutara + vadeye göre türetilir. */
export function deriveInvoiceStatus(amount: number, paidAmount: number, dueDate: Date | null, current: string): string {
  if (current === 'DRAFT' || current === 'CANCELLED') return current;
  if (paidAmount >= amount && amount > 0) return 'PAID';
  if (paidAmount > 0 && paidAmount < amount) return 'PARTIAL';
  if (dueDate && dueDate.getTime() < Date.now() && paidAmount < amount) return 'OVERDUE';
  return current === 'PAID' || current === 'PARTIAL' ? 'ISSUED' : current;
}

/** Fatura toplam tahsilatını ve türetilmiş statüsünü yeniden hesaplayıp DB'ye yazar. */
export async function recalcInvoice(invoiceId: string): Promise<void> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return;
  const paidAmount = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = deriveInvoiceStatus(inv.amount, paidAmount, inv.dueDate, inv.status);
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, status, paidAt: paidAmount >= inv.amount && inv.amount > 0 ? new Date() : null },
  });
}
