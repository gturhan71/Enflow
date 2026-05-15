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
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  MOCK_BOM_ITEMS,
} from '../constants';
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
  customers: Customer[],
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [customerTab, setCustomerTab] = useState<'BASIC' | 'FINANCIAL' | 'TECH'>('BASIC');

  // Optimization: useSearch hook for unified filtering logic
  const customerSearch = useSearch(customers, ['name', 'shortName', 'industry']);
  const opportunitySearch = useSearch(opportunities, ['title', 'description']);

  // Refactor: useForm hook for modal inputs
  const customerForm = useForm<Partial<Customer>>({
    name: '', shortName: '', industry: '', website: '', email: '', phone: '',
    address: '', city: '', country: 'Türkiye', taxOffice: '', taxNumber: '',
    riskScore: 0, creditLimit: 0, currency: 'USD', techStack: '', notes: ''
  });

  const opportunityForm = useForm<Partial<Opportunity>>({
    title: '', value: 0, probability: 50, customerId: '', description: '', status: 'NEW'
  });

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

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunityForm.values.customerId) return alert('Lütfen bir müşteri seçin.');
    setLoading(true);
    try {
      const saved = await apiService.createOpportunity({
        ...opportunityForm.values,
        assignedToId: currentUser?.id,
        createdById: currentUser?.id
      });
      setOpportunities(prev => [...prev, saved]);
      setShowNewOpportunityModal(false);
      opportunityForm.resetForm();
    } catch (err: any) {
      alert(err.message || 'Fırsat kaydedilemedi.');
    } finally {
      setLoading(false);
    }
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

  // --- SUB-TAB: OPPORTUNITIES ---
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
            <button onClick={() => setShowNewOpportunityModal(true)} className="bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest">
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
                <div className="flex flex-col items-end">
                  <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", getStatusStyle(opp.status))}>
                    {opp.status}
                  </span>
                  <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Olasılık: %{opp.probability}</p>
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
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Beklenen</span>
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

  // --- SUB-TAB: CUSTOMERS ---
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

  if (showProposalEditor && selectedOpp) {
    return (
      <ProposalEditor 
        opportunity={selectedOpp}
        bomItems={MOCK_BOM_ITEMS.filter(i => i.opportunityId === selectedOpp.id)}
        customers={customers}
        onSave={() => setShowProposalEditor(false)}
        onCancel={() => setShowProposalEditor(false)}
      />
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      {activeTab === 'crm-proposals' ? (
        <div className="p-8 flex items-center justify-center h-full text-slate-300 font-black uppercase tracking-widest italic">Teklif modülü çok yakında...</div>
      ) : activeTab === 'crm-customers' ? (
        renderCustomers()
      ) : (
        renderOpportunities()
      )}

      {/* NEW CUSTOMER MODAL */}
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
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Müşteri Veri Girişi</p>
                  </div>
                </div>
                <button onClick={() => setShowNewCustomerModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex px-8 pt-6 gap-2">
                {['BASIC', 'FINANCIAL', 'TECH'].map(id => (
                  <button
                    key={id}
                    onClick={() => setCustomerTab(id as any)}
                    className={cn(
                      "px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all",
                      customerTab === id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {id === 'BASIC' ? 'GENEL' : id === 'FINANCIAL' ? 'FİNANS' : 'TEKNİK'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                 {customerTab === 'BASIC' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Firma Adı</label>
                          <input type="text" name="name" required value={customerForm.values.name} onChange={customerForm.handleChange} placeholder="Firma Tam Adı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kısa Ad</label>
                          <input type="text" name="shortName" value={customerForm.values.shortName} onChange={customerForm.handleChange} placeholder="Örn: T-Ecosystem" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">E-posta</label>
                          <input type="email" name="email" value={customerForm.values.email} onChange={customerForm.handleChange} placeholder="info@firma.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Telefon</label>
                          <input type="text" name="phone" value={customerForm.values.phone} onChange={customerForm.handleChange} placeholder="+90" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Adres</label>
                        <textarea name="address" rows={3} value={customerForm.values.address} onChange={customerForm.handleChange} placeholder="Detaylı Adres" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none resize-none focus:ring-4 focus:ring-primary/5" />
                      </div>
                    </div>
                 )}
                 {customerTab === 'FINANCIAL' && (
                   <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kredi Limiti</label>
                         <input type="number" name="creditLimit" value={customerForm.values.creditLimit} onChange={customerForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Para Birimi</label>
                         <select name="currency" value={customerForm.values.currency} onChange={customerForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5">
                           <option value="USD">USD</option>
                           <option value="EUR">EUR</option>
                           <option value="TRY">TRY</option>
                         </select>
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vergi Numarası</label>
                         <input type="text" name="taxNumber" value={customerForm.values.taxNumber} onChange={customerForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Risk Skoru (0-100)</label>
                         <input type="number" name="riskScore" value={customerForm.values.riskScore} onChange={customerForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                       </div>
                     </div>
                   </div>
                 )}
              </form>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
                >
                  İPTAL
                </button>
                <button 
                  onClick={handleSaveCustomer}
                  className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'MÜŞTERİYİ KAYDET'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW OPPORTUNITY MODAL */}
      <AnimatePresence>
        {showNewOpportunityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Target size={24} />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Satış Fırsatı</h4>
                </div>
                <button onClick={() => setShowNewOpportunityModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveOpportunity} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fırsat Başlığı</label>
                  <input type="text" name="title" required value={opportunityForm.values.title} onChange={opportunityForm.handleChange} placeholder="Örn: Sunucu Yenileme Projesi" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Müşteri Seçin</label>
                  <select name="customerId" required value={opportunityForm.values.customerId} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 appearance-none">
                    <option value="">Müşteri Seçin...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Tahmini Değer (USD)</label>
                    <input type="number" name="value" required value={opportunityForm.values.value} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Olasılık (%)</label>
                    <input type="number" name="probability" min="0" max="100" required value={opportunityForm.values.probability} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowNewOpportunityModal(false)} className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800">İPTAL</button>
                  <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase tracking-widest flex items-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'FIRSATI OLUŞTUR'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMModule;
