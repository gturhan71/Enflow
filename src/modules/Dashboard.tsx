import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  XCircle,
  Info,
  Percent
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { Opportunity, Project, TodoTask, Contract, Unit, Proposal, DashboardPayload } from '../types';
import { ROLE_LABELS } from '../constants';

interface KPI {
  key: KpiKey;
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  glowBg?: string;
  items: { id: string; title?: string; name?: string; value?: number; status: string; progress?: number; probability?: number }[];
}

import { cn } from '../lib/utils';
import { fmtCurrency as cfmt } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { WK, WIDGET_META, HORIZON_LABEL, HORIZON_COLOR, WIDGET_HAS_DETAIL, UserDashboardLayout, resolveEffectiveWidgets, buildEditableLayout } from './dashboard/widgetCatalog';
import WidgetDetailDrawer from './dashboard/WidgetDetailDrawer';
import LayoutEditor from './dashboard/LayoutEditor';
import CriticalAlertsStrip from './dashboard/CriticalAlertsStrip';
import { useDashboardStream } from './dashboard/useDashboardStream';
import ManagementReportingModule from './ManagementReportingModule';
import { byCurStr, dleftBadge } from './dashboard/helpers';
import KpiDetailDrawer, { KpiKey } from './dashboard/KpiDetailDrawer';

// Sub-component for KPI cards (Memoized for performance with high-fidelity glow effects)
const KPICard = React.memo(({ kpi, index, onExpand }: { kpi: KPI, index: number, onExpand: (key: KpiKey) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -6, scale: 1.02 }}
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 22,
      delay: index * 0.06
    }}
    onClick={() => onExpand(kpi.key)}
    className="glass-panel p-8 rounded-[32px] group relative overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-white/50 bg-gradient-to-br from-white/80 to-white/40 cursor-pointer"
  >
    {/* Dynamic Background Mesh Glow */}
    <div className={cn(
      "absolute -right-16 -top-16 w-36 h-36 rounded-full blur-[50px] opacity-10 group-hover:opacity-30 group-hover:scale-125 transition-all duration-700 ease-out pointer-events-none",
      kpi.glowBg
    )} />

    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
      <kpi.icon size={80} />
    </div>

    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 shadow-lg shadow-black/5", kpi.bg, kpi.color)}>
      <kpi.icon size={28} />
    </div>

    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
    <div className="flex items-baseline gap-2">
      <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h4>
      <ArrowUpRight size={16} className={cn("transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 duration-300", kpi.color)} />
      <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-slate-900/5 text-slate-500 group-hover:bg-slate-900/10 transition-colors">Detay →</span>
    </div>
    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic">{kpi.sub}</p>
  </motion.div>
));

// ── Role-bazlı Kokpit (zamana-duyarlı + KPI widget'ları) ─────────────────────────

const WCard: React.FC<{ title: string; widgetKey?: WK; count?: number | string; tone?: string; onClick?: () => void; onExpand?: (key: WK, title: string) => void; children: React.ReactNode }> = ({ title, widgetKey, count, tone, onClick, onExpand, children }) => {
  const meta = widgetKey ? WIDGET_META[widgetKey] : undefined;
  const expandable = widgetKey && onExpand && WIDGET_HAS_DETAIL[widgetKey];
  return (
    <div className={`glass-panel rounded-3xl p-5 bg-white border border-slate-100 shadow-sm ${onClick ? 'hover:shadow-lg transition-all' : ''}`}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <div onClick={onClick} className={`flex items-center gap-1.5 min-w-0 ${onClick ? 'cursor-pointer' : ''}`}>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest truncate">{title}</h4>
          {meta && (
            <span title={meta.philosophy} className="shrink-0 cursor-help">
              <Info size={12} className="text-slate-300 hover:text-slate-500" />
            </span>
          )}
        </div>
        {count != null && <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${tone || 'bg-slate-100 text-slate-600'}`}>{count}</span>}
      </div>
      <div className="flex items-center gap-2 mb-2">
        {meta && (
          <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${HORIZON_COLOR[meta.horizon]}`}>
            {HORIZON_LABEL[meta.horizon]}
          </span>
        )}
        {expandable && (
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(widgetKey, title); }}
            className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-slate-900/5 text-slate-500 hover:bg-slate-900/10 transition-colors"
          >
            Detay →
          </button>
        )}
      </div>
      <div onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>{children}</div>
    </div>
  );
};

