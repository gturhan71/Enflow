import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  Target,
  ArrowRight,
  Building,
  Globe,
  Mail,
  Phone,
  MapPin,
  Loader2,
  TrendingUp,
  DollarSign,
  Edit2,
  FileSignature,
  Download,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  TodoTask,
  Opportunity,
  Customer,
} from '../types';
import ProposalEditor from './ProposalEditor';
import { PermissionGate } from '../components/PermissionGate';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useSearch, useForm } from '../hooks/useShared';

const CRMModule = ({
  opportunities = [],
  setOpportunities,
  customers = [],
  setCustomers,
  proposals = [],
  setProposals,
  activeTab = 'crm-opportunities',
  tasks = [],
  setTasks,
  setActiveTab
}: {
  opportunities: Opportunity[],
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>,
  customers: Customer[],
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>,
  proposals: any[],
  setProposals: React.Dispatch<React.SetStateAction<any[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  setActiveTab?: (tab: string) => void
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false);
  const [customerTab, setCustomerTab] = useState<'BASIC' | 'FINANCIAL' | 'TECH'>('BASIC');

  const customerSearch = useSearch(customers, ['name', 'shortName', 'industry']);
  const opportunitySearch = useSearch(opportunities, ['title', 'description']);

  const handleSaveProposal = async (proposalData: any) => {
    if (!selectedOpp) return;
    setLoading(true);
    try {
      const saved = await apiService.createProposal({
        ...proposalData,
        opportunityId: selectedOpp.id,
        customerId: selectedOpp.customerId,
        createdById: currentUser?.id
      });
      setProposals(prev => [...(prev || []), saved]);
      setShowProposalEditor(false);
      setSelectedOpp(null);
    } catch (err: any) {
      alert(err.message || 'Teklif kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const customerForm = useForm<Partial<Customer>>({
    name: '', shortName: '', industry: '', website: '', email: '', phone: '',
    address: '', city: '', country: 'Türkiye', taxOffice: '', taxNumber: '',
    riskScore: 0, creditLimit: 0, currency: 'USD', techStack: '', notes: ''
  });

  const opportunityForm = useForm<Partial<Opportunity>>({
    title: '', value: 0, probability: 50, customerId: '', description: '', status: 'NEW'
  });

  const handleRevertApproval = async (oppId: string) => {
    if (!window.confirm('Onayı geri alıp revizyon aşamasına geçmek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await apiService.revertOpportunityApproval(oppId);
      setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, technicalStatus: 'PENDING' } : o));
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = await apiService.createCustomer(customerForm.values);
      setCustomers(prev => [...prev, saved]);
      setShowNewCustomerModal(false);
      customerForm.resetForm();
    } catch (err: any) {
      alert(err.message || 'Müşteri kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleWonProposal = async (proposal: any) => {
    if (!window.confirm('Bu teklifi KAZANILDI olarak işaretlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await apiService.updateProposal(proposal.id, { status: 'ACCEPTED' });
      await apiService.updateOpportunity(proposal.opportunityId, { status: 'WON' });
      
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'ACCEPTED' } : p));
      setOpportunities(prev => prev.map(o => o.id === proposal.opportunityId ? { ...o, status: 'WON' } : o));
      
      alert('Tebrikler! Teklif kazanıldı. Sözleşme yönetimi modülüne yönlendiriliyorsunuz.');
      if (setActiveTab) setActiveTab('contract');
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleLostProposal = async (proposal: any) => {
    if (!window.confirm('Bu teklifi KAYBEDİLDİ olarak işaretlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await apiService.updateProposal(proposal.id, { status: 'REJECTED' });
      await apiService.updateOpportunity(proposal.opportunityId, { status: 'LOST' });
      
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'REJECTED' } : p));
      setOpportunities(prev => prev.map(o => o.id === proposal.opportunityId ? { ...o, status: 'LOST' } : o));
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const [isEditingOpp, setIsEditingOpp] = useState(false);

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunityForm.values.customerId) return alert('Lütfen bir müşteri seçin.');
    setLoading(true);
    try {
      if (isEditingOpp && selectedOpp) {
        const updated = await apiService.updateOpportunity(selectedOpp.id, {
          ...opportunityForm.values,
          updatedBy: currentUser?.id
        });
        setOpportunities(prev => prev.map(o => o.id === updated.id ? updated : o));
      } else {
        const saved = await apiService.createOpportunity({
          ...opportunityForm.values,
          assignedToId: currentUser?.id,
          createdById: currentUser?.id
        });
        setOpportunities(prev => [...prev, saved]);
      }
      setShowNewOpportunityModal(false);
      setIsEditingOpp(false);
      opportunityForm.resetForm();
    } catch (err: any) {
      alert(err.message || 'Fırsat kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const openEditOpportunity = (opp: Opportunity) => {
    setSelectedOpp(opp);
    opportunityForm.setValues({
      title: opp.title,
      value: opp.value,
      probability: opp.probability,
      customerId: opp.customerId,
      description: opp.description || '',
      status: opp.status
    });
    setIsEditingOpp(true);
    setShowNewOpportunityModal(true);
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      'NEW': 'bg-blue-50 text-blue-600 border-blue-100',
      'QUALIFIED': 'bg-primary/10 text-primary border-primary/20',
      'PROPOSAL': 'bg-amber-50 text-amber-600 border-amber-100',
      'NEGOTIATION': 'bg-purple-50 text-purple-600 border-purple-100',
      'WON': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'LOST': 'bg-red-50 text-red-600 border-red-100',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border-slate-100';
  };

  // --- RENDER HELPERS ---

  const renderOpportunities = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Satış Boru Hattı</h3>
          <p className="text-slate-500 font-medium text-sm">Aktif fırsatlar ve potansiyel gelir analizi.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Fırsat ara..." 
              value={opportunitySearch.searchQuery}
              onChange={(e) => opportunitySearch.setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none w-64 transition-all border-white/40 glass-card"
            />
          </div>
          <PermissionGate permission="CRM_EDIT">
            <button 
              onClick={() => {
                opportunityForm.resetForm();
                setIsEditingOpp(false);
                setShowNewOpportunityModal(true);
              }} 
              className="bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
            >
              <Plus size={18} /> Yeni Fırsat
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {opportunitySearch.filteredItems.map(opp => {
          const customer = customers.find(c => c.id === opp.customerId);
          return (
            <motion.div 
              layout
              key={opp.id} 
              className="glass-panel p-8 rounded-[32px] group hover:border-primary/40 transition-all relative overflow-hidden flex flex-col shadow-sm hover:shadow-xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target size={28} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <PermissionGate permission="CRM_EDIT">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditOpportunity(opp); }} 
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
                        title="Düzenle"
                      >
                        <Edit2 size={14} />
                      </button>
                    </PermissionGate>
                    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", getStatusStyle(opp.status))}>
                      {opp.status}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Olasılık: %{opp.probability}</p>
                </div>
              </div>

              <h5 className="font-black text-slate-900 text-lg mb-1 leading-tight line-clamp-2">{opp.title}</h5>
              <p className="text-xs text-slate-500 font-bold mb-6 flex items-center gap-2">
                <Building size={14} className="text-slate-400" /> {customer?.name || 'Bilinmeyen Müşteri'}
              </p>

              <div className="mt-auto space-y-4">
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tahmini Değer</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-lg font-black text-slate-900">{opp.value?.toLocaleString()} $</p>
                    <p className="text-xs font-black text-emerald-600">{(opp.value * (opp.probability / 100))?.toLocaleString()} $</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedOpp(opp);
                    setShowProposalEditor(true);
                  }}
                  className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-primary transition-all flex items-center justify-center gap-2 group-hover:translate-y-0"
                >
                  Teklif Hazırla <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Müşteri Veri Merkezi</h3>
          <p className="text-slate-500 font-medium text-sm">Tüm birimlerin ortak erişebileceği genişletilmiş müşteri hafızası.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Müşteri ara..." 
              value={customerSearch.searchQuery}
              onChange={(e) => customerSearch.setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none w-64 transition-all border-white/40 glass-card"
            />
          </div>
          <PermissionGate permission="CRM_EDIT">
            <button onClick={() => setShowNewCustomerModal(true)} className="bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest">
              <Plus size={18} /> Yeni Müşteri
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customerSearch.filteredItems.map(customer => (
          <motion.div 
            layout
            key={customer.id} 
            className="glass-panel p-8 rounded-[32px] group hover:border-primary/40 transition-all relative overflow-hidden shadow-sm hover:shadow-xl"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
                <Building size={32} />
              </div>
              <div className="text-right">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                  customer.riskScore > 60 ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
                )}>
                  Risk: {customer.riskScore}/100
                </span>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{customer.industry}</p>
              </div>
            </div>

            <h5 className="font-black text-slate-900 text-lg mb-1 leading-tight">{customer.name}</h5>
            <p className="text-[10px] text-slate-500 mb-6 truncate flex items-center gap-1 font-bold italic">
               <Globe size={12} className="text-primary" /> {customer.website || 'Web sitesi yok'}
            </p>

            <div className="space-y-3 mb-8">
              {[
                { icon: Mail, val: customer.email },
                { icon: Phone, val: customer.phone },
                { icon: MapPin, val: `${customer.address}, ${customer.city}` }
              ].map((info, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                    <info.icon size={14} />
                  </div>
                  <span className="truncate">{info.val}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Kredi Limiti</p>
                <p className="text-sm font-black text-slate-900">{customer.creditLimit?.toLocaleString()} {customer.currency}</p>
              </div>
              <button className="text-primary text-[10px] font-black hover:underline tracking-widest uppercase italic">Arşivi Aç</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderProposals = () => {
    const approvedOpps = opportunities.filter(opp => opp.technicalStatus === 'APPROVED');

    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Teklif Yönetimi</h3>
            <p className="text-slate-500 font-medium text-sm">Teknik onayı tamamlanmış fırsatlar ve teklif arşivi.</p>
          </div>
          <button 
            onClick={() => setShowOpportunitySelector(true)}
            className="bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
          >
            <Plus size={18} /> YENİ TEKLİF OLUŞTUR
          </button>
        </div>

        <div>
          <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase mb-4 border-b border-slate-200 pb-2">ONAYLI FIRSATLAR</h4>
          {approvedOpps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-4 glass-panel rounded-[24px] border-dashed">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <FileSignature size={32} className="text-slate-200" />
              </div>
              <p className="font-black uppercase tracking-widest text-[10px] italic">Teklif bekleyen onaylı fırsat bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedOpps.map(opp => {
                const customer = customers.find(c => c.id === opp.customerId);
                return (
                  <motion.div 
                    layout
                    key={opp.id} 
                    className="glass-panel p-8 rounded-[32px] group hover:border-primary/40 transition-all relative overflow-hidden flex flex-col shadow-sm hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileSignature size={28} />
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
                        ONAYLI
                      </span>
                    </div>

                    <h5 className="font-black text-slate-900 text-lg mb-1 leading-tight line-clamp-2">{opp.title}</h5>
                    <p className="text-xs text-slate-500 font-bold mb-6 flex items-center gap-2">
                      <Building size={14} className="text-slate-400" /> {customer?.name || 'Bilinmeyen Müşteri'}
                    </p>

                    <div className="mt-auto space-y-4">
                      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fırsat Değeri</span>
                        </div>
                        <p className="text-lg font-black text-slate-900">{opp.value?.toLocaleString()} $</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => {
                            setSelectedOpp(opp);
                            setShowProposalEditor(true);
                          }}
                          className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-primary transition-all flex items-center justify-center gap-2 group-hover:translate-y-0"
                        >
                          TEKLİF DÜZENLE <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button 
                          onClick={() => handleRevertApproval(opp.id)}
                          className="w-full bg-white text-slate-500 border border-slate-200 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          ONAYI GERİ AL / REVİZE ET
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4">
          <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase mb-4 border-b border-slate-200 pb-2">Arşivlenmiş Teklifler</h4>
          {(!proposals || proposals.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-4 glass-panel rounded-[24px] border-dashed">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <FileSignature size={32} className="text-slate-200" />
              </div>
              <p className="font-black uppercase tracking-widest text-[10px] italic">Kayıtlı teklif bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proposals.map(proposal => {
                const oppName = proposal.opportunity?.title || 'Bilinmeyen Fırsat';
                const customerName = proposal.opportunity?.customer?.name || 'Bilinmeyen Müşteri';
                let amount = 0;
                
                try {
                  const content = typeof proposal.content === 'string' ? JSON.parse(proposal.content || '{}') : proposal.content;
                  amount = content?.totalPrice || proposal.totalAmount || 0;
                } catch(e) {
                  amount = proposal.totalAmount || 0;
                }

                return (
                  <motion.div 
                    layout
                    key={proposal.id} 
                    className="glass-panel p-6 rounded-[24px] group hover:border-primary/40 transition-all relative overflow-hidden flex flex-col shadow-sm hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileSignature size={24} />
                        </div>
                        <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          V{proposal.version || 1}
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        proposal.status === 'SENT' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        proposal.status === 'ACCEPTED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {proposal.status || 'DRAFT'}
                      </span>
                    </div>

                    <h5 className="font-black text-slate-900 text-md mb-1 leading-tight line-clamp-2">{oppName}</h5>
                    <p className="text-[10px] text-slate-500 font-bold mb-4 flex items-center gap-2">
                      <Building size={12} className="text-slate-400" /> {customerName}
                    </p>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Teklif Tutarı</p>
                        <p className="text-sm font-black text-slate-900">${amount.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        {proposal.status !== 'ACCEPTED' && proposal.status !== 'REJECTED' && (
                          <>
                            <button 
                              onClick={() => handleWonProposal(proposal)}
                              className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-1"
                              title="Kazanıldı"
                            >
                              <CheckCircle size={12} />
                            </button>
                            <button 
                              onClick={() => handleLostProposal(proposal)}
                              className="px-3 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-1"
                              title="Kaybedildi"
                            >
                              <XCircle size={12} />
                            </button>
                          </>
                        )}
                        <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all" title="İndir">
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => alert(`Teklif İnceleme:\n\nFırsat: ${oppName}\nMüşteri: ${customerName}\nTutar: $${amount.toLocaleString()}`)}
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-all"
                        >
                          İncele
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- MAIN RENDER LOGIC ---
  
  if (showProposalEditor && selectedOpp) {
    const oppProposals = Array.isArray(proposals) ? proposals.filter(p => p.opportunityId === selectedOpp.id) : [];
    const latestProposal = oppProposals.length > 0 
      ? [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0]
      : null;
    
    const nextVersion = latestProposal ? (latestProposal.version || 1) + 1 : 1;
    let initialData = undefined;
    
    if (latestProposal && latestProposal.content) {
      try {
        const content = typeof latestProposal.content === 'string' 
          ? JSON.parse(latestProposal.content) 
          : latestProposal.content;
          
        initialData = {
          items: content.items,
          terms: content.terms,
          description: content.description,
          totalPrice: content.totalPrice
        };
      } catch (e) {
        console.error("Failed to parse proposal content", e);
      }
    }

    return (
      <ProposalEditor 
        opportunity={selectedOpp}
        bomItems={selectedOpp.bomItems || []}
        costItems={selectedOpp.costItems || []}
        customers={customers}
        version={nextVersion}
        initialData={initialData}
        onSave={handleSaveProposal}
        onCancel={() => {
          setShowProposalEditor(false);
          setSelectedOpp(null);
        }}
      />
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      {activeTab === 'crm-proposals' ? renderProposals() : 
       activeTab === 'crm-customers' ? renderCustomers() : 
       renderOpportunities()}

      {/* MODALS */}
      <AnimatePresence>
        {showNewCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Building size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Yeni Kurumsal Kayıt</h4>
                  </div>
                </div>
                <button onClick={() => setShowNewCustomerModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <input type="text" name="name" required value={customerForm.values.name} onChange={customerForm.handleChange} placeholder="Firma Tam Adı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                  <input type="text" name="email" value={customerForm.values.email} onChange={customerForm.handleChange} placeholder="E-posta" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowNewCustomerModal(false)} className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">İPTAL</button>
                  <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg">KAYDET</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showNewOpportunityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">{isEditingOpp ? 'Fırsatı Düzenle' : 'Yeni Satış Fırsatı'}</h4>
                <button onClick={() => { setShowNewOpportunityModal(false); setIsEditingOpp(false); }} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveOpportunity} className="p-8 space-y-6">
                <input type="text" name="title" required value={opportunityForm.values.title} onChange={opportunityForm.handleChange} placeholder="Fırsat Başlığı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                <select name="customerId" required value={opportunityForm.values.customerId} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                  <option value="">Müşteri Seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowNewOpportunityModal(false); setIsEditingOpp(false); }} className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">İPTAL</button>
                  <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg">KAYDET</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showOpportunitySelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-xl w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-white/20"
            >
              <div className="p-8 border-b border-white/20 flex items-center justify-between">
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Teklif İçin Fırsat Seçin</h4>
                <button onClick={() => setShowOpportunitySelector(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
                {opportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON').map(opp => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      setSelectedOpp(opp);
                      setShowProposalEditor(true);
                      setShowOpportunitySelector(false);
                    }}
                    className="w-full text-left p-6 rounded-3xl bg-white border border-slate-100 hover:bg-primary hover:text-white transition-all group"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-black text-lg group-hover:text-white">{opp.title}</p>
                        <p className="text-xs opacity-70 group-hover:text-white/80">{customers.find(c => c.id === opp.customerId)?.name || 'Bilinmeyen Müşteri'}</p>
                      </div>
                      <p className="font-black text-md group-hover:text-white">{opp.value?.toLocaleString()} $</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMModule;
