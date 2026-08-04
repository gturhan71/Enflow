import type { FC } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MarginBadge: FC<{ value: number; label?: string }> = ({ value, label }) => {
  const color = value >= 20 ? 'text-green-600 bg-green-50' : value >= 0 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
      {value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {label && <span className="font-normal">{label}:</span>} %{value.toFixed(1)}
    </span>
  );
};

export default MarginBadge;
