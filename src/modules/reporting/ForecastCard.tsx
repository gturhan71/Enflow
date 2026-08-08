import { useState } from 'react';
import { Gauge, Pencil } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import type { ForecastReport } from '../../types';
import { pct, STAGE_LABELS } from './helpers';
import { fmtCurrency as fmtTRY } from '../../lib/format';
import InfoTooltip from '../../components/InfoTooltip';

export default function ForecastCard({ f, onSaved }: { f: ForecastReport; onSaved: () => void }) {
  const { currentUser } = useAuth();
  const isGM = currentUser?.role === 'GENERAL_MANAGER';
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(f.target || ''));
  const [saving, setSaving] = useState(false);
  const covPct = Math.min(1, f.coverage);
  const covCol = f.coverage >= 1 ? 'text-emerald-600' : f.coverage >= 0.7 ? 'text-amber-600' : 'text-red-600';
  const barCol = f.coverage >= 1 ? 'bg-emerald-500' : f.coverage >= 0.7 ? 'bg-amber-500' : 'bg-red-500';
  const maxW = Math.max(1, ...f.byStage.map(s => s.weighted));
  const save = async () => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try { await apiService.setSalesTarget(n); setEditing(false); onSaved(); } finally { setSaving(false); }
  };
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Gauge size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Ağırlıklı Tahmin & Kapsama</h4>
          <InfoTooltip text="Her fırsatın değeri kendi kazanma olasılığıyla (probability) çarpılıp toplanır — 'ağırlıklı pipeline'; bunun satış hedefine oranı kapsama yüzdesini verir. Aşama dağılımı olasılığa göre ağırlıklı, en yüksek aşama en üstte." />
        </div>
        {isGM && !editing && <button onClick={() => { setVal(String(f.target || '')); setEditing(true); }} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"><Pencil size={11} />Hedef</button>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ağırlıklı Pipeline</p><p className="text-lg font-black text-primary">{fmtTRY(f.weightedPipeline)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ham Pipeline</p><p className="text-lg font-black text-slate-800">{fmtTRY(f.rawPipeline)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kazanılan (Dönem)</p><p className="text-lg font-black text-emerald-600">{fmtTRY(f.wonValue)}</p></div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)} className="input-glass flex-1 text-sm" placeholder="Satış hedefi (TRY)" autoFocus />
          <button onClick={save} disabled={saving} className="btn-primary text-xs px-3 py-1.5">{saving ? '…' : 'Kaydet'}</button>
          <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5">İptal</button>
        </div>
      ) : f.target > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold">Hedef Kapsama: <span className="text-slate-700">{fmtTRY(f.weightedPipeline)} / {fmtTRY(f.target)}</span></span>
            <span className={`text-lg font-black ${covCol}`}>{pct(f.coverage)}</span>
          </div>
          <div className="bg-slate-100 rounded-lg h-4 overflow-hidden"><div className={`${barCol} h-full`} style={{ width: `${covPct * 100}%` }} /></div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">Kapsama oranı için satış hedefi girin{isGM ? ' (Hedef butonu)' : ' — Genel Müdür tanımlar'}.</p>
      )}
      {f.byStage.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-slate-100">
          {f.byStage.map(s => (
            <div key={s.status} className="flex items-center gap-2">
              <span className="w-24 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right shrink-0">{STAGE_LABELS[s.status] || s.status}</span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden"><div className="bg-primary/60 h-full" style={{ width: `${Math.max(2, (s.weighted / maxW) * 100)}%` }} /></div>
              <span className="w-24 text-right text-[10px] font-bold text-slate-500">{fmtTRY(s.weighted)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
