import React, { useState } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Briefcase,
  Calendar,
  Filter,
  Target,
  Loader2,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import {
  TodoTask,
  Opportunity,
  Project,
  Contract,
  Unit,
  Proposal
} from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';


const TodoModule = ({
  tasks,
  setTasks,
  projects,
  opportunities,
  contracts,
  units,
  proposals,
  setProposals
}: {
  tasks: TodoTask[],
  setTasks: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  projects?: Project[],
  opportunities?: Opportunity[],
  contracts?: Contract[],
  units?: Unit[],
  proposals?: Proposal[],
  setProposals?: React.Dispatch<React.SetStateAction<Proposal[]>>
}) => {
  const { currentUser } = useAuth();
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState<Partial<TodoTask>>({
    priority: 'MEDIUM',
    status: 'PENDING',
    relatedModule: 'GENERAL'
  });

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.unitId) return alert('Lütfen zorunlu alanları doldurun.');
    setLoading(true);
    try {
      const task = await apiService.createTask({
        ...newTask,
        assignedBy: currentUser?.id,
        createdAt: new Date().toISOString()
      });
      setTasks([task, ...tasks]);
      setShowNewTaskModal(false);
      setNewTask({ priority: 'MEDIUM', status: 'PENDING', relatedModule: 'GENERAL' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Görev atanamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TodoTask['status']) => {
    try {
      const updated = await apiService.updateTask(taskId, { status: newStatus });
      setTasks(tasks.map(t => t.id === taskId ? updated : t));
    } catch (err) {
      alert('Durum güncellenemedi.');
    }
  };

  const filteredTodos = filterUnit === 'all' 
    ? tasks 
    : tasks.filter(t => t.unitId === filterUnit);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'IN_PROGRESS': return <Clock size={16} className="text-amber-500" />;
      case 'CANCELLED': return <X size={16} className="text-slate-400" />;
      default: return <AlertCircle size={16} className="text-indigo-500" />;
    }
  };

  const getRelatedItemName = (todo: TodoTask) => {
    if (!todo.relatedItemId) return '';
    switch (todo.relatedModule) {
      case 'PROJECT':
      case 'PROCUREMENT':
        return projects?.find(p => p.id === todo.relatedItemId)?.name || 'Bilinmeyen Proje';
      case 'OPPORTUNITY':
        return opportunities?.find(o => o.id === todo.relatedItemId)?.title || 'Bilinmeyen Fırsat';
      case 'CONTRACT': {
        const contract = contracts?.find(c => c.id === todo.relatedItemId);
        const proj = projects?.find(p => p.id === contract?.projectId);
        return proj?.name || contract?.id || 'Bilinmeyen Sözleşme';
      }
      case 'PROPOSAL': {
        const proposal = proposals?.find(p => p.id === todo.relatedItemId);
        if (!proposal) return 'Bilinmeyen Teklif';
        const opp = opportunities?.find(o => o.id === proposal.opportunityId);
        return opp?.title || 'Bilinmeyen Fırsat';
      }
      default:
        return '';
    }
  };

  const getProposalDetail = (todo: TodoTask): { price: string } | null => {
    if (todo.relatedModule !== 'PROPOSAL' || !todo.relatedItemId) return null;
    const proposal = proposals?.find(p => p.id === todo.relatedItemId);
    if (!proposal || proposal.totalPrice == null) return null;
    return { price: proposal.totalPrice.toLocaleString('tr-TR') };
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-geist">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Görevler & Takip</h3>
          <p className="text-slate-500 font-medium">Birim bazlı yönetimsel görev atamaları ve süreç takibi.</p>
        </div>
        <button 
          onClick={() => setShowNewTaskModal(true)}
          className="bg-indigo-600 text-white px-10 py-4 rounded-[28px] text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
        >
          <Plus size={20} /> Yeni Görev Ata
        </button>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
        <button 
          onClick={() => setFilterUnit('all')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
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
              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
              filterUnit === unit.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
            )}
          >
            {unit.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredTodos.length === 0 ? (
          <div className="p-20 text-center glass-panel rounded-[40px] border-dashed border-2 border-slate-100">
             <ListTodo size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Henüz görev atanmamış.</p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <motion.div 
              layout 
              key={todo.id} 
              className={cn(
                "glass-panel p-8 rounded-[40px] bg-white border border-slate-100 flex flex-col md:flex-row md:items-center gap-8 group transition-all",
                (todo.relatedModule === 'CONTRACT' || todo.relatedModule === 'OPPORTUNITY') && todo.status === 'PENDING' ? "border-amber-300 shadow-amber-50/20" : "hover:border-indigo-200"
              )}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {(todo.relatedModule === 'CONTRACT' || todo.relatedModule === 'OPPORTUNITY' || todo.relatedModule === 'PROPOSAL') && todo.status === 'PENDING' && (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <AlertCircle className="text-amber-500" size={20} />
                    </motion.div>
                  )}
                  <span className={cn("text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", getPriorityColor(todo.priority))}>
                    {todo.priority}
                  </span>
                  <h4 className="font-black text-slate-900 text-xl tracking-tight">{todo.title}</h4>
                  {(() => {
                    const detail = getProposalDetail(todo);
                    if (!detail) return null;
                    return (
                      <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                        <DollarSign size={12} />
                        {detail.price}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{todo.description}</p>
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                    <Briefcase size={14} />
                    {units?.find(u => u.id === todo.unitId)?.name}
                  </div>
                  {todo.relatedModule && todo.relatedModule !== 'GENERAL' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">
                        <Target size={14} className="shrink-0" />
                        <span>
                          {todo.relatedModule === 'PROJECT' && `Proje: ${getRelatedItemName(todo)}`}
                          {todo.relatedModule === 'OPPORTUNITY' && `Fırsat: ${getRelatedItemName(todo)}`}
                          {todo.relatedModule === 'CONTRACT' && `Sözleşme: ${getRelatedItemName(todo)}`}
                          {todo.relatedModule === 'PROPOSAL' && `Fırsat: ${getRelatedItemName(todo)}`}
                        </span>
                      </div>

                      {/* Yönetici Onay/Red Butonları */}
                      {(todo.relatedModule === 'CONTRACT' || todo.relatedModule === 'OPPORTUNITY' || todo.relatedModule === 'PROPOSAL') && todo.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await handleStatusChange(todo.id, 'COMPLETED');
                              await apiService.updateProposal(todo.relatedItemId!, { status: 'APPROVED' });
                              setProposals?.(prev => prev.map(p =>
                                p.id === todo.relatedItemId ? { ...p, status: 'APPROVED' } : p
                              ));
                              alert('Teklif Onaylandı.');
                            }}
                            className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={async () => {
                              await handleStatusChange(todo.id, 'CANCELLED');
                              await apiService.updateProposal(todo.relatedItemId!, { status: 'REJECTED' });
                              setProposals?.(prev => prev.map(p =>
                                p.id === todo.relatedItemId ? { ...p, status: 'REJECTED' } : p
                              ));
                              alert('Teklif Reddedildi ve CRM\'e yansıtıldı.');
                            }}
                            className="bg-red-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-600"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                    <Calendar size={14} />
                    Termin: {todo.dueDate}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-6 md:pt-0">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  {getStatusIcon(todo.status)}
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    {todo.status.replace('_', ' ')}
                  </span>
                </div>
                <button 
                  onClick={() => handleStatusChange(todo.id, todo.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
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

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Yeni Görev Ata</h4>
                <button onClick={() => setShowNewTaskModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Haftalık Satış Raporu"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Modül</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none appearance-none"
                      value={newTask.relatedModule || 'GENERAL'}
                      onChange={(e) => setNewTask({...newTask, relatedModule: e.target.value as any, relatedItemId: ''})}
                    >
                      <option value="GENERAL">Genel Görev</option>
                      <option value="PROJECT">Proje Yönetimi</option>
                      <option value="OPPORTUNITY">CRM & Fırsat</option>
                      <option value="CONTRACT">Sözleşme</option>
                      <option value="PROCUREMENT">Satın Alma</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Birim</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, unitId: e.target.value})}
                    >
                      <option value="">Seçiniz</option>
                      {units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Öncelik</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                    >
                      <option value="LOW">Düşük</option>
                      <option value="MEDIUM">Orta</option>
                      <option value="HIGH">Yüksek</option>
                      <option value="URGENT">Acil</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Termin Tarihi</label>
                    <input 
                      type="date" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Detayı</label>
                  <textarea 
                    rows={3}
                    placeholder="Görev ile ilgili detaylı açıklama..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none resize-none"
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-8 py-3 text-sm font-black text-slate-500 uppercase tracking-widest"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddTask}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : 'Görevi Ata'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ListTodo = ({ size, className }: { size: number, className: string }) => (
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

export default TodoModule;
