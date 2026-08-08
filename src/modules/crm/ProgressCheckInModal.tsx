import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { cn } from '../../lib/utils';
import { Opportunity, OpportunityProgressLog } from '../../types';
import { apiService } from '../../services/apiService';
import { PIPELINE_STAGES, STATUS_LABEL, getStatusStyle } from './constants';

const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

export default function ProgressCheckInModal({
  opp, onClose, onSaved,
}: {
  opp: Opportunity;
  onClose: () => void;
  onSaved: (updated: Opportunity) => void;
}) {
  const [probability, setProbability] = useState(opp.probability);
  const [status, setStatus] = useState(opp.status);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<OpportunityProgressLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const changed = probability !== opp.probability || status !== opp.status;
  const noteRequired = !changed;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getOpportunityProgressLog(opp.id) as OpportunityProgressLog[];
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch { /* geçmiş yüklenemezse teyit formunu engelleme */ }
      finally { if (!cancelled) setLoadingLogs(false); }
    })();
    return () => { cancelled = true; };
  }, [opp.id]);

  const chartData = [...logs].reverse().map(l => ({ name: fmtShort(l.createdAt), value: l.newProbability }));

  const handleSubmit = async () => {
    if (noteRequired && !note.trim()) {
      setError('Olasılık/aşama değişmediyse nedenini belirtmelisiniz.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await apiService.checkInOpportunityProgress(opp.id, {
        probability, status, note: note.trim() || undefined,
      }) as Opportunity;
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İlerleme teyidi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-3xl p-8 w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div>
          <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">İlerleme Teyidi</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">"{opp.title}" — gerçekleşme olasılığını ve aşamayı güncelleyin, ya da değişmediyse nedenini not düşün.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Gerçekleşme Olasılığı</span><span>{probability}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama</label>
            <div className="flex flex-wrap gap-1.5">
              {([...PIPELINE_STAGES, 'LOST'] as Opportunity['status'][]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all",
                    status === s ? getStatusStyle(s) : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Not {noteRequired ? <span className="text-red-500">(zorunlu — ilerleme değişmedi)</span> : '(opsiyonel)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={noteRequired ? 'Neden ilerleme kaydedilmedi?' : 'Ek not (opsiyonel)'}
              className="input-glass w-full resize-none"
            />
          </div>

          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        </div>

        {!loadingLogs && chartData.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Olasılık Trendi</p>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="name" fontSize={9} fontWeight={700} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} fontWeight={700} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(151 86% 39%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!loadingLogs && logs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Geçmiş</p>
            {logs.map(l => (
              <div key={l.id} className="text-[11px] text-slate-500 font-bold flex items-start gap-2">
                <span className="text-slate-300 shrink-0">{fmtShort(l.createdAt)}</span>
                <span>
                  {l.changed
                    ? `%${l.previousProbability} → %${l.newProbability}${l.previousStatus !== l.newStatus ? `, ${STATUS_LABEL[l.previousStatus] || l.previousStatus} → ${STATUS_LABEL[l.newStatus] || l.newStatus}` : ''}`
                    : 'Değişiklik yok'}
                  {l.note && <span className="text-slate-400"> — {l.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            {saving ? 'Kaydediliyor...' : 'Teyit Et'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
