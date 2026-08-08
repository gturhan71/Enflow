import { AlertTriangle } from 'lucide-react';
import type { BomVarianceReport } from '../../types';
import { pct } from './helpers';
import { fmtCurrency as fmtTRY } from '../../lib/format';
import InfoTooltip from '../../components/InfoTooltip';

export default function BomVarianceCard({ v }: { v: BomVarianceReport }) {
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">BoM Maliyet Varyansı</h4>
          <InfoTooltip text="Teklif anındaki (BoM) maliyet ile gerçekleşen satınalma maliyeti arasındaki fark; en büyük negatif sapma (marj erozyonu) en üstte — teklif hazırlığındaki tahmin hatalarını gösterir." />
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Margin Erozyonu</p>
          <p className={`text-2xl font-black ${v.marginErosionPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{pct(v.marginErosionPct)}</p>
        </div>
      </div>
      {v.lines.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Karşılaştırılacak teklif/gerçekleşen maliyet verisi yok.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-12 text-[9px] font-black uppercase tracking-widest text-slate-400 pb-1 border-b border-slate-100">
            <span className="col-span-5">Fırsat / BoM Kalemi</span><span className="col-span-2 text-right">Teklif</span><span className="col-span-2 text-right">Gerçekleşen</span><span className="col-span-3 text-right">Varyans</span>
          </div>
          {v.lines.slice(0, 5).map((l, i) => (
            <div key={i} className="grid grid-cols-12 text-xs py-1 items-center">
              <span className="col-span-5 font-bold text-slate-700 truncate flex items-center gap-1.5">
                {l.isLineLevel && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Satır bazlı (BoM→Satınalma devri)" />}
                {l.name}
              </span>
              <span className="col-span-2 text-right text-slate-500">{fmtTRY(l.quoted)}</span>
              <span className="col-span-2 text-right text-slate-500">{fmtTRY(l.actual)}</span>
              <span className={`col-span-3 text-right font-bold ${l.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtTRY(l.variance)} ({pct(l.variancePct)})</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{v.note}</p>
    </div>
  );
}
