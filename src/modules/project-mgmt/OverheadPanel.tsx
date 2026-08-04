import { useState, useEffect, useCallback } from 'react';
import { DollarSign } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { fmtCurrencyExact as fmt } from '../../lib/format';
import type { OverheadResult } from '../../types';

// ── İşletme Maliyeti (Overhead) Paneli — yönetim insiyatifi + birim iştiraki ──
export default function OverheadPanel({ projectId, canEdit, onApplied }: { projectId: string; canEdit: boolean; onApplied: () => void }) {
  const [ovh, setOvh] = useState<OverheadResult | null>(null);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [addUnit, setAddUnit] = useState('');
  const [addCoeff, setAddCoeff] = useState(0.2);
  const load = useCallback(() => { apiService.getProjectOverhead(projectId).then(setOvh).catch(() => setOvh(null)); }, [projectId]);
  useEffect(() => { load(); apiService.getUnits().then((u) => setUnits((u as { id: string; name: string }[]) || [])).catch(() => {}); }, [load]);
  if (!ovh) return null;
  const toggle = async () => { setBusy(true); try { const r = await apiService.applyProjectOverhead(projectId, !ovh.applyOverhead); setOvh(r); onApplied(); } finally { setBusy(false); } };
  const addPart = async () => { if (!addUnit) return; setBusy(true); try { await apiService.addProjectParticipation(projectId, { unitId: addUnit, coefficient: addCoeff }); setAddUnit(''); load(); onApplied(); } finally { setBusy(false); } };
  const pctS = (n: number) => `%${(n * 100).toFixed(1)}`;
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><DollarSign size={15} className="text-amber-400" /><p className="text-xs font-bold text-slate-200 uppercase tracking-wide">İşletme Maliyeti (Overhead)</p></div>
        {canEdit ? (
          <button onClick={toggle} disabled={busy || !ovh.hasPool} title={!ovh.hasPool ? 'Önce Finans → İşletme Maliyeti havuzu tanımlayın' : ''}
            className={`text-[11px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors ${ovh.applyOverhead ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slate-400'} ${!ovh.hasPool ? 'opacity-40 cursor-not-allowed' : 'hover:bg-amber-500/30'}`}>
            {ovh.applyOverhead ? '● Marja dahil' : '○ Marja dahil değil'}
          </button>
        ) : <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${ovh.applyOverhead ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slate-400'}`}>{ovh.applyOverhead ? 'Dahil' : 'Hariç'}</span>}
      </div>
      {!ovh.hasPool ? (
        <p className="text-[11px] text-slate-400 italic">Aktif işletme maliyeti havuzu yok — Finans → İşletme Maliyeti sekmesinden dönem havuzu tanımlayın.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Toplam Overhead</p><p className="text-sm font-black text-amber-300">{fmt(ovh.totalOverhead)}</p><p className="text-[9px] text-slate-500">şirket {fmt(ovh.companyAmount)} · birim {fmt(ovh.unitAmount)}</p></div>
          <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Direkt Maliyet</p><p className="text-sm font-black text-slate-200">{fmt(ovh.directCost)}</p></div>
          <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Katkı Marjı</p><p className="text-sm font-black text-slate-200">{pctS(ovh.contributionMargin)}</p></div>
          <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Tam-Yüklü Net Marj</p><p className={`text-sm font-black ${ovh.applyOverhead ? 'text-emerald-400' : 'text-amber-300'}`}>{pctS(ovh.netMargin)}</p></div>
        </div>
      )}

      {/* Birim iştirakleri (Katman-2) */}
      <div className="pt-2 border-t border-white/10">
        <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Birim İştirakleri (Katman-2)</p>
        {ovh.unitBreakdown.length === 0 ? <p className="text-[11px] text-slate-500 italic">İştirak eden birim yok.</p> : (
          <div className="space-y-1">
            {ovh.unitBreakdown.map(b => (
              <div key={b.unitId} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300">{b.unitName} <span className="text-slate-500">(kats. {b.coefficient} × {fmt(b.periodCost)})</span></span>
                <span className="font-bold text-amber-300">{fmt(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex items-center gap-2 mt-2">
            <select value={addUnit} onChange={e => setAddUnit(e.target.value)} className="flex-1 bg-white/10 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-white/10 outline-none">
              <option value="">Birim seç…</option>
              {units.map(u => <option key={u.id} value={u.id} className="bg-slate-800">{u.name}</option>)}
            </select>
            <input type="number" step="0.05" min="0" max="1" value={addCoeff} onChange={e => setAddCoeff(Number(e.target.value))} title="Katsayı (0–1)" className="w-20 bg-white/10 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-white/10 outline-none" />
            <button onClick={addPart} disabled={busy || !addUnit} className="text-[11px] font-black uppercase px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40">Ekle</button>
          </div>
        )}
      </div>
    </div>
  );
}
