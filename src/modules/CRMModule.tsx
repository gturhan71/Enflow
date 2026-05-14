import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
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
  Building,
  Globe,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  Layers,
  Link,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import {
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
import { apiService } from '../services/apiService';

const CRMModule = ({
  opportunities,
  setOpportunities,
  activeTab,
  tasks,
  setTasks
}: {
  opportunities: Opportunity[],
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [customerTab, setCustomerTab] = useState<'BASIC' | 'FINANCIAL' | 'TECH'>('BASIC');

  const [newCustomer, setNewCustomer] = useState<any>({
    name: '',
    shortName: '',
    industry: '',
    website: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Türkiye',
    taxOffice: '',
    taxNumber: '',
    riskScore: 0,
    creditLimit: 0,
    currency: 'USD',
    techStack: '',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await apiService.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Müşteriler yüklenemedi');
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = await apiService.createCustomer(newCustomer);
      setCustomers([...customers, saved]);
      setShowNewCustomerModal(false);
      setNewCustomer({ name: '', country: 'Türkiye', riskScore: 0, creditLimit: 0, currency: 'USD' });
      alert('Müşteri tüm detaylarıyla sisteme kaydedildi.');
    } catch (err: any) {
      alert(err.message || 'Müşteri kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-slate-100 text-slate-500';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-600';
      case 'SUBMITTED': return 'bg-amber-100 text-amber-600';
      case 'REJECTED': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  // --- SUB-TAB: CUSTOMERS (DETAILED) ---
  const renderCustomers = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">MÜŞTERİ VERİ MERKEZİ</h3>
          <p className="text-slate-500 font-medium">Tüm birimlerin ortak erişebileceği genişletilmiş müşteri hafızası.</p>
        </div>
        <PermissionGate permission="CRM_EDIT">
          <button onClick={() => setShowNewCustomerModal(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-[28px] text-sm font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} /> Yeni Müşteri Kaydı
          </button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {customers.map(customer => (
          <motion.div 
            layout
            key={customer.id} 
            className="glass-panel p-8 rounded-[40px] bg-white border border-slate-100 group hover:border-indigo-400 transition-all relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-3xl flex items-center justify-center transition-colors">
                <Building size={32} />
              </div>
              <div className="text-right">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  customer.riskScore > 60 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  Risk: {customer.riskScore}/100
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{customer.industry}</p>
              </div>
            </div>

            <h5 className="font-black text-slate-900 text-lg mb-1 leading-tight">{customer.name}</h5>
            <p className="text-xs text-slate-500 mb-6 truncate flex items-center gap-1">
               <Globe size={12} /> {customer.website || 'Web sitesi yok'}
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Mail size={14} /></div>
                {customer.email}
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Phone size={14} /></div>
                {customer.phone}
              </div>
              <div className="flex items-start gap-3 text-xs font-medium text-slate-600">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0"><MapPin size={14} /></div>
                <span className="line-clamp-2">{customer.address}, {customer.city}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Kredi Limiti</p>
                <p className="text-sm font-black text-slate-900">{customer.creditLimit?.toLocaleString()} {customer.currency}</p>
              </div>
              <button className="text-indigo-600 text-xs font-black hover:underline tracking-widest uppercase">Detaylı Arşiv</button>
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
    <div className="h-full">
      {activeTab === 'crm-proposals' ? (
        <div className="p-8">Teklifler sayfası...</div>
      ) : activeTab === 'crm-customers' ? (
        renderCustomers()
      ) : (
        <div className="p-8">Fırsatlar sayfası...</div>
      )}

      {/* NEW CUSTOMER MODAL (MAXIMUM DATA) */}
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
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Building size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Yeni Kurumsal Kayıt</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Merkezi Müşteri Veri Girişi</p>
                  </div>
                </div>
                <button onClick={() => setShowNewCustomerModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex px-8 pt-6 gap-2">
                {[
                  { id: 'BASIC', label: 'GENEL BİLGİLER', icon: Building },
                  { id: 'FINANCIAL', label: 'FİNANS & RESMİ', icon: CreditCard },
                  { id: 'TECH', label: 'TEKNİK & NOTLAR', icon: Layers },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCustomerTab(t.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all",
                      customerTab === t.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    <t.icon size={16} /> {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-8">
                <AnimatePresence mode="wait">
                  {customerTab === 'BASIC' && (
                    <motion.div key="basic" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Firma Resmi Adı</label>
                          <input type="text" required value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Örn: T-Ecosystem Teknoloji A.Ş." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Marka / Kısa Ad</label>
                          <input type="text" value={newCustomer.shortName} onChange={(e) => setNewCustomer({...newCustomer, shortName: e.target.value})} placeholder="Örn: T-Ecosystem" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Sektör</label>
                          <select value={newCustomer.industry} onChange={(e) => setNewCustomer({...newCustomer, industry: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20">
                            <option value="">Sektör Seçin</option>
                            <option value="Teknoloji">Teknoloji</option>
                            <option value="Finans">Finans</option>
                            <option value="Üretim">Üretim</option>
                            <option value="Enerji">Enerji</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Web Sitesi</label>
                          <input type="url" value={newCustomer.website} onChange={(e) => setNewCustomer({...newCustomer, website: e.target.value})} placeholder="https://..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Genel E-posta</label>
                          <input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} placeholder="info@firma.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Telefon</label>
                          <input type="text" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="+90..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Açık Adres</label>
                        <textarea rows={3} value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="Firma merkez adresi..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                      </div>
                    </motion.div>
                  )}

                  {customerTab === 'FINANCIAL' && (
                    <motion.div key="financial" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vergi Dairesi</label>
                          <input type="text" value={newCustomer.taxOffice} onChange={(e) => setNewCustomer({...newCustomer, taxOffice: e.target.value})} placeholder="Daire Adı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Vergi Numarası / VKNo</label>
                          <input type="text" value={newCustomer.taxNumber} onChange={(e) => setNewCustomer({...newCustomer, taxNumber: e.target.value})} placeholder="10 Haneli No" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Maksimum Kredi Limiti</label>
                          <input type="number" value={newCustomer.creditLimit} onChange={(e) => setNewCustomer({...newCustomer, creditLimit: Number(e.target.value)})} placeholder="0.00" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Çalışma Para Birimi</label>
                          <select value={newCustomer.currency} onChange={(e) => setNewCustomer({...newCustomer, currency: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20">
                            <option value="USD">USD - Amerikan Doları</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="TRY">TRY - Türk Lirası</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İç Risk Skoru (0-100)</label>
                        <input type="range" min="0" max="100" value={newCustomer.riskScore} onChange={(e) => setNewCustomer({...newCustomer, riskScore: Number(e.target.value)})} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mt-2">
                          <span>Güvenli (0)</span>
                          <span className="text-indigo-600">Skor: {newCustomer.riskScore}</span>
                          <span>Riskli (100)</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {customerTab === 'TECH' && (
                    <motion.div key="tech" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kullandığı Teknolojiler (Tech Stack)</label>
                        <textarea rows={4} value={newCustomer.techStack} onChange={(e) => setNewCustomer({...newCustomer, techStack: e.target.value})} placeholder="Örn: Cisco, Dell, Microsoft 365, VMware..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Özel Operasyonel Notlar</label>
                        <textarea rows={4} value={newCustomer.notes} onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})} placeholder="Lojistik kısıtları, özel faturalama talepleri vb..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewCustomerModal(false)} className="px-8 py-3 text-sm font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors">İPTAL</button>
                <button 
                  onClick={handleSaveCustomer}
                  disabled={loading || !newCustomer.name}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <><Save size={20} /> KAYDI TAMAMLA</>}
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
