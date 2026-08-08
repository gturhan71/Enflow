import React from 'react';
import { X, ArrowRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  title: string;
  badge?: { label: string; colorClass: string };
  philosophy?: string;
  onClose: () => void;
  onNavigate?: () => void;
  navigateLabel?: string;
  children: React.ReactNode;
}

// Sağdan açılan drill-down paneli — WidgetDetailDrawer ve KpiDetailDrawer bu
// ortak iskeleti kullanır (backdrop + panel + başlık + felsefe kutusu + alt buton).
const DrawerShell: React.FC<Props> = ({ title, badge, philosophy, onClose, onNavigate, navigateLabel = 'İlgili modüle git', children }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 z-40"
      onClick={onClose}
    />
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
    >
      <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
          {badge && (
            <span className={`inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${badge.colorClass}`}>
              {badge.label}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 shrink-0">
          <X size={18} />
        </button>
      </div>
      {philosophy && (
        <div className="p-6 bg-indigo-50/60 border-b border-indigo-100 flex gap-2">
          <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-900 leading-relaxed">{philosophy}</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {children}
      </div>
      {onNavigate && (
        <div className="p-6 border-t border-slate-100">
          <button
            onClick={onNavigate}
            className="btn-primary w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {navigateLabel} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </motion.div>
  </AnimatePresence>
);

export default DrawerShell;
