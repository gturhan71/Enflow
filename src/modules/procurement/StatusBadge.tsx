import type { FC } from 'react';
import { PurchaseStatus } from '../../types';
import { STATUS_CONFIG } from './constants';

const StatusBadge: FC<{ status: PurchaseStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.textColor}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

export default StatusBadge;
