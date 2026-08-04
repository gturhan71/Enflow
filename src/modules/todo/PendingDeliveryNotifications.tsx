import { Bell, SendHorizonal, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { TodoTask } from '../../types';

export default function PendingDeliveryNotifications({
  deliveries,
  onMarkRead,
}: {
  deliveries: TodoTask[];
  onMarkRead: (taskId: string) => void;
}) {
  if (deliveries.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}>
          <Bell className="text-blue-500" size={20} />
        </motion.div>
        <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Gönderilen Teklif Bildirimleri</h4>
        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200">
          {deliveries.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {deliveries.map(todo => (
          <motion.div
            layout
            key={todo.id}
            className="glass-panel p-6 rounded-[32px] bg-blue-50/40 border border-blue-100 flex flex-col md:flex-row md:items-center gap-6"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-100 shrink-0">
              <SendHorizonal size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-900 text-sm tracking-tight">{todo.title}</h4>
              <p className="text-xs text-slate-500 font-medium mt-1">{todo.description}</p>
            </div>
            <button
              onClick={() => onMarkRead(todo.id)}
              className="shrink-0 flex items-center gap-2 bg-white border border-blue-200 text-blue-600 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 whitespace-nowrap"
            >
              <CheckCircle2 size={14} /> Okundu
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
