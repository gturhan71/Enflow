// Enflow — Satınalma Usulü + Usule Göre Otomatik Masraf Şablonları + Forward Kur
// ─────────────────────────────────────────────────────────────────────────────
// Maliyet analizi: malzeme listesinin satışının hangi usulle yapılacağı seçilir;
// her usulün kendine göre ek masrafları (teminat komisyonu, damga, KİK, dosya,
// noter, kabul, lojistik...) otomatik gelir ve düzenlenebilir.
// Değerler TR-kamu varsayılanlarıdır; analizde override edilebilir.

export type ProcurementMethod = 'OPEN' | 'RESTRICTED' | 'NEGOTIATED' | 'DIRECT' | 'PRIVATE';

export const PROCUREMENT_METHODS: { key: ProcurementMethod; label: string; hint: string }[] = [
  { key: 'OPEN',       label: 'Açık İhale',                hint: 'Tam kamu masraf seti (teminat, damga, KİK, dosya)' },
  { key: 'RESTRICTED', label: 'Belli İstekliler Arası',    hint: 'Açık ihale ile aynı masraf seti' },
  { key: 'NEGOTIATED', label: 'Pazarlık Usulü İhale',      hint: 'İhale masrafları (dosya bedeli hariç)' },
  { key: 'DIRECT',     label: 'Doğrudan Temin',            hint: 'Asgari masraf (yalnız damga vergisi)' },
  { key: 'PRIVATE',    label: 'Özel / Ticari Teklif',      hint: 'Kamu-ihale masrafı yok' },
];

// Operasyonel gider kategorileri (CostItem.category — DB String, migration yok)
export type CostCategory =
  | 'LABOR' | 'LOGISTICS' | 'TECHNICAL_SERVICE' | 'TRAVEL' | 'ACCOMMODATION'
  | 'ACCEPTANCE' | 'NOTARY' | 'CUSTOMS' | 'GUARANTEE' | 'TAX' | 'FEE' | 'OTHER';

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  LABOR: 'İşçilik',
  LOGISTICS: 'Lojistik / Nakliye',
  TECHNICAL_SERVICE: 'Teknik Hizmet / Montaj',
  TRAVEL: 'Seyahat',
  ACCOMMODATION: 'Konaklama',
  ACCEPTANCE: 'Kabul / Test',
  NOTARY: 'Noter',
  CUSTOMS: 'Gümrük',
  GUARANTEE: 'Teminat Komisyonu',
  TAX: 'Vergi / Damga',
  FEE: 'Resmî Harç / Bedel',
  OTHER: 'Diğer',
};

// Usul masraf şablonu kalemi: PERCENT → ön-teklif (BoM+ops, marjlı) tabanından %;
// FIXED → teklif para biriminde sabit tutar. `auto:true` = usule göre otomatik gelen.
export interface MethodCostLine {
  label: string;
  kind: 'PERCENT' | 'FIXED';
  value: number;          // PERCENT: yüzde (ör. 0.948); FIXED: tutar (teklif dövizi)
  category: CostCategory;
}

const IHALE_COMMON: MethodCostLine[] = [
  { label: 'Geçici teminat mektubu komisyonu', kind: 'PERCENT', value: 0.6,   category: 'GUARANTEE' },
  { label: 'Kesin teminat mektubu komisyonu',  kind: 'PERCENT', value: 1.2,   category: 'GUARANTEE' },
  { label: 'Damga vergisi (sözleşme, binde 9.48)', kind: 'PERCENT', value: 0.948, category: 'TAX' },
  { label: 'KİK payı (binde 0.5)',             kind: 'PERCENT', value: 0.05,  category: 'FEE' },
  { label: 'Karar pulu / ilan bedeli',         kind: 'FIXED',   value: 1500,  category: 'FEE' },
  { label: 'Noter / sözleşme masrafı',         kind: 'FIXED',   value: 2500,  category: 'NOTARY' },
];

// Usule göre otomatik masraf şablonu (TR-kamu varsayılanları, düzenlenebilir)
export const METHOD_COST_TEMPLATES: Record<ProcurementMethod, MethodCostLine[]> = {
  OPEN: [
    { label: 'İhale dosya / şartname bedeli', kind: 'FIXED', value: 500, category: 'FEE' },
    ...IHALE_COMMON,
  ],
  RESTRICTED: [
    { label: 'İhale dosya / şartname bedeli', kind: 'FIXED', value: 500, category: 'FEE' },
    ...IHALE_COMMON,
  ],
  NEGOTIATED: [...IHALE_COMMON],
  DIRECT: [
    { label: 'Damga vergisi (sözleşme, binde 9.48)', kind: 'PERCENT', value: 0.948, category: 'TAX' },
  ],
  PRIVATE: [],
};

// ── Forward kur ──────────────────────────────────────────────────────────────
/** Tahsilat tarihine kalan ay (yaklaşık; bugünden). En az 0. */
export function monthsUntil(collectionDate?: string): number {
  if (!collectionDate) return 0;
  const d = new Date(collectionDate).getTime();
  if (Number.isNaN(d)) return 0;
  const months = (d - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0, months);
}

/** forward = spot × (1 + yıllıkDeğerKaybı%/100 × ay/12) — kur oynamasına karşı kapsayıcı. */
export function forwardRate(spot: number, annualDepreciationPct: number, months: number): number {
  return spot * (1 + (annualDepreciationPct / 100) * (months / 12));
}

/** Tüm yabancı dövizler için forward kur tablosu (override varsa o kullanılır). */
export function computeForwardRates(
  spotRates: Record<string, number>,
  annualDepreciationPct: number,
  collectionDate: string | undefined,
  overrides?: Record<string, number>,
): Record<string, number> {
  const months = monthsUntil(collectionDate);
  const out: Record<string, number> = {};
  for (const [c, spot] of Object.entries(spotRates)) {
    out[c] = overrides && overrides[c] != null ? overrides[c] : Math.round(forwardRate(spot, annualDepreciationPct, months) * 10000) / 10000;
  }
  return out;
}
