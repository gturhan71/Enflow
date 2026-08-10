// Şirket adı benzerliği (mükerrer müşteri kaydı uyarısı için). Harici bağımlılık
// eklemeden (businessDays.ts'in saf-fonksiyon deseniyle aynı) — standart Levenshtein.

const LEGAL_SUFFIXES = /\b(a\.?ş\.?|ltd\.?|şti\.?|anonim şirketi|limited şirketi|sanayi|ticaret|ve|inc\.?|corp\.?|co\.?)\b/g;

/** Karşılaştırma için şirket adını sadeleştirir: küçük harf, noktalama ve yaygın ek kelimeler temizlenir. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/[.,'"()]/g, '')
    .replace(LEGAL_SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Standart düzenleme mesafesi (dinamik programlama). */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** 0 (tamamen farklı) — 1 (aynı) arası benzerlik oranı. */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}
