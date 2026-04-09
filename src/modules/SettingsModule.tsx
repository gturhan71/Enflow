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
import IntegrationWizard from './IntegrationWizard';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


const SettingsModule = () => {
  const [activeSubTab, setActiveSubTab] = useState('units');
  const [ncConfig, setNcConfig] = useState<NextcloudConfig>(nextcloudService.getConfig());
  const [exConfig, setExConfig] = useState<ExchangeConfig>(exchangeService.getConfig());
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>(whatsappService.getConfig());

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Şirket Ayarları</h3>
          <p className="text-slate-500">Birim tanımlamaları, kullanıcı yönetimi ve yetkilendirme.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus size={20} />
          {activeSubTab === 'units' ? 'Yeni Birim' : activeSubTab === 'users' ? 'Yeni Kullanıcı' : activeSubTab === 'integrations' ? 'Entegrasyon Ekle' : 'Yeni Yetki'}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'units', label: 'Birimler', icon: LayoutDashboard },
          { id: 'users', label: 'Kullanıcılar', icon: Users },
          { id: 'permissions', label: 'Yetkiler', icon: ShieldCheck },
          { id: 'integrations', label: 'Entegrasyonlar', icon: Puzzle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2",
              activeSubTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'units' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MOCK_UNITS.map((unit) => (
                <div key={unit.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Briefcase size={24} />
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">{unit.name}</h4>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">{unit.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-400">8 Kullanıcı</span>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Düzenle</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-6 px-6">Ad Soyad / Email</th>
                    <th className="py-6 px-6">Birim</th>
                    <th className="py-6 px-6">Rol</th>
                    <th className="py-6 px-6">Durum</th>
                    <th className="py-6 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MOCK_SYSTEM_USERS.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <span className="text-sm text-slate-600">
                          {MOCK_UNITS.find(u => u.id === user.unitId)?.name || '-'}
                        </span>
                      </td>
                      <td className="py-6 px-6">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-6 px-6">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          user.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="py-6 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => nextcloudService.syncUser(user)}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-2"
                            title="Nextcloud'a Senkronize Et"
                          >
                            <History size={18} />
                          </button>
                          <button className="text-slate-400 hover:text-indigo-600 transition-colors p-2">
                            <Settings size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSubTab === 'permissions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MOCK_PERMISSIONS.map((perm) => (
                <div key={perm.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-900">{perm.name}</h4>
                      <code className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {perm.code}
                      </code>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed mb-4">{perm.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Atanan Rol Sayısı: 3</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'integrations' && (
            <IntegrationWizard 
              ncConfig={ncConfig} 
              setNcConfig={setNcConfig} 
              exConfig={exConfig}
              setExConfig={setExConfig}
              waConfig={waConfig}
              setWaConfig={setWaConfig}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SettingsModule;
