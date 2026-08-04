import { AlertTriangle, Clock } from 'lucide-react';
import type { ReportOverview } from '../../types';
import { ROLE_LABELS } from '../../constants';

export default function BottleneckPanel({ overview }: { overview: ReportOverview }) {
  const { bottlenecks } = overview;
  return (
    <div className="glass-card p-5 rounded-2xl border-l-4 border-amber-400">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-amber-500" size={18} />
        <h3 className="text-base font-black text-slate-900">İş Akışı Darboğazı</h3>
        <span className="text-[10px] text-slate-400 font-bold">— onay zinciri hangi birimde bekliyor</span>
      </div>
      {bottlenecks.length === 0 ? (
        <p className="text-sm text-slate-500">Bekleyen onay zinciri yok — iş akışı temiz. ✓</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bottlenecks.map(b => (
            <div key={b.role} className="bg-white border border-slate-100 rounded-xl p-3">
              <p className="text-sm font-bold text-slate-900">{ROLE_LABELS[b.role] || b.role}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-black text-amber-600">{b.pendingCount} bekleyen</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                  <Clock size={11} /> en eski {b.oldestWaitingDays} gün
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
