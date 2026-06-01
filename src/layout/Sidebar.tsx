import React, { useState } from 'react';
import { 
  Zap,
  ChevronRight,
  LogOut,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { 
  NAV_ITEMS
} from '../constants';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, onLogout, companyLogo }: { activeTab: string, setActiveTab: (id: string) => void, onLogout: () => void, companyLogo?: string | null }) => {
  const { handleNavigate } = useUnsavedChanges();
  const { currentUser, hasPermission } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const visibleNavItems = NAV_ITEMS.filter(item => {
    const hasBasePermission = hasPermission(item.requiredPermission);
    if (item.subItems) {
      const visibleSubItems = item.subItems.filter(sub => hasPermission(sub.requiredPermission));
      return hasBasePermission || visibleSubItems.length > 0;
    }
    return hasBasePermission;
  });

  return (
    <div className="w-72 bg-white/20 backdrop-blur-3xl border-r border-white/20 h-screen flex flex-col sticky top-0 z-20 overflow-hidden">
      <div className="pt-12 p-8 flex items-center gap-4 border-b border-white/10 group cursor-pointer">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-all duration-500 overflow-hidden">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Zap size={24} fill="currentColor" />
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="font-black text-slate-900 leading-none uppercase tracking-tighter text-2xl italic">ENFLOW</h1>
          <p className="text-[10px] text-primary uppercase tracking-[0.2em] font-black mt-1 opacity-70">COCKPIT v1.2</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
        {visibleNavItems.map((item) => {
          const isExpanded = expandedMenus.includes(item.id);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isActive = activeTab === item.id || (hasSubItems && item.subItems?.some(sub => sub.id === activeTab));

          const visibleSubItems = item.subItems?.filter(sub => 
            hasPermission(sub.requiredPermission)
          );

          return (
            <div key={item.id} className="mb-1">
              <button
                onClick={() => {
                  if (hasSubItems) {
                    toggleMenu(item.id);
                  } else {
                    handleNavigate(() => setActiveTab(item.id));
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-6 py-4 rounded-[24px] transition-all duration-300 group relative",
                  isActive && !hasSubItems
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-900"
                )}
              >
                <item.icon size={20} strokeWidth={2.5} className={cn(
                  "transition-all duration-300",
                  isActive && !hasSubItems ? "text-white scale-110" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-110"
                )} />
                <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest">{item.label}</span>
                {hasSubItems && (
                  <ChevronRight size={16} strokeWidth={3} className={cn(
                    "transition-transform duration-300 opacity-40",
                    isExpanded ? "rotate-90" : ""
                  )} />
                )}
                {isActive && !hasSubItems && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full"
                  />
                )}
              </button>
              
              {hasSubItems && (
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-14 pr-4 py-2 space-y-1">
                        {visibleSubItems?.map((subItem) => (
                          <button
                            key={subItem.id}
                            onClick={() => handleNavigate(() => setActiveTab(subItem.id))}
                            className={cn(
                              "w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all",
                              activeTab === subItem.id
                                ? "bg-primary/10 text-primary"
                                : "text-slate-400 hover:text-slate-900 hover:bg-white/40"
                            )}
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-6">
        <div className="glass-card rounded-[28px] p-5 flex items-center gap-4 border-white/40 bg-white/30 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-inner shadow-black/10">
            {currentUser?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 truncate tracking-tighter uppercase leading-tight">{currentUser?.name || 'Kullanıcı'}</p>
            <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest font-black mt-0.5">{currentUser?.role?.replace('_', ' ') || 'GÖREV TANIMSIZ'}</p>
          </div>
          <button 
            onClick={() => handleNavigate(onLogout)} 
            className="p-2.5 hover:bg-white/50 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
