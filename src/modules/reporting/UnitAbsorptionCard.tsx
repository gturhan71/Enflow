import { LayoutGrid, AlertTriangle } from 'lucide-react';
import type { UnitAbsorptionReport } from '../../types';
import { pct } from './helpers';
import { fmtCurrency as fmtTRY } from '../../lib/format';

export default function UnitAbsorptionCard({ a }: { a: UnitAbsorptionReport }) {
  const barCol = (p: number) => p >= 1 ? 'bg-red-500' : p >= 0.7 ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><LayoutGrid size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Birim Bütçe Absorpsiyonu</h4></div>
        {a.summary.overAllocatedCount > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded"><AlertTriangle size={12} /> {a.summary.overAllocatedCount} aşırı-dağıtım</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Toplam Bütçe</p><p className="text-lg font-black text-slate-800">{fmtTRY(a.summary.totalBudget)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dağıtılan</p><p className="text-lg font-black text-primary">{fmtTRY(a.summary.totalAllocated)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ort. Absorpsiyon</p><p className="text-lg font-black text-emerald-600">{pct(a.summary.avgAbsorption)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Atıl Maliyet</p><p className="text-lg font-black text-amber-600">{fmtTRY(a.summary.idleCost)}</p></div>
      </div>
      {a.units.length === 0 ? <p className="text-[11px] text-slate-400 italic">Birim bütçesi tanımlı değil (Finans → İşletme Maliyeti / birim bütçe).</p> : (
        <div className="space-y-2">
          {a.units.map(u => (
            <div key={u.unitId} className="flex items-center gap-3">
              <span className="w-32 text-xs font-bold text-slate-700 truncate">{u.unitName}{u.overAllocated && <span className="ml-1 text-[8px] bg-red-100 text-red-600 px-1 rounded uppercase">aşırı</span>}</span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden"><div className={barCol(u.absorptionPct)} style={{ width: `${Math.min(100, u.absorptionPct * 100)}%`, height: '100%' }} /></div>
              <span className="w-12 text-right text-xs font-bold text-slate-600">{pct(u.absorptionPct)}</span>
              <span className="w-40 text-right text-[10px] text-slate-400">{fmtTRY(u.allocated)} / {fmtTRY(u.totalBudget)} · {u.projectCount} proje</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{a.note}</p>
    </div>
  );
}
