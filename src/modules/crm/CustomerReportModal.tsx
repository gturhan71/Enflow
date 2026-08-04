import { X, Building, Trophy, AlertTriangle, Activity, Calendar, BarChart2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Customer } from '../../types';
import { CustomerStats } from './helpers';
import { STATUS_LABEL, getStatusStyle } from './constants';

export default function CustomerReportModal({ customer, stats, onClose }: { customer: Customer; stats: CustomerStats; onClose: () => void }) {
  const winRate = (stats.wonOpps.length + stats.lostOpps.length) > 0
    ? Math.round((stats.wonOpps.length / (stats.wonOpps.length + stats.lostOpps.length)) * 100)
    : null;
  const fmtVal = (v: number) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M ${customer.currency}`
    : v >= 1_000
    ? `${(v / 1_000).toFixed(1)}K ${customer.currency}`
    : `${v.toLocaleString('tr-TR')} ${customer.currency}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl bg-white flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building size={24} className="text-primary" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none">{customer.name}</h4>
              {customer.shortName && <p className="text-xs text-primary font-bold mt-0.5">{customer.shortName}</p>}
              {customer.industry && <p className="text-xs text-slate-400 font-medium">{customer.industry}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-0 border-b border-slate-100 shrink-0">
          <div className="p-6 text-center border-r border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Trophy size={10} className="text-emerald-500" />Kazanılan</p>
            <p className="text-3xl font-black text-emerald-600 tracking-tighter">{stats.wonOpps.length}</p>
            {stats.wonValue > 0 && <p className="text-[11px] font-bold text-emerald-500 mt-0.5">{fmtVal(stats.wonValue)}</p>}
          </div>
          <div className="p-6 text-center border-r border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><AlertTriangle size={10} className="text-red-400" />Kaybedilen</p>
            <p className="text-3xl font-black text-red-500 tracking-tighter">{stats.lostOpps.length}</p>
            {stats.lostValue > 0 && <p className="text-[11px] font-bold text-red-400 mt-0.5">{fmtVal(stats.lostValue)}</p>}
          </div>
          <div className="p-6 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Activity size={10} className="text-blue-500" />Kazanma Oranı</p>
            {winRate !== null
              ? <p className="text-3xl font-black text-blue-600 tracking-tighter">%{winRate}</p>
              : <p className="text-3xl font-black text-slate-300 tracking-tighter">—</p>}
            {stats.activeOpps.length > 0 && <p className="text-[11px] font-bold text-slate-400 mt-0.5">{stats.activeOpps.length} aktif fırsat</p>}
          </div>
        </div>

        {/* Detail lists */}
        <div className="overflow-y-auto flex-1 custom-scrollbar p-8 space-y-8">
          {stats.wonOpps.length > 0 && (
            <div>
              <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Trophy size={13} /> Kazanılan Projeler / Fırsatlar
              </h5>
              <div className="space-y-3">
                {stats.wonOpps.map(opp => {
                  const val = stats.getBestValue(opp);
                  return (
                    <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold flex-wrap">
                          {opp.expectedCloseDate && (
                            <span className="flex items-center gap-1"><Calendar size={9} />{new Date(opp.expectedCloseDate).toLocaleDateString('tr-TR')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600">{fmtVal(val)}</p>
                        <p className="text-[9px] font-black text-emerald-500 uppercase">Kazanıldı</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.lostOpps.length > 0 && (
            <div>
              <h5 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle size={13} /> Kaybedilen Fırsatlar
              </h5>
              <div className="space-y-3">
                {stats.lostOpps.map(opp => {
                  const val = stats.getBestValue(opp);
                  return (
                    <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-red-50/60 border border-red-100">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold flex-wrap">
                          {opp.expectedCloseDate && (
                            <span className="flex items-center gap-1"><Calendar size={9} />{new Date(opp.expectedCloseDate).toLocaleDateString('tr-TR')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-red-500">{fmtVal(val)}</p>
                        <p className="text-[9px] font-black text-red-400 uppercase">Kaybedildi</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.activeOpps.length > 0 && (
            <div>
              <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={13} /> Aktif Fırsatlar
              </h5>
              <div className="space-y-3">
                {stats.activeOpps.map(opp => {
                  const val = stats.getBestValue(opp);
                  return (
                    <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border inline-block mt-1", getStatusStyle(opp.status))}>
                          {STATUS_LABEL[opp.status] ?? opp.status}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        {val > 0 && <p className="text-sm font-black text-slate-700">{fmtVal(val)}</p>}
                        <p className="text-[9px] font-bold text-slate-400 uppercase">%{opp.probability} olasılık</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.wonOpps.length === 0 && stats.lostOpps.length === 0 && stats.activeOpps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
              <BarChart2 size={40} className="opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest">Bu müşteriye ait fırsat kaydı bulunmuyor</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Kapat
          </button>
        </div>
      </motion.div>
    </div>
  );
}
