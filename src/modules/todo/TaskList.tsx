import { useState, useMemo } from 'react';
import {
  Briefcase, Target, UserCircle, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Search, X as XIcon, LayoutList, FolderTree, CalendarClock,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { TodoTask, Unit, User } from '../../types';
import {
  getPriorityColor, taskTargetTab, fmtCompletedAt, fmtDueDate,
  PRIORITY_RANK, daysUntil, RELATED_MODULE_LABEL,
} from './helpers';
import { dleftBadge, severityRank } from '../dashboard/helpers';
import { getStatusIcon, ListTodo } from './icons';
import AgentTag from '../../components/AgentTag';
import { isAgentActor } from '../../lib/agentProvenance';

type ViewMode = 'list' | 'group' | 'deadline';
const VIEW_KEY = 'enflow.todo.taskView';

const readView = (): ViewMode => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'list' || v === 'group' || v === 'deadline') return v;
  } catch { /* ignore */ }
  return 'list';
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-blue-500', LOW: 'bg-slate-300',
};

const bySeverityThenPriority = (a: TodoTask, b: TodoTask) =>
  severityRank(daysUntil(a.dueDate)) - severityRank(daysUntil(b.dueDate)) ||
  (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);

// ── Tek satırlık görev — tıklayınca satır içi detay açılır ────────────────────
function TaskRow({
  todo, units, users, getRelatedItemName, onNavigate, onToggleStatus, expanded, onToggleExpand,
}: {
  todo: TodoTask;
  units?: Unit[];
  users?: User[];
  getRelatedItemName: (todo: TodoTask) => string;
  onNavigate?: (tab: string, itemId?: string | null) => void;
  onToggleStatus: (taskId: string, newStatus: TodoTask['status']) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const dl = daysUntil(todo.dueDate);
  const badge = dleftBadge(dl);
  const relName = todo.relatedModule && todo.relatedModule !== 'GENERAL' ? getRelatedItemName(todo) : '';
  const target = taskTargetTab(todo);

  return (
    <motion.div layout className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggleExpand} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', PRIORITY_DOT[todo.priority] || 'bg-slate-300')}
            title={todo.priority} />
          <span className="font-bold text-slate-800 text-sm truncate">{todo.title}</span>
          {relName && (
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg shrink-0 max-w-[220px] truncate">
              <Target size={11} /> {relName}
            </span>
          )}
        </button>
        <span className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 max-w-[120px] truncate">
          {units?.find(u => u.id === todo.unitId)?.name}
        </span>
        <span className={cn('text-[10px] font-black uppercase tracking-widest shrink-0 w-16 text-right', badge.c)}>
          {badge.t}
        </span>
        {onNavigate && target && (
          <button
            onClick={() => onNavigate(target, todo.relatedItemId)}
            title="İlgili modüldeki işe git"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all active:scale-90 shrink-0"
          >
            <ArrowUpRight size={15} />
          </button>
        )}
        <button
          onClick={() => onToggleStatus(todo.id, 'COMPLETED')}
          title="Tamamlandı olarak işaretle"
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-white text-slate-300 border border-slate-100 hover:border-emerald-500 hover:text-emerald-500 transition-all active:scale-90 shrink-0"
        >
          <CheckCircle2 size={17} />
        </button>
        <button onClick={onToggleExpand} className="text-slate-300 hover:text-slate-500 shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 bg-slate-50/40">
          {todo.description && (
            <p className="text-sm text-slate-500 leading-relaxed font-medium pt-3">{todo.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest', getPriorityColor(todo.priority))}>
              {todo.priority}
            </span>
            <span className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100">
              <Briefcase size={13} /> {units?.find(u => u.id === todo.unitId)?.name}
            </span>
            {todo.assignedToUserId && (
              <span className="flex items-center gap-2 text-[10px] text-emerald-700 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-emerald-100">
                <UserCircle size={13} /> {users?.find(u => u.id === todo.assignedToUserId)?.name || 'Atanan kişi'}
              </span>
            )}
            {relName && (
              <span className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-indigo-100">
                <Target size={13} /> {(RELATED_MODULE_LABEL[todo.relatedModule!] || todo.relatedModule)}: {relName}
              </span>
            )}
            {todo.dueDate && (
              <span className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <CalendarClock size={13} /> Termin: {fmtDueDate(todo.dueDate)}
              </span>
            )}
            {isAgentActor(todo.assignedBy) && <AgentTag actorId={todo.assignedBy} agentRunId={todo.agentRunId} />}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Katlanabilir bölüm başlığı (grup / termin kovası) ─────────────────────────
function Section({
  title, sub, count, collapsed, onToggle, children,
}: {
  title: string; sub?: string; count: number; collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-all"
      >
        {collapsed ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronUp size={16} className="text-slate-400 shrink-0" />}
        <span className="font-black text-slate-700 text-sm truncate">{title}</span>
        {sub && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{sub}</span>}
        <span className="ml-auto bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">{count}</span>
      </button>
      {!collapsed && <div className="grid grid-cols-1 gap-2 pl-2">{children}</div>}
    </div>
  );
}

export default function TaskList({
  units,
  filterUnit,
  setFilterUnit,
  filteredTodos,
  getRelatedItemName,
  users,
  currentUserId,
  onNavigate,
  onToggleStatus,
}: {
  units?: Unit[];
  filterUnit: string;
  setFilterUnit: (unitId: string) => void;
  filteredTodos: TodoTask[];
  getRelatedItemName: (todo: TodoTask) => string;
  users?: User[];
  currentUserId?: string;
  onNavigate?: (tab: string, itemId?: string | null) => void;
  onToggleStatus: (taskId: string, newStatus: TodoTask['status']) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(readView);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'all' | TodoTask['priority']>('all');
  const [moduleF, setModuleF] = useState<string>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
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

  const activeAll = filteredTodos.filter(t => t.status !== 'COMPLETED');
  const completedAll = filteredTodos.filter(t => t.status === 'COMPLETED');

  // relatedModule filtresi için mevcut modüller
  const moduleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of filteredTodos) s.add(t.relatedModule && t.relatedModule !== 'GENERAL' ? t.relatedModule : 'GENERAL');
    return [...s];
  }, [filteredTodos]);

  const q = search.trim().toLocaleLowerCase('tr');
  const matches = (t: TodoTask) => {
    if (priority !== 'all' && t.priority !== priority) return false;
    if (moduleF !== 'all' && (t.relatedModule && t.relatedModule !== 'GENERAL' ? t.relatedModule : 'GENERAL') !== moduleF) return false;
    if (mineOnly && t.assignedToUserId !== currentUserId) return false;
    if (overdueOnly) { const d = daysUntil(t.dueDate); if (d == null || d >= 0) return false; }
    if (q) {
      const hay = `${t.title} ${t.description || ''} ${getRelatedItemName(t)}`.toLocaleLowerCase('tr');
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const activeSorted = useMemo(
    () => activeAll.filter(matches).slice().sort(bySeverityThenPriority),
    [activeAll, q, priority, moduleF, mineOnly, overdueOnly, currentUserId],
  );
  const completedFiltered = useMemo(() => completedAll.filter(matches), [completedAll, q, priority, moduleF, mineOnly, overdueOnly, currentUserId]);

  const hasFilter = q !== '' || priority !== 'all' || moduleF !== 'all' || mineOnly || overdueOnly;
  const clearFilters = () => { setSearch(''); setPriority('all'); setModuleF('all'); setMineOnly(false); setOverdueOnly(false); };

  // ── Grup modu: ilgili kayda göre ──────────────────────────────────────────
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; sub: string; items: TodoTask[] }>();
    for (const t of activeSorted) {
      const hasRel = !!(t.relatedModule && t.relatedModule !== 'GENERAL' && t.relatedItemId);
      const key = hasRel ? `${t.relatedModule}:${t.relatedItemId}` : 'GENERAL';
      if (!m.has(key)) {
        m.set(key, {
          key,
          label: hasRel ? getRelatedItemName(t) || 'İlişkili kayıt' : 'Genel / kayda bağlı olmayan',
          sub: hasRel ? (RELATED_MODULE_LABEL[t.relatedModule!] || t.relatedModule!) : '',
          items: [],
        });
      }
      m.get(key)!.items.push(t);
    }
    return [...m.values()].sort(
      (a, b) => severityRank(daysUntil(a.items[0]?.dueDate)) - severityRank(daysUntil(b.items[0]?.dueDate)),
    );
  }, [activeSorted]);

  // ── Termin modu: kovalar ──────────────────────────────────────────────────
  const buckets = useMemo(() => {
    const defs: { key: string; label: string; test: (d: number | null) => boolean }[] = [
      { key: 'overdue', label: '⛔ Gecikmiş', test: d => d != null && d < 0 },
      { key: 'today', label: '📅 Bugün', test: d => d === 0 },
      { key: 'week', label: '🗓 Bu hafta', test: d => d != null && d >= 1 && d <= 7 },
      { key: 'later', label: '⏳ Sonra', test: d => d != null && d > 7 },
      { key: 'none', label: '— Terminsiz', test: d => d == null },
    ];
    return defs
      .map(b => ({ ...b, items: activeSorted.filter(t => b.test(daysUntil(t.dueDate))) }))
      .filter(b => b.items.length > 0);
  }, [activeSorted]);

  const rowProps = (todo: TodoTask) => ({
    todo, units, users, getRelatedItemName, onNavigate, onToggleStatus,
    expanded: expandedTaskId === todo.id,
    onToggleExpand: () => setExpandedTaskId(expandedTaskId === todo.id ? null : todo.id),
  });

  const VIEW_TABS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: 'list', label: 'Liste', icon: LayoutList },
    { key: 'group', label: 'Grupla', icon: FolderTree },
    { key: 'deadline', label: 'Termin', icon: CalendarClock },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Görevler</h4>
        <div className="flex rounded-2xl overflow-hidden border border-slate-200">
          {VIEW_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setViewPersist(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                view === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50',
              )}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Birim çipleri */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilterUnit('all')}
          className={cn(
            'px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap',
            filterUnit === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50',
          )}
        >
          Tüm Birimler
        </button>
        {units?.map(unit => (
          <button
            key={unit.id}
            onClick={() => setFilterUnit(unit.id)}
            className={cn(
              'px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap',
              filterUnit === unit.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50',
            )}
          >
            {unit.name}
          </button>
        ))}
      </div>

      {/* Arama + filtre çubuğu */}
      <div className="flex items-center gap-2 flex-wrap glass-panel bg-white/60 border border-slate-100 rounded-2xl p-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Başlık, açıklama veya ilgili kayıtta ara..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as typeof priority)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none"
        >
          <option value="all">Öncelik: Tümü</option>
          <option value="URGENT">Acil</option>
          <option value="HIGH">Yüksek</option>
          <option value="MEDIUM">Orta</option>
          <option value="LOW">Düşük</option>
        </select>
        <select
          value={moduleF}
          onChange={e => setModuleF(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none"
        >
          <option value="all">Modül: Tümü</option>
          {moduleOptions.map(m => (
            <option key={m} value={m}>{RELATED_MODULE_LABEL[m] || m}</option>
          ))}
        </select>
        {currentUserId && (
          <button
            onClick={() => setMineOnly(v => !v)}
            className={cn(
              'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
              mineOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
            )}
          >
            Bana atananlar
          </button>
        )}
        <button
          onClick={() => setOverdueOnly(v => !v)}
          className={cn(
            'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
            overdueOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
          )}
        >
          Gecikmiş
        </button>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700"
          >
            <XIcon size={12} /> Temizle
          </button>
        )}
      </div>

      {/* İçerik */}
      {filteredTodos.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-[40px] border-dashed border-2 border-slate-100">
          <ListTodo size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Henüz görev atanmamış.</p>
        </div>
      ) : activeSorted.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-[40px] border-dashed border-2 border-slate-100">
          <CheckCircle2 size={40} className="mx-auto text-emerald-200 mb-3" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            {hasFilter || activeAll.length === 0
              ? (activeAll.length === 0 ? 'Bekleyen görev yok — tümü tamamlandı.' : 'Filtreye uyan görev yok.')
              : 'Bekleyen görev yok — tümü tamamlandı.'}
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 gap-2">
          {activeSorted.map(todo => <TaskRow key={todo.id} {...rowProps(todo)} />)}
        </div>
      ) : view === 'group' ? (
        <div className="space-y-3">
          {groups.map(g => (
            <Section
              key={g.key}
              title={g.label}
              sub={g.sub}
              count={g.items.length}
              collapsed={collapsed.has(g.key)}
              onToggle={() => toggleCollapsed(g.key)}
            >
              {g.items.map(todo => <TaskRow key={todo.id} {...rowProps(todo)} />)}
            </Section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {buckets.map(b => (
            <Section
              key={b.key}
              title={b.label}
              count={b.items.length}
              collapsed={collapsed.has(b.key)}
              onToggle={() => toggleCollapsed(b.key)}
            >
              {b.items.map(todo => <TaskRow key={todo.id} {...rowProps(todo)} />)}
            </Section>
          ))}
        </div>
      )}

      {/* Tamamlanan görevler */}
      {completedFiltered.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="w-full flex items-center justify-between gap-3 p-5 rounded-[28px] bg-emerald-50/60 border border-emerald-100 hover:bg-emerald-50 transition-all"
          >
            <span className="flex items-center gap-2 text-xs font-black text-emerald-700 uppercase tracking-widest">
              <CheckCircle2 size={16} />
              Tamamlanan Görevler ({completedFiltered.length})
            </span>
            {showCompleted ? <ChevronUp size={18} className="text-emerald-600" /> : <ChevronDown size={18} className="text-emerald-600" />}
          </button>

          {showCompleted && (
            <div className="grid grid-cols-1 gap-3 mt-3">
              {completedFiltered.map((todo) => {
                const detailOpen = expandedTaskId === todo.id;
                return (
                  <motion.div
                    layout
                    key={todo.id}
                    className="rounded-[28px] bg-emerald-50/30 border border-emerald-100/80 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTaskId(detailOpen ? null : todo.id)}
                      className="w-full flex items-center gap-4 p-5 text-left"
                    >
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      <span className="flex-1 min-w-0 font-bold text-slate-600 text-sm truncate">{todo.title}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-emerald-100 shrink-0">
                        <Clock size={11} />
                        {fmtCompletedAt(todo.completedAt)}
                      </span>
                      {detailOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                    </button>

                    {detailOpen && (
                      <div className="px-5 pb-5 space-y-4 border-t border-emerald-100/80 pt-4">
                        {todo.description && (
                          <p className="text-sm text-slate-500 leading-relaxed font-medium">{todo.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4">
                          <span className={cn('text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest', getPriorityColor(todo.priority))}>
                            {todo.priority}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100">
                            <Briefcase size={13} />
                            {units?.find(u => u.id === todo.unitId)?.name}
                          </div>
                          {todo.assignedToUserId && (
                            <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-emerald-100">
                              <UserCircle size={13} />
                              {users?.find(u => u.id === todo.assignedToUserId)?.name || 'Atanan kişi'}
                            </div>
                          )}
                          {todo.relatedModule && todo.relatedModule !== 'GENERAL' && (
                            <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-indigo-100">
                              <Target size={13} />
                              {(RELATED_MODULE_LABEL[todo.relatedModule] || todo.relatedModule)}: {getRelatedItemName(todo)}
                            </div>
                          )}
                          {isAgentActor(todo.assignedBy) && (
                            <AgentTag actorId={todo.assignedBy} agentRunId={todo.agentRunId} />
                          )}
                        </div>
                        {onNavigate && taskTargetTab(todo) && (
                          <button
                            onClick={() => onNavigate(taskTargetTab(todo)!, todo.relatedItemId)}
                            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                          >
                            <ArrowUpRight size={14} /> İlgili kayda git
                          </button>
                        )}
                        <button
                          onClick={() => onToggleStatus(todo.id, 'PENDING')}
                          className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest"
                        >
                          Yeniden aç (bekleyene taşı)
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
