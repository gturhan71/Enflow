import { Landmark, FileCheck2, Truck, ClipboardList, ArrowRight } from 'lucide-react';
import { TodoTask, ApprovalChain } from '../../types';
import { dleftBadge, severityRank } from '../dashboard/helpers';
import { CHAIN_ROLE_LABEL } from './helpers';

// Süreç Motoru'nun "Todo'ya eklenecek + deadline taşıyacak" kuralının (değişmez
// kural #5) görünür karşılığı: aşağıdaki 4 ayrı kaynaktan (Onay Zinciri, Teklif
// Onayı, Teslimat Bildirimi, Genel Görev) TEK, deadline'a göre sıralı bir liste
// üretir. Her satır kendi bölümüne (id ile) kaydırır — alttaki uzman bileşenler
// (PendingChainApprovals vb.) hâlâ asıl işlemi yapar, bu yalnız "hepsi bir arada,
// en acilinden" özet görünümüdür.

type Kind = 'CHAIN' | 'PROPOSAL' | 'DELIVERY' | 'TASK';

interface UnifiedItem {
  id: string;
  kind: Kind;
  title: string;
  dueDate: string | null;
  targetId: string;
}

const KIND_META: Record<Kind, { label: string; icon: React.ElementType; badge: string }> = {
  CHAIN: { label: 'Onay Zinciri', icon: Landmark, badge: 'bg-violet-100 text-violet-700' },
  PROPOSAL: { label: 'Teklif Onayı', icon: FileCheck2, badge: 'bg-emerald-100 text-emerald-700' },
  DELIVERY: { label: 'Teslimat', icon: Truck, badge: 'bg-sky-100 text-sky-700' },
  TASK: { label: 'Görev', icon: ClipboardList, badge: 'bg-slate-100 text-slate-700' },
};

const daysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export default function UnifiedWorkQueue({
  chains,
  currentUserRole,
  currentUserUnitId,
  proposalTasks,
  deliveryTasks,
  regularTasks,
}: {
  chains: ApprovalChain[];
  currentUserRole?: string;
  currentUserUnitId?: string;
  proposalTasks: TodoTask[];
  deliveryTasks: TodoTask[];
  regularTasks: TodoTask[];
}) {
  const chainItems: UnifiedItem[] = chains
    .map((chain): UnifiedItem | null => {
      const myStage = chain.stages.find(s => s.status === 'PENDING' && (
        s.role === currentUserRole || (!s.role && !!s.unitId && s.unitId === currentUserUnitId)
      ));
      if (!myStage) return null;
      const role = myStage.role ? (CHAIN_ROLE_LABEL[myStage.role] || myStage.role) : 'Birim onayı';
      return { id: `chain-${chain.id}`, kind: 'CHAIN', title: `${role} — ${chain.entityType}`, dueDate: myStage.dueDate ?? null, targetId: 'todo-section-chains' };
    })
    .filter((x): x is UnifiedItem => x !== null);

  const proposalItems: UnifiedItem[] = proposalTasks.map(t => ({
    id: `proposal-${t.id}`, kind: 'PROPOSAL', title: t.title, dueDate: t.dueDate ?? null, targetId: 'todo-section-proposals',
  }));
  const deliveryItems: UnifiedItem[] = deliveryTasks.map(t => ({
    id: `delivery-${t.id}`, kind: 'DELIVERY', title: t.title, dueDate: t.dueDate ?? null, targetId: 'todo-section-deliveries',
  }));
  const taskItems: UnifiedItem[] = regularTasks.filter(t => t.status === 'PENDING').map(t => ({
    id: `task-${t.id}`, kind: 'TASK', title: t.title, dueDate: t.dueDate ?? null, targetId: 'todo-section-tasks',
  }));

  const all = [...chainItems, ...proposalItems, ...deliveryItems, ...taskItems]
    .sort((a, b) => severityRank(daysLeft(a.dueDate)) - severityRank(daysLeft(b.dueDate)));

  if (all.length === 0) return null;

  const scrollTo = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="glass-card p-6 rounded-[28px] bg-white/60 border border-white/60 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bekleyen İşlerim — Tümü</h4>
        <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">{all.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {all.map(item => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          const dl = daysLeft(item.dueDate);
          const badge = dleftBadge(dl);
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.targetId)}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50/80 rounded-xl px-2 transition-all group"
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.badge}`}>
                <Icon size={14} />
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 shrink-0">{meta.label}</span>
              <span className="flex-1 text-xs font-bold text-slate-700 truncate">{item.title}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${badge.c}`}>{badge.t}</span>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
