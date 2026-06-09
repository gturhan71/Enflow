import React from 'react';
import { Building, X, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tenant } from '../../types';

interface TenantSettingsProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  tenants: Tenant[];
  newTenantName: string;
  setNewTenantName: (name: string) => void;
  handleCreateTenant: () => void;
}

export const TenantSettings = ({
  companyLogo,
  setCompanyLogo,
  activeTenantId,
  setActiveTenantId,
  tenants,
  newTenantName,
  setNewTenantName,
  handleCreateTenant
}: TenantSettingsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
      {/* Kurumsal Kimlik */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Kurumsal Kimlik</h4>
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
          {companyLogo ? (
            <div className="relative group">
              <img src={companyLogo} alt="Logo" className="h-24 w-auto mb-4 object-contain" />
              <button 
                onClick={() => setCompanyLogo(null)} 
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <Building size={48} className="text-slate-300 mb-4" />
          )}
          <h4 className="font-bold text-slate-900">Kurumsal Logo</h4>
          <p className="text-sm text-slate-500 mb-6 text-center italic">Tüm evraklarda ve PDF tekliflerde kullanılacaktır.</p>
          <input 
            type="file" 
            id="logo-upload" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setCompanyLogo(ev.target?.result as string);
                reader.readAsDataURL(file);
              }
            }} 
          />
          <label 
            htmlFor="logo-upload" 
            className="bg-primary text-white px-8 py-3 rounded-2xl text-xs font-black cursor-pointer hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
          >
            Logo Yükle
          </label>
        </div>
      </div>

      {/* Şirket / Tenant Yönetimi */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Şirket / Tenant Yönetimi</h4>
        </div>
        
        <div className="space-y-4">
          <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Şu An Yönetilen Şirket</p>
            <select 
              value={activeTenantId}
              onChange={(e) => setActiveTenantId(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all text-white"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-primary font-bold italic leading-relaxed">
              * Birim ve kullanıcı tanımları yukarıda seçili olan şirket üzerinden yapılacaktır. 
              Şirket değiştiğinde tüm veriler otomatik olarak senkronize edilir.
            </p>
          </div>

          <div className="p-6 border border-slate-100 rounded-[2rem] space-y-4 bg-slate-50/30">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yeni Şirket Tanımla</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Şirket Tam Adı..." 
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm"
              />
              <button 
                onClick={handleCreateTenant}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Ekle
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
             {tenants.map(t => (
               <div key={t.id} className={cn(
                 "flex items-center justify-between p-4 rounded-2xl border transition-all",
                 activeTenantId === t.id ? "bg-primary/5 border-primary/20" : "bg-white border-slate-100"
               )}>
                  <span className="text-xs font-bold text-slate-700">{t.name}</span>
                  {activeTenantId === t.id && <ShieldCheck size={16} className="text-primary" />}
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};
