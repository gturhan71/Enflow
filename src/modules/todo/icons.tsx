import { CheckCircle2, Clock, X, AlertCircle } from 'lucide-react';

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED': return <CheckCircle2 size={16} className="text-emerald-500" />;
    case 'IN_PROGRESS': return <Clock size={16} className="text-amber-500" />;
    case 'CANCELLED': return <X size={16} className="text-slate-400" />;
    default: return <AlertCircle size={16} className="text-indigo-500" />;
  }
};

export const ListTodo = ({ size, className }: { size: number, className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m3 16 2 2 4-4"/><path d="m3 6 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>
  </svg>
);
