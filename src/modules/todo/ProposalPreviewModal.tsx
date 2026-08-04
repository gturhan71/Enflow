import { X, FileText, Package, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TodoTask } from '../../types';
import { ProposalDetail } from './helpers';

export default function ProposalPreviewModal({
  task,
  detail,
  onClose,
  onApprove,
  onReject,
}: {
  task: TodoTask | null;
  detail: ProposalDetail | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <AnimatePresence>
      {task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-widest">
                    Onay Bekliyor
                  </span>
                  {detail && (
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                      v{detail.version}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{task.title}</h3>
                {detail && (
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    Fırsat: {detail.opportunityTitle}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              {!detail ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <FileText size={40} className="mb-3 opacity-30" />
                  <p className="font-bold text-sm">Teklif detayı yüklenemedi.</p>
                </div>
              ) : (
                <>
                  {/* Kalemler */}
                  {detail.items.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Package size={16} className="text-slate-400" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Kalemleri</h4>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-5 py-3 text-left font-black text-slate-500 whitespace-nowrap">Parça No</th>
                              <th className="px-5 py-3 text-left font-black text-slate-500">Açıklama</th>
                              <th className="px-5 py-3 text-right font-black text-slate-500">Adet</th>
                              <th className="px-5 py-3 text-right font-black text-slate-500 whitespace-nowrap">Birim Maliyet</th>
                              <th className="px-5 py-3 text-right font-black text-slate-500 whitespace-nowrap">Birim Satış</th>
                              <th className="px-5 py-3 text-right font-black text-slate-500">Marj</th>
                              <th className="px-5 py-3 text-right font-black text-slate-500">Satış Toplamı</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detail.items.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-5 py-3 font-bold text-slate-600 whitespace-nowrap">{item.partNumber}</td>
                                <td className="px-5 py-3 text-slate-600">{item.description}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-600">{item.quantity}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-400 whitespace-nowrap">
                                  {item.purchaseCost != null ? item.purchaseCost.toLocaleString('tr-TR') : '—'}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                                  {item.unitSalePrice != null ? item.unitSalePrice.toLocaleString('tr-TR') : '—'}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-emerald-600">
                                  {item.marginPercentage != null ? `%${item.marginPercentage}` : '—'}
                                </td>
                                <td className="px-5 py-3 text-right font-black text-slate-800 whitespace-nowrap">
                                  {item.totalSalePrice != null
                                    ? item.totalSalePrice.toLocaleString('tr-TR')
                                    : item.unitSalePrice != null
                                      ? (item.unitSalePrice * item.quantity).toLocaleString('tr-TR')
                                      : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Maliyet Özeti */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam Maliyet</p>
                      <p className="text-xl font-black text-slate-700">{detail.totalCost.toLocaleString('tr-TR')}</p>
                    </div>
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Teklif Tutarı</p>
                      <p className="text-xl font-black text-emerald-700">{detail.price}</p>
                    </div>
                    <div className={cn(
                      "p-5 border rounded-2xl text-center",
                      detail.totalCost > 0 && detail.totalPrice > detail.totalCost
                        ? "bg-blue-50 border-blue-100"
                        : "bg-red-50 border-red-100"
                    )}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tahmini Marj</p>
                      <p className={cn(
                        "text-xl font-black",
                        detail.totalCost > 0 && detail.totalPrice > detail.totalCost ? "text-blue-700" : "text-red-600"
                      )}>
                        {detail.totalCost > 0
                          ? `%${(((detail.totalPrice - detail.totalCost) / detail.totalPrice) * 100).toFixed(1)}`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Açıklama */}
                  {detail.description && (
                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Açıklama</p>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {/* Şartlar */}
                  {detail.terms && (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Şartlar & Koşullar</p>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">{detail.terms}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer — Approve / Reject */}
            <div className="p-8 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                onClick={onClose}
                className="px-6 py-3 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest"
              >
                Kapat
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onReject}
                  className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                >
                  <X size={15} /> Reddet
                </button>
                <button
                  onClick={onApprove}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                >
                  <CheckCircle2 size={15} /> Onayla
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
