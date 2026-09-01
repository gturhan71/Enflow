import { useMemo, useState } from 'react';
import {
  Landmark, FileCheck2, Truck, ClipboardList, ArrowRight,
  LayoutList, FolderTree, CalendarClock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { TodoTask, ApprovalChain, Opportunity } from '../../types';
import { dleftBadge, severityRank } from '../dashboard/helpers';
import { CHAIN_ROLE_LABEL, CHAIN_ENTITY_LABEL } from './helpers';

// Süreç Motoru'nun "Todo'ya eklenecek + deadline taşıyacak" kuralının (değişmez
// kural #5) görünür karşılığı: aşağıdaki 4 ayrı kaynaktan (Onay Zinciri, Teklif
// Onayı, Teslimat Bildirimi, Genel Görev) TEK liste üretir. "Görevler" bölümüyle
// aynı üç görünüm: Liste (düz, en acilinden) · Tür (kaynağa göre grup) · Termin
// (Gecikmiş/Bugün/Bu hafta/Sonra kovaları). Her satır kendi bölümüne kaydırır —
// asıl işlemi hâlâ alttaki uzman bileşenler (PendingChainApprovals vb.) yapar.

type Kind = 'CHAIN' | 'PROPOSAL' | 'DELIVERY' | 'TASK';
type ViewMode = 'list' | 'kind' | 'deadline';
const VIEW_KEY = 'enflow.todo.queueView';

const readView = (): ViewMode => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'list' || v === 'kind' || v === 'deadline') return v;
  } catch { /* ignore */ }
  return 'list';
};

interface UnifiedItem {
  id: string;
  kind: Kind;
  title: string;
  dueDate: string | null;
  targetId: string;
}

const KIND_ORDER: Kind[] = ['CHAIN', 'PROPOSAL', 'DELIVERY', 'TASK'];
const KIND_META: Record<Kind, { label: string; icon: React.ElementType; badge: string }> = {
  CHAIN: { label: 'Onay Zinciri', icon: Landmark, badge: 'bg-violet-100 text-violet-700' },
  PROPOSAL: { label: 'Teklif Onayı', icon: FileCheck2, badge: 'bg-emerald-100 text-emerald-700' },
  DELIVERY: { label: 'Teslimat', icon: Truck, badge: 'bg-sky-100 text-sky-700' },
  TASK: { label: 'Görev', icon: ClipboardList, badge: 'bg-slate-100 text-slate-700' },
};

const daysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
};

function Section({
  title, count, collapsed, onToggle, children,
}: {
  title: string; count: number; collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-all"
      >
        {collapsed ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronUp size={14} className="text-slate-400 shrink-0" />}
        <span className="font-black text-slate-700 text-xs uppercase tracking-widest truncate">{title}</span>
        <span className="ml-auto bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">{count}</span>
      </button>
      {!collapsed && <div className="divide-y divide-slate-100 pl-1">{children}</div>}
    </div>
  );
}

