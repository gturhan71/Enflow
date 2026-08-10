import type { ChangeEvent, FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../types';

export default function NewCustomerModal({
  values, handleChange, onSubmit, onClose, loading,
}: {
  values: Partial<Customer>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel w-full max-w-3xl rounded-[40px] shadow-2xl bg-white flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Müşteri</h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Müşteri bilgilerini doldurun</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>
        <form id="customer-form" onSubmit={onSubmit} className="overflow-y-auto custom-scrollbar flex-1">
          <div className="p-8 space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Temel Bilgiler</p>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text" name="name" required
                  value={values.name ?? ''}
                  onChange={handleChange}
                  placeholder="Müşteri Adı *"
                  className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" name="shortName"
                  value={values.shortName ?? ''}
                  onChange={handleChange}
                  placeholder="Kısa Ad"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" name="industry"
                  value={values.industry ?? ''}
                  onChange={handleChange}
                  placeholder="Sektör"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <select
                  name="source"
                  value={values.source ?? ''}
                  onChange={handleChange}
                  className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Kaynak (opsiyonel)</option>
                  <option value="REFERANS">Referans</option>
                  <option value="WEB_SITESI">Web Sitesi</option>
                  <option value="IHALE_DUYURUSU">İhale Duyurusu</option>
                  <option value="SOGUK_ARAMA">Soğuk Arama</option>
                  <option value="FUAR_ETKINLIK">Fuar / Etkinlik</option>
                  <option value="SOSYAL_MEDYA">Sosyal Medya</option>
                  <option value="DIGER">Diğer</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">İletişim</p>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="email" name="email"
                  value={values.email ?? ''}
                  onChange={handleChange}
                  placeholder="E-posta"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="tel" name="phone"
                  value={values.phone ?? ''}
                  onChange={handleChange}
                  placeholder="Telefon"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="url" name="website"
                  value={values.website ?? ''}
                  onChange={handleChange}
                  placeholder="Web Sitesi"
                  className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adres</p>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text" name="address"
                  value={values.address ?? ''}
                  onChange={handleChange}
                  placeholder="Adres"
                  className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" name="city"
                  value={values.city ?? ''}
                  onChange={handleChange}
                  placeholder="Şehir"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" name="country"
                  value={values.country ?? ''}
                  onChange={handleChange}
                  placeholder="Ülke"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Finansal & Vergi</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text" name="taxOffice"
                  value={values.taxOffice ?? ''}
                  onChange={handleChange}
                  placeholder="Vergi Dairesi"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="text" name="taxNumber"
                  value={values.taxNumber ?? ''}
                  onChange={handleChange}
                  placeholder="Vergi No"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <select
                  name="currency"
                  value={values.currency ?? 'USD'}
                  onChange={handleChange}
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="TRY">TRY ₺</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                </select>
                <input
                  type="number" name="creditLimit" min={0}
                  value={values.creditLimit ?? 0}
                  onChange={handleChange}
                  placeholder="Kredi Limiti"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <input
                  type="number" name="riskScore" min={0} max={100}
                  value={values.riskScore ?? 0}
                  onChange={handleChange}
                  placeholder="Risk Skoru (0-100)"
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <select
                  name="status"
                  value={values.status ?? 'ACTIVE'}
                  onChange={handleChange}
                  className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ek Bilgiler</p>
              <div className="space-y-4">
                <input
                  type="text" name="techStack"
                  value={values.techStack ?? ''}
                  onChange={handleChange}
                  placeholder="Teknoloji Altyapısı (ör: React, SAP, Oracle)"
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <textarea
                  name="notes"
                  value={values.notes ?? ''}
                  onChange={handleChange}
                  placeholder="Notlar..."
                  rows={3}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>
        </form>
        <div className="p-8 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
          >
            İPTAL
          </button>
          <button
            form="customer-form"
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            KAYDET
          </button>
        </div>
      </motion.div>
    </div>
  );
}
