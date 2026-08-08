import { Archive } from 'lucide-react';
import type { ArchiveAnalytics } from '../../types';
import InfoTooltip from '../../components/InfoTooltip';

export default function ArchiveCard({ d }: { d: ArchiveAnalytics }) {
  const maxCat = Math.max(1, ...d.categories.map(c => c.count));
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2"><Archive size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Fiziksel Arşiv</h4>
        <InfoTooltip text="Fiziksel/dijital arşiv kutularının kategori dağılımı; dikkat listesi en uzun süredir ödünçte olan kayıtları en üstte gösterir — kaybolma/gecikme riskini erken görmek için." />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Toplam</p><p className="text-2xl font-black text-slate-800">{d.summary.total}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fiziksel</p><p className="text-2xl font-black text-slate-700">{d.summary.physical}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dijital (Oto.)</p><p className="text-2xl font-black text-emerald-600">{d.summary.digital}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ödünç Verildi</p><p className="text-2xl font-black text-amber-600">{d.summary.borrowed}</p></div>
      </div>
      {d.categories.length > 0 && (
        <div className="space-y-1">
          {d.categories.slice(0, 5).map(c => (
            <div key={c.category} className="flex items-center gap-2">
              <span className="w-32 text-[10px] font-bold text-slate-600 truncate">{c.category}</span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden"><div className="bg-primary/60 h-full" style={{ width: `${Math.max(4, (c.count / maxCat) * 100)}%` }} /></div>
              <span className="w-6 text-right text-[10px] font-bold text-slate-500">{c.count}</span>
            </div>
          ))}
        </div>
      )}
      {d.attention.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dikkat — Uzun Süredir Ödünçte</p>
          {d.attention.slice(0, 5).map(a => (
            <div key={a.id} className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-600 truncate mr-2">{a.boxNo} / {a.shelfNo} · {a.category}</span>
              <span className="shrink-0 font-black text-amber-600">{a.daysSinceUpdate}g</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{d.note}</p>
    </div>
  );
}
