// Enflow — Kârlılık Defteri (tarihli olay üreticisi)
// ─────────────────────────────────────────────────────────────────────────────
// Zamana duyarlı kârlılık + nakit/hazine analizinin çekirdeği: proje verisini
// TARİHLİ OLAY listesine (`ProfitEvent[]`) indirger. Tüm rollup'lar (aylık/
// çeyreklik/yıllık/proje) bu tek defterin üstünde `bucketBy` ile üretilir.
//
// Saf ve yan etkisiz — DB'den zaten çekilmiş düz kayıtlar üzerinde çalışır
// (`projectSummary.ts` deseni). FX dönüşümü YAPMAZ; para birimi ayrışık kalır,
// dönüşüm rollup katmanında açık varsayımla yapılır.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §2-§3

export type ProfitDirection = 'IN' | 'OUT';
export type ProfitBasis = 'ACCRUAL' | 'CASH';
export type ProfitSource = 'PLAN' | 'ACTUAL';

export interface ProfitEvent {
  date: Date;
  amount: number;                 // kalemin kendi dövizinde (rollup'ta TRY'ye çevrilir)
  currency: string;
  direction: ProfitDirection;
  basis: ProfitBasis;
  source: ProfitSource;
  category: string;               // REVENUE | PROCUREMENT | COST_ITEM | PROJECT_COST | OVERHEAD | GUARANTEE | FINANCING
  projectId: string | null;
  opportunityId: string | null;
  ref: string;                    // kaynak kayıt kimliği — idempotency + drill-down
  confidence: 'FIRM' | 'ESTIMATED';
  label: string;
}

// ── Girdi tipleri (DB'den çekilmiş düz kayıtlar) ─────────────────────────────

export interface LedgerProject {
  id: string;
  name: string;
  totalValue: number;
  contractCurrency: string;
  progress: number;               // 0..100
  startDate: Date | null;
  plannedEndDate: Date | null;
  createdAt: Date;
  opportunityId: string | null;
  applyOverhead: boolean;
  overheadAmount: number;         // TRY
}

export interface LedgerInstallment { dueDate: Date; amount: number; currency: string | null; note?: string | null; id?: string }
export interface LedgerMilestone { plannedEnd: Date | null; budgetAmount: number | null; status: string; title?: string }
export interface LedgerBoM { id?: string; partNumber?: string; purchaseCost: number; quantity: number; currency: string | null; paymentTermDays: number | null }
export interface LedgerCostItem { id?: string; description?: string; amount: number; currency: string | null; paymentTermDays: number | null; category: string }
export interface LedgerProjectCostItem {
  id?: string; description?: string; category: string;
  plannedAmount: number; actualAmount: number; amountTRY: number;
  currency: string; date: Date | null; createdAt: Date;
}
export interface LedgerInvoice {
  id?: string; type: 'SALES' | 'PURCHASE';
  amount: number; currency: string;
  issueDate: Date | null; dueDate: Date | null;
  paidAmount: number; paidAt: Date | null;
}
export interface LedgerPayment { id?: string; amount: number; currency: string; paidAt: Date; invoiceType: 'SALES' | 'PURCHASE' }

// ── Yardımcılar ─────────────────────────────────────────────────────────────

const DAY = 86_400_000;

/** Ödeme vadesi olaylarının çıpası: proje başlangıcı → fırsat kazanılması → oluşturulma. */
export function resolveReferenceStart(p: LedgerProject, opportunityWonAt?: Date | null): Date {
  return p.startDate ?? opportunityWonAt ?? p.createdAt;
}

/** [start, end] arasına `count` eşit aylık tarih üretir (gelir/gider serpme fallback'i). */
function spreadDates(start: Date, end: Date, count: number): Date[] {
  if (count <= 0) return [];
  if (count === 1) return [end];
  const span = end.getTime() - start.getTime();
  if (span <= 0) return Array.from({ length: count }, () => end);
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + (span * (i + 1)) / count));
}

/**
 * PLAN gelir takvimi (fallback zinciri — bkz. plan §8.6):
 *   1) CollectionInstallment varsa → doğrudan onlar
 *   2) yoksa milestone.plannedEnd olan aşamalara sözleşme değerini eşit böl
 *   3) o da yoksa referenceStart → plannedEndDate arası eşit aylık serpme (progress'e göre kalan)
 */
