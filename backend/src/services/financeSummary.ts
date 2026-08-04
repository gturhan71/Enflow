import { prisma } from '../prismaClient';

export interface FinanceSummaryResult {
  totalReceivable: number;
  totalCollected: number;
  overdue: number;
  invoiceCount: number;
  salesCount: number;
  activeGuarantees: number;
  expiringGuarantees: number;
  pendingCostApprovals: number;
}

interface SummaryInvoice { type: string; status: string; amount: number; paidAmount: number; dueDate: Date | null }
interface SummaryGuarantee { expiryDate: Date | null }

/**
 * Saf hesap — DB'den zaten çekilmiş fatura/teminat listeleri üzerinde çalışır.
 * NOT: "overdue" burada `status==='OVERDUE'` yerine dueDate/paidAmount'a bakarak
 * kendi hesabını yapıyor — deriveInvoiceStatus'ta PARTIAL dalı OVERDUE'dan önce
 * kontrol edildiği için kısmi ödemeli+vadesi geçmiş faturalar status='PARTIAL'
 * kalır (bkz. invoiceEngine.ts); status alanına güvenilseydi bu özet o faturaları
 * "overdue" toplamından KAÇIRIRDI. Bu satırlar zaten (mantık değişmeden taşındı)
 * doğru olanı yapıyordu — yalnız artık açıkça belgelendi.
 */
export function summarizeFinance(
  invoices: SummaryInvoice[],
  guarantees: SummaryGuarantee[],
  pendingCostApprovals: number,
): FinanceSummaryResult {
  const sales = invoices.filter((i) => i.type === 'SALES');
  const totalReceivable = sales
    .filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const totalCollected = sales.reduce((s, i) => s + i.paidAmount, 0);
  const now = Date.now();
  const overdue = sales
    .filter((i) => i.dueDate && i.dueDate.getTime() < now && i.paidAmount < i.amount && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  const soon = now + 30 * 24 * 60 * 60 * 1000;
  const expiringGuarantees = guarantees.filter((g) => g.expiryDate && g.expiryDate.getTime() <= soon);

  return {
    totalReceivable,
    totalCollected,
    overdue,
    invoiceCount: invoices.length,
    salesCount: sales.length,
    activeGuarantees: guarantees.length,
    expiringGuarantees: expiringGuarantees.length,
    pendingCostApprovals,
  };
}

export async function computeFinanceSummary(tenantId: string): Promise<FinanceSummaryResult> {
  const invoices = await prisma.invoice.findMany({ where: { tenantId } });
  const guarantees = await prisma.guaranteeLetter.findMany({ where: { tenantId, status: 'ACTIVE' } });
  const pendingCostApprovals = await prisma.projectCostItem.count({
    where: { approvalStatus: 'PENDING', project: { tenantId } },
  });
  return summarizeFinance(invoices, guarantees, pendingCostApprovals);
}
