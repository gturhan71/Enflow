import type { FC } from 'react';
import { PurchaseStatus, PurchaseUrgency } from '../../types';
import { STATUS_CONFIG, URGENCY_CONFIG } from './constants';

interface SummaryTabProps {
  statusDist: { status: PurchaseStatus; count: number }[];
  urgencyDist: { urgency: PurchaseUrgency; count: number }[];
  maxCount: number;
  vendorsCount: number;
}

const SummaryTab: FC<SummaryTabProps> = ({ statusDist, urgencyDist, maxCount, vendorsCount }) => (
  <div className="space-y-6">
    <div className="glass-card rounded-2xl p-5">
      <h4 className="font-semibold mb-4 text-sm text-slate-300">Durum Dağılımı</h4>
      <div className="space-y-2">
        {statusDist.map(({ status, count }) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className="flex items-center gap-3">
              <span className={`text-xs w-36 shrink-0 font-semibold ${cfg.textColor}`}>{cfg.label}</span>
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${cfg.bg.replace('bg-', 'bg-').replace('-100', '-500')}`}
                  style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
    <div className="glass-card rounded-2xl p-5">
      <h4 className="font-semibold mb-4 text-sm text-slate-300">Açık Taleplerde Aciliyet</h4>
      <div className="flex gap-4 items-end h-24">
        {urgencyDist.map(({ urgency, count }) => (
          <div key={urgency} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-slate-300">{count}</span>
            <div className="w-full rounded-t-lg bg-indigo-600/60" style={{ height: `${(count / Math.max(...urgencyDist.map(x => x.count), 1)) * 64}px` }} />
            <span className={`text-[10px] font-semibold ${URGENCY_CONFIG[urgency].color}`}>{URGENCY_CONFIG[urgency].label}</span>
          </div>
        ))}
        {urgencyDist.length === 0 && <p className="text-sm text-slate-400">Aktif talep yok.</p>}
      </div>
    </div>
    <div className="glass-card rounded-2xl p-5">
      <h4 className="font-semibold mb-3 text-sm text-slate-300">Tedarikçi Sayısı</h4>
      <p className="text-3xl font-bold">{vendorsCount}</p>
      <p className="text-xs text-slate-400 mt-1">aktif tedarikçi</p>
    </div>
  </div>
);

export default SummaryTab;
