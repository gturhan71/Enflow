import React from 'react';
import { 
  Bell, 
  Search, 
  Settings,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const Header = ({ 
  title, 
  activeTab, 
  onLogout 
}: { 
  title?: string, 
  activeTab?: string, 
  onLogout?: () => void 
}) => {
  const { currentUser } = useAuth();

  const getTitle = () => {
    if (title) return title;
    switch (activeTab) {
      case 'dashboard': return 'Dashboard & Yönetici Kokpiti';
      case 'crm':
      case 'crm-opportunities': return 'CRM & Satış Fırsatları';
      case 'crm-customers': return 'Müşteri Portföyü';
      case 'crm-proposals': return 'Teklif Yönetimi';
      case 'presales': return 'AI Presales & Teknik Analiz';
      case 'sales-support': return 'Satış Destek Operasyonları';
      case 'cost-analysis': return 'Maliyetlendirme & Marj';
      case 'documents': return 'Kurumsal Belge Yönetimi';
      case 'contract': return 'Sözleşme Yönetim Modülü';
      case 'archive': return 'Fiziksel Arşiv Sistemi';
      case 'procurement': return 'Satın Alma & Tedarik';
      case 'project-mgmt': return 'Proje Yönetim Paneli';
      case 'todo': return 'İşlerim & Görev Havuzu';
      default: return 'Enflow ERP';
    }
  };

  return (
    <header className="h-20 bg-white/40 backdrop-blur-xl border-b border-white/20 px-8 flex items-center justify-between sticky top-0 z-10 overflow-hidden font-geist">
      <div className="flex items-center gap-6 flex-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{getTitle()}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canlı Sistem Verisi</p>
          </div>
        </div>

        <div className="hidden md:flex relative group max-w-md w-full ml-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-300" size={18} />
          <input 
            type="text" 
            placeholder="Sistem genelinde ara..." 
            className="w-full pl-14 pr-6 py-3 bg-white/30 border border-white/40 rounded-[20px] text-xs font-bold outline-none focus:bg-white/60 focus:ring-4 focus:ring-primary/5 transition-all backdrop-blur-md placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-3 bg-white/30 border border-white/40 rounded-[20px] text-slate-500 hover:text-primary hover:bg-white/60 transition-all backdrop-blur-md relative group active:scale-90">
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary border-2 border-white rounded-full group-hover:scale-125 transition-transform" />
        </button>
        
        <button className="p-3 bg-white/30 border border-white/40 rounded-[20px] text-slate-500 hover:text-primary hover:bg-white/60 transition-all backdrop-blur-md active:scale-90">
          <HelpCircle size={18} />
        </button>

        <div className="h-10 w-px bg-white/20 mx-2" />

        <button className="p-3 bg-white/30 border border-white/40 rounded-[20px] text-slate-500 hover:text-primary hover:bg-white/60 transition-all backdrop-blur-md active:scale-90">
          <Settings size={18} />
        </button>

        <div className="h-10 w-px bg-white/20 mx-2" />

        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 hover:text-white hover:bg-red-600 hover:border-red-600 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all backdrop-blur-md active:scale-90 flex items-center justify-center gap-2 group font-black text-[10px] uppercase tracking-wider pl-4 pr-4"
          >
            <LogOut size={16} className="group-hover:scale-110 transition-transform" />
            <span>Çıkış Yap</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
