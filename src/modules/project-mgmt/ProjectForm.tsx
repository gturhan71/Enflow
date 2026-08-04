import { useState, type FC, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, ProjectType, ProjectStatus, User } from '../../types';
import { PROJECT_TYPE_LABEL, STATUS_CONFIG } from './constants';

interface ProjectFormProps {
  initial?: Partial<Project>;
  users: User[];
  customers: { id: string; name: string }[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const ProjectForm: FC<ProjectFormProps> = ({ initial, users, customers, onSave, onClose }) => {
  const [form, setForm] = useState({
    opportunityId: (initial as Record<string, string> | undefined)?.opportunityId ?? '',
    name: initial?.name ?? '',
    type: (initial?.type ?? 'HARDWARE') as ProjectType,
    description: initial?.description ?? '',
    customerId: initial?.customerId ?? '',
    customerName: initial?.customerName ?? '',
    pmId: initial?.pmId ?? '',
    pmName: initial?.pmName ?? '',
    totalValue: initial?.totalValue?.toString() ?? '',
    contractCurrency: initial?.contractCurrency ?? 'TRY',
    budgetTotal: initial?.budgetTotal?.toString() ?? '',
    startDate: initial?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    plannedEndDate: initial?.plannedEndDate?.split('T')[0] ?? '',
    status: (initial?.status ?? 'PLANNING') as ProjectStatus,
    milestoneTemplate: initial?.type ?? 'HARDWARE',
  });
  const f = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">{initial?.id ? 'Proje Düzenle' : 'Yeni Proje'}</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Adı *</label>
              <input value={form.name} onChange={f('name')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" placeholder="Proje başlığı" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Tipi</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ProjectType, milestoneTemplate: e.target.value as ProjectType }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Durum</label>
              <select value={form.status} onChange={f('status')} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Müşteri</label>
              <select value={form.customerId} onChange={e => {
                const c = customers.find(c => c.id === e.target.value);
                setForm(p => ({ ...p, customerId: e.target.value, customerName: c?.name ?? '' }));
              }} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Seçin…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Yöneticisi</label>
              <select value={form.pmId} onChange={e => {
                const u = users.find(u => u.id === e.target.value);
                setForm(p => ({ ...p, pmId: e.target.value, pmName: u?.name ?? '' }));
              }} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Seçin…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sözleşme Bedeli</label>
              <div className="flex gap-1">
                <input type="number" value={form.totalValue} onChange={f('totalValue')} className="input-glass flex-1 px-3 py-2 text-sm rounded-l-xl" />
                <select value={form.contractCurrency} onChange={f('contractCurrency')} className="input-glass px-2 py-2 text-sm rounded-r-xl">
                  {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Toplam Bütçe (TRY)</label>
              <input type="number" value={form.budgetTotal} onChange={f('budgetTotal')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Başlangıç Tarihi</label>
              <input type="date" value={form.startDate} onChange={f('startDate')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Planlanan Bitiş</label>
              <input type="date" value={form.plannedEndDate} onChange={f('plannedEndDate')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={f('description')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
          {!initial?.id && (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300">
              <span className="font-semibold">Milestone şablonu:</span> {PROJECT_TYPE_LABEL[form.type as ProjectType]} tipine göre otomatik oluşturulacak.
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, totalValue: Number(form.totalValue), budgetTotal: Number(form.budgetTotal) })}
            disabled={!form.name.trim()} className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            {initial?.id ? 'Güncelle' : 'Proje Oluştur'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProjectForm;
