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
import ProvisionWizard from './ProvisionWizard';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


interface SettingsModuleProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeSubTab?: string;
}

const SettingsModule = ({ companyLogo, setCompanyLogo, activeSubTab = 'company' }: SettingsModuleProps) => {
  const [showProvisionWizard, setShowProvisionWizard] = useState(false);
  const [units, setUnits] = useState<Unit[]>(MOCK_UNITS);
  const [users, setUsers] = useState<User[]>(MOCK_SYSTEM_USERS);
  
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
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowProvisionWizard(true)}
            className="bg-white border border-slate-200 text-indigo-600 px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <Wand2 size={20} />
            Hızlı Provizyon
          </button>
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={20} />
            {activeSubTab === 'units' ? 'Yeni Birim' : activeSubTab === 'users' ? 'Yeni Kullanıcı' : activeSubTab === 'integrations' ? 'Entegrasyon Ekle' : 'Yeni Yetki'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'company' && (
            <div className="glass-panel rounded-3xl p-8 max-w-2xl">
              <h4 className="text-lg font-bold text-slate-900 mb-6">Şirket Profili ve Logo</h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Şirket Logosu</label>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative group">
                      {companyLogo ? (
                        <>
                          <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain p-2" />
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setCompanyLogo(null)}
                              className="text-white text-xs font-bold hover:underline"
                            >
                              Kaldır
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          <Settings size={24} className="mx-auto text-slate-400 mb-2" />
                          <span className="text-xs text-slate-500 font-medium">Logo Yükle</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCompanyLogo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-2">
                        Giriş ekranında ve raporlarda kullanılacak şirket logosunu yükleyin.
                      </p>
                      <p className="text-xs text-slate-400">Önerilen boyut: 256x256px. Maksimum 2MB (PNG, JPG).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'units' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {units.map((unit) => (
                <div key={unit.id} className="glass-card p-6 rounded-3xl transition-all">
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
                    <span className="text-xs font-bold text-slate-400">{users.filter(u => u.unitId === unit.id).length} Kullanıcı</span>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Düzenle</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="glass-panel rounded-3xl overflow-hidden">
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
                  {users.map((user) => (
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
                          {units.find(u => u.id === user.unitId)?.name || '-'}
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
                <div key={perm.id} className="glass-panel p-6 rounded-3xl flex items-start gap-4">
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
      <ProvisionWizard 
        isOpen={showProvisionWizard}
        onClose={() => setShowProvisionWizard(false)}
        existingUnits={units}
        onComplete={(unitData, newUsers) => {
          let unitId = unitData.id;
          let createdUnit = null;

          if (!unitId) {
            // It's a new unit
            unitId = `unit-${Date.now()}`;
            createdUnit = {
              id: unitId,
              name: unitData.name || 'Yeni Birim',
              description: unitData.description
            };
            setUnits([...units, createdUnit]);
          }
          
          const createdUsers: User[] = newUsers.map((u, i) => ({
            id: `user-${Date.now()}-${i}`,
            name: u.name || 'İsimsiz',
            email: u.email || '',
            role: u.role as any,
            status: u.status as any,
            unitId: unitId
          }));

          setUsers([...users, ...createdUsers]);
          setShowProvisionWizard(false);
        }}
      />
    </div>
  );
};

export default SettingsModule;
