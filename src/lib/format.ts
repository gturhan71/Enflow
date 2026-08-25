// Enflow — para/tarih gösterim yardımcıları (tr-TR).
// Faz 1 dedup: aynı Intl.NumberFormat('tr-TR', ...) 8 modülde ayrı ayrı tanımlıydı.
// ÜÇ FARKLI davranış tespit edildi (mekanik dedup — hiçbiri "düzeltilmedi", olduğu gibi
// korunuyor; hangi modül hangisini kullanıyorsa aynısına bağlanıyor):
//   fmtCurrency        — n||0 ile null/undefined'ı 0'a çevirir, maximumFractionDigits:0 (tam sayı).
//   fmtCurrencyExact    — null-fallback YOK (çağıran her zaman geçerli number garanti eder),
//                         minimumFractionDigits:0 (ondalık varsa gösterir, yoksa göstermez).
//   fmtCurrencyOrDash   — null/undefined için '—' döner, minimumFractionDigits:0.

export const fmtCurrency = (n: number, currency = 'TRY'): string =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

export const fmtCurrencyExact = (v: number, currency = 'TRY'): string =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);

export const fmtCurrencyOrDash = (amount: number | null | undefined, currency = 'TRY'): string => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

// Düzenlenebilir para input'ları için — döviz sembolü YOK, yalnız tr-TR yazım biçimi
// (nokta binlik, virgül ondalık). Native <input type="number"> tarayıcı/OS locale'ine
// göre ondalık ayırıcı dayattığı için (seçilen dövizden bağımsız, kafa karıştırıcı)
// MoneyInput bu ikiliyi kullanarak kendi metin tabanlı girişini yönetir.
export const formatMoneyInput = (n: number): string =>
  n === 0 ? '' : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

// Kullanıcının yazdığı serbest metni (virgül/nokta ondalık, TR/EN yazım biçimleri
// karışık olsa da) sayıya çevirir — SON virgül/nokta ondalık ayırıcı kabul edilir,
// öncekiler binlik ayıracı sayılıp atılır (ör. "1.234,56" ve "1234,56" ikisi de 1234.56).
export const parseMoneyInput = (raw: string): number => {
  const cleaned = raw.trim();
  if (!cleaned) return 0;
  const decimalIndex = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '');
  const normalized = decimalIndex === -1
    ? digitsOnly(cleaned)
    : `${digitsOnly(cleaned.slice(0, decimalIndex))}.${digitsOnly(cleaned.slice(decimalIndex + 1))}`;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};
