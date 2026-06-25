// Enflow — Vade & Finansman Etkisi (nakit-akış bazlı, taksitli tahsilat destekli)
// ─────────────────────────────────────────────────────────────────────────────
// Ödeme (çıkış) ve tahsilat (giriş) olaylarının zamanlamasına göre banka faiziyle
// finansman maliyeti/getirisini hesaplar. Para birimleri AYRIŞIK tutulur (kur
// karışıklığı = kritik risk). Çıkış erken → maliyet (+); giriş erken → getiri (−).

export interface CashEvent {
  kind: 'PAYMENT' | 'COLLECTION';
  label: string;
  date: string;       // ISO
  amount: number;
  currency: string;
}

export interface FinancingResultLine extends CashEvent {
  effect: number;     // + maliyet, − getiri (kalemin dövizinde)
}

export interface FinancingResult {
  closingDate: string;
  byCurrency: Record<string, { cost: number; benefit: number; net: number }>; // net = benefit − cost
  events: FinancingResultLine[];
  cashFlowGap: { currency: string; series: { date: string; cumulative: number }[]; maxDeficit: number }[];
}

/** Tek olayın finansman etkisi: tutar × (yıllıkFaiz%/100) × ((kapanış − olayTarihi)/365). */
function eventEffect(amount: number, annualRatePct: number, eventDate: number, closing: number): number {
  const years = Math.max(0, (closing - eventDate) / (365 * 86400000));
  return amount * (annualRatePct / 100) * years;
}

export function computeFinancingEffect(
  events: CashEvent[],
  interestRates: Record<string, number>,
  referenceStart?: string,
): FinancingResult {
  const valid = events.filter(e => e.date && !Number.isNaN(new Date(e.date).getTime()) && e.amount);
  const times = valid.map(e => new Date(e.date).getTime());
  const refStart = referenceStart ? new Date(referenceStart).getTime() : (times.length ? Math.min(...times) : Date.now());
  const closing = times.length ? Math.max(...times, refStart) : refStart;

  const byCurrency: Record<string, { cost: number; benefit: number; net: number }> = {};
  const lines: FinancingResultLine[] = [];
  for (const e of valid) {
    const rate = interestRates[e.currency] ?? 0;
    const eff = eventEffect(e.amount, rate, new Date(e.date).getTime(), closing);
    const cur = byCurrency[e.currency] || { cost: 0, benefit: 0, net: 0 };
    if (e.kind === 'PAYMENT') { cur.cost += eff; lines.push({ ...e, effect: eff }); }
    else { cur.benefit += eff; lines.push({ ...e, effect: -eff }); }
    byCurrency[e.currency] = cur;
  }
  for (const c of Object.keys(byCurrency)) byCurrency[c].net = byCurrency[c].benefit - byCurrency[c].cost;

  // Nakit-akış boşluğu: tarih sırasıyla kümülatif (giriş +, çıkış −) — döviz bazlı
  const cashFlowGap: FinancingResult['cashFlowGap'] = [];
  for (const cur of Object.keys(byCurrency)) {
    const evs = valid.filter(e => e.currency === cur).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cum = 0; let maxDeficit = 0;
    const series = evs.map(e => { cum += e.kind === 'COLLECTION' ? e.amount : -e.amount; maxDeficit = Math.min(maxDeficit, cum); return { date: e.date, cumulative: Math.round(cum * 100) / 100 }; });
    cashFlowGap.push({ currency: cur, series, maxDeficit: Math.round(maxDeficit * 100) / 100 });
  }

  return { closingDate: new Date(closing).toISOString(), byCurrency, events: lines, cashFlowGap };
}

/** referans tarihten gün vade ile ödeme tarihi (ISO). */
export function paymentDate(referenceStart: string | undefined, termDays: number | null | undefined): string {
  const base = referenceStart ? new Date(referenceStart).getTime() : Date.now();
  return new Date(base + (termDays || 0) * 86400000).toISOString();
}
