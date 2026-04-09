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
  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Aktif Projeler', value: '12', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Toplam Pipeline', value: '$2.4M', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ortalama Marj', value: '%16.4', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Bekleyen Onaylar', value: '5', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
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
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Son Projeler</h3>
              <button className="text-indigo-600 text-sm font-semibold hover:underline">Tümünü Gör</button>
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
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Kritik Uyarılar</h3>
            <div className="space-y-4">
              {[
                { title: 'ISO 27001 Yenileme', desc: 'Süre dolmasına 12 gün kaldı.', type: 'warning' },
                { title: 'Düşük Marjlı Teklif', desc: 'P2 projesi %9.2 marj ile onay bekliyor.', type: 'danger' },
                { title: 'ETA Gecikmesi', desc: 'Dell Server siparişi 3 gün gecikti.', type: 'info' },
              ].map((alert, i) => (
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
    </div>
  );
};

export default Dashboard;
