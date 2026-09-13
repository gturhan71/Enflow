import { useState } from 'react';
import { CheckCircle2, X, DollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TodoTask } from '../../types';
import { ProposalDetail } from './helpers';

export default function ResolvedApprovals({
  approvals,
  getDetail,
  getRelatedItemName,
}: {
  approvals: TodoTask[];
  getDetail: (todo: TodoTask) => ProposalDetail | null;
  getRelatedItemName: (todo: TodoTask) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (approvals.length === 0) return null;
  return (
    <div className="space-y-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 rounded-[28px] bg-emerald-50/60 border border-emerald-100 hover:bg-emerald-50 transition-all"
      >
        <span className="flex items-center gap-2 text-xs font-black text-emerald-700 uppercase tracking-widest">
          <CheckCircle2 size={16} />
          Onaylanan / Reddedilen Teklifler ({approvals.length})
        </span>
        {expanded ? <ChevronUp size={18} className="text-emerald-600" /> : <ChevronDown size={18} className="text-emerald-600" />}
      </button>
      {expanded && (
      <div className="grid grid-cols-1 gap-4">
        {approvals.map((todo) => {
          const approved = todo.status === 'COMPLETED';
          const detail = getDetail(todo);
          return (
            <motion.div
              layout
              key={todo.id}
              className={cn(
                "p-7 rounded-[32px] border flex flex-col md:flex-row md:items-center gap-6 transition-all",
                approved
                  ? "bg-emerald-50/60 border-emerald-100"
                  : "bg-red-50/40 border-red-100"
              )}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn(
                    "flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest",
                    approved
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-red-100 text-red-600 border-red-200"
                  )}>
                    {approved ? <CheckCircle2 size={11} /> : <X size={11} />}
                    {approved ? 'Onaylandı' : 'Reddedildi'}
                  </span>
                  <h4 className="font-black text-slate-700 text-base tracking-tight">{todo.title}</h4>
                  {detail && (
                    <span className="flex items-center gap-1.5 bg-white border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                      <DollarSign size={11} />{detail.price}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white/70 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                  <Target size={12} />
                  Fırsat: {getRelatedItemName(todo)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
}
