import { useState, type FC } from 'react';
import { X, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, Unit, PurchaseUrgency } from '../../types';
import { SOURCE_LABEL, URGENCY_CONFIG, CURRENCIES } from './constants';

interface PRFormProps {
  projects: Project[];
  units: Unit[];
  currentUserId?: string;
  currentUserName?: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const PRForm: FC<PRFormProps> = ({ projects, units, currentUserId, currentUserName, onSave, onClose }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    sourceType: 'MANUAL' as string,
    projectId: '',
    unitId: '',
    unitName: '',
    urgency: 'NORMAL' as PurchaseUrgency,
    neededBy: '',
    budgetAmount: '',
    currency: 'TRY',
    notes: '',
  });
  const [items, setItems] = useState([{ name: '', quantity: '1', unit: 'adet', estimatedUnitPrice: '', currency: 'TRY' }]);

  const addItem = () => setItems(is => [...is, { name: '', quantity: '1', unit: 'adet', estimatedUnitPrice: '', currency: 'TRY' }]);
  const removeItem = (i: number) => setItems(is => is.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: string) => setItems(is => is.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleUnitChange = (id: string) => {
    const u = units.find(u => u.id === id);
    setForm(f => ({ ...f, unitId: id, unitName: u?.name ?? '' }));
  };

  const handleSubmit = () => {
    onSave({
      ...form,
      budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
      requestedBy: currentUserId,
      requestedByName: currentUserName,
      items: items.filter(i => i.name.trim()).map(i => ({
        ...i,
        quantity: Number(i.quantity),
        estimatedUnitPrice: i.estimatedUnitPrice ? Number(i.estimatedUnitPrice) : undefined,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">Yeni Satınalma Talebi</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Başlık *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Kısa, açıklayıcı başlık"
              className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Kaynak</label>
              <select value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Aciliyet</label>
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value as PurchaseUrgency }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Birim</label>
              <select value={form.unitId} onChange={e => handleUnitChange(e.target.value)}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Birim seçin…</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">İlgili Proje</label>
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Proje seçin…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Gereksinim Tarihi</label>
              <input type="date" value={form.neededBy} onChange={e => setForm(f => ({ ...f, neededBy: e.target.value }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Bütçe</label>
              <div className="flex gap-1">
                <input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))}
                  className="input-glass flex-1 px-3 py-2 text-sm rounded-l-xl" placeholder="0" />
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="input-glass px-2 py-2 text-sm rounded-r-xl">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Kalemler</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
                <Plus size={12} /> Ekle
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                    placeholder="Ürün/Hizmet adı" className="input-glass col-span-4 px-3 py-2 text-sm rounded-xl" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                    className="input-glass col-span-2 px-3 py-2 text-sm rounded-xl" placeholder="Miktar" />
                  <input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                    className="input-glass col-span-2 px-3 py-2 text-sm rounded-xl" placeholder="Birim" />
                  <input type="number" value={item.estimatedUnitPrice} onChange={e => updateItem(i, 'estimatedUnitPrice', e.target.value)}
                    className="input-glass col-span-3 px-3 py-2 text-sm rounded-xl" placeholder="Birim fiyat" />
                  <button onClick={() => removeItem(i)} className="col-span-1 p-2 text-slate-400 hover:text-red-400 flex justify-center">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={handleSubmit} disabled={!form.title.trim()}
            className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            Talebi Oluştur
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PRForm;
