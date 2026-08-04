import { Briefcase, Calendar, Target, UserCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TodoTask, Unit, User } from '../../types';
import { getPriorityColor, taskTargetTab } from './helpers';
import { getStatusIcon, ListTodo } from './icons';
import AgentTag from '../../components/AgentTag';
import { isAgentActor } from '../../lib/agentProvenance';

export default function TaskList({
  units,
  filterUnit,
  setFilterUnit,
  filteredTodos,
  getRelatedItemName,
  users,
  onNavigate,
  onToggleStatus,
}: {
  units?: Unit[];
  filterUnit: string;
  setFilterUnit: (unitId: string) => void;
  filteredTodos: TodoTask[];
  getRelatedItemName: (todo: TodoTask) => string;
  users?: User[];
  onNavigate?: (tab: string, itemId?: string | null) => void;
  onToggleStatus: (taskId: string, newStatus: TodoTask['status']) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Görevler</h4>
      <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilterUnit('all')}
          className={cn(
            "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
            filterUnit === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
          )}
        >
          Tüm Birimler
        </button>
        {units?.map(unit => (
          <button
            key={unit.id}
            onClick={() => setFilterUnit(unit.id)}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
              filterUnit === unit.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
            )}
          >
            {unit.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5">
        {filteredTodos.length === 0 ? (
          <div className="p-16 text-center glass-panel rounded-[40px] border-dashed border-2 border-slate-100">
            <ListTodo size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Henüz görev atanmamış.</p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <motion.div
              layout
              key={todo.id}
              className={cn(
                "glass-panel p-8 rounded-[40px] bg-white border border-slate-100 flex flex-col md:flex-row md:items-center gap-8 transition-all hover:border-indigo-200",
                todo.status === 'COMPLETED' && "opacity-60"
              )}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className={cn("text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", getPriorityColor(todo.priority))}>
                    {todo.priority}
                  </span>
                  <h4 className="font-black text-slate-900 text-xl tracking-tight">{todo.title}</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{todo.description}</p>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                    <Briefcase size={13} />
                    {units?.find(u => u.id === todo.unitId)?.name}
                  </div>
                  {todo.assignedToUserId && (
                    <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-black uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">
                      <UserCircle size={13} />
                      {users?.find(u => u.id === todo.assignedToUserId)?.name || 'Atanan kişi'}
                    </div>
                  )}
                  {todo.relatedModule && todo.relatedModule !== 'GENERAL' && (
                    <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">
                      <Target size={13} />
                      {todo.relatedModule === 'PROJECT' && `Proje: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'OPPORTUNITY' && `Fırsat: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'CONTRACT' && `Sözleşme: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'LEGAL' && 'Hukuk Talebi'}
                      {todo.relatedModule === 'PROCUREMENT' && `Satın Alma: ${getRelatedItemName(todo)}`}
                    </div>
                  )}
                  {todo.dueDate && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <Calendar size={13} />
                      Termin: {todo.dueDate}
                    </div>
                  )}
                  {isAgentActor(todo.assignedBy) && (
                    <AgentTag actorId={todo.assignedBy} agentRunId={todo.agentRunId} />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-6 md:pt-0">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  {getStatusIcon(todo.status)}
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
                {onNavigate && taskTargetTab(todo) && (
                  <button
                    onClick={() => onNavigate(taskTargetTab(todo)!, todo.relatedItemId)}
                    title="İlgili modüldeki işe git"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                  >
                    <ArrowUpRight size={15} /> Git
                  </button>
                )}
                <button
                  onClick={() => onToggleStatus(todo.id, todo.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
                    todo.status === 'COMPLETED' ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-white text-slate-300 border border-slate-100 hover:border-emerald-500 hover:text-emerald-500"
                  )}
                >
                  <CheckCircle2 size={24} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
