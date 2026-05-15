import React, { useState } from 'react';
import { 
  Bell,
  Search,
  CheckCircle2,
  LogOut,
  Clock,
  Save
} from 'lucide-react';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

const Header = ({ activeTab, companyLogo }: { activeTab: string, companyLogo: string | null }) => {
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setHasUnsavedChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getTitle = () => {
    const titles: Record<string, string> = {
      'dashboard': 'KONTROL PANELİ',
      'crm': 'MÜŞTERİ İLİŞKİLERİ',
      'crm-opportunities': 'SATIŞ FIRSATLARI',
      'crm-customers': 'MÜŞTERİ PORTFÖYÜ',
      'todo': 'GÖREV TAKİBİ',
      'project-mgmt': 'PROJE YÖNETİMİ',
      'procurement': 'SATIN ALMA',
      'contract': 'SÖZLEŞME MERKEZİ',
      'archive': 'DİJİTAL ARŞİV',
      'settings-general': 'GENEL AYARLAR',
      'settings-users': 'KULLANICI YÖNETİMİ'
    };
    return titles[activeTab] || 'ENFLOW';
  };

  return (
    <header className="h-20 px-8 flex items-center justify-between sticky top-0 z-10 glass-header border-b border-white/40">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{getTitle()}</h2>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-1.5 h-1.5 rounded-full bg-primary" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Canlı Sistem</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Sistemde ara..." 
            className="pl-11 pr-4 py-2.5 bg-slate-100/50 border border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-primary/20 outline-none w-64 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges && !saved}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : hasUnsavedChanges
                ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
                : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50'
            }`}
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'KAYDEDİLDİ' : 'DEĞİŞİKLİKLERİ KAYDET'}
          </button>

          <button className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-primary hover:border-primary/20 transition-all relative">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
