import { TodoTask, Opportunity, Project, Contract, Proposal } from '../../types';

// Modül-bazlı İŞLEVSEL görev kataloğu — atanan görevin ne yapacağı zorunlu seçilir
// (örn. "Presales: BoM hazırla → Fırsat X"). GENERAL dışı modüllerde eylem zorunludur.
export const TASK_ACTIONS: Record<string, { key: string; label: string }[]> = {
  OPPORTUNITY: [
    { key: 'BOM_PREPARE', label: 'BoM (malzeme listesi) hazırla' },
    { key: 'COST_ANALYSIS', label: 'Maliyet analizi yap' },
    { key: 'SPEC_ANALYSIS', label: 'Şartname analizi yap' },
    { key: 'PROPOSAL_PREPARE', label: 'Teklif hazırla' },
    { key: 'NEGOTIATION', label: 'Pazarlık yürüt' },
  ],
  PROJECT: [
    { key: 'MILESTONE_UPDATE', label: 'Milestone güncelle' },
    { key: 'HANDOVER_DOCS', label: 'Devir paketi evrakı hazırla' },
    { key: 'COST_ENTRY', label: 'Maliyet kalemi gir' },
  ],
  PROCUREMENT: [
    { key: 'VENDOR_QUOTE', label: 'Tedarikçi teklifi al' },
    { key: 'PO_ISSUE', label: 'Satınalma siparişi (PO) oluştur' },
    { key: 'DELIVERY_RECORD', label: 'Teslimat kaydı gir' },
  ],
  CONTRACT: [
    { key: 'DOC_PREPARE', label: 'Sözleşme evrakı hazırla' },
    { key: 'SIGN_APPROVE', label: 'İmza onayına sun' },
  ],
  LEGAL: [
    { key: 'CONTRACT_REVIEW', label: 'Sözleşme hukuki incelemesi' },
    { key: 'CASE_OPEN', label: 'Hukuki dosya aç' },
    { key: 'OPINION', label: 'Hukuki görüş hazırla' },
  ],
};

// İşlevsel eylem → o işin yapıldığı modül sekmesi (deep-link hedefi).
const ACTION_TARGET: Record<string, string> = {
  BOM_PREPARE: 'presales', SPEC_ANALYSIS: 'presales',
  COST_ANALYSIS: 'crm-cost', PROPOSAL_PREPARE: 'crm-proposals', NEGOTIATION: 'crm-negotiation',
  MILESTONE_UPDATE: 'project-mgmt', HANDOVER_DOCS: 'project-mgmt', COST_ENTRY: 'project-mgmt',
  VENDOR_QUOTE: 'procurement', PO_ISSUE: 'procurement', DELIVERY_RECORD: 'procurement',
  DOC_PREPARE: 'contract-workflow', SIGN_APPROVE: 'contract-workflow',
  CONTRACT_REVIEW: 'contract-workflow', CASE_OPEN: 'contract-workflow', OPINION: 'contract-workflow',
};
// Eylem yoksa modüle göre kaba hedef.
const MODULE_TARGET: Record<string, string> = {
  OPPORTUNITY: 'crm-opportunities', PROJECT: 'project-mgmt', PROCUREMENT: 'procurement',
  CONTRACT: 'contract-workflow', LEGAL: 'contract-workflow',
};
// Bir görevin gidilecek modül sekmesi (eylem önce, sonra modül).
export const taskTargetTab = (t: { actionKey?: string | null; relatedModule?: string | null }): string | null =>
  (t.actionKey ? ACTION_TARGET[t.actionKey] : undefined) || (t.relatedModule ? MODULE_TARGET[t.relatedModule] : undefined) || null;

// Onay zincirindeki rol kodları için görünen ad — Ayarlar'daki ROLE_LABELS ile tutarlı.
export const CHAIN_ROLE_LABEL: Record<string, string> = {
  FINANCE_MGR: 'Finans',
  IGPD_MGR: 'İGB',
  GENERAL_MANAGER: 'Üst Yönetim',
  KSU_MGR: 'KSU',
};
export const CHAIN_ENTITY_LABEL: Record<string, string> = {
  OPPORTUNITY: 'Fırsat/Teklif Onayı',
  PROPOSAL: 'Teklif Onayı',
  CONTRACT_WORKFLOW_SIGNING: 'Sözleşme İmza Onayı',
  DMO_ORDER: 'DMO Sipariş Onayı (kârsız)',
};

// Görevin tamamlandığı an — her zaman görünür olması gereken zaman damgası
// (Tamamlanan Görevler bölümü). Tarih + saat, TR yerel biçimi.
export const fmtCompletedAt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

