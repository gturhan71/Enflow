import React, { useState, useEffect } from 'react';
import {
  Zap,
  ChevronRight,
  LogOut,
  KeyRound,
  X,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { NAV_ITEMS, APP_VERSION } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface EntitlementRow { plugin: { key: string }; active: boolean }

const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  onLogout, 
  companyLogo,
  isOpen,
  onClose
}: { 
  activeTab: string, 
  setActiveTab: (id: string) => void, 
  onLogout: () => void, 
  companyLogo?: string | null,
  isOpen?: boolean,
  onClose?: () => void
}) => {
  const { handleNavigate } = useUnsavedChanges();
  const { currentUser, hasPermission } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  // Kendi şifresini değiştirme — herhangi bir rol kapısı yok, her kullanıcı
  // kendi hesabı için erişebilmeli (bkz. backend PUT /users/me/password).
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPassword.length < 6) { setPwError('Yeni şifre en az 6 karakter olmalıdır.'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('Yeni şifreler eşleşmiyor.'); return; }
    setPwSaving(true);
    try {
      await apiService.changeMyPassword(pwForm.currentPassword, pwForm.newPassword);
      setShowPasswordModal(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      alert('Şifreniz güncellendi.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Şifre güncellenemedi.');
    } finally {
      setPwSaving(false);
    }
  };
  // Ayrı lisanslı modüller (PLUGIN_CATALOG) — aktif entitlement seti. Lisans = ticari hak,
  // izinden bağımsız kapı (GM superuser bile lisanssız görmez).
  const [entitled, setEntitled] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    apiService.getPluginEntitlements()
      .then((rows: EntitlementRow[]) => { if (active) setEntitled(new Set((rows || []).filter(r => r.active).map(r => r.plugin.key))); })
      .catch(() => {});
    return () => { active = false; };
  }, [currentUser?.id]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const visibleNavItems = NAV_ITEMS.filter(item => {
    // Ayrı lisanslı modül: entitlement yoksa gizle (izinden bağımsız kapı).
    const ent = (item as { requiredEntitlement?: string }).requiredEntitlement;
    if (ent && !entitled.has(ent)) return false;
    const hasBasePermission = hasPermission(item.requiredPermission);
    if (item.subItems) {
      const visibleSubItems = item.subItems.filter(sub => hasPermission(sub.requiredPermission));
      return hasBasePermission || visibleSubItems.length > 0;
    }
    return hasBasePermission;
  });

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden"
          />
        )}
      </AnimatePresence>

      <div
        data-testid="sidebar"
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen bg-white/20 backdrop-blur-3xl border-r border-white/20 flex flex-col z-[100] transition-transform duration-500 w-72 lg:translate-x-0 overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="pt-[calc(3rem+env(safe-area-inset-top))] p-8 flex items-center gap-4 border-b border-white/10 group cursor-pointer">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-all duration-500 overflow-hidden">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Zap size={24} fill="currentColor" />
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="font-black text-slate-900 leading-none uppercase tracking-tighter text-2xl italic">ENFLOW</h1>
          <p className="text-[10px] text-primary uppercase tracking-[0.2em] font-black mt-1 opacity-70">COCKPIT {APP_VERSION}</p>
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
            onClick={() => setShowPasswordModal(true)}
            title="Şifre Değiştir"
            className="p-2.5 hover:bg-white/50 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
          >
            <KeyRound size={18} />
          </button>
          <button
            onClick={() => handleNavigate(onLogout)}
            className="p-2.5 hover:bg-white/50 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>

    <AnimatePresence>
      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden bg-white p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-bold text-slate-900">Şifre Değiştir</h4>
              <button onClick={() => { setShowPasswordModal(false); setPwError(''); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                placeholder="Mevcut Şifre"
                required
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                placeholder="Yeni Şifre (en az 6 karakter)"
                required
                minLength={6}
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                placeholder="Yeni Şifre (Tekrar)"
                required
                minLength={6}
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
              />
              {pwError && <p className="text-xs font-bold text-red-600">{pwError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowPasswordModal(false); setPwError(''); }} className="px-6 py-2 text-sm font-bold text-slate-500">
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  {pwSaving ? <Loader2 size={16} className="animate-spin" /> : 'Kaydet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Sidebar;
