import { AlertCircle } from 'lucide-react';
import { Project, ProjectStatus } from '../../types';
import { PROJECT_TYPE_LABEL, PROJECT_TYPE_COLOR, STATUS_CONFIG } from './constants';
import { calcFinancials } from './helpers';
import MarginBadge from './MarginBadge';

export default function KanbanView({
  kanbanGroups, selectedProjectId, onSelect,
}: {
  kanbanGroups: { status: ProjectStatus; projects: Project[] }[];
  selectedProjectId?: string;
  onSelect: (p: Project) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kanbanGroups.map(({ status, projects: gProjects }) => {
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-slate-400 font-semibold">{gProjects.length}</span>
            </div>
            {gProjects.map(p => {
              const fin = calcFinancials(p);
              return (
                <div key={p.id} onClick={() => onSelect(p)}
                  className={`glass-card rounded-xl p-3 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedProjectId === p.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold leading-tight flex-1">{p.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PROJECT_TYPE_COLOR[p.type]} shrink-0`}>
                      {PROJECT_TYPE_LABEL[p.type].slice(0,3)}
                    </span>
                  </div>
                  {p.code && <p className="text-[10px] text-slate-500 font-mono mb-1">{p.code}</p>}
                  {p.customerName && <p className="text-xs text-slate-400 mb-2">{p.customerName}</p>}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">%{p.progress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <MarginBadge value={fin.actualMargin} />
                    {fin.delayedMs > 0 && (
                      <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                        <AlertCircle size={10} />{fin.delayedMs}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {gProjects.length === 0 && (
              <div className="border border-dashed border-white/10 rounded-xl p-4 text-center text-xs text-slate-500">Proje yok</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
