// Backend logger — mevcut console.* çağrılarının davranışını DEĞİŞTİRMEDEN
// tek bir yere indirger (Faz 1, mekanik). Sunucu logları (start/hata/uyarı)
// ops-görünürlüğü için ortamdan bağımsız her zaman basılır — frontend'in
// logger.ts'indeki gibi dev-only gate YOK (bu davranış değişikliği olurdu).
//
// Üretimde (NODE_ENV=production) yapılandırılmış tek-satır JSON basılır — log
// toplayıcılar (bkz. docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz C / S-07)
// parse edebilsin diye. Geliştirmede davranış aynı kalır (okunabilir çoklu-arg
// console çıktısı) — çağıran taraf (`logger.info(...)`) hiç değişmez.
const STRUCTURED = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';

function serialize(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  return v;
}

function emit(level: 'info' | 'warn' | 'error', args: unknown[]): void {
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (!STRUCTURED) { out(...args); return; }

  const [first, ...rest] = args;
  const msg = typeof first === 'string' ? first : undefined;
  const data = (msg ? rest : args).map(serialize);
  out(JSON.stringify({ level, ts: new Date().toISOString(), msg, data: data.length ? data : undefined }));
}

export const logger = {
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};