function planRevenueSchedule(
  p: LedgerProject, installments: LedgerInstallment[], milestones: LedgerMilestone[], refStart: Date,
): { date: Date; amount: number; currency: string; ref: string; label: string; firm: boolean }[] {
  if (installments.length) {
    return installments.map((i, idx) => ({
      date: i.dueDate, amount: i.amount, currency: i.currency || p.contractCurrency,
      ref: i.id ?? `inst-${idx}`, label: i.note || `Tahsilat taksiti ${idx + 1}`, firm: true,
    }));
  }
  const dated = milestones.filter((m) => m.plannedEnd);
  if (dated.length && p.totalValue > 0) {
    const per = p.totalValue / dated.length;
    return dated.map((m, idx) => ({
      date: m.plannedEnd as Date, amount: per, currency: p.contractCurrency,
      ref: `ms-${idx}`, label: m.title ? `Hakediş: ${m.title}` : `Hakediş ${idx + 1}`, firm: false,
    }));
  }
  const end = p.plannedEndDate ?? new Date(refStart.getTime() + 180 * DAY);
  const remaining = p.totalValue * Math.max(0, 1 - (p.progress || 0) / 100);
  const dates = spreadDates(refStart, end, 6);
  const per = remaining / (dates.length || 1);
  return dates.map((d, idx) => ({
    date: d, amount: per, currency: p.contractCurrency,
    ref: `spread-${idx}`, label: `Öngörülen hakediş ${idx + 1}`, firm: false,
  }));
}

/**
 * İşletme maliyeti (overhead) payı olayları — PLAN ve ACTUAL tarafında ORTAK.
 * Yalnız `Project.applyOverhead === true` ise üretilir; kayıtlı `overheadAmount`
 * proje süresine 6 eşit parçaya bölünür (ACCRUAL + CASH). ACTUAL tarafında
 * `untilTs` verilir → yalnız o ana kadar "absorbe edilmiş" paylar döner
 * (gelecek pay plandan gelir; EAC'de çift sayım olmaz).
 */
function overheadEvents(p: LedgerProject, refStart: Date, source: ProfitSource, untilTs?: number): ProfitEvent[] {
  if (!p.applyOverhead || p.overheadAmount <= 0) return [];
  const end = p.plannedEndDate ?? new Date(refStart.getTime() + 180 * DAY);
  const dates = spreadDates(refStart, end, 6);
  const per = p.overheadAmount / (dates.length || 1);
  const base = { source, projectId: p.id, opportunityId: p.opportunityId };
  const out: ProfitEvent[] = [];
  for (const [idx, d] of dates.entries()) {
    if (untilTs !== undefined && d.getTime() > untilTs) continue;
    for (const basis of ['ACCRUAL', 'CASH'] as const) {
      out.push({ ...base, date: d, amount: per, currency: 'TRY', direction: 'OUT', basis,
        category: 'OVERHEAD', ref: `ovh-${source.toLowerCase()}-${basis}-${idx}`,
        confidence: 'ESTIMATED', label: `İşletme maliyeti payı ${idx + 1}` });
    }
  }
  return out;
}

// ── PLAN olayları ───────────────────────────────────────────────────────────

export interface BuildPlanInput {
  project: LedgerProject;
  installments: LedgerInstallment[];
  milestones: LedgerMilestone[];
  boms: LedgerBoM[];
  costItems: LedgerCostItem[];
  projectCostItems: LedgerProjectCostItem[];
  opportunityWonAt?: Date | null;
}

/**
 * Planlanan defteri. Gelir hem ACCRUAL hem CASH olarak üretilir:
 *  - ACCRUAL gelir: hakediş/milestone takvimi (kazanılma anı)
 *  - CASH gelir: taksit varsa taksit tarihleri, yoksa aynı takvim
 * Gider ACCRUAL = tahakkuk (referenceStart / milestone), CASH = +paymentTermDays.
 */
