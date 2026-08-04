import React, { useState, useCallback, useEffect } from 'react';
import { ScrollText, RefreshCw, Search, ChevronDown, Archive, Download, PlayCircle, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { isAgentActor, agentDisplayLabel } from '../lib/agentProvenance';
import type { ActivityLog, ActivityLogArchive } from '../types';

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

// Eski (bu özellikten önce yazılmış) kayıtlarda summary yok — sade bir dönüş üretir.
function fallbackSummary(l: ActivityLog): string {
  const actor = l.actorType === 'AGENT' || isAgentActor(l.userId) ? `🤖 ${agentDisplayLabel(l.userId) ?? l.userId}` : l.userId;
  return `${actor}: ${l.entityType} ${l.entityId.slice(-8)} — ${l.action}`;
}

const fmtBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString('tr-TR') : '—';

const archiveStatusBadge = (s: string) => {
  const tone = s === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : s === 'FAILED' ? 'bg-red-500/10 text-red-600' : 'bg-sky-500/10 text-sky-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>{s}</span>;
};

// Yetki header'lı indirme — tarayıcı navigasyonu x-tenant-id/Authorization gönderemez,
// bu yüzden blob'u fetch ile çekip client-side indir (BackupModule ile aynı desen).
const downloadArchive = async (id: string) => {
  const tid = localStorage.getItem('enflow_active_tenant_id') || '';
  const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
  const res = await fetch(`/api/activity-logs/archives/${id}/download`, {
    headers: { 'x-tenant-id': tid, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { alert('İndirme başarısız: ' + res.status); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-log-archive-${id}.ndjson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function ArchivesTab() {
  const [archives, setArchives] = useState<ActivityLogArchive[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getActivityLogArchives();
      setArchives(Array.isArray(data) ? data : []);
    } catch {
      setArchives([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      await apiService.runActivityLogArchive();
      await load();
    } catch {
      alert('Arşivleme başarısız oldu.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-bold max-w-xl">
          180 günden eski loglar, her ay otomatik olarak sha256 mühürlü NDJSON dosyasına dışa aktarılır,
          hedefe (yerel/Nextcloud/S3) yazıldıktan sonra canlı tablodan silinir. Dosya kendi başına
          okunabilir — özet cümleler yazma anında gömülüdür.
        </p>
        <button onClick={runNow} disabled={running} className="btn-primary px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs whitespace-nowrap">
          {running ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Şimdi Arşivle
        </button>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[150px_100px_90px_90px_1fr_60px] gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Başlangıç</span><span>Durum</span><span>Kayıt</span><span>Boyut</span><span>Aralık / Mühür (sha256)</span><span></span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Yükleniyor…</p>
        ) : archives.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Henüz arşiv yok.</p>
        ) : (
          archives.map(a => (
            <div key={a.id} className="grid grid-cols-[150px_100px_90px_90px_1fr_60px] gap-2 px-4 py-2.5 items-center text-xs border-t border-slate-100 hover:bg-slate-50/60">
              <span className="text-slate-500">{fmtDate(a.startedAt)}</span>
              <span>{archiveStatusBadge(a.status)}</span>
              <span className="text-slate-600 font-mono">{a.recordCount}</span>
              <span className="text-slate-600 font-mono">{fmtBytes(a.sizeBytes)}</span>
              <span className="text-slate-400 truncate">
                {a.fromTimestamp && a.toTimestamp ? `${fmtDate(a.fromTimestamp)} → ${fmtDate(a.toTimestamp)}` : '—'}
                {a.checksum && <span className="ml-2 font-mono text-[10px]" title={a.checksum}>#{a.checksum.slice(0, 12)}</span>}
              </span>
              <span>
                {a.status === 'COMPLETED' && a.targetType === 'LOCAL' && (
                  <button onClick={() => downloadArchive(a.id)} title="NDJSON indir" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                    <Download size={15} />
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ActivityLogModule() {
  const [tab, setTab] = useState<'logs' | 'archives'>('logs');
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
        {tab === 'logs' && (
          <button onClick={load} className="btn-secondary px-3 py-2 rounded-xl flex items-center gap-1 text-xs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-slate-100">
        <button onClick={() => setTab('logs')} className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px ${tab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>
          <ScrollText size={14} /> Loglar
        </button>
        <button onClick={() => setTab('archives')} className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 -mb-px ${tab === 'archives' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>
          <Archive size={14} /> Arşivler
        </button>
      </div>

      {tab === 'archives' ? <ArchivesTab /> : (
        <>
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
            <div className="grid grid-cols-[150px_150px_1fr_40px] gap-2 px-4 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Zaman</span><span>Aksiyon</span><span>Özet</span><span></span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-10">Yükleniyor…</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Kayıt bulunamadı.</p>
            ) : (
              logs.map(l => (
                <div key={l.id} className="border-t border-slate-100">
                  <div className="grid grid-cols-[150px_150px_1fr_40px] gap-2 px-4 py-2.5 items-center text-xs hover:bg-slate-50/60">
                    <span className="text-slate-500">{new Date(l.timestamp).toLocaleString('tr-TR')}</span>
                    <span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionTone(l.action)}`}>{l.action}</span></span>
                    <span className="text-slate-700 font-medium truncate">{l.summary || fallbackSummary(l)}</span>
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
        </>
      )}
    </div>
  );
}

export default ActivityLogModule;
