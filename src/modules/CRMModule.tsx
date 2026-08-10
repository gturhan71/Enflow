import { useState, useEffect, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  TodoTask,
  Opportunity,
  Customer,
  Proposal,
  CustomerHealthReport,
  Contact,
  ContactRole,
} from '../types';
import ProposalEditor from './ProposalEditor';
import NegotiationModule from './NegotiationModule';
import { HandOffModal } from '../components/HandOffModal';
import { workflowService } from '../services/workflowService';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useSearch, useForm } from '../hooks/useShared';
import { CustomerImportWizard } from '../components/CustomerImportWizard';
import { generateProposalPDF } from '../utils/generateProposalPDF';
import { logger } from '../utils/logger';
import { getContentJson, getCustomerStats } from './crm/helpers';
import DashboardView from './crm/DashboardView';
import OpportunitiesView from './crm/OpportunitiesView';
import CustomersView from './crm/CustomersView';
import ProposalsView from './crm/ProposalsView';
import CustomerReportModal from './crm/CustomerReportModal';
import LostReasonModal from './crm/LostReasonModal';
import ProgressCheckInModal from './crm/ProgressCheckInModal';
import NewOpportunityModal from './crm/NewOpportunityModal';
import NewCustomerModal from './crm/NewCustomerModal';
import ContactsModal, { type ContactFormState } from './crm/ContactsModal';

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
  onNavigate,
  initialItemId,
}: {
  opportunities: Opportunity[],
  setOpportunities: Dispatch<SetStateAction<Opportunity[]>>,
  customers: Customer[],
  setCustomers: Dispatch<SetStateAction<Customer[]>>,
  proposals: Proposal[],
  setProposals: Dispatch<SetStateAction<Proposal[]>>,
  activeTab?: string,
  tasks?: TodoTask[],
  setTasks?: Dispatch<SetStateAction<TodoTask[]>>,
  setActiveTab?: (tab: string) => void,
  onNavigate?: (tab: string, itemId?: string | null) => void,
  initialItemId?: string | null,
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [contactsModal, setContactsModal] = useState<Customer | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>({ name: '', role: 'OTHER', title: '', email: '', phone: '', isPrimary: false });
  const [contactSaving, setContactSaving] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [showNewOpportunityModal, setShowNewOpportunityModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  // Fırsat kartından/Teklifler sekmesinden geçmiş bir teklife tıklanınca o teklifin
  // içeriği editöre yüklensin diye — kaydedince yine de (mevcut versiyonlama mantığıyla
  // tutarlı) yeni bir versiyon olarak kaydedilir, seçilen kayıt üzerine yazılmaz.
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false);
  const [showHandOffModal, setShowHandOffModal] = useState(false);
  const [handOffTarget, setHandOffTarget] = useState<Opportunity | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<Opportunity | null>(null);
  const [customerReportTarget, setCustomerReportTarget] = useState<Customer | null>(null);
  const [customerHealth, setCustomerHealth] = useState<CustomerHealthReport | null>(null);

  useEffect(() => { apiService.getCustomerHealth().then(setCustomerHealth).catch(() => {}); }, []);

  // Deep-link: bildirim/görev "Git" ile gelen fırsatı otomatik aç (teklif sekmesinde
  // teklif editörünü açar; diğer sekmelerde fırsatı seçili getirir).
  useEffect(() => {
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
      const { creditWarning, marginWarning, ...savedProposal } = saved as Proposal & {
        creditWarning?: { exposure: number; creditLimit: number; currency: string } | null;
        marginWarning?: { marginPct: number; marginFloorPct: number } | null;
      };
      setProposals(prev => [...(prev || []), savedProposal]);
      if (creditWarning) {
        alert(`⚠ Kredi limiti uyarısı: ${selectedOpp.customer?.name || 'Müşteri'} için açık fırsat toplamı ${creditWarning.exposure.toLocaleString('tr-TR')} ${creditWarning.currency}, kredi limitini (${creditWarning.creditLimit.toLocaleString('tr-TR')} ${creditWarning.currency}) aşıyor. GM ve Satış Müdürü bilgilendirildi.`);
      }
      if (marginWarning) {
        alert(`⚠ Marj uyarısı: Teklif marjı %${marginWarning.marginPct.toFixed(1)}, eşiğin (%${marginWarning.marginFloorPct}) altında. GM ve Satış Müdürü bilgilendirildi.`);
      }

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
      setEditingProposalId(null);
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
    procurementMethod: 'OPEN', targetBidDate: '', expectedCloseDate: ''
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

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const saved = await apiService.createCustomer(customerForm.values);
      const { duplicateWarning, ...savedCustomer } = saved as Customer & { duplicateWarning?: { id: string; name: string; similarity: number }[] | null };
      setCustomers(prev => [...prev, savedCustomer]);
      setShowNewCustomerModal(false);
      customerForm.resetForm();
      if (duplicateWarning?.length) {
        const list = duplicateWarning.map(d => `• ${d.name} (%${Math.round(d.similarity * 100)} benzer)`).join('\n');
        alert(`⚠ Olası mükerrer kayıt: girilen isme benzer müşteri(ler) zaten var:\n${list}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Müşteri kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Kişiler (Contact) — kurumsal müşteride birden çok kişi ─────────────────
  const resetContactForm = () => setContactForm({ name: '', role: 'OTHER', title: '', email: '', phone: '', isPrimary: false });

  const handleSaveContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactsModal || !contactForm.name.trim()) return;
    setContactSaving(true);
    try {
      const payload = { name: contactForm.name, role: contactForm.role, title: contactForm.title || null, email: contactForm.email || null, phone: contactForm.phone || null, isPrimary: contactForm.isPrimary };
      const saved: Contact = contactForm.id
        ? await apiService.updateContact(contactsModal.id, contactForm.id, payload)
        : await apiService.createContact(contactsModal.id, payload);
      setCustomers(prev => prev.map(c => {
        if (c.id !== contactsModal.id) return c;
        const others = contactForm.isPrimary ? (c.contacts || []).map(x => ({ ...x, isPrimary: false })) : (c.contacts || []);
        const next = contactForm.id ? others.map(x => x.id === saved.id ? saved : x) : [...others, saved];
        return { ...c, contacts: next };
      }));
      setContactsModal(prev => prev ? { ...prev, contacts: (prev.contacts || []).some(x => x.id === saved.id) ? (prev.contacts || []).map(x => x.id === saved.id ? saved : x) : [...(prev.contacts || []), saved] } : prev);
      resetContactForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kişi kaydedilemedi.');
    } finally {
      setContactSaving(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!contactsModal) return;
    if (!window.confirm(`"${contact.name}" kişisini silmek istediğinize emin misiniz?`)) return;
    try {
      await apiService.deleteContact(contactsModal.id, contact.id);
      setCustomers(prev => prev.map(c => c.id === contactsModal.id ? { ...c, contacts: (c.contacts || []).filter(x => x.id !== contact.id) } : c));
      setContactsModal(prev => prev ? { ...prev, contacts: (prev.contacts || []).filter(x => x.id !== contact.id) } : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kişi silinemedi.');
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

  const handleSendForApproval = async (proposal: Proposal) => {
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
  };

  const handleGeneratePdf = async (proposal: Proposal) => {
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
  };

  const handleEditProposal = (proposal: Proposal) => {
    const o = opportunities.find(o => o.id === proposal.opportunityId);
    if (o) { setSelectedOpp(o); setEditingProposalId(proposal.id); setShowProposalEditor(true); }
  };

  const handleCreateProposalForOpp = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setEditingProposalId(null);
    setShowProposalEditor(true);
  };

  // Fırsat kartı geçmiş panelinden "Güncel Analize Git" — maliyet analizi ekranına
  // (crm-cost) o fırsat seçili olarak deep-link.
  const handleGoToCostAnalysis = (opp: Opportunity) => {
    if (onNavigate) onNavigate('crm-cost', opp.id);
    else if (setActiveTab) setActiveTab('crm-cost');
  };

  const [isEditingOpp, setIsEditingOpp] = useState(false);

  const handleSaveOpportunity = async (e: FormEvent) => {
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
      targetBidDate: opp.targetBidDate ? opp.targetBidDate.slice(0, 10) : '',
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : ''
    });
    setIsEditingOpp(true);
    setShowNewOpportunityModal(true);
  };

  const handleProgressCheckInSaved = (updated: Opportunity) => {
    setOpportunities(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
  };

  const handleProgressStatus = async (opp: Opportunity, toStatus: Opportunity['status']) => {
    try {
      const updated = await apiService.updateOpportunity(opp.id, { status: toStatus });
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, ...updated, status: toStatus } : o));
    } catch {
      alert('Durum güncellenemedi.');
    }
  };

  if (showProposalEditor && selectedOpp) {
    const oppProposals = Array.isArray(proposals) ? proposals.filter(p => p.opportunityId === selectedOpp.id) : [];
    const latestProposal = oppProposals.length > 0
      ? [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0]
      : null;
    // Fırsat kartından/Teklifler sekmesinden geçmiş bir versiyona "Düzenle" ile gelindiyse
    // içerik o versiyondan yüklenir; aksi halde (yeni teklif / genel "Düzenle") en güncel versiyon baz alınır.
    const sourceProposal = (editingProposalId && oppProposals.find(p => p.id === editingProposalId)) || latestProposal;

    const nextVersion = latestProposal ? (latestProposal.version || 1) + 1 : 1;
    let initialData = undefined;

    if (sourceProposal && sourceProposal.content) {
      try {
        const content = typeof sourceProposal.content === 'string'
          ? JSON.parse(sourceProposal.content)
          : sourceProposal.content;

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
        logger.error("Failed to parse proposal content", e);
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
          setEditingProposalId(null);
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
      ) : activeTab === 'crm-opportunities' ? (
        <OpportunitiesView
          filteredOpportunities={opportunitySearch.filteredItems}
          customers={customers}
          proposals={proposals}
          loading={loading}
          onSaveAll={handleSaveAll}
          onNewOpportunity={() => { opportunityForm.resetForm(); setIsEditingOpp(false); setShowNewOpportunityModal(true); }}
          onProgressStatus={handleProgressStatus}
          onMarkLost={(opp) => setLostReasonModal({ opp })}
          onHandOff={(opp) => { setHandOffTarget(opp); setShowHandOffModal(true); }}
          onEdit={openEditOpportunity}
          onCheckIn={(opp) => setCheckInTarget(opp)}
          onEditProposal={handleEditProposal}
          onGoToCostAnalysis={handleGoToCostAnalysis}
        />
      ) : activeTab === 'crm-customers' ? (
        <CustomersView
          filteredCustomers={customerSearch.filteredItems}
          totalCount={customers.length}
          searchQuery={customerSearch.searchQuery}
          setSearchQuery={customerSearch.setSearchQuery}
          customerHealth={customerHealth}
          onImport={() => setShowImportWizard(true)}
          onNewCustomer={() => { customerForm.resetForm(); setShowNewCustomerModal(true); }}
          getStats={(customerId) => getCustomerStats(customerId, opportunities, proposals)}
          onOpenReport={setCustomerReportTarget}
          onOpenContacts={(customer) => { setContactsModal(customer); resetContactForm(); }}
        />
      ) : activeTab === 'crm-proposals' ? (
        <ProposalsView
          opportunities={opportunities}
          proposals={proposals}
          customers={customers}
          loading={loading}
          generatingPdfId={generatingPdfId}
          onCreateProposal={handleCreateProposalForOpp}
          onWonOpportunity={handleWonOpportunity}
          onLostOpportunity={handleLostOpportunity}
          onEditProposal={handleEditProposal}
          onSendForApproval={handleSendForApproval}
          onGeneratePdf={handleGeneratePdf}
          onMarkDelivered={handleMarkDelivered}
          onWonProposal={handleWonProposal}
          onLostProposal={handleLostProposal}
        />
      ) : (
        <DashboardView
          opportunities={opportunities}
          customers={customers}
          proposals={proposals}
          setActiveTab={setActiveTab}
        />
      )}

      <AnimatePresence>
        {customerReportTarget && (
          <CustomerReportModal
            customer={customerReportTarget}
            stats={getCustomerStats(customerReportTarget.id, opportunities, proposals)}
            onClose={() => setCustomerReportTarget(null)}
          />
        )}

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
        {checkInTarget && (
          <ProgressCheckInModal
            opp={checkInTarget}
            onClose={() => setCheckInTarget(null)}
            onSaved={handleProgressCheckInSaved}
          />
        )}
        {lostReasonModal && (
          <LostReasonModal
            target={lostReasonModal}
            choice={lostReasonChoice}
            setChoice={setLostReasonChoice}
            custom={lostReasonCustom}
            setCustom={setLostReasonCustom}
            loading={loading}
            onCancel={() => { setLostReasonModal(null); setLostReasonChoice(''); setLostReasonCustom(''); }}
            onConfirm={confirmLostReason}
          />
        )}
        {showNewOpportunityModal && (
          <NewOpportunityModal
            values={opportunityForm.values}
            handleChange={opportunityForm.handleChange}
            customers={customers}
            onSubmit={handleSaveOpportunity}
            onClose={() => setShowNewOpportunityModal(false)}
          />
        )}
        {showNewCustomerModal && (
          <NewCustomerModal
            values={customerForm.values}
            handleChange={customerForm.handleChange}
            onSubmit={handleSaveCustomer}
            onClose={() => setShowNewCustomerModal(false)}
            loading={loading}
          />
        )}

        {/* Kişiler (Contact) modalı — kurumsal müşteride birden çok kişi */}
        {contactsModal && (
          <ContactsModal
            customer={contactsModal}
            contactForm={contactForm}
            setContactForm={setContactForm}
            contactSaving={contactSaving}
            onSave={handleSaveContact}
            onDelete={handleDeleteContact}
            onClose={() => setContactsModal(null)}
            onResetForm={resetContactForm}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRMModule;
