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
  XCircle,
  GitBranch,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  TodoTask,
  Opportunity,
  Customer,
  Proposal,
} from '../types';
import ProposalEditor from './ProposalEditor';
import NegotiationModule from './NegotiationModule';
import { HandOffModal } from '../components/HandOffModal';
import { SaveButton } from '../components/SaveButton';
import { workflowService } from '../services/workflowService';
import { PermissionGate } from '../components/PermissionGate';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useSearch, useForm } from '../hooks/useShared';
import { CustomerImportWizard } from '../components/CustomerImportWizard';
import { generateProposalPDF } from '../utils/generateProposalPDF';

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
  proposals: Proposal[],
  setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  setActiveTab?: (tab: string) => void
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false);
  const [showHandOffModal, setShowHandOffModal] = useState(false);
  const [handOffTarget, setHandOffTarget] = useState<Opportunity | null>(null);

  const handleHandOff = async (data: { toUnit: string; toUser: { id: string; name: string }; note: string }) => {
    if (!handOffTarget || !currentUser) return;
    await workflowService.triggerHandOff({
      itemId: handOffTarget.id,
      itemTitle: handOffTarget.title,
      fromUnit: 'unit_sales', // Demo: Satış birimi
      toUnit: data.toUnit,
      fromUser: { id: currentUser.id, name: currentUser.name },
      toUser: data.toUser,
      note: data.note
    });
    setShowHandOffModal(false);
    setHandOffTarget(null);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      await apiService.saveCRMData({ opportunities, customers, proposals });
      alert('Tüm CRM verileri başarıyla kaydedildi.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const customerSearch = useSearch(customers, ['name', 'shortName', 'industry']);
  const opportunitySearch = useSearch(opportunities, ['title', 'description']);

  const handleSaveProposal = async (proposalData: Omit<Proposal, 'id'>) => {
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Teklif kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const customerForm = useForm<Partial<Customer>>({
    name: '', shortName: '', industry: '', website: '', email: '', phone: '',
    address: '', city: '', country: 'Türkiye', taxOffice: '', taxNumber: '',
    riskScore: 0, creditLimit: 0, currency: 'USD', techStack: '', notes: '',
    status: 'ACTIVE'
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Müşteri kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleWonProposal = async (proposal: Proposal) => {
    if (!window.confirm('Bu teklifi KAZANILDI olarak işaretlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await apiService.updateProposal(proposal.id, { status: 'ACCEPTED' });
      await apiService.updateOpportunity(proposal.opportunityId, { status: 'WON' });
      
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'ACCEPTED' } : p));
      setOpportunities(prev => prev.map(o => o.id === proposal.opportunityId ? { ...o, status: 'WON' } : o));
      
      alert('Tebrikler! Teklif kazanıldı. Sözleşme yönetimi modülüne yönlendiriliyorsunuz.');
      if (setActiveTab) setActiveTab('contract');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleLostProposal = async (proposal: Proposal) => {
    if (!window.confirm('Bu teklifi KAYBEDİLDİ olarak işaretlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await apiService.updateProposal(proposal.id, { status: 'REJECTED' });
      await apiService.updateOpportunity(proposal.opportunityId, { status: 'LOST' });
      
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'REJECTED' } : p));
      setOpportunities(prev => prev.map(o => o.id === proposal.opportunityId ? { ...o, status: 'LOST' } : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fırsat kaydedilemedi.');
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

  const renderOpportunities = () => {
    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Satış Boru Hattı</h3>
          </div>
          <div className="flex items-center gap-4">
            <SaveButton onClick={handleSaveAll} loading={loading} />
            <PermissionGate permission="CRM_EDIT">
              <button 
                onClick={() => {
                  opportunityForm.resetForm();
                  setIsEditingOpp(false);
                  setShowNewOpportunityModal(true);
                }} 
                className="bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all"
              >
                <Plus size={18} /> Yeni Fırsat
              </button>
            </PermissionGate>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {opportunitySearch.filteredItems.map(opp => (
            <motion.div layout key={opp.id} className="glass-panel p-8 rounded-[32px]">
              <h5 className="font-black text-slate-900 text-lg">{opp.title}</h5>
              <button 
                onClick={() => { setHandOffTarget(opp); setShowHandOffModal(true); }}
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary"
              >
                Görev Aktar <GitBranch size={12} className="inline" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Müşteriler</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">{customers.length} kayıtlı müşteri</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Müşteri ara..."
              value={customerSearch.searchQuery}
              onChange={e => customerSearch.setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-56"
            />
          </div>
          <PermissionGate permission="CRM_EDIT">
            <button
              onClick={() => setShowImportWizard(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
            >
              <FileSpreadsheet size={15} /> Excel'den Aktar
            </button>
            <button
              onClick={() => { customerForm.resetForm(); setShowNewCustomerModal(true); }}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus size={16} /> Yeni Müşteri Ekle
            </button>
          </PermissionGate>
        </div>
      </div>

      {customerSearch.filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Building size={48} className="mb-4 opacity-30" />
          <p className="font-black text-sm uppercase tracking-widest">Müşteri bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {customerSearch.filteredItems.map(customer => (
            <motion.div
              layout
              key={customer.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-7 rounded-[28px] hover:shadow-xl transition-all group border border-white/60 bg-gradient-to-br from-white/80 to-white/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building size={22} className="text-primary" />
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                  customer.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                )}>
                  {customer.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <h4 className="font-black text-slate-900 text-base leading-snug">{customer.name}</h4>
              {customer.shortName && <p className="text-xs text-primary font-bold mt-0.5">{customer.shortName}</p>}
              {customer.industry && <p className="text-xs text-slate-500 font-medium mt-1">{customer.industry}</p>}
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                {customer.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={12} className="shrink-0" />{customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={12} className="shrink-0" />{customer.phone}
                  </div>
                )}
                {customer.city && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={12} className="shrink-0" />{customer.city}{customer.country ? `, ${customer.country}` : ''}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Kredi Limiti</span>
                <span className="font-black text-slate-700">
                  {customer.creditLimit?.toLocaleString('tr-TR')} {customer.currency}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProposals = () => {
    // Maliyet analizi yapılmış (approved) ancak henüz teklif oluşturulmamış fırsatları filtrele
    const readyForProposalOpps = opportunities.filter(opp => {
      const isApproved = opp.technicalStatus === 'APPROVED';
      const hasProposal = proposals.find(p => p.opportunityId === opp.id);
      return isApproved && !hasProposal;
    });

    return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-black">Teklifler ({proposals.length})</h3>
        {proposals.length > 0 && (
          <button 
            onClick={() => setProposals([])}
            className="text-xs font-black text-red-500 uppercase tracking-widest hover:text-red-700"
          >
            Teklifleri Temizle
          </button>
        )}
      </div>

      {/* Teklife Hazır Fırsatlar Listesi */}
      {readyForProposalOpps.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Teklife Hazır Fırsatlar ({readyForProposalOpps.length})</h4>
          <div className="space-y-4">
            {readyForProposalOpps.map(opp => (
              <div key={opp.id} className="glass-panel p-6 rounded-2xl flex justify-between items-center border-l-4 border-emerald-500">
                <div>
                  <h4 className="font-bold">{opp.title}</h4>
                  <p className="text-xs text-emerald-600 mt-1 font-black uppercase">Teklife Hazır</p>
                </div>
                <button 
                  onClick={() => { setSelectedOpp(opp); setShowProposalEditor(true); }}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Teklif Oluştur
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {proposals.length === 0 ? (
          <p className="text-slate-400 font-bold text-sm">Henüz teklif bulunmuyor.</p>
        ) : (
          proposals.map(proposal => {
            const opp = opportunities.find(o => o.id === proposal.opportunityId);
            const customer = opp ? customers.find(c => c.id === opp.customerId) : null;
            return (
              <div key={proposal.id} className="glass-panel p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <h4 className="font-bold">
                    {customer?.name || 'Bilinmeyen Müşteri'} - 
                    {opp?.title || 'Bilinmeyen İş'} - v{proposal.version || 1}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Durum: 
                    <span className={cn(
                      "ml-2 font-black uppercase text-[10px] px-2 py-0.5 rounded-full",
                      proposal.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" :
                      proposal.status === 'REJECTED' ? "bg-red-100 text-red-700" :
                      proposal.status === 'PENDING_APPROVAL' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {proposal.status === 'PENDING_APPROVAL' ? 'YÖNETİCİ ONAYINDA' : 
                       proposal.status === 'REJECTED' ? 'REDDEDİLDİ' : 
                       proposal.status === 'APPROVED' ? 'ONAYLANDI' : proposal.status}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {(proposal.status === 'DRAFT' || proposal.status === 'REJECTED') && (
                    <button 
                      onClick={() => {
                        const opp = opportunities.find(o => o.id === proposal.opportunityId);
                        if (opp) {
                          setSelectedOpp(opp);
                          setShowProposalEditor(true);
                        }
                      }}
                      className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                      {proposal.status === 'REJECTED' ? 'Revize Et' : 'Düzenle'}
                    </button>
                  )}
                  {proposal.status === 'DRAFT' && (
                    <button 
                      onClick={async () => {
                        setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'PENDING_APPROVAL' } : p));
                        try {
                          const opp = opportunities.find(o => o.id === proposal.opportunityId);
                          const customer = customers.find(c => c.id === proposal.customerId);
                          const currency = customer?.currency || 'TRY';
                          const priceLabel = proposal.totalPrice != null
                            ? proposal.totalPrice.toLocaleString('tr-TR') + ' ' + currency
                            : '';
                          const newTask = await apiService.createTask({
                            title: `Teklif Onayı: ${opp?.title ?? 'Fırsat'}`,
                            description: priceLabel ? `Toplam Tutar: ${priceLabel}` : 'Yeni bir teklif onayınızı bekliyor.',
                            unitId: 'unit_management',
                            assignedBy: currentUser?.id || 'admin',
                            priority: 'HIGH',
                            status: 'PENDING',
                            relatedModule: 'PROPOSAL',
                            relatedItemId: proposal.id
                          });
                          if (setTasks) setTasks(prev => [newTask, ...prev]);
                          alert('Teklif yönetici onayına gönderildi.');
                        } catch (e) {
                          alert('Görev atanamadı.');
                        }
                      }}
                      className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
                    >
                      Onaya Gönder
                    </button>
                  )}
                  {proposal.status === 'APPROVED' && (
                    <button
                      disabled={generatingPdfId === proposal.id}
                      onClick={async () => {
                        setGeneratingPdfId(proposal.id);
                        try {
                          const opp = opportunities.find(o => o.id === proposal.opportunityId);
                          const cust = customers.find(c => c.id === (opp?.customerId ?? proposal.customerId));
                          if (!opp) { alert('Fırsat bulunamadı.'); return; }
                          await generateProposalPDF(proposal, opp, cust);
                        } catch (err) {
                          alert('PDF oluşturulamadı: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
                        } finally {
                          setGeneratingPdfId(null);
                        }
                      }}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60"
                    >
                      {generatingPdfId === proposal.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Download size={14} />}
                      PDF Oluştur
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
    );
  };

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
      {activeTab === 'crm-negotiation' ? (
        <NegotiationModule 
          opportunities={opportunities} 
          setOpportunities={setOpportunities} 
          proposals={proposals}
          setActiveTab={setActiveTab} 
        />
      ) : activeTab === 'crm-proposals' ? renderProposals() : 
       activeTab === 'crm-customers' ? renderCustomers() : 
       renderOpportunities()}

      <AnimatePresence>
        {showImportWizard && (
          <CustomerImportWizard
            onClose={() => setShowImportWizard(false)}
            onImported={(newCustomers) => {
              setCustomers(prev => [...prev, ...newCustomers]);
              setShowImportWizard(false);
            }}
          />
        )}
        {showHandOffModal && handOffTarget && (
          <HandOffModal
            isOpen={showHandOffModal}
            onClose={() => setShowHandOffModal(false)}
            onConfirm={handleHandOff}
            itemTitle={handOffTarget.title}
          />
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
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Satış Fırsatı</h4>
                <button onClick={() => setShowNewOpportunityModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveOpportunity} className="p-8 space-y-6">
                <input type="text" name="title" required value={opportunityForm.values.title} onChange={opportunityForm.handleChange} placeholder="Fırsat Başlığı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                <select name="customerId" required value={opportunityForm.values.customerId} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                  <option value="">Müşteri Seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowNewOpportunityModal(false)} className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">İPTAL</button>
                  <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg">KAYDET</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {showNewCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-3xl rounded-[40px] shadow-2xl bg-white flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Müşteri</h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Müşteri bilgilerini doldurun</p>
                </div>
                <button onClick={() => setShowNewCustomerModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <form id="customer-form" onSubmit={handleSaveCustomer} className="overflow-y-auto custom-scrollbar flex-1">
                <div className="p-8 space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Temel Bilgiler</p>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text" name="name" required
                        value={customerForm.values.name ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Müşteri Adı *"
                        className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="text" name="shortName"
                        value={customerForm.values.shortName ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Kısa Ad"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="text" name="industry"
                        value={customerForm.values.industry ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Sektör"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">İletişim</p>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="email" name="email"
                        value={customerForm.values.email ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="E-posta"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="tel" name="phone"
                        value={customerForm.values.phone ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Telefon"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="url" name="website"
                        value={customerForm.values.website ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Web Sitesi"
                        className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adres</p>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text" name="address"
                        value={customerForm.values.address ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Adres"
                        className="col-span-2 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="text" name="city"
                        value={customerForm.values.city ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Şehir"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="text" name="country"
                        value={customerForm.values.country ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Ülke"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Finansal & Vergi</p>
                    <div className="grid grid-cols-3 gap-4">
                      <input
                        type="text" name="taxOffice"
                        value={customerForm.values.taxOffice ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Vergi Dairesi"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="text" name="taxNumber"
                        value={customerForm.values.taxNumber ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Vergi No"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <select
                        name="currency"
                        value={customerForm.values.currency ?? 'USD'}
                        onChange={customerForm.handleChange}
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="TRY">TRY ₺</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                      <input
                        type="number" name="creditLimit" min={0}
                        value={customerForm.values.creditLimit ?? 0}
                        onChange={customerForm.handleChange}
                        placeholder="Kredi Limiti"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <input
                        type="number" name="riskScore" min={0} max={100}
                        value={customerForm.values.riskScore ?? 0}
                        onChange={customerForm.handleChange}
                        placeholder="Risk Skoru (0-100)"
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <select
                        name="status"
                        value={customerForm.values.status ?? 'ACTIVE'}
                        onChange={customerForm.handleChange}
                        className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="ACTIVE">Aktif</option>
                        <option value="PASSIVE">Pasif</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ek Bilgiler</p>
                    <div className="space-y-4">
                      <input
                        type="text" name="techStack"
                        value={customerForm.values.techStack ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Teknoloji Altyapısı (ör: React, SAP, Oracle)"
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <textarea
                        name="notes"
                        value={customerForm.values.notes ?? ''}
                        onChange={customerForm.handleChange}
                        placeholder="Notlar..."
                        rows={3}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      />
                    </div>
                  </div>
                </div>
              </form>
              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-8 py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                >
                  İPTAL
                </button>
                <button
                  form="customer-form"
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  KAYDET
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