// İlgili modülün seçilebilir kayıtları (fırsat/proje).
export const itemsForModule = (
  mod: string | undefined,
  { opportunities, projects }: { opportunities?: Opportunity[]; projects?: Project[] }
): { id: string; name: string }[] => {
  if (mod === 'OPPORTUNITY') return (opportunities || []).map(o => ({ id: o.id, name: o.title }));
  if (mod === 'PROJECT' || mod === 'PROCUREMENT') return (projects || []).map(p => ({ id: p.id, name: p.name }));
  return [];
};

// İşlevsel görev başlığını eylem + ilgili kayıttan kompoze eder.
export const composedTitle = (
  newTask: Partial<TodoTask>,
  taskAction: string,
  ctx: { opportunities?: Opportunity[]; projects?: Project[] }
): string => {
  const mod = newTask.relatedModule || 'GENERAL';
  if (mod === 'GENERAL') return newTask.title || '';
  const action = TASK_ACTIONS[mod]?.find(a => a.key === taskAction);
  if (!action) return '';
  const item = itemsForModule(mod, ctx).find(i => i.id === newTask.relatedItemId);
  return item ? `${action.label} — ${item.name}` : action.label;
};

export const getRelatedItemName = (
  todo: TodoTask,
  { projects, opportunities, proposals, contracts }: {
    projects?: Project[]; opportunities?: Opportunity[]; proposals?: Proposal[]; contracts?: Contract[];
  }
): string => {
  if (!todo.relatedItemId) return '';
  switch (todo.relatedModule) {
    case 'PROJECT':
    case 'PROCUREMENT':
      return projects?.find(p => p.id === todo.relatedItemId)?.name || 'Bilinmeyen Proje';
    case 'OPPORTUNITY':
      return opportunities?.find(o => o.id === todo.relatedItemId)?.title || 'Bilinmeyen Fırsat';
    case 'CONTRACT': {
      // Eski teklif onay görevleri relatedModule:'CONTRACT' ile kaydedildi
      // relatedItemId bir proposal id'si olabilir — önce proposal'da ara
      const proposalMatch = proposals?.find(p => p.id === todo.relatedItemId);
      if (proposalMatch) {
        const opp = opportunities?.find(o => o.id === proposalMatch.opportunityId);
        return opp?.title || 'Bilinmeyen Fırsat';
      }
      const contract = contracts?.find(c => c.id === todo.relatedItemId);
      const proj = projects?.find(p => p.id === contract?.projectId);
      return proj?.name || contract?.id || 'Bilinmeyen Sözleşme';
    }
    case 'PROPOSAL': {
      const proposal = proposals?.find(p => p.id === todo.relatedItemId);
      if (!proposal) return 'Bilinmeyen Teklif';
      const opp = opportunities?.find(o => o.id === proposal.opportunityId);
      return opp?.title || 'Bilinmeyen Fırsat';
    }
    default:
      return '';
  }
};

export interface ProposalDetailItem {
  partNumber: string;
  description: string;
  quantity: number;
  purchaseCost?: number;
  unitSalePrice?: number;
  totalSalePrice?: number;
  marginPercentage?: number;
}

export interface ProposalDetail {
  price: string;
  totalPrice: number;
  totalCost: number;
  items: ProposalDetailItem[];
  description: string;
  terms: string;
  version: number;
  opportunityTitle: string;
}

export const getProposalDetail = (
  todo: TodoTask,
  { proposals, opportunities, projects, contracts }: {
    proposals?: Proposal[]; opportunities?: Opportunity[]; projects?: Project[]; contracts?: Contract[];
  }
): ProposalDetail | null => {
  if (!todo.relatedItemId) return null;
  const proposal = proposals?.find(p => p.id === todo.relatedItemId);
  if (!proposal) return null;

  let totalPrice: number | undefined = proposal.totalPrice;
  let items: ProposalDetailItem[] = (proposal.items as ProposalDetailItem[]) || [];
  let description = proposal.description || '';
  let terms = proposal.terms || '';

  if (proposal.content) {
    try {
      const parsed = typeof proposal.content === 'string'
        ? JSON.parse(proposal.content)
        : proposal.content;
      if (totalPrice == null) totalPrice = parsed.totalPrice as number | undefined;
      if (!items.length && Array.isArray(parsed.items)) items = parsed.items as ProposalDetailItem[];
      if (!description) description = (parsed.description as string) || '';
      if (!terms) terms = (parsed.terms as string) || '';
    } catch { /* ignore */ }
  }

  if (totalPrice == null) return null;

  const totalCost = items.reduce(
    (s, i) => s + (i.purchaseCost ?? 0) * (i.quantity ?? 1),
    0
  );

  const opp = opportunities?.find(o => o.id === proposal.opportunityId);

  return {
    price: totalPrice.toLocaleString('tr-TR'),
    totalPrice,
    totalCost,
    items,
    description,
    terms,
    version: proposal.version || 1,
    opportunityTitle: opp?.title || getRelatedItemName(todo, { projects, opportunities, proposals, contracts }),
  };
};