export function buildPlanEvents(input: BuildPlanInput): ProfitEvent[] {
  const { project: p, installments, milestones, boms, costItems, projectCostItems } = input;
  const refStart = resolveReferenceStart(p, input.opportunityWonAt);
  const ev: ProfitEvent[] = [];
  const base = { source: 'PLAN' as const, projectId: p.id, opportunityId: p.opportunityId };

  // ── Gelir ─────────────────────────────────────────────────────────────────
  const accrualSchedule = planRevenueSchedule(p, [], milestones, refStart); // taksitleri yok say → tahakkuk takvimi
  for (const s of accrualSchedule) {
    ev.push({ ...base, date: s.date, amount: s.amount, currency: s.currency, direction: 'IN', basis: 'ACCRUAL',
      category: 'REVENUE', ref: `rev-acc-${s.ref}`, confidence: s.firm ? 'FIRM' : 'ESTIMATED', label: s.label });
  }
  const cashSchedule = planRevenueSchedule(p, installments, milestones, refStart);
  for (const s of cashSchedule) {
    ev.push({ ...base, date: s.date, amount: s.amount, currency: s.currency, direction: 'IN', basis: 'CASH',
      category: 'REVENUE', ref: `rev-cash-${s.ref}`, confidence: s.firm ? 'FIRM' : 'ESTIMATED', label: s.label });
  }

  // ── BoM alımları (çıkış) ──────────────────────────────────────────────────
  for (const [idx, b] of boms.entries()) {
    const amount = (b.purchaseCost || 0) * (b.quantity || 0);
    if (!amount) continue;
    const cur = b.currency || p.contractCurrency;
    const ref = b.id ?? `bom-${idx}`;
    const label = `BoM: ${b.partNumber || ref}`;
    ev.push({ ...base, date: refStart, amount, currency: cur, direction: 'OUT', basis: 'ACCRUAL',
      category: 'PROCUREMENT', ref: `bom-acc-${ref}`, confidence: 'ESTIMATED', label });
    ev.push({ ...base, date: new Date(refStart.getTime() + (b.paymentTermDays || 0) * DAY), amount, currency: cur,
      direction: 'OUT', basis: 'CASH', category: 'PROCUREMENT', ref: `bom-cash-${ref}`, confidence: 'ESTIMATED', label });
  }

  // ── CostItem giderleri (çıkış) — FINANCE kategorisi hariç (döngü önleme) ──
  for (const [idx, c] of costItems.entries()) {
    if (c.category === 'FINANCE') continue;
    const amount = c.amount || 0;
    if (!amount) continue;
    const cur = c.currency || p.contractCurrency;
    const ref = c.id ?? `cost-${idx}`;
    const label = c.description || `Gider ${idx + 1}`;
    ev.push({ ...base, date: refStart, amount, currency: cur, direction: 'OUT', basis: 'ACCRUAL',
      category: 'COST_ITEM', ref: `cost-acc-${ref}`, confidence: 'ESTIMATED', label });
    ev.push({ ...base, date: new Date(refStart.getTime() + (c.paymentTermDays || 0) * DAY), amount, currency: cur,
      direction: 'OUT', basis: 'CASH', category: 'COST_ITEM', ref: `cost-cash-${ref}`, confidence: 'ESTIMATED', label });
  }

  // ── ProjectCostItem planlanan tutarları (çıkış) ──────────────────────────
  for (const [idx, pc] of projectCostItems.entries()) {
    const amount = pc.plannedAmount || 0;
    if (!amount) continue;
    const when = pc.date ?? pc.createdAt ?? refStart;
    const ref = pc.id ?? `pci-${idx}`;
    const label = pc.description || `Proje gideri ${idx + 1}`;
    ev.push({ ...base, date: when, amount, currency: pc.currency || p.contractCurrency, direction: 'OUT',
      basis: 'ACCRUAL', category: 'PROJECT_COST', ref: `pci-acc-${ref}`, confidence: 'ESTIMATED', label });
    ev.push({ ...base, date: when, amount, currency: pc.currency || p.contractCurrency, direction: 'OUT',
      basis: 'CASH', category: 'PROJECT_COST', ref: `pci-cash-${ref}`, confidence: 'ESTIMATED', label });
  }

  // ── Overhead (işletme maliyeti) — yalnız applyOverhead=true (PLAN: tüm süre)
  ev.push(...overheadEvents(p, refStart, 'PLAN'));

  return ev;
}

// ── ACTUAL olayları ─────────────────────────────────────────────────────────

