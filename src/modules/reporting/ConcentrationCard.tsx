import { Building2 } from 'lucide-react';
import type { ConcentrationReport } from '../../types';
import { pct } from './helpers';

export default function ConcentrationCard({ c }: { c: ConcentrationReport }) {
  const risk = c.hhi > 2500 ? { t: 'Yüksek yoğunlaşma', col: 'text-red-600' } : c.hhi > 1500 ? { t: 'Orta yoğunlaşma', col: 'text-amber-600' } : { t: 'Dağınık (sağlıklı)', col: 'text-emerald-600' };
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center gap-2"><Building2 size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Müşteri & Kamu Konsantrasyonu</h4></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">HHI</p><p className={`text-2xl font-black ${risk.col}`}>{c.hhi}</p><p className="text-[9px] text-slate-400">{risk.t}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">En Büyük Müşteri</p><p className="text-2xl font-black text-slate-800">{pct(c.top1Pct)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">İlk 3 Müşteri</p><p className="text-2xl font-black text-slate-800">{pct(c.top3Pct)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kamu Payı</p><p className="text-2xl font-black text-indigo-600">{pct(c.publicPct)}</p></div>
      </div>
      {c.topCustomers.length > 0 && (
        <div className="space-y-1">
          {c.topCustomers.slice(0, 5).map((cu, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-40 text-xs font-bold text-slate-700 truncate">{cu.name}{cu.isPublic && <span className="ml-1 text-[8px] bg-indigo-100 text-indigo-600 px-1 rounded uppercase">kamu</span>}</span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden"><div className="bg-primary/70 h-full" style={{ width: `${Math.max(2, cu.sharePct * 100)}%` }} /></div>
              <span className="w-14 text-right text-xs font-bold text-slate-500">{pct(cu.sharePct)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{c.note}</p>
    </div>
  );
}
