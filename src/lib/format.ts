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
