import { RefreshCw, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { Project } from '../../types';
import { fmtCurrencyExact as fmt } from '../../lib/format';
import { PROJECT_TYPE_LABEL, PROJECT_TYPE_COLOR } from './constants';
import { calcFinancials, fmtDate } from './helpers';
import StatusBadge from './StatusBadge';
import MarginBadge from './MarginBadge';

export default function ProjectListView({
  loading, filtered, selectedProjectId, onSelect, onEdit, onDelete,
}: {
  loading: boolean;
  filtered: Project[];
  selectedProjectId?: string;
  onSelect: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {loading ? <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-slate-400" /></div>
        : filtered.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Proje bulunamadı.</div>
        : filtered.map(p => {
          const fin = calcFinancials(p);
          return (
            <div key={p.id} onClick={() => onSelect(p)}
              className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedProjectId === p.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusBadge status={p.status} />
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PROJECT_TYPE_COLOR[p.type]}`}>{PROJECT_TYPE_LABEL[p.type]}</span>
                    {fin.delayedMs > 0 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle size={11} />{fin.delayedMs} gecikmiş</span>}
                  </div>
                  <h4 className="font-semibold text-sm">{p.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.code && <span className="font-mono text-slate-500">{p.code} · </span>}
                    {p.customerName && <span>{p.customerName} · </span>}
                    PM: {p.pmName ?? '—'} · Faz: {p.phase}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-sm">{fmt(p.totalValue, p.contractCurrency)}</p>
                  <div className="flex gap-1 justify-end">
                    <MarginBadge value={fin.actualMargin} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                </div>
                <span className="text-xs text-slate-400 font-bold">%{p.progress}</span>
                <span className="text-xs text-slate-400">Bitiş: {fmtDate(p.plannedEndDate)}</span>
                <button onClick={e => { e.stopPropagation(); onEdit(p); }}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"><Edit2 size={13} /></button>
                <button onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
