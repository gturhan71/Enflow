import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Project } from '../../types';
import { calcFinancials } from './helpers';

export default function RiskPanel({ riskProjects, onSelect }: { riskProjects: Project[]; onSelect: (p: Project) => void }) {
  if (riskProjects.length === 0) return null;
  return (
    <div className="glass-card rounded-2xl p-5 border-amber-500/20 border bg-amber-900/5">
      <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
        <AlertTriangle size={16} /> Risk Paneli
      </h4>
      <div className="space-y-2">
        {riskProjects.map(p => {
          const fin = calcFinancials(p);
          const risks: string[] = [];
          if (fin.delayedMs > 0) risks.push(`${fin.delayedMs} gecikmiş milestone`);
          if (fin.actualMargin < fin.plannedMargin - 5) risks.push(`Kar %${(fin.plannedMargin - fin.actualMargin).toFixed(1)} geride`);
          if (p.budgetTotal > 0 && fin.totalActual > p.budgetTotal * 0.85) risks.push(`Bütçenin %${((fin.totalActual/p.budgetTotal)*100).toFixed(0)}'i kullanıldı`);
          return (
            <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl p-2 transition-colors"
              onClick={() => onSelect(p)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">{p.name}</p>
                <p className="text-xs text-amber-400">{risks.join(' · ')}</p>
              </div>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
