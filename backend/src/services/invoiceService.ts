// Fatura oluşturma mantığının tek kaynağı — `finance.ts`'in POST /invoices'ı
// (gate'siz yol: PURCHASE tipi, ya da projesiz SALES) ve processEngine.ts'in
// CREATE_SALES_INVOICE_FOR_PROJECT AUTO eylemi (gate'li yol: PROJECT_TO_INVOICE
// süreci onaylandıktan sonra) bunu paylaşır — iş mantığı iki yerde kopyalanmaz.
import { prisma } from '../prismaClient';
import { logActivity } from './activityLog';
import { nextDocumentNumber } from './documentNumberService';

export interface CreateInvoiceInput {
  type?: string;
  invoiceNo?: string;
  amount: number | string;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  projectId?: string | null;
  contractId?: string | null;
  milestoneId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
  notes?: string | null;
  createdById?: string | null;
  categoryCode?: string;
  issueRateToTRY?: number | string;
}

export async function createInvoiceRecord(tenantId: string, data: CreateInvoiceInput, actorUserId?: string) {
  const {
    type, invoiceNo, amount, currency, issueDate, dueDate, status,
    projectId, contractId, milestoneId, customerId, customerName, vendorName,
    notes, createdById, categoryCode, issueRateToTRY,
  } = data;
  if (amount == null) throw new Error('Fatura tutarı zorunlu.');
  const docNumber = categoryCode ? await nextDocumentNumber(tenantId, categoryCode) : null;

  // customerId verildiyse müşteri adını oradan doğrula/doldur (elle girilen
  // ismin üzerine yazmaz, yalnız boşsa doldurur) — bkz. computeCustomerHealth.
  let resolvedCustomerName = customerName || null;
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { name: true } });
    if (!customer) throw new Error('Müşteri bulunamadı.');
    if (!resolvedCustomerName) resolvedCustomerName = customer.name;
  }

  const item = await prisma.invoice.create({
    data: {
      tenantId,
      type: type || 'SALES',
      invoiceNo: invoiceNo || null,
      amount: Number(amount) || 0,
      currency: currency || 'TRY',
      issueDate: issueDate ? new Date(issueDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'DRAFT',
      projectId: projectId || null,
      contractId: contractId || null,
      milestoneId: milestoneId || null,
      customerId: customerId || null,
      customerName: resolvedCustomerName,
      vendorName: vendorName || null,
      notes: notes || null,
      createdById: createdById || null,
      docNumber,
      // B-18 — yabancı para birimli faturada kesim kuru (döviz kur farkı hesabı için)
      issueRateToTRY: (currency && currency !== 'TRY' && issueRateToTRY) ? Number(issueRateToTRY) : null,
    },
  });
  await logActivity({ tenantId, userId: actorUserId, action: 'CREATE', entityType: 'INVOICE', entityId: item.id, details: { type: item.type, amount: item.amount, invoiceNo: item.invoiceNo } });
  return item;
}
