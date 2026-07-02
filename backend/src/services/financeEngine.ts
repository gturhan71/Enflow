// Enflow — Finansal Hesap Motoru (canonical SoT — saf fonksiyonlar)
// ─────────────────────────────────────────────────────────────────────────────
// Para birimi: TAM SAYI minor unit (kuruş) — float yuvarlama hatası yasak.
// net / KDV / brüt ayrımı + çoklu döviz (asla sessiz tek-toplam) + tutarlı yuvarlama.
// Bu servis hesabın TEK doğruluk kaynağıdır; modüller dağıtık hesap yapmamalı.
//
// NOT: Mevcut şema para alanlarını Float tutuyor. Bu motor hesabı kuruş tabanlı
// yapar; alanların bigint'e KALICI taşınması ayrı/aşamalı bir migration'dır
// (bkz. rapor C/Float — riskli, ayrı iş). Burada hesap doğruluğu sağlanır.

export type Currency = 'TRY' | 'USD' | 'EUR' | string;

export interface MoneyBreakdown {
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  currency: Currency;
}

export interface LineInput {
  qty: number;
  unitPrice: number;       // ana birim (örn. TL) — toMinor ile kuruşa çevrilir
  vatRate?: number;        // 0.20 vb. (varsayılan 0)
  currency?: Currency;     // varsayılan TRY
  discountPct?: number;    // satır iskontosu yüzdesi (0–100)
}

/** Ana birim → kuruş (tam sayı). Float kalıntısını yuvarlar. */
export function toMinor(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}
/** Kuruş → ana birim (gösterim). */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}
/** Tutarlı yuvarlama (half-up) — tek nokta. */
export function roundMinor(minor: number): number {
  return Math.round(minor);
}

/** Net kuruş + KDV oranı → {net, vat, gross}. */
export function applyVat(netMinor: number, vatRate = 0): { netMinor: number; vatMinor: number; grossMinor: number } {
  const net = roundMinor(netMinor);
  const vat = roundMinor(net * (vatRate || 0));
  return { netMinor: net, vatMinor: vat, grossMinor: net + vat };
}

/** Bir satırın net/KDV/brüt kırılımı (iskonto + KDV dahil). */
export function lineBreakdown(line: LineInput): MoneyBreakdown {
  const unitMinor = toMinor(line.unitPrice);
  const qty = Number(line.qty) || 0;
  let net = roundMinor(unitMinor * qty);
  if (line.discountPct && line.discountPct > 0) {
    net = roundMinor(net * (1 - Math.min(100, line.discountPct) / 100));
  }
  const { vatMinor, grossMinor } = applyVat(net, line.vatRate || 0);
  return { netMinor: net, vatMinor, grossMinor, currency: line.currency || 'TRY' };
}

/**
 * Çok satırlı toplam — DÖVİZ BAZINDA AYRI (sessiz tek-toplam YASAK).
 * Karışık para birimi güvenliği: her currency için ayrı net/vat/gross döner.
 */
export function sumByCurrency(lines: LineInput[]): Record<Currency, MoneyBreakdown> {
  const out: Record<Currency, MoneyBreakdown> = {};
  for (const line of lines) {
    const b = lineBreakdown(line);
    const cur = b.currency;
    if (!out[cur]) out[cur] = { netMinor: 0, vatMinor: 0, grossMinor: 0, currency: cur };
    out[cur].netMinor += b.netMinor;
    out[cur].vatMinor += b.vatMinor;
    out[cur].grossMinor += b.grossMinor;
  }
  return out;
}

/** Açık döviz çevrimi (yalnız istendiğinde; kur ve tarih çağıran tarafından kilitlenir). */
export function convertMinor(minor: number, fxRate: number): number {
  return roundMinor(minor * (fxRate || 1));
}

/** Gösterim için kırılımı ana birime çevirir (UI/rapor). */
export function presentBreakdown(b: MoneyBreakdown): { net: number; vat: number; gross: number; currency: Currency } {
  return { net: fromMinor(b.netMinor), vat: fromMinor(b.vatMinor), gross: fromMinor(b.grossMinor), currency: b.currency };
}

// ── İşletme Maliyeti (Overhead) — Katman 1 (şirket genel gider %) ─────────────
export type OverheadMethod = 'PCT_OF_VALUE' | 'PCT_OF_DIRECT_COST' | 'POOL_RATE';

/**
 * Katman-1 şirket işletme maliyeti. Saf fonksiyon; taban çağıran tarafından seçilir
 * (PCT_OF_VALUE→sözleşme değeri, PCT_OF_DIRECT_COST→direkt maliyet, POOL_RATE→dağıtım tabanı).
 * PCT_*: rate yüzdedir (ör. 8 = %8). POOL_RATE: rate ondalık orandır (ör. 0.12).
 */
export function computeCompanyOverhead(base: number, method: OverheadMethod, rate: number): number {
  const minor = toMinor(base || 0);
  const factor = method === 'POOL_RATE' ? (rate || 0) : (rate || 0) / 100;
  return fromMinor(roundMinor(minor * factor));
}

/** Proje marjları: katkı (direkt) ve tam-yüklü (net, overhead dahil). value 0 ise 0. */
export function projectMargins(value: number, directCost: number, overhead: number): { contributionMargin: number; netMargin: number } {
  if (!value || value <= 0) return { contributionMargin: 0, netMargin: 0 };
  return {
    contributionMargin: (value - directCost) / value,
    netMargin: (value - directCost - overhead) / value,
  };
}
