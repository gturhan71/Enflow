import { TrendingUp } from 'lucide-react';
import type { FunnelReport } from '../../types';
import { pct } from './helpers';
import InfoTooltip from '../../components/InfoTooltip';

export default function FunnelCard({ f }: { f: FunnelReport }) {
  const max = Math.max(1, ...f.stages.map(s => s.count));
  const topLoss = f.lossByReason[0];
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2"><TrendingUp size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Dönüşüm Hunisi</h4>
        <InfoTooltip text="Fırsatların CRM aşamalarına göre sayısal dağılımı, aşamalar akış sırasına göre (Yeni→...→Kazanıldı) dizilir; her aşama altında bir sonrakine geçiş oranı gösterilir — düşük geçiş oranı süreçte sızıntı noktasını işaret eder." />
      </div>
      <div className="space-y-2">
        {f.stages.map((s) => (
          <div key={s.status} className="flex items-center gap-3">
            <div className="w-24 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right shrink-0">{s.name}</div>
            <div className="flex-1 bg-slate-100 rounded-lg h-7 overflow-hidden relative">
              <div className="bg-primary/80 h-full flex items-center px-2" style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }}>
                <span className="text-[11px] font-black text-white">{s.count}</span>
              </div>
            </div>
            <div className="w-12 text-[10px] font-bold text-slate-400 shrink-0">
              {s.conversionToNext !== null ? <span className={s.conversionToNext < 0.5 ? 'text-red-500' : 'text-emerald-600'}>↓{pct(s.conversionToNext)}</span> : ''}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        <span className="text-slate-400 font-bold">Pipeline'a giren: <span className="text-slate-700">{f.entered}</span></span>
        {topLoss && <span className="text-slate-400 font-bold">En sık kayıp: <span className="text-red-500">{topLoss.reason} ({topLoss.count})</span></span>}
      </div>
    </div>
  );
}
