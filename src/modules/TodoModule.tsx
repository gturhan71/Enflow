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


const TodoModule = () => {
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [todos, setTodos] = useState<TodoTask[]>(MOCK_TODO_TASKS);

  const filteredTodos = filterUnit === 'all' 
    ? todos 
    : todos.filter(t => t.unitId === filterUnit);

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

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Görevler & Takip</h3>
          <p className="text-slate-500">Birim bazlı yönetimsel görev atamaları ve süreç takibi.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
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
          <div key={todo.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6">
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
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                  <Settings size={18} />
                </button>
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-colors">
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodoModule;
