import React, { useState, useCallback, useEffect } from 'react';
import { ScrollText, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { apiService } from '../services/apiService';
import { isAgentActor, agentDisplayLabel } from '../lib/agentProvenance';
import type { ActivityLog } from '../types';

const ENTITY_TYPES = [
  'OPPORTUNITY', 'PROPOSAL', 'PROJECT', 'CONTRACT_WORKFLOW', 'CONTRACT', 'TENDER',
  'PURCHASE_REQUEST', 'VENDOR', 'INVOICE', 'PROJECT_COST', 'GUARANTEE', 'LEGAL_CASE',
  'TASK', 'CUSTOMER', 'USER', 'UNIT', 'APPROVAL_STAGE', 'DOCUMENT', 'ARCHIVE',
  'LESSON', 'RISK', 'METRIC', 'EXTERNAL_DOC', 'VISIT_PLAN', 'WORKFLOW',
];

function actionTone(action: string): string {
  if (action.startsWith('CREATE')) return 'bg-emerald-100 text-emerald-700';
  if (action.startsWith('DELETE') || action.includes('REJECT')) return 'bg-red-100 text-red-700';
  if (action.startsWith('STATUS_') || action.includes('APPROVE') || action.includes('TRANSFER')) return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}

export function ActivityLogModule() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getActivityLogs({ entityType: entityType || undefined, action: action || undefined, limit });
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, action, limit]);

  useEffect(() => { load(); }, [load]);

  const actorLabel = (l: ActivityLog) => {
    if (l.actorType === 'AGENT' || isAgentActor(l.userId)) {
      return <span className="text-violet-600 font-bold">🤖 {agentDisplayLabel(l.userId) ?? l.userId}</span>;
    }
    return <span className="text-slate-600">{l.userId}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ScrollText className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
              Denetim İzi
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 font-black text-amber-600">TEST</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold">Sistem genelinde değişiklik/aksiyon kaydı (ActivityLog)</p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary px-3 py-2 rounded-xl flex items-center gap-1 text-xs">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yenile
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Varlık Tipi</label>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} className="input-glass text-sm px-3 py-2 rounded-xl block">
            <option value="">Tümü</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Aksiyon</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={action} onChange={e => setAction(e.target.value)} placeholder="CREATE, STATUS_WON…" className="input-glass text-sm pl-8 pr-3 py-2 rounded-xl" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Limit</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="input-glass text-sm px-3 py-2 rounded-xl block">
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[150px_140px_1fr_180px_40px] gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Zaman</span><span>Aksiyon</span><span>Varlık</span><span>Aktör</span><span></span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Yükleniyor…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Kayıt bulunamadı.</p>
        ) : (
          logs.map(l => (
            <div key={l.id} className="border-t border-slate-100">
              <div className="grid grid-cols-[150px_140px_1fr_180px_40px] gap-2 px-4 py-2.5 items-center text-xs hover:bg-slate-50/60">
                <span className="text-slate-500">{new Date(l.timestamp).toLocaleString('tr-TR')}</span>
                <span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionTone(l.action)}`}>{l.action}</span></span>
                <span className="text-slate-700 font-medium truncate">{l.entityType} <span className="text-slate-400 font-mono text-[10px]">{l.entityId.slice(-8)}</span></span>
                <span className="truncate">{actorLabel(l)}</span>
                <span>
                  {l.details && (
                    <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="p-1 text-slate-400 hover:text-primary">
                      <ChevronDown size={15} className={`transition-transform ${expanded === l.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </span>
              </div>
              {expanded === l.id && l.details && (
                <pre className="px-4 pb-3 text-[11px] text-slate-500 whitespace-pre-wrap break-all">{(() => {
                  try { return JSON.stringify(JSON.parse(l.details), null, 2); } catch { return l.details; }
                })()}</pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityLogModule;
