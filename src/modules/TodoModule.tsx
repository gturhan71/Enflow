import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Briefcase,
  Calendar,
  Filter,
  Target,
  Loader2,
  DollarSign,
  Eye,
  FileText,
  Package,
  TrendingUp,
  Bell,
  SendHorizonal,
  Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import {
  TodoTask,
  Opportunity,
  Project,
  Contract,
  Unit,
  Proposal,
  ApprovalChain
} from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// Onay zincirindeki rol kodları için görünen ad — Ayarlar'daki ROLE_LABELS ile tutarlı.
const CHAIN_ROLE_LABEL: Record<string, string> = {
  FINANCE_MGR: 'Finans',
  IGPD_MGR: 'İGPD',
  GENERAL_MANAGER: 'Üst Yönetim',
  KSU_MGR: 'KSU',
};
const CHAIN_ENTITY_LABEL: Record<string, string> = {
  OPPORTUNITY: 'Fırsat/Teklif Onayı',
  PROPOSAL: 'Teklif Onayı',
  CONTRACT_WORKFLOW_SIGNING: 'Sözleşme İmza Onayı',
};


const TodoModule = ({
  tasks,
  setTasks,
  projects,
  opportunities,
  contracts,
  units,
  proposals,
  setProposals
}: {
  tasks: TodoTask[],
  setTasks: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  projects?: Project[],
  opportunities?: Opportunity[],
  contracts?: Contract[],
  units?: Unit[],
  proposals?: Proposal[],
  setProposals?: React.Dispatch<React.SetStateAction<Proposal[]>>
}) => {
  const { currentUser } = useAuth();
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [pendingChainApprovals, setPendingChainApprovals] = useState<ApprovalChain[]>([]);
  const [chainActionLoading, setChainActionLoading] = useState<string | null>(null);

  // Bekleyen Onaylarım — Onay Zinciri (Faz 1, Finans/İGPD/Üst Yönetim/KSU swimlane'i).
  // Kullanıcının rolü zincirde hangi aşamadaysa, sırası gelmiş onaylar burada listelenir.
  const refreshPendingChainApprovals = useCallback(async () => {
    if (!currentUser?.role) return;
    try {
      const chains = await apiService.getPendingApprovalChainsForRole(currentUser.role);
      setPendingChainApprovals(chains);
    } catch {
      // sessizce geç — bu görünüm opsiyonel bir ek katman
    }
  }, [currentUser?.role]);

  useEffect(() => { refreshPendingChainApprovals(); }, [refreshPendingChainApprovals]);

  const handleChainStageAction = async (chain: ApprovalChain, stageId: string, action: 'approve' | 'reject') => {
    if (!currentUser?.id) return;
    setChainActionLoading(stageId);
    try {
      if (action === 'approve') {
        await apiService.approveApprovalStage(chain.id, stageId, { approverId: currentUser.id });
      } else {
        await apiService.rejectApprovalStage(chain.id, stageId, { approverId: currentUser.id });
      }
      await refreshPendingChainApprovals();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setChainActionLoading(null);
    }
  };
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewTask, setPreviewTask] = useState<TodoTask | null>(null);
  const [newTask, setNewTask] = useState<Partial<TodoTask>>({
    priority: 'MEDIUM',
    status: 'PENDING',
    relatedModule: 'GENERAL'
  });

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.unitId) return alert('Lütfen zorunlu alanları doldurun.');
    setLoading(true);
    try {
      const task = await apiService.createTask({
        ...newTask,
        assignedBy: currentUser?.id,
        createdAt: new Date().toISOString()
      });
      setTasks([task, ...tasks]);
      setShowNewTaskModal(false);
      setNewTask({ priority: 'MEDIUM', status: 'PENDING', relatedModule: 'GENERAL' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Görev atanamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TodoTask['status']) => {
    try {
      const updated = await apiService.updateTask(taskId, { status: newStatus });
      setTasks(tasks.map(t => t.id === taskId ? updated : t));
    } catch (err) {
      alert('Durum güncellenemedi.');
    }
  };

  // 'PROPOSAL' yeni format; 'CONTRACT' eski format — her ikisini de yakala
  const isProposalApprovalTask = (t: TodoTask) =>
    t.relatedModule === 'PROPOSAL' ||
    (t.relatedModule === 'CONTRACT' && proposals?.some(p => p.id === t.relatedItemId));

  const proposalTasks = tasks.filter(isProposalApprovalTask);
  const pendingApprovals = proposalTasks.filter(t => t.status === 'PENDING');
  const resolvedApprovals = proposalTasks.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED');

  const isDeliveryTask = (t: TodoTask) => t.relatedModule === 'DELIVERY';

  const deliveryTasks = tasks.filter(isDeliveryTask);
  const pendingDeliveries = deliveryTasks.filter(t => t.status === 'PENDING');

  const regularTasks = tasks.filter(t => !isProposalApprovalTask(t) && !isDeliveryTask(t));
  const filteredTodos = filterUnit === 'all'
    ? regularTasks
    : regularTasks.filter(t => t.unitId === filterUnit);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'IN_PROGRESS': return <Clock size={16} className="text-amber-500" />;
      case 'CANCELLED': return <X size={16} className="text-slate-400" />;
      default: return <AlertCircle size={16} className="text-indigo-500" />;
    }
  };

  const getRelatedItemName = (todo: TodoTask) => {
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

  interface ProposalDetailItem {
    partNumber: string;
    description: string;
    quantity: number;
    purchaseCost?: number;
    unitSalePrice?: number;
    totalSalePrice?: number;
    marginPercentage?: number;
  }

  interface ProposalDetail {
    price: string;
    totalPrice: number;
    totalCost: number;
    items: ProposalDetailItem[];
    description: string;
    terms: string;
    version: number;
    opportunityTitle: string;
  }

  const getProposalDetail = (todo: TodoTask): ProposalDetail | null => {
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
      opportunityTitle: opp?.title || getRelatedItemName(todo),
    };
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-geist">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Görevler & Takip</h3>
          <p className="text-slate-500 font-medium">Birim bazlı yönetimsel görev atamaları ve süreç takibi.</p>
        </div>
        <button 
          onClick={() => setShowNewTaskModal(true)}
          className="bg-indigo-600 text-white px-10 py-4 rounded-[28px] text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 uppercase tracking-widest"
        >
          <Plus size={20} /> Yeni Görev Ata
        </button>
      </div>

      {/* ── Bekleyen Onaylarım — Onay Zinciri (Finans/İGPD/Üst Yönetim/KSU) ── */}
      {pendingChainApprovals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Landmark className="text-violet-500" size={20} />
            <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">
              Bekleyen Onaylarım — {CHAIN_ROLE_LABEL[currentUser?.role || ''] || currentUser?.role}
            </h4>
            <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-violet-200">
              {pendingChainApprovals.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {pendingChainApprovals.map(chain => {
              const myStage = chain.stages.find(s => s.role === currentUser?.role && s.status === 'PENDING');
              if (!myStage) return null;
              return (
                <motion.div
                  layout
                  key={chain.id}
                  className="glass-panel p-6 rounded-[32px] bg-violet-50/40 border border-violet-100 flex flex-col md:flex-row md:items-center gap-6"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                      {CHAIN_ENTITY_LABEL[chain.entityType || ''] || chain.entityType}
                    </span>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                      Zincir: {chain.stages.map(s => CHAIN_ROLE_LABEL[s.role] || s.role).join(' → ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleChainStageAction(chain, myStage.id, 'reject')}
                      disabled={chainActionLoading === myStage.id}
                      className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <X size={14} /> Reddet
                    </button>
                    <button
                      onClick={() => handleChainStageAction(chain, myStage.id, 'approve')}
                      disabled={chainActionLoading === myStage.id}
                      className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-violet-100"
                    >
                      {chainActionLoading === myStage.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Onayla
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Onay Bekleyen Teklifler ───────────────────────────────── */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <AlertCircle className="text-amber-500" size={22} />
            </motion.div>
            <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Onay Bekleyen Teklifler</h4>
            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
              {pendingApprovals.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {pendingApprovals.map((todo) => {
              const detail = getProposalDetail(todo);
              return (
                <motion.div
                  layout
                  key={todo.id}
                  className="glass-panel p-8 rounded-[40px] bg-white border-2 border-amber-300 shadow-amber-50/30 flex flex-col md:flex-row md:items-center gap-8"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={cn("text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", getPriorityColor(todo.priority))}>
                        {todo.priority}
                      </span>
                      <h4 className="font-black text-slate-900 text-lg tracking-tight">{todo.title}</h4>
                      {detail && (
                        <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                          <DollarSign size={12} />{detail.price}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{todo.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg w-fit">
                      <Target size={13} />
                      Fırsat: {getRelatedItemName(todo)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setPreviewTask(todo)}
                      className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
                    >
                      <Eye size={15} /> İncele
                    </button>
                    <button
                      onClick={async () => {
                        await handleStatusChange(todo.id, 'COMPLETED');
                        await apiService.updateProposal(todo.relatedItemId!, { status: 'APPROVED' });
                        setProposals?.(prev => prev.map(p =>
                          p.id === todo.relatedItemId ? { ...p, status: 'APPROVED' } : p
                        ));
                      }}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                    >
                      <CheckCircle2 size={15} /> Onayla
                    </button>
                    <button
                      onClick={async () => {
                        await handleStatusChange(todo.id, 'CANCELLED');
                        await apiService.updateProposal(todo.relatedItemId!, { status: 'REJECTED' });
                        setProposals?.(prev => prev.map(p =>
                          p.id === todo.relatedItemId ? { ...p, status: 'REJECTED' } : p
                        ));
                      }}
                      className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                    >
                      <X size={15} /> Reddet
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Gönderilen Teklif Bildirimleri ───────────────────────── */}
      {pendingDeliveries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}>
              <Bell className="text-blue-500" size={20} />
            </motion.div>
            <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Gönderilen Teklif Bildirimleri</h4>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200">
              {pendingDeliveries.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {pendingDeliveries.map(todo => (
              <motion.div
                layout
                key={todo.id}
                className="glass-panel p-6 rounded-[32px] bg-blue-50/40 border border-blue-100 flex flex-col md:flex-row md:items-center gap-6"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-100 shrink-0">
                  <SendHorizonal size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-900 text-sm tracking-tight">{todo.title}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">{todo.description}</p>
                </div>
                <button
                  onClick={() => handleStatusChange(todo.id, 'COMPLETED')}
                  className="shrink-0 flex items-center gap-2 bg-white border border-blue-200 text-blue-600 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 whitespace-nowrap"
                >
                  <CheckCircle2 size={14} /> Okundu
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Genel Görevler ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Görevler</h4>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterUnit('all')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
              filterUnit === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
            )}
          >
            Tüm Birimler
          </button>
          {units?.map(unit => (
            <button
              key={unit.id}
              onClick={() => setFilterUnit(unit.id)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                filterUnit === unit.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
              )}
            >
              {unit.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5">
          {filteredTodos.length === 0 ? (
            <div className="p-16 text-center glass-panel rounded-[40px] border-dashed border-2 border-slate-100">
              <ListTodo size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Henüz görev atanmamış.</p>
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <motion.div
                layout
                key={todo.id}
                className={cn(
                  "glass-panel p-8 rounded-[40px] bg-white border border-slate-100 flex flex-col md:flex-row md:items-center gap-8 transition-all hover:border-indigo-200",
                  todo.status === 'COMPLETED' && "opacity-60"
                )}
              >
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className={cn("text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest", getPriorityColor(todo.priority))}>
                      {todo.priority}
                    </span>
                    <h4 className="font-black text-slate-900 text-xl tracking-tight">{todo.title}</h4>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{todo.description}</p>
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                      <Briefcase size={13} />
                      {units?.find(u => u.id === todo.unitId)?.name}
                    </div>
                    {todo.relatedModule && todo.relatedModule !== 'GENERAL' && (
                      <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">
                        <Target size={13} />
                        {todo.relatedModule === 'PROJECT' && `Proje: ${getRelatedItemName(todo)}`}
                        {todo.relatedModule === 'OPPORTUNITY' && `Fırsat: ${getRelatedItemName(todo)}`}
                        {todo.relatedModule === 'CONTRACT' && `Sözleşme: ${getRelatedItemName(todo)}`}
                      </div>
                    )}
                    {todo.dueDate && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        <Calendar size={13} />
                        Termin: {todo.dueDate}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-6 md:pt-0">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                    {getStatusIcon(todo.status)}
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                      {todo.status.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStatusChange(todo.id, todo.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
                      todo.status === 'COMPLETED' ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-white text-slate-300 border border-slate-100 hover:border-emerald-500 hover:text-emerald-500"
                    )}
                  >
                    <CheckCircle2 size={24} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ── Onaylanan / Reddedilen Teklifler ─────────────────────── */}
      {resolvedApprovals.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Onaylanan / Reddedilen Teklifler</h4>
          <div className="grid grid-cols-1 gap-4">
            {resolvedApprovals.map((todo) => {
              const approved = todo.status === 'COMPLETED';
              const detail = getProposalDetail(todo);
              return (
                <motion.div
                  layout
                  key={todo.id}
                  className={cn(
                    "p-7 rounded-[32px] border flex flex-col md:flex-row md:items-center gap-6 transition-all",
                    approved
                      ? "bg-emerald-50/60 border-emerald-100"
                      : "bg-red-50/40 border-red-100"
                  )}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest",
                        approved
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-red-100 text-red-600 border-red-200"
                      )}>
                        {approved ? <CheckCircle2 size={11} /> : <X size={11} />}
                        {approved ? 'Onaylandı' : 'Reddedildi'}
                      </span>
                      <h4 className="font-black text-slate-700 text-base tracking-tight">{todo.title}</h4>
                      {detail && (
                        <span className="flex items-center gap-1.5 bg-white border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                          <DollarSign size={11} />{detail.price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white/70 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                      <Target size={12} />
                      Fırsat: {getRelatedItemName(todo)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proposal Preview Modal */}
      <AnimatePresence>
        {previewTask && (() => {
          const detail = getProposalDetail(previewTask);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col max-h-[92vh]"
              >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-start justify-between shrink-0">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-widest">
                        Onay Bekliyor
                      </span>
                      {detail && (
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                          v{detail.version}
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{previewTask.title}</h3>
                    {detail && (
                      <p className="text-sm text-slate-500 font-medium mt-1">
                        Fırsat: {detail.opportunityTitle}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setPreviewTask(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                  {!detail ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <FileText size={40} className="mb-3 opacity-30" />
                      <p className="font-bold text-sm">Teklif detayı yüklenemedi.</p>
                    </div>
                  ) : (
                    <>
                      {/* Kalemler */}
                      {detail.items.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Package size={16} className="text-slate-400" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Kalemleri</h4>
                          </div>
                          <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-5 py-3 text-left font-black text-slate-500 whitespace-nowrap">Parça No</th>
                                  <th className="px-5 py-3 text-left font-black text-slate-500">Açıklama</th>
                                  <th className="px-5 py-3 text-right font-black text-slate-500">Adet</th>
                                  <th className="px-5 py-3 text-right font-black text-slate-500 whitespace-nowrap">Birim Maliyet</th>
                                  <th className="px-5 py-3 text-right font-black text-slate-500 whitespace-nowrap">Birim Satış</th>
                                  <th className="px-5 py-3 text-right font-black text-slate-500">Marj</th>
                                  <th className="px-5 py-3 text-right font-black text-slate-500">Satış Toplamı</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {detail.items.map((item, i) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                    <td className="px-5 py-3 font-bold text-slate-600 whitespace-nowrap">{item.partNumber}</td>
                                    <td className="px-5 py-3 text-slate-600">{item.description}</td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-600">{item.quantity}</td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-400 whitespace-nowrap">
                                      {item.purchaseCost != null ? item.purchaseCost.toLocaleString('tr-TR') : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                                      {item.unitSalePrice != null ? item.unitSalePrice.toLocaleString('tr-TR') : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-emerald-600">
                                      {item.marginPercentage != null ? `%${item.marginPercentage}` : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black text-slate-800 whitespace-nowrap">
                                      {item.totalSalePrice != null
                                        ? item.totalSalePrice.toLocaleString('tr-TR')
                                        : item.unitSalePrice != null
                                          ? (item.unitSalePrice * item.quantity).toLocaleString('tr-TR')
                                          : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Maliyet Özeti */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam Maliyet</p>
                          <p className="text-xl font-black text-slate-700">{detail.totalCost.toLocaleString('tr-TR')}</p>
                        </div>
                        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Teklif Tutarı</p>
                          <p className="text-xl font-black text-emerald-700">{detail.price}</p>
                        </div>
                        <div className={cn(
                          "p-5 border rounded-2xl text-center",
                          detail.totalCost > 0 && detail.totalPrice > detail.totalCost
                            ? "bg-blue-50 border-blue-100"
                            : "bg-red-50 border-red-100"
                        )}>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tahmini Marj</p>
                          <p className={cn(
                            "text-xl font-black",
                            detail.totalCost > 0 && detail.totalPrice > detail.totalCost ? "text-blue-700" : "text-red-600"
                          )}>
                            {detail.totalCost > 0
                              ? `%${(((detail.totalPrice - detail.totalCost) / detail.totalPrice) * 100).toFixed(1)}`
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Açıklama */}
                      {detail.description && (
                        <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Açıklama</p>
                          <p className="text-sm text-slate-700 font-medium leading-relaxed">{detail.description}</p>
                        </div>
                      )}

                      {/* Şartlar */}
                      {detail.terms && (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Şartlar & Koşullar</p>
                          <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">{detail.terms}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer — Approve / Reject */}
                <div className="p-8 border-t border-slate-100 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => setPreviewTask(null)}
                    className="px-6 py-3 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest"
                  >
                    Kapat
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        await handleStatusChange(previewTask.id, 'CANCELLED');
                        await apiService.updateProposal(previewTask.relatedItemId!, { status: 'REJECTED' });
                        setProposals?.(prev => prev.map(p =>
                          p.id === previewTask.relatedItemId ? { ...p, status: 'REJECTED' } : p
                        ));
                        setPreviewTask(null);
                      }}
                      className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95"
                    >
                      <X size={15} /> Reddet
                    </button>
                    <button
                      onClick={async () => {
                        await handleStatusChange(previewTask.id, 'COMPLETED');
                        await apiService.updateProposal(previewTask.relatedItemId!, { status: 'APPROVED' });
                        setProposals?.(prev => prev.map(p =>
                          p.id === previewTask.relatedItemId ? { ...p, status: 'APPROVED' } : p
                        ));
                        setPreviewTask(null);
                      }}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
                    >
                      <CheckCircle2 size={15} /> Onayla
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Yeni Görev Ata</h4>
                <button onClick={() => setShowNewTaskModal(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Haftalık Satış Raporu"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Modül</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none appearance-none"
                      value={newTask.relatedModule || 'GENERAL'}
                      onChange={(e) => setNewTask({...newTask, relatedModule: e.target.value as any, relatedItemId: ''})}
                    >
                      <option value="GENERAL">Genel Görev</option>
                      <option value="PROJECT">Proje Yönetimi</option>
                      <option value="OPPORTUNITY">CRM & Fırsat</option>
                      <option value="CONTRACT">Sözleşme</option>
                      <option value="PROCUREMENT">Satın Alma</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Birim</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, unitId: e.target.value})}
                    >
                      <option value="">Seçiniz</option>
                      {units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Öncelik</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                    >
                      <option value="LOW">Düşük</option>
                      <option value="MEDIUM">Orta</option>
                      <option value="HIGH">Yüksek</option>
                      <option value="URGENT">Acil</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Termin Tarihi</label>
                    <input 
                      type="date" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Detayı</label>
                  <textarea 
                    rows={3}
                    placeholder="Görev ile ilgili detaylı açıklama..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none resize-none"
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-8 py-3 text-sm font-black text-slate-500 uppercase tracking-widest"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddTask}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : 'Görevi Ata'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ListTodo = ({ size, className }: { size: number, className: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m3 16 2 2 4-4"/><path d="m3 6 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>
  </svg>
);

export default TodoModule;
