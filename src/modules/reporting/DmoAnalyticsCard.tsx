import { Package, AlertTriangle } from 'lucide-react';
import type { DmoAnalytics } from '../../types';
import { DMO_STATUS_TR, pct } from './helpers';
import { fmtCurrency as fmtTRY } from '../../lib/format';

export default function DmoAnalyticsCard({ d }: { d: DmoAnalytics }) {
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Package size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">DMO Kanalı</h4></div>
        {d.unprofitableCount > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded"><AlertTriangle size={12} /> {d.unprofitableCount} kârsız</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gerçek Ciro</p><p className="text-lg font-black text-slate-800">{fmtTRY(d.activeRevenue)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Net Kâr</p><p className={`text-lg font-black ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtTRY(d.netProfit)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ort. Net Marj</p><p className="text-lg font-black text-primary">{pct(d.avgNetMarginPct)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Değerlendirmede</p><p className="text-lg font-black text-amber-600">{d.evaluationCount} · {fmtTRY(d.evaluationValue)}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Durum Dağılımı</p>
          <div className="flex flex-wrap gap-1">
            {d.byStatus.map(s => <span key={s.status} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{DMO_STATUS_TR[s.status] || s.status}: {s.count}</span>)}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Risturn: <b>{fmtTRY(d.risturnAccrued)}</b> · Komisyon: <b>{fmtTRY(d.commissionTotal)}</b></p>
        </div>
        {d.topInstitutions.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">En Büyük Kurumlar</p>
            {d.topInstitutions.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] border-b border-slate-100 py-0.5 last:border-0">
                <span className="font-bold text-slate-600 truncate mr-2">{it.name}</span>
                <span className="shrink-0 text-slate-500">{fmtTRY(it.revenue)} · <span className={it.net >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtTRY(it.net)}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 italic">{d.note}</p>
    </div>
  );
}
