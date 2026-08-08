import { useState, useEffect, type FC, type ChangeEvent } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Vendor, Brand } from '../../types';
import { apiService } from '../../services/apiService';

interface VendorFormProps {
  initial?: Partial<Vendor>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const VendorForm: FC<VendorFormProps> = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    taxNo: initial?.taxNo ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    contactName: initial?.contactName ?? '',
    iban: initial?.iban ?? '',
    bankName: initial?.bankName ?? '',
    notes: initial?.notes ?? '',
    categories: (initial?.categories ? (typeof initial.categories === 'string' ? JSON.parse(initial.categories) : initial.categories) : []) as string[],
  });
  const [catInput, setCatInput] = useState('');
  const [brandIds, setBrandIds] = useState<string[]>(initial?.brands?.map(b => b.id) ?? []);
  const [brands, setBrands] = useState<Brand[]>([]);
  useEffect(() => { apiService.getBrands().then(setBrands).catch(() => {}); }, []);
  const toggleBrand = (id: string) => setBrandIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addCat = () => {
    const t = catInput.trim();
    if (t && !form.categories.includes(t)) {
      setForm(f => ({ ...f, categories: [...f.categories, t] }));
    }
    setCatInput('');
  };

  const f = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">{initial?.id ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {[['name','Firma Adı *'],['taxNo','Vergi No'],['contactName','İlgili Kişi'],['phone','Telefon'],['email','E-posta'],['bankName','Banka Adı'],['iban','IBAN'],['taxNo','Vergi No']].filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i).map(([key, lbl]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{lbl}</label>
                <input value={(form as unknown as Record<string,string>)[key] ?? ''} onChange={f(key)}
                  className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Adres</label>
            <textarea value={form.address} onChange={f('address')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Kategoriler</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.categories.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                  {c}
                  <button onClick={() => setForm(f => ({ ...f, categories: f.categories.filter(x => x !== c) }))} className="hover:text-indigo-900"><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={catInput} onChange={e => setCatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
                placeholder="Kategori ekle (Enter)"
                className="input-glass flex-1 px-3 py-2 text-sm rounded-xl" />
              <button onClick={addCat} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Markalar (taşıdığı/yetkili satıcısı olduğu)</label>
            {brands.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Henüz marka tanımlanmadı — Ayarlar → Marka &amp; Ürün Grubu'ndan ekleyin.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {brands.map(b => {
                  const selected = brandIds.includes(b.id);
                  return (
                    <button key={b.id} type="button" onClick={() => toggleBrand(b.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${selected ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}>
                      {selected && <Check size={11} />} {b.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notlar</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, categories: form.categories, brandIds })}
            disabled={!form.name.trim()}
            className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            Kaydet
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VendorForm;
