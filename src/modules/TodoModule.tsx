import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSearch, 
  FileText, 
  ShoppingCart, 
  Archive, 
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Menu,
  X,
  LogOut,
  TrendingUp,
  DollarSign,
  Briefcase,
  Truck,
  Package,
  History,
  FileDown,
  Calendar,
  ShieldCheck,
  MapPin,
  UserCheck,
  ExternalLink,
  Download,
  Filter,
  MoreVertical,
  BarChart3,
  PieChart,
  ArrowDownRight,
  Target,
  Percent,
  FileSignature,
  Gavel,
  Kanban,
  Wand2,
  Puzzle,
  Cpu,
  Mail,
  MessageSquare,
  ListTodo,
  UserPlus,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { 
  NAV_ITEMS, 
  MOCK_CUSTOMERS,
  MOCK_PROJECTS, 
  MOCK_DOCUMENTS, 
  MOCK_WORK_EXPERIENCE, 
  MOCK_CERTIFICATES,
  MOCK_UNITS,
  MOCK_PERMISSIONS,
  MOCK_SYSTEM_USERS,
  MOCK_BOM_ITEMS,
  MOCK_COST_REQUIREMENTS,
  MOCK_CONTRACTS,
  MOCK_CONTRACT_DOCS,
  MOCK_PROJECT_TASKS,
  MOCK_TODO_TASKS,
  MOCK_OPPORTUNITIES
} from '../constants';
import { 
  CorporateDocument, 
  Unit, 
  User, 
  Permission, 
  BoMItem, 
  CostRequirement,
  Contract,
  ContractDocumentRequirement,
  ProjectTask,
  TodoTask,
  Opportunity,
  Project,
  NextcloudConfig,
  ExchangeConfig,
  WhatsAppConfig
} from '../types';
import { nextcloudService } from '../services/nextcloudService';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


const TodoModule = ({ 
  tasks, 
  setTasks,
  projects,
  opportunities,
  contracts
}: { 
  tasks: TodoTask[], 
  setTasks: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  projects?: Project[],
  opportunities?: Opportunity[],
  contracts?: Contract[]
}) => {
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<Partial<TodoTask>>({
    priority: 'MEDIUM',
    status: 'PENDING',
    relatedModule: 'GENERAL'
  });

  const handleAddTask = () => {
    const task: TodoTask = {
      ...newTask as TodoTask,
      id: `task${Date.now()}`,
      assignedBy: 'user1', // Default current user
      createdAt: new Date().toISOString().split('T')[0]
    };
    setTasks([task, ...tasks]);
    setShowNewTaskModal(false);
    setNewTask({ priority: 'MEDIUM', status: 'PENDING', relatedModule: 'GENERAL' });
  };

  const handleStatusChange = (taskId: string, newStatus: TodoTask['status']) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    // If task is completed and related to a module, we could trigger an event or update here.
    // For now, the modules are reading the tasks array directly to show progress, 
    // which fulfills the requirement of "gözlemlenmesini sağla" (make it observable).
    // Actual data updates in the related module (e.g. changing project status) 
    // would require passing down more setters or using a global state/context.
    if (newStatus === 'COMPLETED' && taskToUpdate.relatedModule !== 'GENERAL') {
      console.log(`Task ${taskId} completed. Related module ${taskToUpdate.relatedModule} item ${taskToUpdate.relatedItemId} should be notified.`);
      // Example: if we had setProjects, we could update project progress here.
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
      case 'CONTRACT':
        const contract = contracts?.find(c => c.id === todo.relatedItemId);
        const proj = projects?.find(p => p.id === contract?.projectId);
        return proj?.name || contract?.id || 'Bilinmeyen Sözleşme';
      default:
        return '';
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Görevler & Takip</h3>
          <p className="text-slate-500">Birim bazlı yönetimsel görev atamaları ve süreç takibi.</p>
        </div>
        <button 
          onClick={() => setShowNewTaskModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Yeni Görev Ata
        </button>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <button 
          onClick={() => setFilterUnit('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
            filterUnit === 'all' ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          Tüm Birimler
        </button>
        {MOCK_UNITS.map(unit => (
          <button 
            key={unit.id}
            onClick={() => setFilterUnit(unit.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
              filterUnit === unit.id ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {unit.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTodos.map((todo) => (
          <div key={todo.id} className="glass-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider", getPriorityColor(todo.priority))}>
                  {todo.priority}
                </span>
                <h4 className="font-bold text-slate-900">{todo.title}</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{todo.description}</p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Briefcase size={14} />
                  {MOCK_UNITS.find(u => u.id === todo.unitId)?.name}
                </div>
                {todo.relatedModule && todo.relatedModule !== 'GENERAL' && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-1 rounded-md max-w-[250px] truncate">
                    <Target size={14} className="shrink-0" />
                    <span className="truncate">
                      {todo.relatedModule === 'PROJECT' && `Proje: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'OPPORTUNITY' && `Fırsat: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'CONTRACT' && `Sözleşme: ${getRelatedItemName(todo)}`}
                      {todo.relatedModule === 'PROCUREMENT' && `Satın Alma: ${getRelatedItemName(todo)}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Calendar size={14} />
                  Termin: {todo.dueDate}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(todo.status)}
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {todo.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleStatusChange(todo.id, todo.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    todo.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" : "hover:bg-slate-50 text-slate-400 hover:text-emerald-600"
                  )}
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Görev Ata</h4>
                <button onClick={() => setShowNewTaskModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Görev Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Haftalık Satış Raporu"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">İlgili Modül (İş Emri)</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
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
                  {newTask.relatedModule && newTask.relatedModule !== 'GENERAL' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">İlgili Kayıt</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewTask({...newTask, relatedItemId: e.target.value})}
                      >
                        <option value="">Seçiniz</option>
                        {newTask.relatedModule === 'PROJECT' && projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        {newTask.relatedModule === 'OPPORTUNITY' && opportunities?.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                        {newTask.relatedModule === 'CONTRACT' && contracts?.map(c => <option key={c.id} value={c.id}>{c.id} - {projects?.find(p => p.id === c.projectId)?.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">İlgili Birim</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewTask({...newTask, unitId: e.target.value})}
                    >
                      <option value="">Seçiniz</option>
                      {MOCK_UNITS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Öncelik</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                    >
                      <option value="LOW">Düşük</option>
                      <option value="MEDIUM">Orta</option>
                      <option value="HIGH">Yüksek</option>
                      <option value="URGENT">Acil</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Termin Tarihi</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Görev Detayı</label>
                  <textarea 
                    rows={3}
                    placeholder="Görev ile ilgili detaylı açıklama..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddTask}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Görevi Ata
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TodoModule;
