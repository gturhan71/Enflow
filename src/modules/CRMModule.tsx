import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  X,
  TrendingUp,
  DollarSign,
  Briefcase,
  Mail,
  Filter,
  Target,
  FileSignature,
  FileCheck2,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import {
  MOCK_CUSTOMERS,
  MOCK_SYSTEM_USERS,
  MOCK_BOM_ITEMS,
} from '../constants';
import {
  TodoTask,
  Opportunity,
} from '../types';
import ProposalEditor from './ProposalEditor';
import { TaskProgressTracker } from '../components/TaskProgressTracker';
import { PermissionGate } from '../components/PermissionGate';

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
  const [showProposalEditor, setShowProposalEditor] = useState(false);
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

  const updateStatus = (id: string, status: Opportunity['status']) => {
    setOpportunities(opportunities.map(o => o.id === id ? { ...o, status } : o));
  };

  const assignPresales = (id: string, presalesId: string) => {
    setOpportunities(opportunities.map(o => o.id === id ? { ...o, presalesId, technicalStatus: 'IN_PROGRESS' } : o));
  };

  const submitBoM = (id: string) => {
    setOpportunities(opportunities.map(o => o.id === id ? { ...o, bomStatus: 'SUBMITTED', technicalStatus: 'COMPLETED' } : o));
  };

  const approveBoM = (id: string, approved: boolean) => {
    setOpportunities(opportunities.map(o => o.id === id ? { ...o, bomStatus: approved ? 'APPROVED' : 'REJECTED' } : o));
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

  // --- SUB-TAB: OPPORTUNITIES ---
  const renderOpportunities = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Fırsat Takibi</h3>
          <p className="text-slate-500">Satış boru hattı ve aktif fırsatlar.</p>
        </div>
        <PermissionGate permission="CRM_EDIT">
          <button onClick={() => setShowNewModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={20} /> Yeni Fırsat
          </button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Pipeline Değeri', value: `$${opportunities.reduce((sum, o) => sum + o.value, 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Aktif Fırsat', value: opportunities.length, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Bekleyen BoM', value: opportunities.filter(o => o.bomStatus === 'SUBMITTED').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Kazanma Olasılığı', value: `%${Math.round(opportunities.reduce((sum, o) => sum + o.probability, 0) / (opportunities.length || 1))}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-3xl flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden bg-white shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="font-bold text-slate-900">Aktif Satış Boru Hattı</h4>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Ara..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500" />
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600"><Filter size={18} /></button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {opportunities.map((opp) => (
            <div key={opp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setSelectedOpp(opp); setShowDetailModal(true); }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Briefcase size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900">{opp.title}</h5>
                  <p className="text-xs text-slate-500">{(customers || MOCK_CUSTOMERS).find(c => c.id === opp.customerId)?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">BoM Durumu</p>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase block mt-1", getStatusBadge(opp.bomStatus))}>
                    {opp.bomStatus}
                  </span>
                </div>
                <div className="text-right w-24">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Değer</p>
                  <p className="text-sm font-bold text-slate-900">${opp.value.toLocaleString()}</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Aşama</p>
                  <span className={cn(
                    "text-[10px] font-bold px-3 py-1 rounded-lg block mt-1 text-center",
                    opp.status === 'WON' ? "bg-emerald-100 text-emerald-700" :
                    opp.status === 'LOST' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {opp.status}
                  </span>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- SUB-TAB: PROPOSALS ---
  const renderProposals = () => {
    const proposals = opportunities.filter(o => o.bomStatus === 'APPROVED' || o.status === 'PROPOSAL');
    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Teklif Yönetimi</h3>
          <p className="text-slate-500">Hazırlanan ve onaylanan fiyat teklifleri.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {proposals.map(opp => (
            <div key={opp.id} className="glass-panel p-6 rounded-3xl bg-white border border-slate-200 hover:border-indigo-300 transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <FileSignature size={24} />
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  opp.status === 'PROPOSAL' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  {opp.status === 'PROPOSAL' ? 'SUNULDU' : 'TEKLİF BEKLİYOR'}
                </span>
              </div>
              <h5 className="font-bold text-slate-900 text-lg mb-1">{opp.title}</h5>
              <p className="text-sm text-slate-500 mb-6">{(customers || MOCK_CUSTOMERS).find(c => c.id === opp.customerId)?.name}</p>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Teklif Değeri</p>
                  <p className="text-lg font-black text-slate-900">${opp.value.toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => { setSelectedOpp(opp); setShowProposalEditor(true); }}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  {opp.status === 'PROPOSAL' ? 'Teklifi Güncelle' : 'Teklif Hazırla'}
                </button>
              </div>
            </div>
          ))}
          {proposals.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400">
              <FileSignature size={48} className="mx-auto mb-4 opacity-10" />
              <p>Teklif aşamasında fırsat bulunmuyor.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- SUB-TAB: CUSTOMERS ---
  const renderCustomers = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Müşteri Portföyü</h3>
          <p className="text-slate-500">Kayıtlı firmalar ve iletişim bilgileri.</p>
        </div>
        <PermissionGate permission="CRM_EDIT">
          <button onClick={() => setShowNewCustomerModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={20} /> Yeni Müşteri
          </button>
        </PermissionGate>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(customers || MOCK_CUSTOMERS).map(customer => (
          <div key={customer.id} className="glass-panel p-6 rounded-3xl bg-white border border-slate-200 group hover:border-indigo-300 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center transition-colors">
                <Users size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-slate-900 truncate">{customer.name}</h5>
                <p className="text-xs text-slate-500 truncate">{customer.industry}</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail size={14} className="text-slate-400" /> {customer.email}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock size={14} className="text-slate-400" /> Son Etkileşim: 2 gün önce
              </div>
            </div>
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                customer.riskScore > 40 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
              )}>
                Risk: {customer.riskScore}
              </span>
              <button className="text-indigo-600 text-xs font-bold hover:underline">Detaylar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (showProposalEditor && selectedOpp) {
    return (
      <ProposalEditor 
        opportunity={selectedOpp}
        bomItems={MOCK_BOM_ITEMS.filter(i => i.opportunityId === selectedOpp.id)}
        customers={customers || MOCK_CUSTOMERS}
        onSave={(data) => {
          setShowProposalEditor(false);
          updateStatus(selectedOpp.id, 'PROPOSAL');
        }}
        onCancel={() => setShowProposalEditor(false)}
      />
    );
  }

  return (
    <div className="h-full">
      {activeTab === 'crm-proposals' ? renderProposals() : 
       activeTab === 'crm-customers' ? renderCustomers() : 
       renderOpportunities()}

      {/* Opportunity Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <Briefcase size={20} />
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
                        <button onClick={() => assignPresales(selectedOpp.id, 'user2')} className="text-[10px] font-bold text-indigo-600 hover:underline">
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

                {selectedOpp.bomStatus === 'SUBMITTED' && (
                  <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-3 text-indigo-900">
                      <div className="p-2 bg-indigo-100 rounded-xl"><FileCheck2 size={20} /></div>
                      <div>
                        <h5 className="font-bold">Yönetici Onayı Bekliyor</h5>
                        <p className="text-xs text-indigo-700">BoM listesi hazır. Yönetici onayı sonrası teklif oluşturulabilir.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => approveBoM(selectedOpp.id, true)} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100">Onayla</button>
                      <button onClick={() => approveBoM(selectedOpp.id, false)} className="flex-1 py-3 bg-white text-red-600 border border-red-200 rounded-2xl text-sm font-bold hover:bg-red-50">Reddet</button>
                    </div>
                  </div>
                )}

                {selectedOpp.bomStatus === 'APPROVED' && (
                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-emerald-900">
                      <div className="p-2 bg-emerald-100 rounded-xl"><CheckCircle2 size={20} /></div>
                      <div>
                        <h5 className="font-bold">BoM Onaylandı</h5>
                        <p className="text-xs text-emerald-700">Teknik detaylandırma tamam. Teklif hazırlamaya geçebilirsiniz.</p>
                      </div>
                    </div>
                    <button onClick={() => setShowProposalEditor(true)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 flex items-center gap-2">
                      <FileSignature size={14} /> Teklif Hazırla
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <h5 className="font-bold text-slate-900 flex items-center gap-2">
                    <Target size={18} className="text-indigo-600" />
                    Görevler ve Takip
                  </h5>
                  <TaskProgressTracker tasks={tasks || []} setTasks={setTasks!} relatedModule="OPPORTUNITY" relatedItemId={selectedOpp.id} />
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
              <h4 className="text-xl font-bold text-slate-900">Yeni Fırsat Ekle</h4>
              <div className="space-y-4">
                <input type="text" placeholder="Fırsat Başlığı" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500" />
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500">
                  <option value="">Müşteri Seçin</option>
                  {(customers || MOCK_CUSTOMERS).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Değer ($)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500" />
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                <button className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Kaydet</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Customer Modal */}
      <AnimatePresence>
        {showNewCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
              <h4 className="text-xl font-bold text-slate-900">Yeni Müşteri</h4>
              <div className="space-y-4">
                <input type="text" placeholder="Firma Adı" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500" />
                <input type="email" placeholder="E-posta" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewCustomerModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                <button className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Kaydet</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMModule;