export interface BuildActualInput {
  project: LedgerProject;
  invoices: LedgerInvoice[];
  payments: LedgerPayment[];
  projectCostItems: LedgerProjectCostItem[];
  /** ACTUAL overhead payının "absorbe edilmiş" kısmını kesmek için (varsayılan: şimdi). */
  asOf?: Date;
  opportunityWonAt?: Date | null;
}

/**
 * Gerçekleşen defteri.
 *  - ACCRUAL gelir/gider: Invoice.issueDate (SALES→IN, PURCHASE→OUT)
 *  - CASH gelir/gider: Payment.paidAt (invoiceType ile yön) — Payment yoksa
 *    Invoice.paidAmount+paidAt fallback
 *  - ACCRUAL gider: ProjectCostItem.amountTRY (date/createdAt)
 *  - OVERHEAD: applyOverhead=true ise, asOf'a kadar absorbe edilmiş işletme
 *    maliyeti payı (plan ile simetri — gelecek pay plandan gelir)
 */
export function buildActualEvents(input: BuildActualInput): ProfitEvent[] {
  const { project: p, invoices, payments, projectCostItems } = input;
  const asOf = input.asOf ?? new Date();
  const ev: ProfitEvent[] = [];
  const base = { source: 'ACTUAL' as const, projectId: p.id, opportunityId: p.opportunityId };

  for (const [idx, inv] of invoices.entries()) {
    const ref = inv.id ?? `inv-${idx}`;
    const dir: ProfitDirection = inv.type === 'SALES' ? 'IN' : 'OUT';
    const cat = inv.type === 'SALES' ? 'REVENUE' : 'PROCUREMENT';
    if (inv.issueDate && inv.amount) {
      ev.push({ ...base, date: inv.issueDate, amount: inv.amount, currency: inv.currency, direction: dir,
        basis: 'ACCRUAL', category: cat, ref: `inv-acc-${ref}`, confidence: 'FIRM',
        label: `${inv.type === 'SALES' ? 'Satış' : 'Alış'} faturası` });
    }
  }

  const hasPaymentFor = new Set(payments.map((_, i) => i)); // Payment kayıtları öncelikli
  if (payments.length) {
    for (const [idx, pay] of payments.entries()) {
      if (!pay.amount) continue;
      const dir: ProfitDirection = pay.invoiceType === 'SALES' ? 'IN' : 'OUT';
      ev.push({ ...base, date: pay.paidAt, amount: pay.amount, currency: pay.currency, direction: dir,
        basis: 'CASH', category: pay.invoiceType === 'SALES' ? 'REVENUE' : 'PROCUREMENT',
        ref: `pay-${pay.id ?? idx}`, confidence: 'FIRM', label: 'Tahsilat/ödeme' });
    }
  } else {
    // Payment kaydı yoksa Invoice.paidAmount + paidAt fallback
    for (const [idx, inv] of invoices.entries()) {
      if (!inv.paidAt || !inv.paidAmount) continue;
      const dir: ProfitDirection = inv.type === 'SALES' ? 'IN' : 'OUT';
      ev.push({ ...base, date: inv.paidAt, amount: inv.paidAmount, currency: inv.currency, direction: dir,
        basis: 'CASH', category: inv.type === 'SALES' ? 'REVENUE' : 'PROCUREMENT',
        ref: `inv-cash-${inv.id ?? idx}`, confidence: 'FIRM', label: 'Fatura ödemesi' });
    }
  }
  void hasPaymentFor;

  for (const [idx, pc] of projectCostItems.entries()) {
    const amount = pc.amountTRY || pc.actualAmount || 0;
    if (!amount) continue;
    const when = pc.date ?? pc.createdAt;
    ev.push({ ...base, date: when, amount, currency: 'TRY', direction: 'OUT', basis: 'ACCRUAL',
      category: 'PROJECT_COST', ref: `pci-act-${pc.id ?? idx}`, confidence: 'FIRM',
      label: pc.description || `Proje gideri ${idx + 1}` });
  }

  // ── Overhead — asOf'a kadar absorbe edilmiş pay (plan ile simetri)
  ev.push(...overheadEvents(p, resolveReferenceStart(p, input.opportunityWonAt), 'ACTUAL', asOf.getTime()));

  return ev;
}
