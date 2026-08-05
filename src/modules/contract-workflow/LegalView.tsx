import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, ArrowRightCircle, Trash2, AlertTriangle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { apiService } from '../../services/apiService';
import { LegalCase, LegalRequest } from '../../types';
import { LEGAL_TYPE_LABELS, LEGAL_STATUS_STYLES, PRIORITY_STYLES } from './constants';
import { BASE, apiFetch, computeDeadlineAlarm } from './helpers';
import { ContractWorkflow } from './types';
import LegalCaseForm from './LegalCaseForm';

export default function LegalView() {
  const [view, setView] = useState<'requests' | 'cases'>('cases');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [requests, setRequests] = useState<LegalRequest[]>([]);
  const [workflows, setWorkflows] = useState<ContractWorkflow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, w] = await Promise.all([apiService.getLegalCases(), apiService.getLegalRequests(), apiFetch(BASE)]);
      setCases(c as LegalCase[]); setRequests(r as LegalRequest[]); setWorkflows(w as ContractWorkflow[]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const linkedWorkflow = (c: LegalCase) =>
    c.relatedEntityType === 'CONTRACT_WORKFLOW' && c.relatedEntityId
      ? workflows.find(w => w.id === c.relatedEntityId)
      : undefined;

  const closeCase = async (c: LegalCase) => {
    setErrMsg(null);
    try {
      await apiService.updateLegalCase(c.id, { status: 'CLOSED' });
      load();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Vaka kapatılamadı.');
    }
  };

  const convertToCase = async (req: LegalRequest) => {
    await apiService.createLegalCase({
      title: req.title, type: 'CONTRACT_REVIEW', priority: req.priority || 'MEDIUM',
      summary: req.description, sourceTaskId: req.id, categoryCode: 'HUK',
    });
    setMsg('Talep hukuki vakaya dönüştürüldü.');
    setView('cases');
    load();
  };

  const pendingRequests = requests.filter(r => !r.converted);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('cases')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'cases' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            Hukuki Vakalar <span className="ml-1 text-xs opacity-70">({cases.length})</span>
          </button>
          <button onClick={() => setView('requests')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'requests' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            Gelen Talepler <span className="ml-1 text-xs opacity-70">({pendingRequests.length})</span>
          </button>
        </div>
        {view === 'cases' && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Yeni Vaka
          </button>
        )}
      </div>

      {msg && <div className="glass-card p-3 text-sm text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {msg}</div>}
      {errMsg && <div className="glass-card p-3 text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errMsg}</div>}
      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}

      {view === 'requests' && (
        pendingRequests.length === 0
          ? <div className="glass-card p-12 text-center text-slate-400 italic">Bekleyen hukuk talebi yok. (Görevler modülünde "Hukuk / Şirket Avukatı" modülüyle görev oluşturulduğunda burada görünür.)</div>
          : <div className="space-y-3">
              {pendingRequests.map(r => (
                <div key={r.id} className="glass-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">{r.title}</h4>
                    {r.description && <p className="text-xs text-slate-600 mt-1">{r.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">Öncelik: <span className={PRIORITY_STYLES[r.priority] || 'text-slate-400'}>{r.priority}</span> · {r.status}</p>
                  </div>
                  <button onClick={() => convertToCase(r)} className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap">
                    <ArrowRightCircle className="w-3.5 h-3.5" /> Vakaya Dönüştür
                  </button>
                </div>
              ))}
            </div>
      )}

      {view === 'cases' && (
        cases.length === 0
          ? <div className="glass-card p-12 text-center text-slate-400 italic">Henüz hukuki vaka yok. Sözleşme incelemesi, hukuki görüş veya uyuşmazlık kaydı ekleyin.</div>
          : <div className="space-y-3">
              {cases.map(c => {
                const wf = linkedWorkflow(c);
                const alarm = wf ? computeDeadlineAlarm(wf) : null;
                return (
                <div key={c.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-900">{c.title}</h4>
                        <span className="text-xs text-slate-500">{LEGAL_TYPE_LABELS[c.type] || c.type}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${LEGAL_STATUS_STYLES[c.status] || ''}`}>{c.status}</span>
                        <span className={`text-[10px] font-bold uppercase ${PRIORITY_STYLES[c.priority]}`}>{c.priority}</span>
                        {c.docNumber && <span className="text-[10px] font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg">{c.docNumber}</span>}
                      </div>
                      {c.summary && <p className="text-xs text-slate-600">{c.summary}</p>}
                      {c.opinion && <p className="text-xs text-slate-600"><span className="font-bold">Görüş:</span> {c.opinion}</p>}
                      {wf && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          Bağlı sözleşme: <span className="font-semibold text-slate-700">{wf.title}</span>
                          {alarm && alarm.level !== 'none' && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${alarm.level === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                              <AlertTriangle className="w-3 h-3" /> {alarm.label}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.status !== 'CLOSED' && (
                        <button onClick={() => closeCase(c)} className="text-xs text-emerald-600 hover:underline">Kapat</button>
                      )}
                      <button onClick={async () => { await apiService.deleteLegalCase(c.id); load(); }}
                        className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
      )}

      <AnimatePresence>
        {showForm && <LegalCaseForm workflows={workflows} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}
