import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Settings,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Check,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_NOTIFICATIONS } from '../constants';
import { Notification } from '../types';
import { apiService } from '../services/apiService';

const Header = ({ 
  title, 
  activeTab, 
  setActiveTab,
  onLogout,
  onMenuToggle,
  isSidebarOpen
}: { 
  title?: string, 
  activeTab?: string, 
  setActiveTab?: (id: string) => void,
  onLogout?: () => void,
  onMenuToggle?: () => void,
  isSidebarOpen?: boolean
}) => {
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  // Gerçek (backend) bildirimlerini kullanıcı bazında çek; varsa mock'un yerini alır
  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    const load = async () => {
      try {
        const real = await apiService.getNotifications(currentUser.id);
        if (active && Array.isArray(real) && real.length > 0) {
          setNotifications(real as Notification[]);
        }
      } catch {
        // sessizce mock'ta kal
      }
    };
    load();
    const t = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(t); };
  }, [currentUser?.id]);

  // Filter out notifications that are scheduled for the future
  const visibleNotifications = notifications.filter(n => {
    if (!n.scheduledAt) return true;
    return new Date(n.scheduledAt) <= new Date();
  });

  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;

  const logNotificationAccess = async () => {
    try {
      await fetch('http://localhost:3002/api/logs/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'anonymous',
          timestamp: new Date().toISOString(),
          action: 'opened notifications list'
        })
      });
    } catch (err) {
      console.error('Logging access failed:', err);
    }
  };

  useEffect(() => {
    if (showNotifications) {
      logNotificationAccess();
    }
  }, [showNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
    if (!notification.isRead) {
      apiService.updateNotification(notification.id, { isRead: true }).catch(() => {});
    }

    // Navigate if possible
    if (notification.relatedModule && setActiveTab) {
      setActiveTab(notification.relatedModule);
    }
    
    setShowNotifications(false);
  };

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
      case 'crm-cost':
      case 'presales-cost':
      case 'cost-analysis': return 'Maliyetlendirme & Marj';
      case 'documents': return 'Kurumsal Belge Yönetimi';
      case 'contract': return 'Sözleşme Yönetim Modülü';
      case 'archive': return 'Fiziksel Arşiv Sistemi';
      case 'procurement': return 'Satın Alma & Tedarik';
      case 'project-mgmt': return 'Proje Yönetim Paneli';
      case 'todo': return 'İşlerim & Görev Havuzu';
      case 'subscription': return 'Lisans & Abonelik Yönetimi';
      case 'license-gen': return 'Master Lisans Üretici';
      default: return 'Enflow ERP';
    }
  };

  return (
    <header className="min-h-20 pt-[env(safe-area-inset-top)] glass-header px-4 md:px-8 flex items-center justify-between sticky top-0 z-[100] font-geist">
      <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
        <button 
          onClick={onMenuToggle}
          className="p-2.5 bg-white/5 dark:bg-slate-800/30 border border-white/10 rounded-xl text-slate-400 hover:text-primary transition-all lg:hidden"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tighter italic leading-none truncate">{getTitle()}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">Canlı Sistem Verisi</p>
          </div>
        </div>

        <div className="hidden lg:flex relative group max-w-md w-full ml-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors duration-300" size={18} />
          <input 
            type="text" 
            placeholder="Sistem genelinde ara..." 
            className="glass-input w-full pl-14 pr-6 py-3 rounded-[20px] text-xs font-bold"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "p-3 rounded-[20px] transition-all backdrop-blur-md active:scale-90 relative",
              showNotifications
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "bg-white/30 dark:bg-slate-800/30 border border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-white/60"
            )}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-primary border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-4 w-80 glass-panel rounded-[28px] overflow-hidden shadow-2xl z-50 border-white/40 dark:border-white/10"
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bildirimler</h5>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-primary text-white text-[9px] font-black rounded-full uppercase tracking-widest">
                      {unreadCount} Yeni
                    </span>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {visibleNotifications.length > 0 ? (
                    visibleNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full p-6 text-left border-b border-white/5 last:border-0 transition-all hover:bg-white/10 flex gap-4",
                          !notification.isRead && "bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          notification.type === 'URGENT' ? "bg-red-500/10 text-red-500" :
                          notification.type === 'SUCCESS' ? "bg-emerald-500/10 text-emerald-500" :
                          notification.type === 'WARNING' ? "bg-amber-500/10 text-amber-500" :
                          "bg-primary/10 text-primary"
                        )}>
                          <Bell size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-foreground uppercase tracking-tight mb-1">{notification.title}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">{notification.message}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
                            {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Henüz bildirim yok.</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
                  className="w-full p-4 text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-white/5 hover:bg-white/10 transition-all border-t border-white/10"
                >
                  Tümünü Okundu İşaretle
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <button className="hidden sm:flex p-3 bg-white/30 dark:bg-slate-800/30 border border-white/40 dark:border-white/10 rounded-[20px] text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-white/60 transition-all backdrop-blur-md active:scale-90">
          <HelpCircle size={18} />
        </button>

        <div className="hidden sm:block h-10 w-px bg-white/20 mx-2" />

        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-3 rounded-[20px] transition-all backdrop-blur-md active:scale-90 relative",
              showSettings 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "bg-white/30 dark:bg-slate-800/30 border border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-white/60"
            )}
          >
            <Settings size={18} className={cn(showSettings && "animate-spin-slow")} />
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-4 w-64 glass-panel rounded-[28px] p-6 shadow-2xl z-50 border-white/40 dark:border-white/10"
              >
                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Görünüm Ayarları</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => theme === 'dark' && toggleTheme()}
                        className={cn(
                          "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                          theme === 'light' 
                            ? "bg-primary/10 border-primary text-primary" 
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                        )}
                      >
                        <Sun size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Aydınlık</span>
                      </button>
                      <button 
                        onClick={() => theme === 'light' && toggleTheme()}
                        className={cn(
                          "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                          theme === 'dark' 
                            ? "bg-primary/10 border-primary text-primary" 
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                        )}
                      >
                        <Moon size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Koyu</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all group">
                      <div className="flex items-center gap-3">
                        <Monitor size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Sistem Teması</span>
                      </div>
                      <div className="w-4 h-4 rounded-full border border-white/20 group-hover:border-primary transition-colors" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:block h-10 w-px bg-white/20 mx-2" />

        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 hover:text-white hover:bg-red-600 hover:border-red-600 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all backdrop-blur-md active:scale-90 flex items-center justify-center gap-2 group font-black text-[10px] uppercase tracking-wider pl-4 pr-4"
          >
            <LogOut size={16} className="group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Çıkış Yap</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
