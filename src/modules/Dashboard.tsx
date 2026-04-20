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


const Dashboard = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const activeProjects = MOCK_PROJECTS.filter(p => p.status === 'IN_PROGRESS' || p.status === 'ANALYSIS');
  const totalPipelineValue = MOCK_OPPORTUNITIES.reduce((sum, o) => sum + o.value, 0);
  
  // Calculate average margin
  const totalProjectValue = MOCK_PROJECTS.reduce((sum, p) => sum + p.totalValue, 0);
  const totalProjectMargin = MOCK_PROJECTS.reduce((sum, p) => sum + (p.totalValue * (p.avgMargin / 100)), 0);
  const avgMargin = totalProjectValue > 0 ? (totalProjectMargin / totalProjectValue) * 100 : 0;

  const pendingApprovals = [
    ...MOCK_PROJECTS.filter(p => p.status === 'AWAITING_APPROVAL').map(p => ({ type: 'Proje', name: p.name, desc: 'Proje onayı bekliyor' })),
    ...MOCK_OPPORTUNITIES.filter(o => o.bomStatus === 'SUBMITTED').map(o => ({ type: 'BoM', name: o.title, desc: 'BoM listesi onayı bekliyor' }))
  ];

  const alerts = [
    { title: 'ISO 27001 Yenileme', desc: 'Süre dolmasına 12 gün kaldı.', type: 'warning', date: '2026-04-26' },
    { title: 'Düşük Marjlı Teklif', desc: 'P2 projesi %9.2 marj ile onay bekliyor.', type: 'danger', date: '2026-04-14' },
    { title: 'ETA Gecikmesi', desc: 'Dell Server siparişi 3 gün gecikti.', type: 'info', date: '2026-04-11' },
  ];

  const renderModalContent = () => {
    switch (activeModal) {
      case 'activeProjects':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Aktif Projeler Detayı</h4>
            <div className="divide-y divide-slate-100">
              {activeProjects.map(p => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">Müşteri ID: {p.customerId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${p.totalValue.toLocaleString()}</p>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase">{p.status}</span>
                  </div>
                </div>
              ))}
              {activeProjects.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Aktif proje bulunmamaktadır.</p>}
            </div>
          </div>
        );
      case 'pipeline':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Toplam Pipeline Detayı</h4>
            <div className="divide-y divide-slate-100">
              {MOCK_OPPORTUNITIES.map(o => (
                <div key={o.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{o.title}</p>
                    <p className="text-xs text-slate-500">Olasılık: %{o.probability}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${o.value.toLocaleString()}</p>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 uppercase">{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'margin':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Ortalama Marj Detayı</h4>
            <div className="divide-y divide-slate-100">
              {MOCK_PROJECTS.map(p => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">Değer: ${p.totalValue.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold", p.avgMargin >= 15 ? "text-emerald-600" : p.avgMargin >= 10 ? "text-amber-600" : "text-red-600")}>
                      %{p.avgMargin.toFixed(1)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'approvals':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Bekleyen Onaylar Detayı</h4>
            <div className="divide-y divide-slate-100">
              {pendingApprovals.map((a, i) => (
                <div key={i} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-500">{a.desc}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600 uppercase">{a.type}</span>
                </div>
              ))}
              {pendingApprovals.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">Bekleyen onay bulunmamaktadır.</p>}
            </div>
          </div>
        );
      case 'allProjects':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Tüm Projeler</h4>
            <div className="divide-y divide-slate-100">
              {MOCK_PROJECTS.map(p => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">Deadline: {p.deadline}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${p.totalValue.toLocaleString()}</p>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'alerts':
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 mb-4">Tüm Kritik Uyarılar</h4>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-2xl border flex gap-3",
                  alert.type === 'warning' ? "bg-amber-50 border-amber-100" : 
                  alert.type === 'danger' ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                )}>
                  <AlertCircle size={20} className={cn(
                    alert.type === 'warning' ? "text-amber-600" : 
                    alert.type === 'danger' ? "text-red-600" : "text-blue-600"
                  )} />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h5 className="text-sm font-bold text-slate-900 leading-none mb-1">{alert.title}</h5>
                      <span className="text-[10px] text-slate-500">{alert.date}</span>
                    </div>
                    <p className="text-xs text-slate-600">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'activeProjects', label: 'Aktif Projeler', value: activeProjects.length.toString(), icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'pipeline', label: 'Toplam Pipeline', value: `$${(totalPipelineValue / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'margin', label: 'Ortalama Marj', value: `%${avgMargin.toFixed(1)}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'approvals', label: 'Bekleyen Onaylar', value: pendingApprovals.length.toString(), icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            onClick={() => setActiveModal(stat.id)}
            className="glass-card p-6 rounded-3xl cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <ArrowUpRight size={12} /> +4.2%
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Son Projeler</h3>
              <button onClick={() => setActiveModal('allProjects')} className="text-indigo-600 text-sm font-semibold hover:underline">Tümünü Gör</button>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_PROJECTS.map((project) => (
                <div key={project.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{project.name}</h4>
                      <p className="text-xs text-slate-500">Müşteri ID: {project.customerId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${project.totalValue.toLocaleString()}</p>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                      project.status === 'ANALYSIS' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 cursor-pointer" onClick={() => setActiveModal('alerts')}>
            <h3 className="font-bold text-slate-900 mb-6 flex items-center justify-between">
              Kritik Uyarılar
              <ChevronRight size={16} className="text-slate-400" />
            </h3>
            <div className="space-y-4">
              {alerts.map((alert, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-2xl border flex gap-3",
                  alert.type === 'warning' ? "bg-amber-50 border-amber-100" : 
                  alert.type === 'danger' ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                )}>
                  <AlertCircle size={20} className={cn(
                    alert.type === 'warning' ? "text-amber-600" : 
                    alert.type === 'danger' ? "text-red-600" : "text-blue-600"
                  )} />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 leading-none mb-1">{alert.title}</h5>
                    <p className="text-xs text-slate-600">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Detail Modal */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-xl font-bold text-slate-900">Detaylar</h4>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1">
                {renderModalContent()}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
