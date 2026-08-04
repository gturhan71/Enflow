import type { ReportMetric } from '../../types';
import { TONE_CLASSES, fmtValue } from './helpers';

export default function MetricCard({ m, prev }: { m: ReportMetric; prev?: number }) {
  let delta: { up: boolean; pct: number } | null = null;
  if (typeof m.value === 'number' && typeof prev === 'number' && prev !== 0 && m.value !== prev) {
    const d = m.value - prev;
    delta = { up: d > 0, pct: Math.abs((d / Math.abs(prev)) * 100) };
  }
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{m.label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-black tracking-tighter ${TONE_CLASSES[m.tone || 'default']}`}>{fmtValue(m)}</p>
        {delta && (
          <span className="text-[11px] font-bold text-slate-500" title="Önceki döneme göre">
            {delta.up ? '▲' : '▼'} {delta.pct.toFixed(0)}%
          </span>
        )}
      </div>
      {m.hint && <p className="text-[10px] text-slate-400 mt-1">{m.hint}</p>}
    </div>
  );
}