export default function UnifiedWorkQueue({
  chains,
  currentUserRole,
  currentUserUnitId,
  proposalTasks,
  deliveryTasks,
  regularTasks,
  opportunities,
}: {
  chains: ApprovalChain[];
  currentUserRole?: string;
  currentUserUnitId?: string;
  proposalTasks: TodoTask[];
  deliveryTasks: TodoTask[];
  regularTasks: TodoTask[];
  opportunities?: Opportunity[];
}) {
  const [view, setView] = useState<ViewMode>(readView);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const setViewPersist = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };
  const toggleCollapsed = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const all = useMemo<UnifiedItem[]>(() => {
    const chainItems: UnifiedItem[] = chains
      .map((chain): UnifiedItem | null => {
        const myStage = chain.stages.find(s => s.status === 'PENDING' && (
          s.role === currentUserRole || (!s.role && !!s.unitId && s.unitId === currentUserUnitId)
        ));
        if (!myStage) return null;
        const role = myStage.role ? (CHAIN_ROLE_LABEL[myStage.role] || myStage.role) : 'Birim onayı';
        const oppTitle = chain.entityType === 'OPPORTUNITY' ? opportunities?.find(o => o.id === chain.entityId)?.title : null;
        const entityLabel = oppTitle || CHAIN_ENTITY_LABEL[chain.entityType || ''] || chain.entityType;
        return { id: `chain-${chain.id}`, kind: 'CHAIN', title: `${role} — ${entityLabel}`, dueDate: myStage.dueDate ?? null, targetId: 'todo-section-chains' };
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

    return [...chainItems, ...proposalItems, ...deliveryItems, ...taskItems]
      .sort((a, b) => severityRank(daysLeft(a.dueDate)) - severityRank(daysLeft(b.dueDate)));
  }, [chains, currentUserRole, currentUserUnitId, proposalTasks, deliveryTasks, regularTasks, opportunities]);

  const byKind = useMemo(
    () => KIND_ORDER.map(k => ({ key: k, label: KIND_META[k].label, items: all.filter(i => i.kind === k) })).filter(g => g.items.length > 0),
    [all],
  );

  const buckets = useMemo(() => {
    const defs: { key: string; label: string; test: (d: number | null) => boolean }[] = [
      { key: 'overdue', label: '⛔ Gecikmiş', test: d => d != null && d < 0 },
      { key: 'today', label: '📅 Bugün', test: d => d === 0 },
      { key: 'week', label: '🗓 Bu hafta', test: d => d != null && d >= 1 && d <= 7 },
      { key: 'later', label: '⏳ Sonra', test: d => d != null && d > 7 },
      { key: 'none', label: '— Terminsiz', test: d => d == null },
    ];
    return defs
      .map(b => ({ ...b, items: all.filter(i => b.test(daysLeft(i.dueDate))) }))
      .filter(b => b.items.length > 0);
  }, [all]);

  if (all.length === 0) return null;

  const scrollTo = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const Row = (item: UnifiedItem) => {
    const meta = KIND_META[item.kind];
    const Icon = meta.icon;
    const badge = dleftBadge(daysLeft(item.dueDate));
    return (
      <button
        key={item.id}
        onClick={() => scrollTo(item.targetId)}
        className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50/80 rounded-xl px-2 transition-all group"
      >
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.badge}`}>
          <Icon size={14} />
        </span>
        {view !== 'kind' && (
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 shrink-0">{meta.label}</span>
        )}
        <span className="flex-1 text-xs font-bold text-slate-700 truncate">{item.title}</span>
        <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${badge.c}`}>{badge.t}</span>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
      </button>
    );
  };

  const VIEW_TABS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: 'list', label: 'Liste', icon: LayoutList },
    { key: 'kind', label: 'Tür', icon: FolderTree },
    { key: 'deadline', label: 'Termin', icon: CalendarClock },
  ];

  return (
    <div className="glass-card p-6 rounded-[28px] bg-white/60 border border-white/60 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bekleyen İşlerim — Tümü</h4>
          <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">{all.length}</span>
        </div>
        <div className="flex rounded-2xl overflow-hidden border border-slate-200">
          {VIEW_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setViewPersist(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                view === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50',
              )}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <div className="divide-y divide-slate-100">{all.map(Row)}</div>
      ) : view === 'kind' ? (
        <div className="space-y-3">
          {byKind.map(g => (
            <Section key={g.key} title={g.label} count={g.items.length} collapsed={collapsed.has(g.key)} onToggle={() => toggleCollapsed(g.key)}>
              {g.items.map(Row)}
            </Section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {buckets.map(b => (
            <Section key={b.key} title={b.label} count={b.items.length} collapsed={collapsed.has(b.key)} onToggle={() => toggleCollapsed(b.key)}>
              {b.items.map(Row)}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
