import type { FC } from 'react';
import { Building2, Edit2, Trash2, Phone, Mail, Star } from 'lucide-react';
import { Vendor } from '../../types';

interface VendorsTabProps {
  vendors: Vendor[];
  loading: boolean;
  onEdit: (v: Vendor) => void;
  onDelete: (id: string) => void;
}

const VendorsTab: FC<VendorsTabProps> = ({ vendors, loading, onEdit, onDelete }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {vendors.length === 0 && !loading && (
      <div className="col-span-2 text-center py-12 text-slate-400">
        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Henüz tedarikçi eklenmedi.</p>
      </div>
    )}
    {vendors.map(v => {
      const cats: string[] = v.categories ? (typeof v.categories === 'string' ? JSON.parse(v.categories) : v.categories) : [];
      return (
        <div key={v.id} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold">{v.name}</h4>
              {v.contactName && <p className="text-xs text-slate-400 mt-0.5">{v.contactName}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => onEdit(v)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(v.id)}
                className="p-1.5 hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1 text-xs text-slate-400">
            {v.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{v.phone}</div>}
            {v.email && <div className="flex items-center gap-1.5"><Mail size={11} />{v.email}</div>}
          </div>
          {cats.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {cats.map(c => (
                <span key={c} className="text-[11px] px-2 py-0.5 bg-indigo-900/30 text-indigo-300 rounded-full font-medium">{c}</span>
              ))}
            </div>
          )}
          {v.rating && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={12} className={i < v.rating! ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default VendorsTab;
