import { prisma } from '../prismaClient';

export interface AgingBuckets { notDue: number; d0_30: number; d31_60: number; d61_90: number; d90plus: number }
export interface AgingReportResult {
  buckets: AgingBuckets;
  dso: number;
  totalReceivable: number;
  byCurrency: Record<string, { totalReceivable: number; buckets: AgingBuckets }>;
}

interface AgingInvoice {
  status: string;
  amount: number;
  paidAmount: number;
  dueDate: Date | null;
  currency: string;
  issueDate: Date | null;
  createdAt: Date;
}

const DAY = 86_400_000;
const emptyBuckets = (): AgingBuckets => ({ notDue: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });

/**
 * Saf hesap — SALES faturalarını vade-geçmişi kovalarına ayırır + DSO (ortalama
 * tahsil süresi) hesaplar. `now` test edilebilirlik için opsiyonel (varsayılan
 * gerçek saat — çağıran taraf vermezse davranış aynı).
 */
export function computeAging(invoices: AgingInvoice[], now: number = Date.now()): AgingReportResult {
  // Açık (tahsil edilmemiş) SALES alacakları — DRAFT/CANCELLED/PAID hariç
  const open = invoices.filter((i) => i.status !== 'DRAFT' && i.status !== 'CANCELLED' && i.status !== 'PAID' && (i.amount - i.paidAmount) > 0);

  const buckets = emptyBuckets();
  const byCurrency: Record<string, { totalReceivable: number; buckets: AgingBuckets }> = {};
  let totalReceivable = 0;

  for (const inv of open) {
    const rem = inv.amount - inv.paidAmount;
    const cur = inv.currency || 'TRY';
    if (!byCurrency[cur]) byCurrency[cur] = { totalReceivable: 0, buckets: emptyBuckets() };
    const dpd = inv.dueDate ? Math.floor((now - inv.dueDate.getTime()) / DAY) : -1; // vade yoksa "vadesi gelmemiş"
    const key: keyof AgingBuckets = dpd <= 0 ? 'notDue' : dpd <= 30 ? 'd0_30' : dpd <= 60 ? 'd31_60' : dpd <= 90 ? 'd61_90' : 'd90plus';
    buckets[key] += rem; totalReceivable += rem;
    byCurrency[cur].buckets[key] += rem; byCurrency[cur].totalReceivable += rem;
  }

  // DSO = toplam açık alacak / (son 365g tahsil-esaslı SALES tutarı) × 365
  const yearAgo = now - 365 * DAY;
  const salesLast365 = invoices
    .filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
    .filter((i) => (i.issueDate ?? i.createdAt).getTime() >= yearAgo)
    .reduce((s, i) => s + i.amount, 0);
  const dso = salesLast365 > 0 ? Math.round((totalReceivable / salesLast365) * 365) : 0;

  return { buckets, dso, totalReceivable, byCurrency };
}

export async function computeAgingReport(tenantId: string): Promise<AgingReportResult> {
  const invoices = await prisma.invoice.findMany({ where: { tenantId, type: 'SALES' } });
  return computeAging(invoices);
}
