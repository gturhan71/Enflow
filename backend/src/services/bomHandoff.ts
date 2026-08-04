// BoM Presales→Satış devri (handoff) sırasında kullanılan saf hesaplar.
// DB yazma/okuma sırası (transaction, upsert, notification, archive) route'ta
// kalıyor — bu dosya yalnız "verilen veriden ne üretilir" kısmını izole eder.

export interface BomQuoteInput {
  lineKey: string;
  componentName: string | null;
  vendorName: string;
  unitPrice: number;
  currency: string;
  technicalCompliance: string;
  specSummary: string | null;
  fileName: string | null;
  fileUrl: string | null;
  isSelected: boolean;
}

export interface BomEvaluationLine {
  lineKey: string;
  componentName: string | null;
  quoteCount: number;
  selected: {
    vendorName: string; unitPrice: number; currency: string; technicalCompliance: string;
    specSummary: string | null; fileName: string | null; fileUrl: string | null;
  } | null;
  alternatives: { vendorName: string; unitPrice: number; currency: string; technicalCompliance: string }[];
}

export interface BomEvaluationSnapshot {
  evaluatedAt: string;
  totalQuotes: number;
  lines: BomEvaluationLine[];
}

/** Tedarikçi teklif değerlendirme snapshot'ı — kalem (lineKey) bazında seçilen + alternatifler. */
export function buildBomEvaluationSnapshot(quotes: BomQuoteInput[], now: Date = new Date()): BomEvaluationSnapshot | null {
  if (quotes.length === 0) return null;
  const byLine = new Map<string, BomQuoteInput[]>();
  for (const q of quotes) {
    const arr = byLine.get(q.lineKey) || [];
    arr.push(q);
    byLine.set(q.lineKey, arr);
  }
  return {
    evaluatedAt: now.toISOString(),
    totalQuotes: quotes.length,
    lines: [...byLine.entries()].map(([lineKey, qs]) => {
      const sel = qs.find((x) => x.isSelected) || null;
      return {
        lineKey,
        componentName: qs[0].componentName || null,
        quoteCount: qs.length,
        selected: sel
          ? { vendorName: sel.vendorName, unitPrice: sel.unitPrice, currency: sel.currency, technicalCompliance: sel.technicalCompliance, specSummary: sel.specSummary, fileName: sel.fileName, fileUrl: sel.fileUrl }
          : null,
        alternatives: qs.filter((x) => !x.isSelected).map((x) => ({ vendorName: x.vendorName, unitPrice: x.unitPrice, currency: x.currency, technicalCompliance: x.technicalCompliance })),
      };
    }),
  };
}

export interface BomTotalItem { currency: string | null; purchaseCost: number | null; quantity: number | null }

/** BoM kalemlerinin para birimi bazında toplam maliyeti (purchaseCost × quantity). */
export function sumBomTotalsByCurrency(items: BomTotalItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const b of items) {
    const cur = b.currency || 'TRY';
    totals[cur] = (totals[cur] || 0) + (b.purchaseCost || 0) * (b.quantity || 0);
  }
  return totals;
}
