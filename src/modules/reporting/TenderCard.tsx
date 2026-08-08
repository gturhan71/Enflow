import { BarChart3 } from 'lucide-react';
import type { TenderAnalytics } from '../../types';
import { pct } from './helpers';
import { fmtCurrency as fmtTRY } from '../../lib/format';
import InfoTooltip from '../../components/InfoTooltip';

export default function TenderCard({ t }: { t: TenderAnalytics }) {
  const o = t.overall;
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2"><BarChart3 size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">İhale Kazanma Kırılımı</h4>
        <InfoTooltip text="İhale kazanma oranının yöntem ve idareye göre kırılımı; her grup toplam ihale sayısına göre azalan sıralanır — hangi idare/yöntemde daha güçlü olduğunuzu gösterir." />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kazanma%</p><p className="text-2xl font-black text-emerald-600">{pct(o.winRate)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kazanılan Değer</p><p className="text-lg font-black text-slate-800">{fmtTRY(o.wonValue)}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aktif Pipeline</p><p className="text-lg font-black text-indigo-600">{fmtTRY(o.activePipeline)}</p></div>
      </div>
      <div className="border-t border-slate-100 pt-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Yönteme Göre</p>
        {t.byMethod.slice(0, 5).map(g => (
          <div key={g.key} className="flex items-center justify-between text-xs py-0.5">
            <span className="font-bold text-slate-700">{g.key}</span>
            <span className="text-slate-400">{g.total} ihale · <span className={g.winRate >= 0.5 ? 'text-emerald-600' : 'text-slate-500'}>kazanma {pct(g.winRate)}</span></span>
          </div>
        ))}
      </div>
      {t.byAuthority.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">İdareye Göre (ilk 5)</p>
          {t.byAuthority.slice(0, 5).map(g => (
            <div key={g.key} className="flex items-center justify-between text-xs py-0.5">
              <span className="font-bold text-slate-700 truncate max-w-[60%]">{g.key}</span>
              <span className="text-slate-400">{g.won}K/{g.lost}Kyb · {pct(g.winRate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
