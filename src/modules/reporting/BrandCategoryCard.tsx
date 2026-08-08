import { Tags } from 'lucide-react';
import type { BrandCategoryAnalytics } from '../../types';
import { fmtCurrency as fmtTRY } from '../../lib/format';
import InfoTooltip from '../../components/InfoTooltip';

export default function BrandCategoryCard({ d }: { d: BrandCategoryAnalytics }) {
  const empty = d.byBrand.length === 0 && d.byCategory.length === 0 && d.byVendor.length === 0;
  return (
    <div className="glass-card p-6 space-y-4 lg:col-span-2">
      <div className="flex items-center gap-2">
        <Tags size={16} className="text-primary" />
        <h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Marka & Ürün Grubu Hacmi</h4>
        <InfoTooltip text="Presales BoM kaleminde etiketlenen marka/ürün grubuna göre çalışılan (tüm etiketli kalemler) ve kazanılan (yalnız WON fırsatlar) iş hacmi; tedarikçi hacmi seçilmiş satınalma teklifinden gelir." />
      </div>
      {empty ? (
        <p className="text-xs text-slate-400 italic">Henüz marka/ürün grubu etiketli BoM kalemi yok — Presales'te BoM satırına marka/kategori girildikçe burada görünecek.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Markaya Göre (ilk 5)</p>
            {d.byBrand.length === 0 && <p className="text-xs text-slate-300 italic">Veri yok</p>}
            {d.byBrand.slice(0, 5).map(g => (
              <div key={g.key} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <span className="font-bold text-slate-700 truncate max-w-[50%]">{g.label}</span>
                <span className="text-right text-slate-500">
                  <span className="text-slate-800 font-semibold">{fmtTRY(g.workedValue)}</span>
                  {g.wonValue > 0 && <span className="text-emerald-600"> · {fmtTRY(g.wonValue)} kazanıldı</span>}
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Ürün Grubuna Göre (ilk 5)</p>
            {d.byCategory.length === 0 && <p className="text-xs text-slate-300 italic">Veri yok</p>}
            {d.byCategory.slice(0, 5).map(g => (
              <div key={g.key} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <span className="font-bold text-slate-700 truncate max-w-[50%]">{g.label}</span>
                <span className="text-right text-slate-500">
                  <span className="text-slate-800 font-semibold">{fmtTRY(g.workedValue)}</span>
                  {g.wonValue > 0 && <span className="text-emerald-600"> · {fmtTRY(g.wonValue)} kazanıldı</span>}
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tedarikçiye Göre (ilk 5)</p>
            {d.byVendor.length === 0 && <p className="text-xs text-slate-300 italic">Veri yok</p>}
            {d.byVendor.slice(0, 5).map(g => (
              <div key={g.key} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <span className="font-bold text-slate-700 truncate max-w-[50%]">{g.key}</span>
                <span className="text-slate-500">{fmtTRY(g.totalValue)} · {g.orderCount} işlem</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
