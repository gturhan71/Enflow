import { Printer, TrendingUp } from 'lucide-react';
import type { ReportOverview } from '../../types';
import { ROLE_LABELS } from '../../constants';
import { printOverview } from './helpers';
import BottleneckPanel from './BottleneckPanel';
import MetricCard from './MetricCard';
import ChartBlock from './ChartBlock';
import InfoTooltip from '../../components/InfoTooltip';

export default function OverviewTab({ overview, start, end }: { overview: ReportOverview; start: string; end: string }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => printOverview(overview, start, end)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
          <Printer size={13} /> Konsolide Yazdır
        </button>
      </div>
      <BottleneckPanel overview={overview} />
      {overview.units.map(u => (
        <div key={u.unitKey} className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary" size={16} />
            <h3 className="text-base font-black text-slate-900">{u.label}</h3>
            <InfoTooltip text={`${u.label} biriminin seçili dönemdeki öne çıkan metrikleri; her kart bir önceki dönemle (▲/▼) otomatik karşılaştırılır.`} />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ROLE_LABELS[u.role] || u.role}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {u.headline.map((m, i) => <MetricCard key={i} m={m} />)}
          </div>
          {u.charts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {u.charts.map((c, i) => <ChartBlock key={i} c={c} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
