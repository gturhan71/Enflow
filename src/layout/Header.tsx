import React from 'react';
import { 
  Bell, 
  Search, 
  Settings,
  HelpCircle,
  Menu,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const Header = ({ title }: { title: string }) => {
  const { currentUser } = useAuth();

  return (
    <header className="h-20 bg-white/40 backdrop-blur-xl border-b border-white/20 px-8 flex items-center justify-between sticky top-0 z-10 overflow-hidden">
      <div className="flex items-center gap-6 flex-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{title}</h2>
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

        <button className="p-3 bg-slate-900 text-white rounded-[20px] hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-90">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
