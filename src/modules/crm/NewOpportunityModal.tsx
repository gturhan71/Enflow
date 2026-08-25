import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Customer, Opportunity } from '../../types';
import { PROCUREMENT_METHODS } from '../../lib/procurementCosts';
import { apiService } from '../../services/apiService';
import MoneyInput from '../../components/MoneyInput';

const CURRENCIES = [
  { code: 'TRY', label: '₺ TRY' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
];

const VISIT_ENGAGEMENT_THRESHOLD = 3;

export default function NewOpportunityModal({
  values, handleChange, customers, onSubmit, onClose,
}: {
  values: Partial<Opportunity>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  customers: Customer[];
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const [visitSummary, setVisitSummary] = useState<{ count: number; windowMonths: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!values.customerId) { setVisitSummary(null); return; }
    apiService.getCustomerVisitSummary(values.customerId, 3)
      .then((data) => { if (!cancelled) setVisitSummary(data); })
      .catch(() => { if (!cancelled) setVisitSummary(null); });
    return () => { cancelled = true; };
  }, [values.customerId]);
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
          {visitSummary && visitSummary.count > 0 && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold -mt-2",
              visitSummary.count >= VISIT_ENGAGEMENT_THRESHOLD
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-slate-50 text-slate-500 border border-slate-200"
            )}>
              <MapPin size={13} className="shrink-0" />
              Bu müşteriye son {visitSummary.windowMonths} ayda {visitSummary.count} ziyaret yapılmış
              {visitSummary.count >= VISIT_ENGAGEMENT_THRESHOLD ? ' — yüksek etkileşim' : ''}
            </div>
          )}
          <div className="flex gap-3">
            <MoneyInput
              value={values.value ?? 0}
              onChange={(n) => handleChange({ target: { name: 'value', value: String(n), type: 'number' } } as unknown as ChangeEvent<HTMLInputElement>)}
              placeholder="Tahmini Bedel"
              className="flex-1 min-w-0 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none"
            />
            <select
              name="currency"
              value={values.currency ?? 'TRY'}
              onChange={handleChange}
              className="px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none w-28 shrink-0"
              title="Para birimi"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
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
