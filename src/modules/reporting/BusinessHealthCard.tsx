import { HeartPulse } from 'lucide-react';
import type { BusinessHealth } from '../../types';
import { healthColor, healthBar } from '../../components/HealthCards';

export default function BusinessHealthCard({ h }: { h: BusinessHealth }) {
  const statusBadge = h.status === 'GÜÇLÜ' ? 'bg-emerald-100 text-emerald-700' : h.status === 'ORTA' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return (
    <div className="glass-card p-6 space-y-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><HeartPulse size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">İş Sağlığı Skoru</h4></div>
        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${statusBadge}`}>{h.status}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-center shrink-0">
          <p className={`text-5xl font-black ${healthColor(h.overall)}`}>{h.overall}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">/ 100</p>
        </div>
        <div className="flex-1 space-y-2">
          {h.pillars.map(p => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="w-20 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right shrink-0">{p.label}</span>
              <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden relative">
                <div className={`${healthBar(p.score)} h-full`} style={{ width: `${p.score}%` }} />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-slate-600">{p.detail}</span>
              </div>
              <span className={`w-8 text-right text-sm font-black shrink-0 ${healthColor(p.score)}`}>{p.score}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span className="text-slate-400 font-bold">Zayıf halka: <span className="text-red-500">{h.weakest}</span></span>
      </div>
      <p className="text-[10px] text-slate-400 italic">{h.note}</p>
    </div>
  );
}
