// Backend logger — mevcut console.* çağrılarının davranışını DEĞİŞTİRMEDEN
// tek bir yere indirger (Faz 1, mekanik). Sunucu logları (start/hata/uyarı)
// ops-görünürlüğü için ortamdan bağımsız her zaman basılır — frontend'in
// logger.ts'indeki gibi dev-only gate YOK (bu davranış değişikliği olurdu).
export const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