const RoleCockpit: React.FC<{ d: DashboardPayload; role?: string; widgets: WK[]; go: (t: string) => void; onEditLayout: () => void }> = ({ d, role, widgets, go, onEditLayout }) => {
  const empty = (t: string) => <p className="text-xs text-slate-400 italic">{t}</p>;
  const [expanded, setExpanded] = useState<{ key: WK; title: string } | null>(null);
  const handleExpand = (key: WK, title: string) => setExpanded({ key, title });
  const render = (w: WK) => {
    switch (w) {
      case 'kpiOverview': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Genel KPI">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-[10px] text-slate-400 uppercase">Kazanım Oranı</p><p className="font-black text-slate-900">%{d.kpis.winRate}</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase">Açık Pipeline</p><p className="font-black text-slate-900">{cfmt(d.kpis.pipelineValue)}</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase">Kazanılan</p><p className="font-bold text-emerald-600">{d.kpis.won.count}</p></div>
            <div><p className="text-[10px] text-slate-400 uppercase">İştirak Edilmeyen</p><p className="font-bold text-slate-500">{d.kpis.withdrawnCount}</p></div>
          </div>
        </WCard>);
      case 'costApprovals': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Bekleyen Maliyet Onayı" count={d.timeSensitive.costApprovalsPending.length} tone="bg-amber-100 text-amber-700" onClick={() => go('crm-cost')}>
          {d.timeSensitive.costApprovalsPending.length === 0 ? empty('Bekleyen onay yok.') :
            <div className="space-y-1">{d.timeSensitive.costApprovalsPending.slice(0, 5).map(c => <div key={c.id} className="flex justify-between text-xs"><span className="truncate">{c.title}</span><span className="font-bold">{cfmt(c.value)}</span></div>)}</div>}
        </WCard>);
      case 'tenderDeadlines': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="İhale Vadeleri" count={d.timeSensitive.tenderDeadlines.length} tone="bg-indigo-100 text-indigo-700" onClick={() => go('sales-support')}>
          {d.timeSensitive.tenderDeadlines.length === 0 ? empty('Yaklaşan ihale vadesi yok.') :
            <div className="space-y-1">{d.timeSensitive.tenderDeadlines.slice(0, 5).map(t => { const b = dleftBadge(t.daysLeft); return <div key={t.id} className="flex justify-between text-xs gap-2"><span className="truncate">{t.name}</span><span className={`font-bold ${b.c}`}>{b.t}</span></div>; })}</div>}
        </WCard>);
      case 'guaranteeExpiries': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Süresi Yaklaşan Teminat" count={d.timeSensitive.guaranteeExpiries.length} tone="bg-red-100 text-red-700" onClick={() => go('finance')}>
          {d.timeSensitive.guaranteeExpiries.length === 0 ? empty('30 gün içinde dolan teminat yok.') :
            <div className="space-y-1">{d.timeSensitive.guaranteeExpiries.slice(0, 5).map(g => { const b = dleftBadge(g.daysLeft); return <div key={g.id} className="flex justify-between text-xs gap-2"><span className="truncate">{cfmt(g.amount, g.currency)}</span><span className={`font-bold ${b.c}`}>{b.t}</span></div>; })}</div>}
        </WCard>);
      case 'guaranteeRequests': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Teminat Talepleri" count={d.timeSensitive.guaranteeRequests.length} tone="bg-amber-100 text-amber-700" onClick={() => go('finance')}>
          {d.timeSensitive.guaranteeRequests.length === 0 ? empty('Bekleyen teminat talebi yok.') :
            <div className="space-y-1">{d.timeSensitive.guaranteeRequests.slice(0, 5).map(g => <div key={g.id} className="flex justify-between text-xs"><span>{g.type === 'BID_BOND' ? 'Geçici' : 'Kesin'}{g.isIndefinite ? ' · süresiz' : ''}</span><span className="font-bold">{cfmt(g.amount, g.currency)}</span></div>)}</div>}
        </WCard>);
      case 'financingGap': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Finansman / Nakit Akış" onClick={() => go('finance')}>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Alacak</span><span className="font-bold">{byCurStr(d.management.financing.receivableByCurrency)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gecikmiş</span><span className="font-bold text-red-600">{byCurStr(d.management.financing.overdueByCurrency)}</span></div>
          </div>
        </WCard>);
      case 'tenderPipeline': { const tp = d.management.tenderPipeline; return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="İhale Hattı" onClick={() => go('sales-support')}>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="font-black text-slate-900">{tp.active}</p><p className="text-[10px] text-slate-400">Aktif</p></div>
            <div><p className="font-black text-indigo-600">{tp.submitted}</p><p className="text-[10px] text-slate-400">Teklif</p></div>
            <div><p className="font-black text-emerald-600">{tp.won}</p><p className="text-[10px] text-slate-400">Kazanıldı</p></div>
            <div><p className="font-black text-red-500">{tp.lost}</p><p className="text-[10px] text-slate-400">Kaybedildi</p></div>
            <div><p className="font-black text-slate-500">{tp.withdrawn}</p><p className="text-[10px] text-slate-400">İştirak yok</p></div>
          </div>
        </WCard>); }
      case 'withdrawnTenders': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="İştirak Edilmeyen (Yönetim)" count={d.management.tenderPipeline.withdrawn} tone="bg-slate-100 text-slate-600">
          <p className="text-xs text-slate-500">Yönetim kararıyla girilmeyen ihaleler — KPI'yı etkilemez.</p>
        </WCard>);
      case 'bomHandoffs': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Devredilen BoM" count={d.management.bomHandoffs.count} tone="bg-indigo-100 text-indigo-700" onClick={() => go('presales')}>
          {d.management.bomHandoffs.recent.length === 0 ? empty('Henüz devir yok.') :
            <div className="space-y-1">{d.management.bomHandoffs.recent.map(h => <div key={h.id} className="flex justify-between text-xs gap-2"><span className="truncate">{h.oppTitle}</span><span className="text-slate-400">{h.itemCount} kalem</span></div>)}</div>}
        </WCard>);
      case 'invoicesDue': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Fatura Vadeleri" count={d.timeSensitive.invoicesDue.length} tone="bg-amber-100 text-amber-700" onClick={() => go('finance')}>
          {d.timeSensitive.invoicesDue.length === 0 ? empty('Bekleyen fatura yok.') :
            <div className="space-y-1">{d.timeSensitive.invoicesDue.slice(0, 5).map(i => <div key={i.id} className="flex justify-between text-xs"><span className={i.overdue ? 'text-red-600 font-bold' : ''}>{i.invoiceNo || 'Fatura'}{i.overdue ? ' (gecikti)' : ''}</span><span className="font-bold">{cfmt(i.amount, i.currency)}</span></div>)}</div>}
        </WCard>);
      case 'milestonesDue': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Yaklaşan Milestone" count={d.timeSensitive.milestonesDue.length} tone="bg-indigo-100 text-indigo-700" onClick={() => go('project-mgmt')}>
          {d.timeSensitive.milestonesDue.length === 0 ? empty('Yaklaşan milestone yok.') :
            <div className="space-y-1">{d.timeSensitive.milestonesDue.slice(0, 5).map(m => { const b = dleftBadge(m.daysLeft); return <div key={m.id} className="flex justify-between text-xs gap-2"><span className="truncate">{m.title}</span><span className={`font-bold ${b.c}`}>{b.t}</span></div>; })}</div>}
        </WCard>);
      case 'purchaseRequests': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Satınalma Talepleri" onClick={() => go('procurement')}>
          {Object.keys(d.management.purchaseRequests).length === 0 ? empty('Talep yok.') :
            <div className="flex flex-wrap gap-2">{Object.entries(d.management.purchaseRequests).map(([s, n]) => <span key={s} className="text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded-full">{s}: {n}</span>)}</div>}
        </WCard>);
      case 'projects': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Projeler" count={d.management.projects.active} tone="bg-emerald-100 text-emerald-700" onClick={() => go('project-mgmt')}>
          <p className="text-xs text-slate-500">Aktif proje · Ortalama marj <b>%{d.management.projects.avgMargin}</b></p>
        </WCard>);
      case 'contractDeadlines': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Sözleşme Vadeleri" count={d.timeSensitive.contractDeadlines.length} tone="bg-amber-100 text-amber-700" onClick={() => go('contract-workflow')}>
          {d.timeSensitive.contractDeadlines.length === 0 ? empty('Yaklaşan sözleşme vadesi yok.') :
            <div className="space-y-1">{d.timeSensitive.contractDeadlines.slice(0, 5).map(c => { const b = dleftBadge(c.daysLeft); return <div key={c.id} className="flex justify-between text-xs gap-2"><span className="truncate">{c.title}</span><span className={`font-bold ${b.c}`}>{b.t}</span></div>; })}</div>}
        </WCard>);
      case 'legalDeadlines': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Hukuk Dosyası Vadeleri" count={d.timeSensitive.legalDeadlines.length} tone="bg-red-100 text-red-700" onClick={() => go('contract-workflow')}>
          {d.timeSensitive.legalDeadlines.length === 0 ? empty('Açık hukuk dosyası vadesi yok.') :
            <div className="space-y-1">{d.timeSensitive.legalDeadlines.slice(0, 5).map(l => { const b = dleftBadge(l.daysLeft); return <div key={l.id} className="flex justify-between text-xs gap-2"><span className="truncate">{l.title}</span><span className={`font-bold ${b.c}`}>{b.t}</span></div>; })}</div>}
        </WCard>);
      case 'approvalBottlenecks': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Onay Zinciri Darboğazı" count={d.management.bottlenecks.reduce((s, b) => s + b.pendingCount, 0)} tone="bg-rose-100 text-rose-700">
          {d.management.bottlenecks.length === 0 ? empty('Bekleyen onay zinciri aşaması yok.') :
            <div className="space-y-1">{d.management.bottlenecks.slice(0, 5).map(b => <div key={b.role} className="flex justify-between text-xs gap-2"><span className="truncate">{b.label || b.role}</span><span className="font-bold text-slate-600">{b.pendingCount} adet · {b.oldestWaitingDays} gün</span></div>)}</div>}
        </WCard>);
      case 'topRisks': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Öncelikli Riskler" count={d.management.topRisks.length} tone="bg-violet-100 text-violet-700" onClick={() => go('corporate-governance')}>
          {d.management.topRisks.length === 0 ? empty('Açık risk kaydı yok.') :
            <div className="space-y-1">{d.management.topRisks.slice(0, 5).map(r => <div key={r.id} className="flex justify-between text-xs gap-2"><span className="truncate">{r.title}</span><span className="font-bold text-slate-600">Skor {r.score}</span></div>)}</div>}
        </WCard>);
      case 'agentActivity': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Sanal Agent Aktivitesi" count={d.management.agentActivityToday.total} tone="bg-sky-100 text-sky-700" onClick={() => go('virtual-agents-test')}>
          <p className="text-xs text-slate-500">{d.management.agentActivityToday.actionsTaken} otonom eylem · {d.management.agentActivityToday.pendingRatification} onay bekliyor</p>
        </WCard>);
      case 'visitPerformance': { const vp = d.management.visitPerformance; return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Ziyaret Performansı" count={`%${vp.coveragePct}`} tone={vp.coveragePct >= vp.targetRate ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} onClick={() => go('visit-plan')}>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div><p className="font-black text-slate-900">{vp.planned}</p><p className="text-[10px] text-slate-400">Planlanan (bu ay)</p></div>
            <div><p className="font-black text-emerald-600">{vp.completed}</p><p className="text-[10px] text-slate-400">Gerçekleşen (bu ay)</p></div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-400">Fırsata dönüşen (son 6 ay)</span>
            <span className="font-black text-indigo-600">{vp.conversion.convertedVisits}/{vp.conversion.maturedVisits} · %{vp.conversion.conversionRatePct}</span>
          </div>
        </WCard>); }
      case 'myOpportunities': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Fırsatlarım" count={d.personal.myOpportunities.length} tone="bg-indigo-100 text-indigo-700" onClick={() => go('crm-opportunities')}>
          {d.personal.myOpportunities.length === 0 ? empty('Atanmış aktif fırsat yok.') :
            <div className="space-y-1">{d.personal.myOpportunities.slice(0, 6).map(o => <div key={o.id} className="flex justify-between text-xs gap-2"><span className="truncate">{o.title}</span><span className="text-slate-400">{o.technicalStatus === 'PENDING_APPROVAL' ? 'onayda' : o.status}</span></div>)}</div>}
        </WCard>);
      case 'myTasks': return (
        <WCard key={w} widgetKey={w} onExpand={handleExpand} title="Görevlerim" count={d.personal.myTasksPending} tone="bg-amber-100 text-amber-700" onClick={() => go('todo')}>
          <p className="text-xs text-slate-500">{d.personal.myTasksPending} bekleyen görev · {d.personal.unreadNotifications} okunmamış bildirim</p>
        </WCard>);
      default: return null;
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{ROLE_LABELS[role || ''] || 'Kullanıcı'} Kokpiti — Zamana Duyarlı İşler & KPI</h4>
        <button onClick={onEditLayout} className="text-[10px] font-black text-slate-400 hover:text-emerald-600 uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-emerald-500/5 transition-colors">
          Kokpiti Düzenle
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{widgets.map(render)}</div>
      {expanded && (
        <WidgetDetailDrawer
          widgetKey={expanded.key}
          title={expanded.title}
          d={d}
          onClose={() => setExpanded(null)}
          onNavigate={go}
        />
      )}
    </div>
  );
};

