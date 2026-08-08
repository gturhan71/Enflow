import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { DashboardPayload } from '../../types';
import { buildCriticalAlerts } from './criticalAlerts';

const severityStyle = (daysLeft: number) => {
  if (daysLeft < 0) return { dot: 'bg-red-600', text: 'text-red-600', label: 'süre doldu' };
  if (daysLeft <= 2) return { dot: 'bg-red-500', text: 'text-red-600', label: `${daysLeft} gün` };
  return { dot: 'bg-amber-500', text: 'text-amber-600', label: `${daysLeft} gün` };
};

const CriticalAlertsStrip: React.FC<{ d: DashboardPayload; go: (t: string) => void }> = ({ d, go }) => {
  const alerts = buildCriticalAlerts(d).slice(0, 8);
  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-5 bg-gradient-to-br from-red-50/80 to-white border border-red-100"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-red-500" />
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Kritik Uyarılar</h4>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">— tüm birimlerden, önem sırasına göre</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {alerts.map(a => {
          const s = severityStyle(a.daysLeft ?? 0);
          return (
            <button
              key={a.id}
              onClick={() => go(a.targetTab)}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/70 hover:bg-white border border-transparent hover:border-red-100 transition-colors text-left"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{a.category}</span>
              <span className="text-xs font-bold text-slate-700 truncate flex-1">{a.title}</span>
              <span className={`text-xs font-black shrink-0 ${s.text}`}>{s.label}</span>
              <ChevronRight size={12} className="text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CriticalAlertsStrip;
