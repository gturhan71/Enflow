import type { ChangeEvent, FormEvent } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer, Opportunity } from '../../types';
import { PROCUREMENT_METHODS } from '../../lib/procurementCosts';

export default function NewOpportunityModal({
  values, handleChange, customers, onSubmit, onClose,
}: {
  values: Partial<Opportunity>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  customers: Customer[];
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Satış Fırsatı</h4>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <input type="text" name="title" required value={values.title} onChange={handleChange} placeholder="Fırsat Başlığı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
          <select name="customerId" required value={values.customerId} onChange={handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
            <option value="">Müşteri Seçin...</option>
            {(() => {
              const topLevel = customers.filter(c => !c.parentId);
              const childrenByParent = new Map<string, Customer[]>();
              for (const c of customers) {
                if (!c.parentId) continue;
                const arr = childrenByParent.get(c.parentId) ?? [];
                arr.push(c);
                childrenByParent.set(c.parentId, arr);
              }
              return topLevel.map(parent => {
                const kids = childrenByParent.get(parent.id) ?? [];
                if (kids.length === 0) return <option key={parent.id} value={parent.id}>{parent.name}</option>;
                return (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name} (Genel Merkez)</option>
                    {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </optgroup>
                );
              });
            })()}
          </select>
          <input type="number" name="value" min={0} value={values.value ?? 0} onChange={handleChange} placeholder="Tahmini Bedel" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Muhtemel Kapanış Tarihi (bilgi amaçlı)</label>
            <input type="date" name="expectedCloseDate" value={values.expectedCloseDate ?? ''} onChange={handleChange}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teklife Dönüşüm — Satış Destek Tetikleyici</p>
            <div className="grid grid-cols-2 gap-4">
              <select name="procurementMethod" value={values.procurementMethod ?? 'OPEN'} onChange={handleChange} className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {PROCUREMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <input type="date" name="targetBidDate" value={values.targetBidDate ?? ''} onChange={handleChange} title="Son teklif tarihi" className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Fırsat kaydedilince seçilen usulle Satış Destek birimine ihale/dosya takibi uyarısı iletilir.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">İPTAL</button>
            <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg">KAYDET</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
