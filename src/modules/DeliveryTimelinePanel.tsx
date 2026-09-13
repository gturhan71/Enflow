import React from 'react';
import { Truck } from 'lucide-react';

export interface DeliveryTimelineStepLike {
  id: string;
  title: string;
  sortOrder: number;
  plannedDate?: string | null;
}

interface DeliveryTimelinePanelProps {
  steps?: DeliveryTimelineStepLike[] | null;
  title?: string;
}

/**
 * Alt kırılımlı teslim süresi tahmini takvimi — İhale detayında ve Sözleşme
 * ContextTab'ında kullanılan salt-okunur, sistem-üretimi gösterim.
 */
const DeliveryTimelinePanel: React.FC<DeliveryTimelinePanelProps> = ({ steps, title = 'Tahmini Teslim Takvimi' }) => {
  if (!steps || steps.length === 0) return null;
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Truck size={16} className="text-indigo-600" />
        {title}
      </div>
      <ol className="flex flex-col gap-2">
        {sorted.map((step, i) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {i + 1}
            </span>
            <span className="flex-1 text-slate-700">{step.title}</span>
            <span className="text-slate-500 text-xs">
              {step.plannedDate ? new Date(step.plannedDate).toLocaleDateString('tr-TR') : '—'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default DeliveryTimelinePanel;
