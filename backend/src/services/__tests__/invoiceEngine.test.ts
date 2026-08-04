import { describe, it, expect } from 'vitest';
import { deriveInvoiceStatus } from '../invoiceEngine';

describe('invoiceEngine — deriveInvoiceStatus', () => {
  it('never leaves DRAFT or CANCELLED regardless of payment/due-date (manual states)', () => {
    expect(deriveInvoiceStatus(1000, 1000, null, 'DRAFT')).toBe('DRAFT');
    expect(deriveInvoiceStatus(1000, 0, new Date('2020-01-01'), 'CANCELLED')).toBe('CANCELLED');
  });

  it('is PAID when paid amount reaches or exceeds the invoice amount', () => {
    expect(deriveInvoiceStatus(1000, 1000, null, 'ISSUED')).toBe('PAID');
    expect(deriveInvoiceStatus(1000, 1200, null, 'ISSUED')).toBe('PAID'); // overpayment still counts as PAID
  });

  it('is PARTIAL when some but not all has been paid', () => {
    expect(deriveInvoiceStatus(1000, 400, null, 'ISSUED')).toBe('PARTIAL');
  });

  it('is OVERDUE when fully unpaid and past the due date', () => {
    const pastDue = new Date(Date.now() - 86_400_000);
    expect(deriveInvoiceStatus(1000, 0, pastDue, 'ISSUED')).toBe('OVERDUE');
  });

  it('stays PARTIAL (not OVERDUE) when some payment exists, even past due — PARTIAL is checked first', () => {
    // Kasıtlı davranış kilidi: dal sırası PARTIAL'ı OVERDUE'dan önce kontrol ediyor,
    // yani kısmi ödemesi olan bir fatura vadesi geçse bile PARTIAL kalır — yalnız
    // hiç ödeme yapılmamış faturalar OVERDUE'a düşer.
    const pastDue = new Date(Date.now() - 86_400_000);
    expect(deriveInvoiceStatus(1000, 400, pastDue, 'ISSUED')).toBe('PARTIAL');
  });

  it('is not OVERDUE when the due date is in the future', () => {
    const futureDue = new Date(Date.now() + 86_400_000);
    expect(deriveInvoiceStatus(1000, 0, futureDue, 'ISSUED')).toBe('ISSUED');
  });

  it('falls back to ISSUED when unpaid, no due date, and previously non-payment-derived', () => {
    expect(deriveInvoiceStatus(1000, 0, null, 'ISSUED')).toBe('ISSUED');
    expect(deriveInvoiceStatus(1000, 0, null, 'SENT')).toBe('SENT');
  });

  it('reverts a stale PAID/PARTIAL status back to ISSUED if a payment was later removed', () => {
    // Bir ödeme silindiğinde recalcInvoice bu fonksiyonu tekrar çağırır — mevcut
    // durum hâlâ 'PAID' olsa bile yeni paidAmount 0 ise ve vade geçmemişse ISSUED'a döner.
    expect(deriveInvoiceStatus(1000, 0, null, 'PAID')).toBe('ISSUED');
    expect(deriveInvoiceStatus(1000, 0, null, 'PARTIAL')).toBe('ISSUED');
  });

  it('treats a zero-amount invoice as never PAID (avoids 0>=0 false positive)', () => {
    expect(deriveInvoiceStatus(0, 0, null, 'ISSUED')).toBe('ISSUED');
  });
});
