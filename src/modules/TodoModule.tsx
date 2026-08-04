import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import {
  TodoTask,
  Opportunity,
  Project,
  Contract,
  Unit,
  User,
  Proposal,
  ApprovalChain
} from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import {
  itemsForModule,
  composedTitle,
  getRelatedItemName,
  getProposalDetail,
} from './todo/helpers';
import PendingChainApprovals from './todo/PendingChainApprovals';
import PendingProposalApprovals from './todo/PendingProposalApprovals';
import PendingDeliveryNotifications from './todo/PendingDeliveryNotifications';
import TaskList from './todo/TaskList';
import ResolvedApprovals from './todo/ResolvedApprovals';
import ProposalPreviewModal from './todo/ProposalPreviewModal';
import NewTaskModal from './todo/NewTaskModal';

const TodoModule = ({
  tasks,
  setTasks,
  projects,
  opportunities,
  contracts,
  units,
  users,
  proposals,
  setProposals,
  onNavigate
}: {
  tasks: TodoTask[],
  setTasks: Dispatch<SetStateAction<TodoTask[]>>,
  projects?: Project[],
  opportunities?: Opportunity[],
  contracts?: Contract[],
  units?: Unit[],
  users?: User[],
  proposals?: Proposal[],
  setProposals?: Dispatch<SetStateAction<Proposal[]>>,
  onNavigate?: (tab: string, itemId?: string | null) => void
}) => {
  const { currentUser } = useAuth();
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [pendingChainApprovals, setPendingChainApprovals] = useState<ApprovalChain[]>([]);
  const [chainActionLoading, setChainActionLoading] = useState<string | null>(null);

  // Bekleyen Onaylarım — Onay Zinciri (Faz 1, Finans/İGB/Üst Yönetim/KSU swimlane'i).
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
  const [taskAction, setTaskAction] = useState('');

  const handleAddTask = async () => {
    const mod = newTask.relatedModule || 'GENERAL';
    if (!newTask.unitId) return alert('Lütfen bir birim seçin.');
    let title = newTask.title;
    if (mod !== 'GENERAL') {
      if (!taskAction) return alert('İşlevsel görev tanımını seçin (örn. BoM hazırla).');
      if (itemsForModule(mod, { opportunities, projects }).length > 0 && !newTask.relatedItemId) return alert('İlgili kaydı (fırsat/proje) seçin.');
      title = composedTitle(newTask, taskAction, { opportunities, projects });
    }
    if (!title) return alert('Görev tanımı eksik.');
    setLoading(true);
    try {
      const task = await apiService.createTask({
        ...newTask,
        title,
        actionKey: mod !== 'GENERAL' ? taskAction : undefined,
        assignedBy: currentUser?.id,
        createdAt: new Date().toISOString()
      });
      setTasks([task, ...tasks]);
      setShowNewTaskModal(false);
      setNewTask({ priority: 'MEDIUM', status: 'PENDING', relatedModule: 'GENERAL' });
      setTaskAction('');
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

  const approveProposalTask = async (task: TodoTask) => {
    await handleStatusChange(task.id, 'COMPLETED');
    await apiService.updateProposal(task.relatedItemId!, { status: 'APPROVED' });
    setProposals?.(prev => prev.map(p => p.id === task.relatedItemId ? { ...p, status: 'APPROVED' } : p));
  };
  const rejectProposalTask = async (task: TodoTask) => {
    await handleStatusChange(task.id, 'CANCELLED');
    await apiService.updateProposal(task.relatedItemId!, { status: 'REJECTED' });
    setProposals?.(prev => prev.map(p => p.id === task.relatedItemId ? { ...p, status: 'REJECTED' } : p));
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

  const relatedItemCtx = { projects, opportunities, proposals, contracts };
  const detailCtx = { proposals, opportunities, projects, contracts };

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

      <PendingChainApprovals
        chains={pendingChainApprovals}
        currentUserRole={currentUser?.role}
        actionLoading={chainActionLoading}
        onAction={handleChainStageAction}
      />

      <PendingProposalApprovals
        approvals={pendingApprovals}
        getDetail={(todo) => getProposalDetail(todo, detailCtx)}
        getRelatedItemName={(todo) => getRelatedItemName(todo, relatedItemCtx)}
        onPreview={setPreviewTask}
        onApprove={approveProposalTask}
        onReject={rejectProposalTask}
      />

      <PendingDeliveryNotifications
        deliveries={pendingDeliveries}
        onMarkRead={(taskId) => handleStatusChange(taskId, 'COMPLETED')}
      />

      <TaskList
        units={units}
        filterUnit={filterUnit}
        setFilterUnit={setFilterUnit}
        filteredTodos={filteredTodos}
        getRelatedItemName={(todo) => getRelatedItemName(todo, relatedItemCtx)}
        users={users}
        onNavigate={onNavigate}
        onToggleStatus={handleStatusChange}
      />

      <ResolvedApprovals
        approvals={resolvedApprovals}
        getDetail={(todo) => getProposalDetail(todo, detailCtx)}
        getRelatedItemName={(todo) => getRelatedItemName(todo, relatedItemCtx)}
      />

      <ProposalPreviewModal
        task={previewTask}
        detail={previewTask ? getProposalDetail(previewTask, detailCtx) : null}
        onClose={() => setPreviewTask(null)}
        onApprove={async () => { if (previewTask) { await approveProposalTask(previewTask); setPreviewTask(null); } }}
        onReject={async () => { if (previewTask) { await rejectProposalTask(previewTask); setPreviewTask(null); } }}
      />

      <NewTaskModal
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        units={units}
        users={users}
        newTask={newTask}
        setNewTask={setNewTask}
        taskAction={taskAction}
        setTaskAction={setTaskAction}
        items={itemsForModule(newTask.relatedModule, { opportunities, projects })}
        composedTitleText={composedTitle(newTask, taskAction, { opportunities, projects })}
        loading={loading}
        onSubmit={handleAddTask}
      />
    </div>
  );
};

export default TodoModule;