const Dashboard = ({
  opportunities = [],
  projects = [],
  tasks = [],
  contracts = [],
  units = [],
  proposals = [],
  onApproveProposal,
  onNavigate
}: {
  opportunities: Opportunity[],
  projects: Project[],
  tasks: TodoTask[],
  contracts?: Contract[],
  units?: Unit[],
  proposals?: Proposal[],
  onApproveProposal?: (id: string) => void,
  onNavigate?: (tab: string) => void
}) => {
  const { currentUser, setCurrentUser, hasPermission } = useAuth();
  const [incomingReports, setIncomingReports] = useState<any[]>([]);
  const [allUnitReports, setAllUnitReports] = useState<any[]>([]);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const [expandedKpi, setExpandedKpi] = useState<KpiKey | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  const isGM = currentUser?.role === 'GENERAL_MANAGER';
  const isManager = isGM || /_MGR$/.test(currentUser?.role || '');

  const savedLayout = useMemo<UserDashboardLayout | null>(() => {
    if (!currentUser?.dashboardLayout) return null;
    try { return JSON.parse(currentUser.dashboardLayout); } catch { return null; }
  }, [currentUser?.dashboardLayout]);
  // Tenant GM'i rol bazlı varsayılan şablonu özelleştirmiş olabilir (Ayarlar → Kokpit
  // Şablonları); kullanıcının kişisel seçimi (savedLayout) her zaman önceliklidir.
  const [roleTemplates, setRoleTemplates] = useState<Record<string, WK[]>>({});
  useEffect(() => { apiService.getDashboardRoleTemplates().then(t => setRoleTemplates(t as Record<string, WK[]>)).catch(() => {}); }, []);
  const roleTemplateOverride = roleTemplates[currentUser?.role || ''] || null;
  const effectiveWidgets = useMemo(() => resolveEffectiveWidgets(currentUser?.role, savedLayout, roleTemplateOverride), [currentUser?.role, savedLayout, roleTemplateOverride]);

  const handleSaveLayout = async (items: { key: WK; enabled: boolean }[]) => {
    setSavingLayout(true);
    try {
      const payload = { widgets: items.map(i => ({ key: i.key, enabled: i.enabled })), order: items.map(i => i.key) };
      await apiService.saveDashboardLayout(payload);
      setCurrentUser({ ...currentUser, dashboardLayout: JSON.stringify(payload) });
      setEditingLayout(false);
    } finally {
      setSavingLayout(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = () => apiService.getDashboard().then(d => { if (active) setDash(d as DashboardPayload); }).catch(() => {});
    load();
    // Polling — SSE bağlantısı koparsa/desteklenmezse güvenlik ağı (Header.tsx'teki 30sn bildirim
    // polling'iyle aynı desen).
    const t = window.setInterval(load, 45000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // SSE: sunucu tarafında ilgili bir şey değiştiğinde (bildirim/onay/agent eylemi/hatırlatma)
  // anında yeniden çeker — polling'i beklemeden.
  useDashboardStream(() => {
    apiService.getDashboard().then(d => setDash(d as DashboardPayload)).catch(() => {});
  });

  // Yönetici: kendisine yönlenen (escalate) bekleyen raporlar + birim KPI için tüm raporlar
  useEffect(() => {
    if (!isManager) return;
    const pendingP = isGM
      ? apiService.getUnitReports({ status: 'SUBMITTED' })
      : apiService.getUnitReports({ pendingForReviewer: currentUser?.id || '' });
    Promise.all([pendingP, apiService.getUnitReports()])
      .then(([pend, all]) => {
        setIncomingReports(Array.isArray(pend) ? pend : []);
        setAllUnitReports(Array.isArray(all) ? all : []);
      })
      .catch(() => { /* sessiz */ });
  }, [isManager, isGM, currentUser?.id]);

  // Birim KPI: birim başına rapor durumları (SUBMITTED/REVIEWED)
  const reportKpiByUnit = useMemo(() => {
    const map: Record<string, { unit: string; sunulan: number; onaylanan: number }> = {};
    for (const r of allUnitReports) {
      const k = r.unitLabel || r.unitKey;
      if (!map[k]) map[k] = { unit: k, sunulan: 0, onaylanan: 0 };
      if (r.status === 'SUBMITTED') map[k].sunulan++;
      if (r.status === 'REVIEWED') map[k].onaylanan++;
    }
    return Object.values(map);
  }, [allUnitReports]);

  // Optimization: useMemo for expensive calculations
  const kpis = useMemo(() => {
    // Build best proposal value per opportunity (prefer highest-ranked status, then highest version)
    const STATUS_RANK: Record<string, number> = { APPROVED: 4, ACCEPTED: 3, SENT: 2, PENDING_APPROVAL: 1, DRAFT: 0, REJECTED: -1 };
    type BestEntry = { rank: number; version: number; price: number };
    const bestByOppId: Record<string, BestEntry> = {};
    for (const p of proposals) {
      if (!p.opportunityId || !p.totalPrice) continue;
      const rank = STATUS_RANK[p.status] ?? 0;
      const version = p.version ?? 0;
      const cur = bestByOppId[p.opportunityId];
      if (!cur || rank > cur.rank || (rank === cur.rank && version > cur.version)) {
        bestByOppId[p.opportunityId] = { rank, version, price: p.totalPrice };
      }
    }
    const bestProposalByOppId: Record<string, number> = Object.fromEntries(
      Object.entries(bestByOppId).map(([id, e]) => [id, e.price])
    );
    const getOppValue = (o: Opportunity) => bestProposalByOppId[o.id] ?? o.value ?? 0;

    const activeOpps = opportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON' && o.status !== 'WITHDRAWN');
    const lostOpps = opportunities.filter(o => o.status === 'LOST');
    const wonOpps = opportunities.filter(o => o.status === 'WON');

    const totalPipelineValue = activeOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const lostValue = lostOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const wonValue = wonOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const activeProjectsList = projects.filter(p => ['IN_PROGRESS', 'NOT_STARTED'].includes(p.status));

    const fmtVal = (v: number) => v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : v.toFixed(0);

    const oppItems = (opps: Opportunity[]) => opps
      .map(o => ({ id: o.id, title: o.title, value: getOppValue(o), status: o.status }))
      .sort((a, b) => b.value - a.value);

    // Pipeline aşamasını yüzdesel göster: kazanılan/kapanan fırsat 100 kabul edilir,
    // her aktif fırsatın kendi kazanma olasılığı (probability, 0-100) kapanışa ne kadar
    // yaklaştığını gösterir — aşama bilgisini sayı yerine tek bir yüzdede özetler.
    const probItems = activeOpps
      .map(o => ({ id: o.id, title: o.title, value: getOppValue(o), status: o.status, probability: o.status === 'WON' ? 100 : (o.probability ?? 0) }))
      .sort((a, b) => b.probability - a.probability);
    const avgProbability = probItems.length > 0
      ? Math.round(probItems.reduce((s, o) => s + o.probability, 0) / probItems.length)
      : 0;

    return [
      { key: 'pipeline' as const, label: 'Toplam Pipeline', value: fmtVal(totalPipelineValue), sub: `${activeOpps.length} Aktif Fırsat`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10', glowBg: 'bg-emerald-500', items: oppItems(activeOpps) },
      { key: 'won' as const, label: 'Kazanılan Değer', value: fmtVal(wonValue), sub: `${wonOpps.length} Kazanılan Fırsat`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-500/10', glowBg: 'bg-blue-500', items: oppItems(wonOpps) },
      { key: 'winProbability' as const, label: 'Ort. Kazanma Olasılığı', value: `%${avgProbability}`, sub: `${probItems.length} aktif fırsat üzerinden`, icon: Percent, color: 'text-amber-600', bg: 'bg-amber-500/10', glowBg: 'bg-amber-500', items: probItems },
      { key: 'projects' as const, label: 'Aktif Projeler', value: activeProjectsList.length, sub: 'Uygulama Aşamasında', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-500/10', glowBg: 'bg-purple-500', items: activeProjectsList.map(p => ({ id: p.id, name: p.name, status: p.status, progress: p.progress || 0 })) },
      { key: 'lost' as const, label: 'Kaybedilen Değer', value: fmtVal(lostValue), sub: `${lostOpps.length} Kaybedilen Fırsat`, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', glowBg: 'bg-red-500', items: oppItems(lostOpps) },
    ];
  }, [opportunities, projects, proposals]);

  const liveNegotiationCount = useMemo(() => {
    const oppIds = new Set(
      proposals.filter(p => {
        if (p.openForNegotiation === true) return true;
        try {
          const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
          return (c as Record<string, unknown>)?.openForNegotiation === true;
        } catch { return false; }
      }).map(p => p.opportunityId)
    );
    return oppIds.size;
  }, [proposals]);

  const pipelineChartData = useMemo(() => {
    const rows = [
      { name: 'Yeni',         value: opportunities.filter(o => o.status === 'NEW').length,         grad: 'url(#barPrimary)' },
      { name: 'İletişimde',   value: opportunities.filter(o => o.status === 'CONTACTED').length,   grad: 'url(#barBlue)' },
      { name: 'Nitelikli',    value: opportunities.filter(o => o.status === 'QUALIFIED').length,    grad: 'url(#barPurple)' },
      { name: 'Teklif',       value: opportunities.filter(o => o.status === 'PROPOSAL').length,     grad: 'url(#barOrange)' },
      { name: 'Pazarlık',     value: opportunities.filter(o => o.status === 'NEGOTIATION').length,  grad: 'url(#barEmerald)' },
      ...(liveNegotiationCount > 0
        ? [{ name: 'Canlı Pazarlık', value: liveNegotiationCount, grad: 'url(#barLive)' }]
        : []),
      { name: 'Kazanıldı',   value: opportunities.filter(o => o.status === 'WON').length,          grad: 'url(#barWon)' },
      { name: 'Kaybedildi',  value: opportunities.filter(o => o.status === 'LOST').length,         grad: 'url(#barLost)' },
    ];
    return rows;
  }, [opportunities, liveNegotiationCount]);

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Kurumsal Kokpit</h3>
          <p className="text-slate-500 font-medium text-sm mt-1">Sistem genelindeki canlı performans ve operasyonel veriler.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 glass-card p-3 px-4 rounded-2xl bg-white/40 border border-white/60 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center animate-pulse">
              <Zap size={20} fill="currentColor" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sistem Durumu</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/40 animate-ping absolute" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/40 relative" />
                <p className="text-xs font-bold text-slate-900 italic">Senkronize</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-bazlı kokpit — zamana duyarlı işler + KPI */}
      {dash && <CriticalAlertsStrip d={dash} go={(t) => onNavigate?.(t)} />}
      {dash && <RoleCockpit d={dash} role={currentUser?.role} widgets={effectiveWidgets} go={(t) => onNavigate?.(t)} onEditLayout={() => setEditingLayout(true)} />}
      {editingLayout && (
        <LayoutEditor
          role={currentUser?.role}
          initial={buildEditableLayout(currentUser?.role, savedLayout, roleTemplateOverride)}
          roleDefault={roleTemplateOverride || undefined}
          saving={savingLayout}
          onClose={() => setEditingLayout(false)}
          onSave={handleSaveLayout}
        />
      )}

      {/* Yönetici için klasik KPI kartları + grafikler (alt bölüm) */}
      {isManager && <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => <KPICard key={kpi.label} kpi={kpi} index={i} onExpand={setExpandedKpi} />)}
      </div>
      {expandedKpi && (() => {
        const kpi = kpis.find(k => k.key === expandedKpi)!;
        return (
          <KpiDetailDrawer
            kpiKey={expandedKpi}
            oppItems={expandedKpi === 'projects' ? undefined : (kpi.items as { id: string; title: string; value: number; status: string; probability?: number }[])}
            projectItems={expandedKpi === 'projects' ? (kpi.items as { id: string; name: string; status: string; progress: number }[]) : undefined}
            onClose={() => setExpandedKpi(null)}
            onNavigate={(t) => onNavigate?.(t)}
          />
        );
      })()}

      {/* Yönetici: Gelen Birim Raporları + birim rapor KPI grafiği */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel rounded-3xl p-6 bg-white border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gelen Raporlar</h4>
              <span className={`text-[11px] font-black px-3 py-1 rounded-full ${incomingReports.length ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                {incomingReports.length} bekliyor
              </span>
            </div>
            {incomingReports.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-8">İnceleme bekleyen rapor yok.</p>
            ) : (
              <div className="space-y-2">
                {incomingReports.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{r.unitLabel || r.unitKey}</p>
                      <p className="text-[10px] text-slate-400">{(r.periodStart || '').slice(0, 10)} — {(r.periodEnd || '').slice(0, 10)} · {r.authorName || '—'}</p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 shrink-0">SUNULDU</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isGM && (
            <div className="glass-panel rounded-3xl p-6 bg-white border border-slate-100 lg:col-span-2">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Birim Rapor KPI</h4>
              {reportKpiByUnit.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-8">Henüz birim raporu yok.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportKpiByUnit}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="unit" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="sunulan" name="Sunulan" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="onaylanan" name="Onaylanan" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Sales Pipeline Chart */}
        <div className="lg:col-span-3 glass-panel p-8 rounded-[32px] flex flex-col min-h-[450px] shadow-sm bg-gradient-to-br from-white/80 to-white/40 border border-white/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Satış Boru Hattı</h4>
              <p className="text-xs text-slate-500 font-bold">Fırsatların aşamalara göre dağılımı</p>
            </div>
            <div className="flex items-center gap-3">
              {liveNegotiationCount > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20 animate-pulse">
                  <Zap size={12} fill="currentColor" /> {liveNegotiationCount} Canlı Pazarlık
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                <ShieldCheck size={12} /> Doğrulanmış Veri
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                {/* Premium Glow & Solid Neon Gradients */}
                <defs>
                  <linearGradient id="barPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(151, 86%, 39%, 1)" />
                    <stop offset="100%" stopColor="hsla(151, 86%, 39%, 0.15)" />
                  </linearGradient>
                  <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(217, 91%, 60%, 1)" />
                    <stop offset="100%" stopColor="hsla(217, 91%, 60%, 0.15)" />
                  </linearGradient>
                  <linearGradient id="barPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(271, 91%, 65%, 1)" />
                    <stop offset="100%" stopColor="hsla(271, 91%, 65%, 0.15)" />
                  </linearGradient>
                  <linearGradient id="barOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(14, 91%, 60%, 1)" />
                    <stop offset="100%" stopColor="hsla(14, 91%, 60%, 0.15)" />
                  </linearGradient>
                  <linearGradient id="barEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(151, 86%, 39%, 1)" />
                    <stop offset="100%" stopColor="hsla(151, 86%, 39%, 0.3)" />
                  </linearGradient>
                  <linearGradient id="barLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(340, 90%, 55%, 1)" />
                    <stop offset="100%" stopColor="hsla(340, 90%, 55%, 0.2)" />
                  </linearGradient>
                  <linearGradient id="barWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(142, 76%, 36%, 1)" />
                    <stop offset="100%" stopColor="hsla(142, 76%, 36%, 0.25)" />
                  </linearGradient>
                  <linearGradient id="barLost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsla(0, 84%, 60%, 1)" />
                    <stop offset="100%" stopColor="hsla(0, 84%, 60%, 0.2)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="rgba(0,0,0,0.015)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} 
                  dy={15}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.01)' }}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: '1px solid rgba(255,255,255,0.6)', 
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                    padding: '16px 20px', 
                    backgroundColor: 'rgba(255,255,255,0.85)', 
                    backdropFilter: 'blur(16px)' 
                  }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={38}>
                  {pipelineChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.grad} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Projects List */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-[32px] flex flex-col max-h-[450px] shadow-sm bg-gradient-to-br from-white/80 to-white/40 border border-white/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Aktif Projeler</h4>
              <p className="text-xs text-slate-500 font-bold">Kritik uygulama süreçleri</p>
            </div>
            <button onClick={() => onNavigate?.('project-mgmt')} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-500/5 px-4 py-2 rounded-xl transition-all border border-emerald-500/10 cursor-pointer">Tümünü Gör</button>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                <Briefcase size={48} className="opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest italic">Henüz proje kaydı bulunmuyor</p>
              </div>
            ) : (
              projects.slice(0, 8).map(p => (
                <motion.div
                  layout
                  key={p.id}
                  onClick={() => onNavigate?.('project-mgmt')}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/20 hover:bg-white transition-all border border-transparent hover:border-slate-100/50 group cursor-pointer shadow-none hover:shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-all shrink-0">
                    <Briefcase size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{p.name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                        p.status === 'IN_PROGRESS' ? "bg-emerald-500/10 text-emerald-600" :
                        p.status === 'COMPLETED' ? "bg-blue-500/10 text-blue-600" :
                        p.status === 'PLANNING' ? "bg-amber-500/10 text-amber-600" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {({ IN_PROGRESS: 'Devam Ediyor', NOT_STARTED: 'Başlamadı', COMPLETED: 'Tamamlandı', DRAFT: 'Taslak', APPROVED: 'Onaylandı', ANALYSIS: 'Analiz', AWAITING_APPROVAL: 'Onay Bekliyor', WON: 'Kazanıldı', LOST: 'Kaybedildi' } as Record<string, string>)[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">{((p.totalValue || 0) / 1000).toFixed(0)}k $</p>
                    <div className="w-20 h-1.5 bg-slate-100/80 rounded-full mt-2 overflow-hidden border border-slate-200/30">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${p.progress || 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Yönetim Raporları & Analitik — Dashboard'a gömülü, MANAGEMENT_REPORTS_VIEW izni olmayan
          birim yöneticileri/standart kullanıcılar bu bölümü görmez, sadece yukarıdaki kişisel
          RoleCockpit'i görür. */}
      {hasPermission('MANAGEMENT_REPORTS_VIEW') && (
        <div className="glass-panel rounded-[32px] p-8 bg-gradient-to-br from-white/80 to-white/40 border border-white/50">
          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic mb-6">Yönetim Raporları & Analitik</h4>
          <ManagementReportingModule embedded />
        </div>
      )}
      </>}
    </div>
  );
};

export default Dashboard;
