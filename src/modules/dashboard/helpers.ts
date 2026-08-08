import { fmtCurrency as cfmt } from '../../lib/format';

export const byCurStr = (m: Record<string, number>) =>
  Object.entries(m || {}).filter(([, v]) => v).map(([c, v]) => cfmt(v, c)).join(' · ') || '—';

export const dleftBadge = (d: number | null) => {
  if (d == null) return { t: '—', c: 'text-slate-400' };
  if (d < 0) return { t: 'süre doldu', c: 'text-red-600' };
  if (d <= 2) return { t: `${d} gün`, c: 'text-red-600' };
  if (d <= 7) return { t: `${d} gün`, c: 'text-amber-600' };
  return { t: `${d} gün`, c: 'text-slate-500' };
};

// Küçük sayı = daha kritik (birleşik Kritik Uyarılar sıralaması için de kullanılır)
export const severityRank = (d: number | null) => (d == null ? 3 : d < 0 ? 0 : d <= 2 ? 1 : d <= 7 ? 2 : 3);
