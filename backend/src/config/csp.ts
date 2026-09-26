// İçerik Güvenlik Politikası (P0-3). Bir XSS bulunsa bile enjekte edilen betiğin çalışmasını ve
// veriyi dışarı sızdırmasını sınırlar (defense-in-depth; token zaten httpOnly çerezde).
//
// Dayanak (kod taraması, 2026-09-26): index.html satır içi betik içermez (yalnız type=module) →
// script-src 'self' mümkün. Kalan dış bağımlılıklar: Google Fonts (stil+yazı tipi) ve PDF üretimi için
// jsdelivr'den yazı tipi indirme (fetch → connect-src). pdf.js worker'ı artık paketin içinden gelir.
// style-src 'unsafe-inline' KAÇINILMAZ: React/recharts/motion `style=""` özniteliği yazar (öznitelikler
// nonce/hash alamaz) — betik yürütmeyi etkilemez, yalnız stil.
//
// CSP_MODE: enforce (varsayılan) | report-only (yalnız raporla — yayın sonrası acil kaçış) | off.
// Ekstra origin'ler: CSP_EXTRA_CONNECT / CSP_EXTRA_IMG (virgüllü) — ör. şirket içi CDN/uzak depo.
export type CspMode = 'enforce' | 'report-only' | 'off';

export function cspMode(env: NodeJS.ProcessEnv = process.env): CspMode {
  const v = (env.CSP_MODE || 'enforce').toLowerCase();
  return v === 'report-only' || v === 'off' ? v : 'enforce';
}

const list = (v?: string) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export function cspDirectives(env: NodeJS.ProcessEnv = process.env): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', ...list(env.CSP_EXTRA_IMG)],
    'connect-src': ["'self'", 'https://cdn.jsdelivr.net', ...list(env.CSP_EXTRA_CONNECT)],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'", 'blob:', 'data:'],
    'media-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    // HTTP üzerinde çalışan on-prem kurulumu bozmamak için upgrade-insecure-requests YOK.
    'report-uri': ['/api/csp-report'],
  };
}

/** helmet({ contentSecurityPolicy }) değeri: false (kapalı) ya da { useDefaults:false, directives, reportOnly }. */
export function helmetCsp(env: NodeJS.ProcessEnv = process.env) {
  const mode = cspMode(env);
  if (mode === 'off') return false as const;
  return { useDefaults: false, directives: cspDirectives(env), reportOnly: mode === 'report-only' };
}
