import type { FormEvent } from 'react';
import { X, Star, Edit2, Trash2, Mail, Phone, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer, Contact, ContactRole, CONTACT_ROLE_LABEL } from '../../types';

export interface ContactFormState { id?: string; name: string; role: ContactRole; title: string; email: string; phone: string; isPrimary: boolean }

export default function ContactsModal({
  customer, contactForm, setContactForm, contactSaving, onSave, onDelete, onClose, onResetForm,
}: {
  customer: Customer;
  contactForm: ContactFormState;
  setContactForm: (updater: (f: ContactFormState) => ContactFormState) => void;
  contactSaving: boolean;
  onSave: (e: FormEvent) => void;
  onDelete: (contact: Contact) => void;
  onClose: () => void;
  onResetForm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-lg font-black text-slate-900">Kişiler</h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto custom-scrollbar">
          {(customer.contacts || []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Henüz kişi eklenmedi.</p>
          )}
          {(customer.contacts || []).map(contact => (
            <div key={contact.id} className="flex items-start justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {contact.isPrimary && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
                  <span className="font-bold text-sm text-slate-900 truncate">{contact.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{CONTACT_ROLE_LABEL[contact.role]}</span>
                </div>
                {contact.title && <p className="text-xs text-slate-500 mt-0.5">{contact.title}</p>}
                {contact.email && <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Mail size={11} />{contact.email}</p>}
                {contact.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={11} />{contact.phone}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setContactForm(() => ({ id: contact.id, name: contact.name, role: contact.role, title: contact.title || '', email: contact.email || '', phone: contact.phone || '', isPrimary: contact.isPrimary }))}
                  className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-xl transition-all"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(contact)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={onSave} className="p-6 border-t border-slate-100 space-y-3 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contactForm.id ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}</p>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Ad Soyad *" required value={contactForm.name}
              onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary" />
            <select value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value as ContactRole }))}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
              {(Object.keys(CONTACT_ROLE_LABEL) as ContactRole[]).map(r => <option key={r} value={r}>{CONTACT_ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <input type="text" placeholder="Unvan (ör. Satınalma Müdürü)" value={contactForm.title}
            onChange={e => setContactForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary" />
          <div className="grid grid-cols-2 gap-3">
            <input type="email" placeholder="E-posta" value={contactForm.email}
              onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary" />
            <input type="text" placeholder="Telefon" value={contactForm.phone}
              onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))} />
            Birincil kişi
          </label>
          <div className="flex gap-3">
            {contactForm.id && (
              <button type="button" onClick={onResetForm} className="flex-1 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-all">Vazgeç</button>
            )}
            <button type="submit" disabled={contactSaving || !contactForm.name.trim()}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {contactSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {contactForm.id ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
