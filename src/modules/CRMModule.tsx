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
  ThumbsUp,
  ThumbsDown,
  GitBranch,
  FileSpreadsheet,
  Send,
  Package,
  Trophy,
  AlertTriangle,
  BarChart2,
  ChevronRight,
  Calendar,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  TodoTask,
  Opportunity,
  Customer,
  Proposal,
  CustomerHealthReport,
} from '../types';
import { CustomerHealthCard } from '../components/HealthCards';
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
import { PROCUREMENT_METHODS } from '../lib/procurementCosts';

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
  setActiveTab,
  initialItemId,
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
  setActiveTab?: (tab: string) => void,
  initialItemId?: string | null,
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
  const [customerReportTarget, setCustomerReportTarget] = useState<Customer | null>(null);
  const [customerHealth, setCustomerHealth] = useState<CustomerHealthReport | null>(null);

  React.useEffect(() => { apiService.getCustomerHealth().then(setCustomerHealth).catch(() => {}); }, []);

  // Deep-link: bildirim/görev "Git" ile gelen fırsatı otomatik aç (teklif sekmesinde
  // teklif editörünü açar; diğer sekmelerde fırsatı seçili getirir).
  React.useEffect(() => {
    if (!initialItemId) return;
    const opp = opportunities.find(o => o.id === initialItemId);
    if (!opp) return;
    setSelectedOpp(opp);
    if (activeTab === 'crm-proposals') setShowProposalEditor(true);
  }, [initialItemId, opportunities, activeTab]);

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

      // Determine target status based on proposal content
      let targetStatus: Opportunity['status'] = 'PROPOSAL';
      try {
        const contentObj = typeof proposalData.content === 'string'
          ? JSON.parse(proposalData.content as string)
          : (proposalData.content as Record<string, unknown>);
        if (contentObj?.openForNegotiation) targetStatus = 'NEGOTIATION';
      } catch { /* ignore parse errors */ }

      // Auto-advance opportunity if it's earlier in the pipeline
      const NON_FINAL: Opportunity['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'];
      if (NON_FINAL.includes(selectedOpp.status) ||
          (targetStatus === 'NEGOTIATION' && selectedOpp.status === 'PROPOSAL')) {
        await apiService.updateOpportunity(selectedOpp.id, { status: targetStatus });
        setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, status: targetStatus } : o));
      }

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
    title: '', value: 0, probability: 50, customerId: '', description: '', status: 'NEW',
    procurementMethod: 'OPEN', targetBidDate: ''
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
      if (setActiveTab) setActiveTab('contract-workflow');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // Kaybedilen fırsat — neden seçimi modalı (Faz 1). Modal onaylanınca confirmLostReason çalışır.
  const LOST_REASON_OPTIONS = [
    'Fiyat rekabeti',
    'Bütçe iptal edildi',
    'Rakip firma seçildi',
    'Teknik uygunsuzluk',
    'Zamanlama / termin uyuşmazlığı',
    'Müşteri vazgeçti',
    'Diğer',
  ];
  const [lostReasonModal, setLostReasonModal] = useState<{ opp: Opportunity; proposal?: Proposal } | null>(null);
  const [lostReasonChoice, setLostReasonChoice] = useState('');
  const [lostReasonCustom, setLostReasonCustom] = useState('');

  const confirmLostReason = async () => {
    if (!lostReasonModal) return;
    const reason = lostReasonChoice === 'Diğer' ? (lostReasonCustom.trim() || 'Diğer') : lostReasonChoice;
    if (!reason) { alert('Lütfen bir kayıp nedeni seçin.'); return; }
    setLoading(true);
    try {
      const { opp, proposal } = lostReasonModal;
      if (proposal) {
        // B-21 — kayıp nedeni artık Opportunity.lostReason'a ek olarak Proposal.rejectionReason'a
        // da yazılır; "neden kaybettik" analizi teklif kaydının kendisinden de yapılabilir.
        await apiService.updateProposal(proposal.id, { status: 'REJECTED', rejectionReason: reason });
        setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'REJECTED', rejectionReason: reason } : p));
      }
      await apiService.updateOpportunity(opp.id, { status: 'LOST', lostReason: reason });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'LOST', lostReason: reason } : o));
      setLostReasonModal(null);
      setLostReasonChoice('');
      setLostReasonCustom('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleLostProposal = (proposal: Proposal) => {
    const opp = opportunities.find(o => o.id === proposal.opportunityId);
    if (!opp) return;
    setLostReasonModal({ opp, proposal });
  };

  // Teklif objesi olmadan direkt fırsat üzerinde kazanıldı/kaybedildi
  const handleWonOpportunity = async (opp: Opportunity) => {
    if (!window.confirm(`"${opp.title}" fırsatını KAZANILDI olarak işaretlemek istiyor musunuz?`)) return;
    setLoading(true);
    try {
      await apiService.updateOpportunity(opp.id, { status: 'WON' });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'WON' } : o));
      alert('Tebrikler! Fırsat kazanıldı. Sözleşme yönetimi modülüne yönlendiriliyorsunuz.');
      if (setActiveTab) setActiveTab('contract-workflow');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleLostOpportunity = (opp: Opportunity) => {
    setLostReasonModal({ opp });
  };

  const getContentJson = (proposal: Proposal): Record<string, unknown> => {
    if (!proposal.content) return {};
    if (typeof proposal.content === 'string') {
      try { return JSON.parse(proposal.content); } catch { return {}; }
    }
    return proposal.content as Record<string, unknown>;
  };

  const handleMarkDelivered = async (proposal: Proposal, delivered: boolean) => {
    const contentJson = getContentJson(proposal);
    const newContent = { ...contentJson, deliveredToCustomer: delivered };
    try {
      await apiService.updateProposal(proposal.id, { content: JSON.stringify(newContent) });
      setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, content: newContent } : p));

      // İletildi olarak işaretlendiğinde birim yöneticisine bildirim oluştur
      if (delivered) {
        const opp = opportunities.find(o => o.id === proposal.opportunityId);
        const cust = customers.find(cu => cu.id === (opp?.customerId ?? proposal.customerId));
        const totalPrice = contentJson.totalPrice as number | undefined;
        const currency = cust?.currency ?? 'TRY';
        const priceLabel = totalPrice != null
          ? `${totalPrice.toLocaleString('tr-TR')} ${currency}`
          : '';
        const newTask = await apiService.createTask({
          title: `Teklif Müşteriye İletildi: ${opp?.title ?? 'Fırsat'}`,
          description: [
            `Müşteri: ${cust?.name ?? 'Bilinmiyor'}`,
            priceLabel ? `Tutar: ${priceLabel}` : '',
            `İletilme: ${new Date().toLocaleString('tr-TR')}`,
          ].filter(Boolean).join(' · '),
          unitId: 'unit_management',
          assignedBy: currentUser?.id || 'system',
          priority: 'MEDIUM',
          status: 'PENDING',
          relatedModule: 'DELIVERY',
          relatedItemId: proposal.id,
        });
        if (setTasks) setTasks(prev => [newTask, ...prev]);
      }
    } catch {
      alert('Güncelleme başarısız.');
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
      status: opp.status,
      procurementMethod: opp.procurementMethod || 'OPEN',
      targetBidDate: opp.targetBidDate ? opp.targetBidDate.slice(0, 10) : ''
    });
    setIsEditingOpp(true);
    setShowNewOpportunityModal(true);
  };

  const PIPELINE_STAGES: Opportunity['status'][] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];

  const STATUS_LABEL: Record<string, string> = {
    NEW: 'Yeni', CONTACTED: 'İletişimde', QUALIFIED: 'Nitelikli',
    PROPOSAL: 'Teklif Aşaması', NEGOTIATION: 'Pazarlıkta',
    WON: 'Kazanıldı', LOST: 'Kaybedildi',
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      'NEW': 'bg-blue-50 text-blue-600 border-blue-100',
      'CONTACTED': 'bg-sky-50 text-sky-600 border-sky-100',
      'QUALIFIED': 'bg-primary/10 text-primary border-primary/20',
      'PROPOSAL': 'bg-amber-50 text-amber-600 border-amber-100',
      'NEGOTIATION': 'bg-purple-50 text-purple-600 border-purple-100',
      'WON': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'LOST': 'bg-red-50 text-red-600 border-red-100',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const handleProgressStatus = async (opp: Opportunity, toStatus: Opportunity['status']) => {
    try {
      const updated = await apiService.updateOpportunity(opp.id, { status: toStatus });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, ...updated, status: toStatus } : o));
    } catch {
      alert('Durum güncellenemedi.');
    }
  };

  const renderOpportunities = () => {
    // Group by status for pipeline view
    const grouped: Partial<Record<Opportunity['status'], Opportunity[]>> = {};
    for (const stage of PIPELINE_STAGES) grouped[stage] = [];
    grouped['LOST'] = [];
    for (const opp of opportunitySearch.filteredItems) {
      (grouped[opp.status] ?? []).push(opp);
    }

    const stageColors: Record<string, string> = {
      NEW: 'border-t-blue-400', CONTACTED: 'border-t-sky-400',
      QUALIFIED: 'border-t-primary', PROPOSAL: 'border-t-amber-400',
      NEGOTIATION: 'border-t-purple-400', WON: 'border-t-emerald-500', LOST: 'border-t-red-400',
    };

    const allStages: Opportunity['status'][] = [...PIPELINE_STAGES, 'LOST'];

    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Satış Boru Hattı</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">{opportunitySearch.filteredItems.length} fırsat · {opportunitySearch.filteredItems.filter(o => o.status !== 'LOST' && o.status !== 'WON' && o.status !== 'WITHDRAWN').length} aktif</p>
          </div>
          <div className="flex items-center gap-4">
            <SaveButton onClick={handleSaveAll} loading={loading} />
            <PermissionGate permission="CRM_EDIT">
              <button
                onClick={() => { opportunityForm.resetForm(); setIsEditingOpp(false); setShowNewOpportunityModal(true); }}
                className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all"
              >
                <Plus size={18} /> Yeni Fırsat
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {PIPELINE_STAGES.filter(s => s !== 'WON').map((stage, idx) => {
            const count = (grouped[stage] ?? []).length;
            const isActive = count > 0;
            return (
              <React.Fragment key={stage}>
                <div className={cn(
                  "flex-1 min-w-[80px] text-center py-2 px-3 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                  isActive ? getStatusStyle(stage) : 'text-slate-300 bg-slate-50'
                )}>
                  {STATUS_LABEL[stage]}
                  <span className="ml-1 opacity-70">({count})</span>
                </div>
                {idx < PIPELINE_STAGES.filter(s => s !== 'WON').length - 1 && (
                  <ArrowRight size={12} className="text-slate-300 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Cards grouped by stage */}
        {allStages.filter(stage => (grouped[stage] ?? []).length > 0).map(stage => (
          <div key={stage}>
            <div className="flex items-center gap-3 mb-4">
              <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", getStatusStyle(stage))}>
                {STATUS_LABEL[stage]}
              </span>
              <span className="text-xs text-slate-400 font-bold">{(grouped[stage] ?? []).length} fırsat</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(grouped[stage] ?? []).map(opp => {
                const customer = customers.find(c => c.id === opp.customerId);
                const oppProposals = proposals.filter(p => p.opportunityId === opp.id);
                const latestProposal = oppProposals.length > 0
                  ? [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0]
                  : null;
                const stageIdx = PIPELINE_STAGES.indexOf(opp.status);
                const nextStage = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1
                  ? PIPELINE_STAGES[stageIdx + 1]
                  : null;
                return (
                  <motion.div
                    layout key={opp.id}
                    className={cn("glass-panel p-6 rounded-[24px] border-t-4 flex flex-col gap-4 hover:shadow-xl transition-all", stageColors[opp.status] || 'border-t-slate-200')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="font-black text-slate-900 text-sm leading-snug truncate">{opp.title}</h5>
                        {customer && (
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                            <Building size={10} />{customer.name}
                          </p>
                        )}
                      </div>
                      <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border shrink-0", getStatusStyle(opp.status))}>
                        {STATUS_LABEL[opp.status]}
                      </span>
                    </div>

                    {opp.value > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Değer</span>
                        <span className="font-black text-slate-800">{opp.value.toLocaleString('tr-TR')} {customer?.currency || ''}</span>
                      </div>
                    )}

                    {opp.probability > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>Olasılık</span><span>{opp.probability}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${opp.probability}%` }} />
                        </div>
                      </div>
                    )}

                    {latestProposal && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold">
                        <FileSignature size={11} />
                        Teklif v{latestProposal.version} ·{' '}
                        <span className={cn("font-black", latestProposal.status === 'APPROVED' ? 'text-emerald-600' : latestProposal.status === 'REJECTED' ? 'text-red-500' : 'text-slate-500')}>
                          {latestProposal.status === 'DRAFT' ? 'Taslak' : latestProposal.status === 'PENDING_APPROVAL' ? 'Onay Bekliyor' : latestProposal.status === 'APPROVED' ? 'Onaylandı' : latestProposal.status === 'SENT' ? 'Gönderildi' : latestProposal.status === 'ACCEPTED' ? 'Kabul Edildi' : latestProposal.status === 'REJECTED' ? 'Reddedildi' : latestProposal.status}
                        </span>
                      </div>
                    )}

                    {(opp.agentTriage?.igpd || opp.agentTriage?.crm) && (
                      <div className="flex flex-col gap-1">
                        {opp.agentTriage.igpd && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                            🤖 BD: {opp.agentTriage.igpd.expectedValue.toLocaleString('tr-TR')} ₺ · {opp.agentTriage.igpd.recommendation}
                          </span>
                        )}
                        {opp.agentTriage.crm && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                            🤖 CRM: {opp.agentTriage.crm.recommendation}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                      {nextStage && opp.status !== 'WON' && opp.status !== 'LOST' && (
                        <button
                          onClick={() => handleProgressStatus(opp, nextStage)}
                          className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <ArrowRight size={11} /> {STATUS_LABEL[nextStage]}
                        </button>
                      )}
                      {opp.status !== 'WON' && opp.status !== 'LOST' && (
                        <button
                          onClick={() => setLostReasonModal({ opp })}
                          className="flex items-center gap-1 bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <XCircle size={11} /> Kaybedildi
                        </button>
                      )}
                      {opp.status === 'LOST' && (
                        <button
                          onClick={() => handleProgressStatus(opp, 'NEW')}
                          className="flex items-center gap-1 bg-blue-50 text-blue-500 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <ArrowRight size={11} /> Yeniden Aç
                        </button>
                      )}
                      <button
                        onClick={() => { setHandOffTarget(opp); setShowHandOffModal(true); }}
                        className="flex items-center gap-1 text-slate-400 hover:text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                      >
                        <GitBranch size={11} /> Aktar
                      </button>
                      <PermissionGate permission="CRM_EDIT">
                        <button
                          onClick={() => openEditOpportunity(opp)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                        >
                          <Edit2 size={11} /> Düzenle
                        </button>
                      </PermissionGate>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {opportunitySearch.filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Target size={48} className="mb-4 opacity-20" />
            <p className="font-black text-sm uppercase tracking-widest">Henüz fırsat kaydı bulunmuyor</p>
          </div>
        )}
      </div>
    );
  };

  const getCustomerStats = (customerId: string) => {
    const customerOpps = opportunities.filter(o => o.customerId === customerId);
    const wonOpps = customerOpps.filter(o => o.status === 'WON');
    const lostOpps = customerOpps.filter(o => o.status === 'LOST');
    const activeOpps = customerOpps.filter(o => !['WON', 'LOST', 'WITHDRAWN'].includes(o.status));

    const getBestValue = (opp: Opportunity) => {
      const oppProposals = proposals.filter(p => p.opportunityId === opp.id && p.totalPrice);
      if (oppProposals.length === 0) return opp.value ?? 0;
      return [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0].totalPrice!;
    };

    const wonValue = wonOpps.reduce((s, o) => s + getBestValue(o), 0);
    const lostValue = lostOpps.reduce((s, o) => s + getBestValue(o), 0);

    return { wonOpps, lostOpps, activeOpps, wonValue, lostValue, getBestValue };
  };

  const renderCRMDashboard = () => {
    const activeOpps = opportunities.filter(o => o.status !== 'WON' && o.status !== 'LOST' && o.status !== 'WITHDRAWN');
    const wonOpps = opportunities.filter(o => o.status === 'WON');
    // Win-rate paydası: yönetimsel "iştirak edilmedi" hariç (KPI nötr)
    const kpiOpps = opportunities.filter(o => o.status !== 'WITHDRAWN');
    const pipelineValue = activeOpps.reduce((s, o) => s + (o.value ?? 0), 0);
    const wonValue = wonOpps.reduce((s, o) => s + (o.value ?? 0), 0);
    const winRate = kpiOpps.length > 0
      ? Math.round((wonOpps.length / kpiOpps.length) * 100)
      : 0;
    const pendingProposals = proposals.filter(p => p.status === 'PENDING_APPROVAL').length;
    const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;

    const stageOrder: Opportunity['status'][] = ['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION'];
    const stageCounts = stageOrder.map(s => ({
      status: s,
      label: STATUS_LABEL[s],
      count: opportunities.filter(o => o.status === s).length,
    }));
    const maxStageCount = Math.max(...stageCounts.map(s => s.count), 1);

    const recentOpps = [...opportunities]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5);

    const fmtValue = (v: number) =>
      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

    const modules = [
      {
        id: 'crm-opportunities',
        label: 'Fırsatlar',
        description: 'Satış boru hattı ve pipeline yönetimi',
        icon: <Target size={24} />,
        color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
        iconColor: 'text-blue-400',
        stat: `${activeOpps.length} aktif`,
      },
      {
        id: 'crm-customers',
        label: 'Müşteriler',
        description: 'Müşteri portföyü ve hesap yönetimi',
        icon: <Building size={24} />,
        color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
        iconColor: 'text-emerald-400',
        stat: `${activeCustomers} aktif`,
      },
      {
        id: 'crm-proposals',
        label: 'Teklifler',
        description: 'Teklif takibi ve onay süreci',
        icon: <FileSignature size={24} />,
        color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
        iconColor: 'text-amber-400',
        stat: pendingProposals > 0 ? `${pendingProposals} onay bekliyor` : `${proposals.length} toplam`,
      },
      {
        id: 'crm-negotiation',
        label: 'Canlı Pazarlıklar',
        description: 'Aktif müzakere ve anlaşma süreçleri',
        icon: <Activity size={24} />,
        color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
        iconColor: 'text-purple-400',
        stat: `${opportunities.filter(o => o.status === 'NEGOTIATION').length} müzakerede`,
      },
    ];

    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
        {/* Başlık */}
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">CRM Genel Bakış</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">Satış ve müşteri yönetiminin özeti</p>
        </div>

        {/* Metrik kartlar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Aktif Müşteri',   value: activeCustomers,          icon: <Building size={20} />,     color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Pipeline Değeri', value: fmtValue(pipelineValue),  icon: <TrendingUp size={20} />,   color: 'bg-blue-50 text-blue-600' },
            { label: 'Kazanılan Değer', value: fmtValue(wonValue),       icon: <Trophy size={20} />,       color: 'bg-amber-50 text-amber-700' },
            { label: 'Kazanma Oranı',   value: `%${winRate}`,            icon: <BarChart2 size={20} />,    color: 'bg-purple-50 text-purple-600' },
          ].map(m => (
            <div key={m.label} className="glass-panel rounded-2xl p-5">
              <div className={`inline-flex p-2 rounded-xl mb-3 ${m.color}`}>{m.icon}</div>
              <p className="text-2xl font-black text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Modül kartları */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Modüller</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map(mod => (
              <motion.div
                key={mod.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveTab && setActiveTab(mod.id)}
                className={`cursor-pointer glass-panel rounded-2xl p-5 border bg-gradient-to-br ${mod.color} transition-all hover:shadow-lg`}
              >
                <div className="flex items-start justify-between">
                  <div className={`${mod.iconColor} mb-3`}>{mod.icon}</div>
                  <ChevronRight size={16} className="text-slate-400 mt-1" />
                </div>
                <h5 className="font-black text-slate-900 text-lg">{mod.label}</h5>
                <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                <p className={`text-xs font-bold mt-3 ${mod.iconColor}`}>{mod.stat}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Özeti */}
          <div className="glass-panel rounded-2xl p-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Pipeline Dağılımı</h4>
            <div className="space-y-3">
              {stageCounts.map(({ status, label, count }) => (
                <div
                  key={status}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
                >
                  <span className="text-xs text-slate-500 w-24 shrink-0 font-medium group-hover:text-slate-700 transition-colors">{label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxStageCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${getStatusStyle(status).split(' ')[0].replace('bg-', 'bg-').replace('-50', '-400')}`}
                      style={{ backgroundColor: ({
                        NEW: '#60a5fa', CONTACTED: '#38bdf8', QUALIFIED: '#818cf8',
                        PROPOSAL: '#fbbf24', NEGOTIATION: '#c084fc',
                      } as Record<string, string>)[status] ?? '#94a3b8' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Son Fırsatlar */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Son Fırsatlar</h4>
              <button
                onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                Tümü <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {recentOpps.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Henüz fırsat yok.</p>
              )}
              {recentOpps.map(opp => {
                const cust = customers.find(c => c.id === opp.customerId);
                return (
                  <div
                    key={opp.id}
                    onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{opp.title}</p>
                      <p className="text-xs text-slate-400">{cust?.name ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(opp.status)}`}>
                        {STATUS_LABEL[opp.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {customerHealth && customerHealth.summary.total > 0 && <CustomerHealthCard c={customerHealth} className="" />}

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

              {/* Won / Lost Stats */}
              {(() => {
                const stats = getCustomerStats(customer.id);
                const hasAny = stats.wonOpps.length > 0 || stats.lostOpps.length > 0;
                return (
                  <button
                    onClick={() => setCustomerReportTarget(customer)}
                    className={cn(
                      "w-full mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-left group/stat",
                      hasAny ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Trophy size={11} className="shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Kazanılan</span>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {stats.wonOpps.length} <span className="text-[10px] font-medium text-slate-400">proje</span>
                      </p>
                      {stats.wonValue > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600">
                          {stats.wonValue >= 1_000_000
                            ? `${(stats.wonValue / 1_000_000).toFixed(1)}M`
                            : stats.wonValue >= 1_000
                            ? `${(stats.wonValue / 1_000).toFixed(0)}K`
                            : stats.wonValue.toLocaleString('tr-TR')} {customer.currency}
                        </p>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-red-400">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Kaybedilen</span>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {stats.lostOpps.length} <span className="text-[10px] font-medium text-slate-400">fırsat</span>
                      </p>
                      {stats.lostValue > 0 && (
                        <p className="text-[10px] font-bold text-red-400">
                          {stats.lostValue >= 1_000_000
                            ? `${(stats.lostValue / 1_000_000).toFixed(1)}M`
                            : stats.lostValue >= 1_000
                            ? `${(stats.lostValue / 1_000).toFixed(0)}K`
                            : stats.lostValue.toLocaleString('tr-TR')} {customer.currency}
                        </p>
                      )}
                    </div>
                    {hasAny && (
                      <div className="col-span-2 flex items-center justify-end gap-1 text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover/stat:opacity-100 transition-opacity">
                        <BarChart2 size={10} /> Detay Rapor <ChevronRight size={10} />
                      </div>
                    )}
                  </button>
                );
              })()}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProposals = () => {
    // Maliyet analizi tamamlanmış fırsatlar:
    // technicalStatus='APPROVED' VEYA kaydedilmiş BoM/maliyet kalemleri var.
    // Sadece aktif (DRAFT/PENDING_APPROVAL/APPROVED/SENT) teklifi olmayan fırsatları göster;
    // REJECTED teklifi olan fırsatlar yeniden listeye girer.
    const readyForProposalOpps = opportunities.filter(opp => {
      const hasCostAnalysis =
        opp.technicalStatus === 'APPROVED' ||
        (opp.bomItems && opp.bomItems.length > 0) ||
        (opp.costItems && opp.costItems.length > 0);
      // Presales BoM onay teklifleri bloklucu sayılmaz;
      // sadece CRM'den oluşturulan gerçek müşteri teklifleri bloklucu.
      const isBoMApproval = (p: Proposal) => {
        try {
          const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
          const obj = c as Record<string, unknown>;
          return !!(
            obj?.isBomApproval ||
            (typeof obj?.description === 'string' && obj.description.startsWith('BoM bazlı'))
          );
        } catch { return false; }
      };
      // WON/LOST fırsatlar listede görünmemeli
      if (opp.status === 'WON' || opp.status === 'LOST') return false;
      const hasBlockingProposal = proposals.some(p =>
        p.opportunityId === opp.id &&
        ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(p.status) &&
        !isBoMApproval(p)
      );
      return hasCostAnalysis && !hasBlockingProposal;
    });

    // Aktif teklifler: ACCEPTED (kazanıldı) ve kaybedilen REJECTED'lar gösterilmez
    const activeProposals = [...proposals.filter(p => {
      if (p.status === 'SENT' || p.status === 'ACCEPTED') return false;
      if (p.status === 'REJECTED') {
        // Yönetici reddi → revize edilebilir, göster
        // Kaybedilen anlaşma → fırsat LOST → gizle
        const opp = opportunities.find(o => o.id === p.opportunityId);
        return opp?.status !== 'LOST';
      }
      return true;
    })].sort((a, b) => {
      if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
      if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
      return 0;
    });

    // Yollanan teklifler: WON veya LOST olan fırsatların teklifleri kaldırılır
    const sentProposals = proposals.filter(p => {
      if (p.status !== 'SENT') return false;
      const opp = opportunities.find(o => o.id === p.opportunityId);
      return opp?.status !== 'WON' && opp?.status !== 'LOST';
    });

    const statusLabel = (s: string) => {
      if (s === 'DRAFT') return 'TASLAK';
      if (s === 'PENDING_APPROVAL') return 'YÖNETİCİ ONAYINDA';
      if (s === 'REJECTED') return 'REDDEDİLDİ';
      if (s === 'APPROVED') return 'ONAYLANDI';
      if (s === 'ACCEPTED') return 'MÜŞTERİ KABUL';
      if (s === 'SENT') return 'GÖNDERİLDİ';
      return s;
    };
    const statusCls = (s: string) =>
      s === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
      s === 'REJECTED' ? 'bg-red-100 text-red-700' :
      s === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
      'bg-slate-100 text-slate-700';

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black">Teklifler</h3>
        </div>

        {/* Aktif Teklifler — teklif bekleyen fırsatlar + mevcut taslak/onay teklifleri */}
        {(readyForProposalOpps.length > 0 || activeProposals.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">
                Aktif Teklifler ({readyForProposalOpps.length + activeProposals.length})
              </h4>
            </div>
            <div className="space-y-4">
              {/* 1. Maliyet analizi tamamlanmış, teklif henüz oluşturulmamış fırsatlar */}
              {readyForProposalOpps.map(opp => {
                const cust = customers.find(c => c.id === opp.customerId);
                const currency = cust?.currency ?? 'TRY';
                const bomTotal = opp.bomItems && opp.bomItems.length > 0
                  ? opp.bomItems.reduce((sum, item) => {
                      const sp = item.unitSalePrice
                        ?? ((item.purchaseCost ?? 0) * (1 + (item.marginPercentage ?? 0) / 100));
                      return sum + sp * (item.quantity ?? 1);
                    }, 0)
                  : null;
                const displayTotal = bomTotal ?? opp.value;
                const hasRejectedProposal = proposals.some(
                  p => p.opportunityId === opp.id && p.status === 'REJECTED'
                );
                return (
                  <div
                    key={`ready-${opp.id}`}
                    className="glass-panel p-5 rounded-2xl border-l-4 border-emerald-400 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-800 text-sm truncate">{opp.title}</h4>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">
                          Teklif Bekliyor
                        </span>
                        {hasRejectedProposal && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 uppercase tracking-widest">
                            Önceki Reddedildi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        {cust && <span className="flex items-center gap-1"><Building size={11} />{cust.name}</span>}
                        {displayTotal > 0 && (
                          <span className="flex items-center gap-1 font-black text-slate-700">
                            <DollarSign size={11} />
                            {Math.round(displayTotal).toLocaleString('tr-TR')} {currency}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleWonOpportunity(opp)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                        title="Teklif olmadan direkt kazanıldı işaretle"
                      >
                        <ThumbsUp size={12} />
                        Kazanıldı
                      </button>
                      <button
                        onClick={() => handleLostOpportunity(opp)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                        title="Teklif olmadan direkt kaybedildi işaretle"
                      >
                        <ThumbsDown size={12} />
                        Kaybedildi
                      </button>
                      <button
                        onClick={() => { setSelectedOpp(opp); setShowProposalEditor(true); }}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-primary/20"
                      >
                        <Plus size={13} />
                        Teklif Oluştur
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeProposals.map(proposal => {
                const opp = opportunities.find(o => o.id === proposal.opportunityId);
                const customer = opp ? customers.find(c => c.id === opp.customerId) : null;
                return (
                  <div key={proposal.id} className={cn(
                    "glass-panel p-6 rounded-2xl flex justify-between items-center",
                    proposal.status === 'APPROVED' && "border-l-4 border-emerald-400"
                  )}>
                    <div>
                      <h4 className="font-bold">
                        {customer?.name || 'Bilinmeyen Müşteri'} · {opp?.title || 'Bilinmeyen İş'} · v{proposal.version || 1}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Durum:
                        <span className={cn("ml-2 font-black uppercase text-[10px] px-2 py-0.5 rounded-full", statusCls(proposal.status))}>
                          {statusLabel(proposal.status)}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(proposal.status === 'DRAFT' || proposal.status === 'REJECTED') && (
                        <button
                          onClick={() => {
                            const o = opportunities.find(o => o.id === proposal.opportunityId);
                            if (o) { setSelectedOpp(o); setShowProposalEditor(true); }
                          }}
                          className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                          {proposal.status === 'REJECTED' ? 'Revize Et' : 'Düzenle'}
                        </button>
                      )}
                      {proposal.status === 'DRAFT' && (
                        <button
                          onClick={async () => {
                            try {
                              await apiService.updateProposal(proposal.id, { status: 'PENDING_APPROVAL' });
                            } catch { /* persist failure is non-blocking */ }
                            setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'PENDING_APPROVAL' } : p));
                            try {
                              const o = opportunities.find(o => o.id === proposal.opportunityId);
                              const cust = customers.find(c => c.id === proposal.customerId);
                              const currency = cust?.currency || 'TRY';
                              const c = getContentJson(proposal);
                              const totalPrice = c.totalPrice as number ?? proposal.totalPrice;
                              const priceLabel = totalPrice != null
                                ? totalPrice.toLocaleString('tr-TR') + ' ' + currency
                                : '';
                              const newTask = await apiService.createTask({
                                title: `Teklif Onayı: ${o?.title ?? 'Fırsat'}`,
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
                            } catch {
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
                              const o = opportunities.find(o => o.id === proposal.opportunityId);
                              const cust = customers.find(c => c.id === (o?.customerId ?? proposal.customerId));
                              if (!o) { alert('Fırsat bulunamadı.'); return; }
                              await generateProposalPDF(proposal, o, cust);
                              // PDF oluşturulunca SENT statüsüne geç ve tarihi kaydet
                              const c = getContentJson(proposal);
                              const newContent = { ...c, pdfGeneratedAt: new Date().toISOString(), deliveredToCustomer: false };
                              await apiService.updateProposal(proposal.id, { status: 'SENT', content: JSON.stringify(newContent) });
                              setProposals(prev => prev.map(p =>
                                p.id === proposal.id ? { ...p, status: 'SENT', content: newContent } : p
                              ));
                              // Auto-advance opportunity to NEGOTIATION when proposal is sent
                              const opp2 = opportunities.find(o => o.id === proposal.opportunityId);
                              if (opp2 && !['NEGOTIATION', 'WON', 'LOST'].includes(opp2.status)) {
                                await apiService.updateOpportunity(opp2.id, { status: 'NEGOTIATION' });
                                setOpportunities(prev => prev.map(o => o.id === opp2.id ? { ...o, status: 'NEGOTIATION' } : o));
                              }
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
              })}
            </div>
          </div>
        )}

        {activeProposals.length === 0 && sentProposals.length === 0 && readyForProposalOpps.length === 0 && (
          <p className="text-slate-400 font-bold text-sm">Henüz teklif bulunmuyor.</p>
        )}

        {/* Yollanan Teklifler */}
        {sentProposals.length > 0 && (
          <div>
            <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Send size={14} />
              Yollanan Teklifler ({sentProposals.length})
            </h4>
            <div className="space-y-3">
              {sentProposals.map(proposal => {
                const opp = opportunities.find(o => o.id === proposal.opportunityId);
                const cust = opp ? customers.find(c => c.id === opp.customerId) : null;
                const c = getContentJson(proposal);
                const pdfDateRaw = c.pdfGeneratedAt as string | undefined;
                const pdfDate = pdfDateRaw
                  ? new Date(pdfDateRaw).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '-';
                const totalPrice = c.totalPrice as number | undefined;
                const currency = cust?.currency ?? 'TRY';
                const delivered = !!(c.deliveredToCustomer as boolean | undefined);
                return (
                  <div key={proposal.id} className="glass-panel p-5 rounded-2xl border-l-4 border-blue-400">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm">
                          {cust?.name || 'Bilinmeyen Müşteri'} · {opp?.title || 'Bilinmeyen Fırsat'} · v{proposal.version || 1}
                        </h4>
                        <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Package size={11} />
                            PDF: {pdfDate}
                          </span>
                          {totalPrice != null && (
                            <span className="font-black text-slate-700">
                              {totalPrice.toLocaleString('tr-TR')} {currency}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0 flex-wrap justify-end">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => handleMarkDelivered(proposal, !delivered)}
                            className={cn(
                              "relative w-10 h-5 rounded-full transition-colors cursor-pointer",
                              delivered ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <span className={cn(
                              "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                              delivered && "translate-x-5"
                            )} />
                          </div>
                          <span className={cn("text-xs font-black uppercase whitespace-nowrap", delivered ? "text-emerald-600" : "text-slate-400")}>
                            {delivered ? 'İletildi' : 'İletilmedi'}
                          </span>
                        </label>
                        <div className="w-px h-6 bg-slate-200" />
                        <button
                          onClick={() => handleWonProposal(proposal)}
                          disabled={loading}
                          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm shadow-emerald-200"
                        >
                          <ThumbsUp size={12} />
                          Kazanıldı
                        </button>
                        <button
                          onClick={() => handleLostProposal(proposal)}
                          disabled={loading}
                          className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          <ThumbsDown size={12} />
                          Kaybedildi
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
          totalPrice: content.totalPrice,
          marginMode: content.marginMode,
          globalMargin: content.globalMargin,
          currency: content.currency,
          openForNegotiation: content.openForNegotiation,
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
          initialOppId={activeTab === 'crm-negotiation' ? initialItemId : null}
        />
      ) : activeTab === 'crm-opportunities' ? renderOpportunities()
        : activeTab === 'crm-customers' ? renderCustomers()
        : activeTab === 'crm-proposals' ? renderProposals()
        : renderCRMDashboard()}

      <AnimatePresence>
        {/* Customer Detail Report Modal */}
        {customerReportTarget && (() => {
          const cust = customerReportTarget;
          const stats = getCustomerStats(cust.id);
          const winRate = (stats.wonOpps.length + stats.lostOpps.length) > 0
            ? Math.round((stats.wonOpps.length / (stats.wonOpps.length + stats.lostOpps.length)) * 100)
            : null;
          const fmtVal = (v: number) => v >= 1_000_000
            ? `${(v / 1_000_000).toFixed(2)}M ${cust.currency}`
            : v >= 1_000
            ? `${(v / 1_000).toFixed(1)}K ${cust.currency}`
            : `${v.toLocaleString('tr-TR')} ${cust.currency}`;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl bg-white flex flex-col max-h-[88vh] overflow-hidden"
              >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building size={24} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic leading-none">{cust.name}</h4>
                      {cust.shortName && <p className="text-xs text-primary font-bold mt-0.5">{cust.shortName}</p>}
                      {cust.industry && <p className="text-xs text-slate-400 font-medium">{cust.industry}</p>}
                    </div>
                  </div>
                  <button onClick={() => setCustomerReportTarget(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all shrink-0">
                    <X size={20} />
                  </button>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-3 gap-0 border-b border-slate-100 shrink-0">
                  <div className="p-6 text-center border-r border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Trophy size={10} className="text-emerald-500" />Kazanılan</p>
                    <p className="text-3xl font-black text-emerald-600 tracking-tighter">{stats.wonOpps.length}</p>
                    {stats.wonValue > 0 && <p className="text-[11px] font-bold text-emerald-500 mt-0.5">{fmtVal(stats.wonValue)}</p>}
                  </div>
                  <div className="p-6 text-center border-r border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><AlertTriangle size={10} className="text-red-400" />Kaybedilen</p>
                    <p className="text-3xl font-black text-red-500 tracking-tighter">{stats.lostOpps.length}</p>
                    {stats.lostValue > 0 && <p className="text-[11px] font-bold text-red-400 mt-0.5">{fmtVal(stats.lostValue)}</p>}
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Activity size={10} className="text-blue-500" />Kazanma Oranı</p>
                    {winRate !== null
                      ? <p className="text-3xl font-black text-blue-600 tracking-tighter">%{winRate}</p>
                      : <p className="text-3xl font-black text-slate-300 tracking-tighter">—</p>}
                    {stats.activeOpps.length > 0 && <p className="text-[11px] font-bold text-slate-400 mt-0.5">{stats.activeOpps.length} aktif fırsat</p>}
                  </div>
                </div>

                {/* Detail lists */}
                <div className="overflow-y-auto flex-1 custom-scrollbar p-8 space-y-8">
                  {stats.wonOpps.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Trophy size={13} /> Kazanılan Projeler / Fırsatlar
                      </h5>
                      <div className="space-y-3">
                        {stats.wonOpps.map(opp => {
                          const val = stats.getBestValue(opp);
                          const oppProps = proposals.filter(p => p.opportunityId === opp.id);
                          const latest = oppProps.length > 0 ? [...oppProps].sort((a, b) => (b.version||0)-(a.version||0))[0] : null;
                          return (
                            <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold flex-wrap">
                                  {opp.expectedCloseDate && (
                                    <span className="flex items-center gap-1"><Calendar size={9} />{new Date(opp.expectedCloseDate).toLocaleDateString('tr-TR')}</span>
                                  )}
                                  {latest && <span>Teklif v{latest.version}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-emerald-600">{fmtVal(val)}</p>
                                <p className="text-[9px] font-black text-emerald-500 uppercase">Kazanıldı</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {stats.lostOpps.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <AlertTriangle size={13} /> Kaybedilen Fırsatlar
                      </h5>
                      <div className="space-y-3">
                        {stats.lostOpps.map(opp => {
                          const val = stats.getBestValue(opp);
                          const oppProps = proposals.filter(p => p.opportunityId === opp.id);
                          const latest = oppProps.length > 0 ? [...oppProps].sort((a, b) => (b.version||0)-(a.version||0))[0] : null;
                          return (
                            <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-red-50/60 border border-red-100">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold flex-wrap">
                                  {opp.expectedCloseDate && (
                                    <span className="flex items-center gap-1"><Calendar size={9} />{new Date(opp.expectedCloseDate).toLocaleDateString('tr-TR')}</span>
                                  )}
                                  {latest && <span>Teklif v{latest.version} · {latest.status === 'REJECTED' ? 'Reddedildi' : latest.status}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black text-red-500">{fmtVal(val)}</p>
                                <p className="text-[9px] font-black text-red-400 uppercase">Kaybedildi</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {stats.activeOpps.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={13} /> Aktif Fırsatlar
                      </h5>
                      <div className="space-y-3">
                        {stats.activeOpps.map(opp => {
                          const val = stats.getBestValue(opp);
                          return (
                            <div key={opp.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{opp.title}</p>
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border inline-block mt-1", getStatusStyle(opp.status))}>
                                  {STATUS_LABEL[opp.status] ?? opp.status}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                {val > 0 && <p className="text-sm font-black text-slate-700">{fmtVal(val)}</p>}
                                <p className="text-[9px] font-bold text-slate-400 uppercase">%{opp.probability} olasılık</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {stats.wonOpps.length === 0 && stats.lostOpps.length === 0 && stats.activeOpps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
                      <BarChart2 size={40} className="opacity-30" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Bu müşteriye ait fırsat kaydı bulunmuyor</p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 shrink-0 flex justify-end">
                  <button
                    onClick={() => setCustomerReportTarget(null)}
                    className="px-8 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Kapat
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}

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
        {lostReasonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-3xl p-8 w-full max-w-md space-y-6"
            >
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Kaybedilen Fırsat — Neden</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">"{lostReasonModal.opp.title}" fırsatı KAYBEDİLDİ olarak işaretlenecek ve otomatik arşivlenecek.</p>
              </div>
              <div className="space-y-3">
                {LOST_REASON_OPTIONS.map(reason => (
                  <label key={reason} className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all text-sm font-bold",
                    lostReasonChoice === reason ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 hover:border-slate-300"
                  )}>
                    <input
                      type="radio"
                      name="lostReason"
                      value={reason}
                      checked={lostReasonChoice === reason}
                      onChange={() => setLostReasonChoice(reason)}
                      className="accent-red-500"
                    />
                    {reason}
                  </label>
                ))}
                {lostReasonChoice === 'Diğer' && (
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nedeni yazın..."
                    value={lostReasonCustom}
                    onChange={(e) => setLostReasonCustom(e.target.value)}
                    className="input-glass w-full"
                  />
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setLostReasonModal(null); setLostReasonChoice(''); setLostReasonCustom(''); }}
                  className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest"
                >
                  İptal
                </button>
                <button
                  onClick={confirmLostReason}
                  disabled={loading || !lostReasonChoice}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Kaybedildi Olarak İşaretle
                </button>
              </div>
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
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Yeni Satış Fırsatı</h4>
                <button onClick={() => setShowNewOpportunityModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveOpportunity} className="p-8 space-y-6">
                <input type="text" name="title" required value={opportunityForm.values.title} onChange={opportunityForm.handleChange} placeholder="Fırsat Başlığı" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                <select name="customerId" required value={opportunityForm.values.customerId} onChange={opportunityForm.handleChange} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                  <option value="">Müşteri Seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" name="value" min={0} value={opportunityForm.values.value ?? 0} onChange={opportunityForm.handleChange} placeholder="Tahmini Bedel" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teklife Dönüşüm — Satış Destek Tetikleyici</p>
                  <div className="grid grid-cols-2 gap-4">
                    <select name="procurementMethod" value={opportunityForm.values.procurementMethod ?? 'OPEN'} onChange={opportunityForm.handleChange} className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      {PROCUREMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <input type="date" name="targetBidDate" value={opportunityForm.values.targetBidDate ?? ''} onChange={opportunityForm.handleChange} title="Son teklif tarihi" className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Fırsat kaydedilince seçilen usulle Satış Destek birimine ihale/dosya takibi uyarısı iletilir.</p>
                </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
