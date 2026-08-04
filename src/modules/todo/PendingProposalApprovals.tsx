import { AlertCircle, DollarSign, Eye, CheckCircle2, X, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TodoTask } from '../../types';
import { getPriorityColor, ProposalDetail } from './helpers';

export default function PendingProposalApprovals({
  approvals,
  getDetail,
  getRelatedItemName,
  onPreview,
  onApprove,
  onReject,
}: {
  approvals: TodoTask[];
  getDetail: (todo: TodoTask) => ProposalDetail | null;
  getRelatedItemName: (todo: TodoTask) => string;
  onPreview: (todo: TodoTask) => void;
  onApprove: (todo: TodoTask) => void;
  onReject: (todo: TodoTask) => void;
}) {
  if (approvals.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          <AlertCircle className="text-amber-500" size={22} />
        </motion.div>
        <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Onay Bekleyen Teklifler</h4>
        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
          {approvals.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {approvals.map((todo) => {
          const detail = getDetail(todo);
          return (
            <motion.div
              layout
              key={todo.id}
              className="glass-panel p-8 rounded-[40px] bg-white border-2 border-amber-300 shadow-amber-50/30 flex flex-col md:flex-row md:items-center gap-8"
            >
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn("text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", getPriorityColor(todo.priority))}>
                    {todo.priority}
                  </span>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">{todo.title}</h4>
                  {detail && (
                    <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                      <DollarSign size={12} />{detail.price}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-medium">{todo.description}</p>
                <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg w-fit">
                  <Target size={13} />
                  Fırsat: {getRelatedItemName(todo)}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onPreview(todo)}
                  className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
                >
                  <Eye size={15} /> İncele
                </button>
                <button
                  onClick={() => onApprove(todo)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                >
                  <CheckCircle2 size={15} /> Onayla
                </button>
                <button
                  onClick={() => onReject(todo)}
                  className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                >
                  <X size={15} /> Reddet
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
