import { useState, type FC, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { ProjectMilestone, CostCategory } from '../../types';
import { COST_CAT_LABEL } from './constants';

interface CostFormProps {
  projectId: string;
  milestones: ProjectMilestone[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}
const CostForm: FC<CostFormProps> = ({ milestones, onSave, onClose }) => {
  const [form, setForm] = useState({
    category: 'OTHER' as CostCategory, description: '',
    plannedAmount: '', actualAmount: '', currency: 'TRY', amountTRY: '',
    milestoneId: '', date: new Date().toISOString().split('T')[0],
    invoiceNo: '', notes: '',
  });
  const f = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="font-bold">Maliyet Kalemi Ekle</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Kategori</label>
              <select value={form.category} onChange={f('category')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                {Object.entries(COST_CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Milestone</label>
              <select value={form.milestoneId} onChange={f('milestoneId')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                <option value="">Genel</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 font-semibold">Açıklama *</label>
              <input value={form.description} onChange={f('description')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Planlanan (TRY)</label>
              <input type="number" value={form.plannedAmount} onChange={f('plannedAmount')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Gerçekleşen (TRY)</label>
              <input type="number" value={form.actualAmount} onChange={f('actualAmount')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Tarih</label>
              <input type="date" value={form.date} onChange={f('date')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Fatura No</label>
              <input value={form.invoiceNo} onChange={f('invoiceNo')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 font-semibold">Not</label>
              <textarea value={form.notes} onChange={f('notes')} rows={2} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1 resize-none" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, plannedAmount: Number(form.plannedAmount), actualAmount: Number(form.actualAmount), amountTRY: Number(form.actualAmount) })}
            disabled={!form.description} className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-50">
            Ekle
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CostForm;
