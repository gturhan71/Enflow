import type { FC } from 'react';
import { ProjectStatus } from '../../types';
import { STATUS_CONFIG } from './constants';

const StatusBadge: FC<{ status: ProjectStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.color}`}>{c.label}</span>;
};

export default StatusBadge;
