import { Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function AccessDeniedPanel({ role, onBackToDashboard }: { role?: string; onBackToDashboard?: () => void }) {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50/50">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel p-12 max-w-md w-full rounded-[40px] text-center border border-red-200/40 bg-white/60 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-red-500" />
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
          <Lock size={40} className="animate-pulse" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Erişim Engellendi</h3>
        <p className="text-sm text-slate-500 font-bold mt-4 leading-relaxed">
          Pazarlık Modülü ve Canlı Simülasyon paneli sadece **Satış Birim Yöneticisine (Genel Müdür)** yetkilendirilmiştir.
        </p>
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-2">
          <p className="text-xs text-slate-400 font-medium">Mevcut Rolünüz: <span className="font-bold text-slate-600">{role || 'Bilinmiyor'}</span></p>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-4 bg-slate-900 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all active:scale-95"
            >
              KOKPİTE GERİ DÖN
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
