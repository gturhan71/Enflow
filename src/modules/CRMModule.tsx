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


import { TaskProgressTracker } from '../components/TaskProgressTracker';

const CRMModule = ({ 
  opportunities, 
  setOpportunities,
  customers,
  setCustomers,
  activeTab,
  tasks,
  setTasks
}: { 
  opportunities: Opportunity[], 
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>,
  customers?: any[],
  setCustomers?: React.Dispatch<React.SetStateAction<any[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newOpp, setNewOpp] = useState<Partial<Opportunity>>({
    status: 'NEW',
    probability: 10,
    value: 0,
    technicalStatus: 'PENDING',
    bomStatus: 'DRAFT'
  });
  const [newCustomer, setNewCustomer] = useState<any>({
    name: '',
    industry: '',
    riskScore: 0,
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  const handleAddCustomer = () => {
    if (setCustomers && customers) {
      const customer = {
        ...newCustomer,
        id: `c${Date.now()}`
      };
      setCustomers([customer, ...customers]);
    }
    setShowNewCustomerModal(false);
    setNewCustomer({ name: '', industry: '', riskScore: 0, contactPerson: '', email: '', phone: '', address: '' });
  };

  const handleAddOpportunity = () => {
    const opp: Opportunity = {
      ...newOpp as Opportunity,
      id: `opp${Date.now()}`,
      assignedTo: 'user3', // Default to current user for demo
      createdBy: 'user1', // Default creator for demo
      technicalStatus: 'PENDING',
      bomStatus: 'DRAFT'
    };
    setOpportunities([opp, ...opportunities]);
    setShowNewModal(false);
    setNewOpp({ status: 'NEW', probability: 10, value: 0, technicalStatus: 'PENDING', bomStatus: 'DRAFT' });
  };

  const updateStatus = (id: string, status: Opportunity['status']) => {
    setOpportunities(opportunities.map(o => o.id === id ? { ...o, status } : o));
    if (status === 'WON') {
      console.log(`Opportunity ${id} won! Moving to Contract Management.`);
    }
  };

  const assignPresales = (id: string, presalesId: string) => {
    const updated = opportunities.map(o => o.id === id ? { 
      ...o, 
      presalesId, 
      technicalStatus: 'IN_PROGRESS' as const
    } : o);
    setOpportunities(updated);
    const current = updated.find(o => o.id === id);
    if (current) setSelectedOpp(current);
  };

  const submitBoM = (id: string) => {
    const updated = opportunities.map(o => o.id === id ? { 
      ...o, 
      bomStatus: 'SUBMITTED' as const,
      technicalStatus: 'COMPLETED' as const
    } : o);
    setOpportunities(updated);
    const current = updated.find(o => o.id === id);
    if (current) setSelectedOpp(current);
  };

  const approveBoM = (id: string, approved: boolean) => {
    const updated = opportunities.map(o => o.id === id ? { 
      ...o, 
      bomStatus: (approved ? 'APPROVED' : 'REJECTED') as any
    } : o);
    setOpportunities(updated);
    const current = updated.find(o => o.id === id);
    if (current) setSelectedOpp(current);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-slate-100 text-slate-500';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-600';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-600';
      case 'SUBMITTED': return 'bg-amber-100 text-amber-600';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-600';
      case 'REJECTED': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  if (activeTab === 'crm-customers') {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Müşteriler</h3>
            <p className="text-slate-500">Müşteri veritabanı ve detaylı firma bilgileri.</p>
          </div>
          <button 
            onClick={() => setShowNewCustomerModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus size={20} /> Yeni Müşteri Ekle
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h4 className="font-bold text-slate-900">Müşteri Listesi</h4>
            <div className="flex gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600"><Filter size={18} /></button>
              <button className="p-2 text-slate-400 hover:text-slate-600"><Search size={18} /></button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {(customers || MOCK_CUSTOMERS).map((customer) => (
              <div key={customer.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">{customer.name}</h5>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500">{customer.industry}</p>
                      <span className="text-slate-300">•</span>
                      <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Mail size={10} /> {customer.email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">İletişim Kişisi</p>
                    <p className="text-sm font-bold text-slate-900">{customer.contactPerson}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Risk Skoru</p>
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded-lg",
                      customer.riskScore > 40 ? "bg-red-100 text-red-600" :
                      customer.riskScore > 20 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {customer.riskScore}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-indigo-600 p-2">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* New Customer Modal */}
        <AnimatePresence>
          {showNewCustomerModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xl font-bold text-slate-900">Yeni Müşteri Ekle</h4>
                  <button onClick={() => setShowNewCustomerModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Firma Adı</label>
                      <input 
                        type="text" 
                        placeholder="Örn: TechCorp A.Ş."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Sektör</label>
                      <input 
                        type="text" 
                        placeholder="Örn: Finans"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, industry: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">İletişim Kişisi</label>
                      <input 
                        type="text" 
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, contactPerson: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">E-posta</label>
                      <input 
                        type="email" 
                        placeholder="Örn: ahmet@techcorp.com"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Telefon</label>
                      <input 
                        type="tel" 
                        placeholder="Örn: +90 555 123 4567"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Risk Skoru (0-100)</label>
                      <input 
                        type="number" 
                        min="0" max="100"
                        defaultValue={0}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        onChange={(e) => setNewCustomer({...newCustomer, riskScore: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Adres</label>
                    <textarea 
                      rows={3}
                      placeholder="Firma açık adresi..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                      onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    onClick={() => setShowNewCustomerModal(false)}
                    className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                  >
                    İptal
                  </button>
                  <button 
                    onClick={handleAddCustomer}
                    className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Müşteriyi Kaydet
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">CRM & Fırsat Takibi</h3>
          <p className="text-slate-500">Müşteri ilişkileri ve satış boru hattı yönetimi.</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} /> Yeni Fırsat
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Toplam Fırsat Değeri</p>
          <h4 className="text-2xl font-bold text-slate-900">
            ${opportunities.reduce((sum, o) => sum + o.value, 0).toLocaleString()}
          </h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Aktif Fırsat Sayısı</p>
          <h4 className="text-2xl font-bold text-slate-900">{opportunities.length}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ortalama Olasılık</p>
          <h4 className="text-2xl font-bold text-indigo-600">
            %{Math.round(opportunities.reduce((sum, o) => sum + o.probability, 0) / (opportunities.length || 1))}
          </h4>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="font-bold text-slate-900">Aktif Fırsatlar</h4>
          <div className="flex gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600"><Filter size={18} /></button>
            <button className="p-2 text-slate-400 hover:text-slate-600"><Search size={18} /></button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {opportunities.map((opp) => (
            <div key={opp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900">{opp.title}</h5>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">{(customers || MOCK_CUSTOMERS).find(c => c.id === opp.customerId)?.name}</p>
                    <span className="text-slate-300">•</span>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Users size={10} /> {MOCK_SYSTEM_USERS.find(u => u.id === opp.createdBy)?.name}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="hidden lg:block text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Teknik / BoM</p>
                  <div className="flex gap-1 mt-1">
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", getStatusBadge(opp.technicalStatus))}>
                      Teknik: {opp.technicalStatus}
                    </span>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", getStatusBadge(opp.bomStatus))}>
                      BoM: {opp.bomStatus}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Değer</p>
                  <p className="text-sm font-bold text-slate-900">${opp.value.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Durum</p>
                  <select 
                    value={opp.status}
                    onChange={(e) => updateStatus(opp.id, e.target.value as Opportunity['status'])}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none cursor-pointer",
                      opp.status === 'WON' ? "bg-emerald-100 text-emerald-700" : 
                      opp.status === 'LOST' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    )}
                  >
                    <option value="NEW">Yeni</option>
                    <option value="QUALIFIED">Kalifiye</option>
                    <option value="PROPOSAL">Teklif</option>
                    <option value="NEGOTIATION">Pazarlık</option>
                    <option value="WON">Kazanıldı</option>
                    <option value="LOST">Kaybedildi</option>
                  </select>
                </div>
                <button 
                  onClick={() => {
                    setSelectedOpp(opp);
                    setShowDetailModal(true);
                  }}
                  className="text-slate-400 hover:text-indigo-600 p-2"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
          <AlertCircle size={24} />
        </div>
        <div>
          <h5 className="font-bold text-amber-900">Otomatik İş Akışı Bilgisi</h5>
          <p className="text-sm text-amber-700 mt-1">
            Fırsat durumu <strong>"Kazanıldı"</strong> olarak güncellendiğinde, sistem otomatik olarak projeyi <strong>Sözleşme Yönetimi</strong> modülüne aktarır ve Satış Destek ekibine bildirim gönderir.
          </p>
        </div>
      </div>

      {/* Opportunity Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{selectedOpp.title}</h4>
                    <p className="text-xs text-slate-500">{(customers || MOCK_CUSTOMERS).find(c => c.id === selectedOpp.customerId)?.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Satış Sorumlusu</p>
                    <p className="text-sm font-bold text-slate-900">{MOCK_SYSTEM_USERS.find(u => u.id === selectedOpp.assignedTo)?.name}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Presales Sorumlusu</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">
                        {selectedOpp.presalesId ? MOCK_SYSTEM_USERS.find(u => u.id === selectedOpp.presalesId)?.name : 'Atanmadı'}
                      </p>
                      {!selectedOpp.presalesId && (
                        <button 
                          onClick={() => assignPresales(selectedOpp.id, 'user2')}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          Ata (Mehmet Öz)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">BoM Durumu</p>
                    <span className={cn("text-xs font-bold px-2 py-1 rounded-lg uppercase", getStatusBadge(selectedOpp.bomStatus))}>
                      {selectedOpp.bomStatus}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-900 flex items-center gap-2">
                      <FileSearch size={18} className="text-indigo-600" />
                      Muhtemel BoM Listesi
                    </h5>
                    {selectedOpp.presalesId && selectedOpp.bomStatus === 'DRAFT' && (
                      <button 
                        onClick={() => submitBoM(selectedOpp.id)}
                        className="text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                      >
                        <ArrowUpRight size={14} /> Onaya Gönder
                      </button>
                    )}
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase text-[10px]">Parça No</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase text-[10px]">Açıklama</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase text-[10px] text-center">Adet</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase text-[10px] text-right">Maliyet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {MOCK_BOM_ITEMS.filter(i => i.opportunityId === selectedOpp.id).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">{item.partNumber}</td>
                            <td className="px-4 py-3 text-slate-600">{item.description}</td>
                            <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">${item.purchaseCost.toLocaleString()}</td>
                          </tr>
                        ))}
                        {MOCK_BOM_ITEMS.filter(i => i.opportunityId === selectedOpp.id).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                              Henüz teknik detaylandırma yapılmamış.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedOpp.bomStatus === 'SUBMITTED' && (
                  <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-3 text-indigo-900">
                      <div className="p-2 bg-indigo-100 rounded-xl"><FileCheck2 size={20} /></div>
                      <div>
                        <h5 className="font-bold">Yönetici Onayı Bekliyor</h5>
                        <p className="text-xs text-indigo-700">Presales ekibi BoM listesini tamamladı. Satış birim yöneticisi onayı gereklidir.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => approveBoM(selectedOpp.id, true)}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        Onayla
                      </button>
                      <button 
                        onClick={() => approveBoM(selectedOpp.id, false)}
                        className="flex-1 py-3 bg-white text-red-600 border border-red-200 rounded-2xl text-sm font-bold hover:bg-red-50 transition-all"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h5 className="font-bold text-slate-900 flex items-center gap-2">
                    <Target size={18} className="text-indigo-600" />
                    İş Emirleri ve İlerlemeler
                  </h5>
                  <div className="space-y-3">
                    <TaskProgressTracker 
                      tasks={tasks || []} 
                      setTasks={setTasks!} 
                      relatedModule="OPPORTUNITY" 
                      relatedItemId={selectedOpp.id} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Opportunity Modal */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Fırsat Ekle</h4>
                <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Fırsat Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Veri Merkezi Modernizasyonu"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewOpp({...newOpp, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Müşteri</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewOpp({...newOpp, customerId: e.target.value})}
                    >
                      <option value="">Seçiniz</option>
                      {(customers || MOCK_CUSTOMERS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Tahmini Değer ($)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewOpp({...newOpp, value: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Olasılık (%)</label>
                    <input 
                      type="number" 
                      min="0" max="100"
                      defaultValue={10}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewOpp({...newOpp, probability: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Beklenen Kapanış</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewOpp({...newOpp, expectedCloseDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Açıklama</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewOpp({...newOpp, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddOpportunity}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Fırsatı Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMModule;
