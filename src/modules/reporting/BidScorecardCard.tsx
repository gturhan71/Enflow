import { ClipboardCheck } from 'lucide-react';
import type { BidScorecard } from '../../types';
import { REC_STYLE } from './helpers';

export default function BidScorecardCard({ s }: { s: BidScorecard }) {
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Bid / No-Bid Skorkartı</h4></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Karar-Öncesi</p><p className="text-2xl font-black text-slate-800">{s.summary.total}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Katıl</p><p className="text-2xl font-black text-emerald-600">{s.summary.bid}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">İncele</p><p className="text-2xl font-black text-amber-600">{s.summary.review}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ort. Skor</p><p className="text-2xl font-black text-primary">{s.summary.avgScore}</p></div>
      </div>
      {s.tenders.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">Karar aşamasında (taslak/hazırlık) ihale yok.</p>
      ) : (
        <div className="space-y-2">
          {s.tenders.map(t => {
            const rec = REC_STYLE[t.recommendation];
            return (
              <div key={t.id} className="flex items-center gap-3 border-b border-slate-100 pb-2 last:border-0">
                <div className="w-8 shrink-0 text-center"><span className="text-lg font-black text-slate-800">{t.score}</span></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {t.authority}{t.authorityWinPct !== null && ` · geçmiş %${Math.round(t.authorityWinPct * 100)}`}
                    {t.daysLeft !== null && ` · ${t.daysLeft}g kaldı`}
                    {` · hazırlık %${Math.round(t.readinessPct * 100)}`}
                    {t.triageTier && ` · İGB ${t.triageTier}`}
                  </p>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    <div className="bg-indigo-400 rounded-sm" style={{ width: `${t.factors.authorityWinRate}%` }} title="İdare geçmişi" />
                    <div className="bg-sky-400 rounded-sm" style={{ width: `${t.factors.deadline}%` }} title="Süre" />
                    <div className="bg-emerald-400 rounded-sm" style={{ width: `${t.factors.readiness}%` }} title="Hazırlık" />
                    <div className="bg-amber-400 rounded-sm" style={{ width: `${t.factors.valueFit}%` }} title="Değer uyumu" />
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded ${rec.badge}`}>{rec.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{s.note}</p>
    </div>
  );
}
