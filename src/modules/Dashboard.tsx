import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  Clock, 
  Target,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  XCircle,
  FileSignature,
  ShoppingCart,
  Kanban,
  BarChart3,
  History,
  Loader2,
  Calendar
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
import { motion, AnimatePresence } from 'motion/react';
import { Opportunity, Project, TodoTask, Contract, Unit, Proposal } from '../types';

interface KPI {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  glowBg?: string;
}

interface DevelopmentItem {
  id: string;
  title: string;
  description: string;
  type?: string;
  date?: string;
  icon?: React.ElementType;
  color?: string;
}
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

// Sub-component for KPI cards (Memoized for performance with high-fidelity glow effects)
const KPICard = React.memo(({ kpi, index }: { kpi: KPI, index: number }) => (
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
    className="glass-panel p-8 rounded-[32px] group relative overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-white/50 bg-gradient-to-br from-white/80 to-white/40 cursor-pointer"
  >
    {/* Dynamic Background Mesh Glow */}
    <div className={cn(
      "absolute -right-16 -top-16 w-36 h-36 rounded-full blur-[50px] opacity-10 group-hover:opacity-30 group-hover:scale-125 transition-all duration-700 ease-out",
      kpi.glowBg
    )} />
    
    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
      <kpi.icon size={80} />
    </div>
    
    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 shadow-lg shadow-black/5", kpi.bg, kpi.color)}>
      <kpi.icon size={28} />
    </div>
    
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
    <div className="flex items-baseline gap-2">
      <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h4>
      <ArrowUpRight size={16} className={cn("transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 duration-300", kpi.color)} />
    </div>
    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic">{kpi.sub}</p>
  </motion.div>
));

const Dashboard = ({
  opportunities = [],
  projects = [],
  tasks = [],
  contracts = [],
  units = [],
  proposals = [],
  onApproveProposal
}: {
  opportunities: Opportunity[],
  projects: Project[],
  tasks: TodoTask[],
  contracts?: Contract[],
  units?: Unit[],
  proposals?: Proposal[],
  onApproveProposal?: (id: string) => void
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const isManager = currentUser?.role === 'GENERAL_MANAGER';

  useEffect(() => {
    if (activeTab === 'performance' && isManager) {
      setLoadingLogs(true);
      apiService.getNotificationLogs()
        .then(data => setLogs(data.logs || []))
        .catch(err => console.error('Logs fetch failed:', err))
        .finally(() => setLoadingLogs(false));
    }
  }, [activeTab, isManager]);
  
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

    const activeOpps = opportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON');
    const lostOpps = opportunities.filter(o => o.status === 'LOST');
    const wonOpps = opportunities.filter(o => o.status === 'WON');

    const totalPipelineValue = activeOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const lostValue = lostOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const wonValue = wonOpps.reduce((sum, o) => sum + getOppValue(o), 0);
    const activeProjects = projects.filter(p => ['IN_PROGRESS', 'NOT_STARTED'].includes(p.status)).length;

    const fmtVal = (v: number) => v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
      ? `${(v / 1_000).toFixed(0)}K`
      : v.toFixed(0);

    return [
      { label: 'Toplam Pipeline', value: fmtVal(totalPipelineValue), sub: `${activeOpps.length} Aktif Fırsat`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10', glowBg: 'bg-emerald-500' },
      { label: 'Kazanılan Değer', value: fmtVal(wonValue), sub: `${wonOpps.length} Kazanılan Fırsat`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-500/10', glowBg: 'bg-blue-500' },
      { label: 'Aktif Projeler', value: activeProjects, sub: 'Uygulama Aşamasında', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-500/10', glowBg: 'bg-purple-500' },
      { label: 'Kaybedilen Değer', value: fmtVal(lostValue), sub: `${lostOpps.length} Kaybedilen Fırsat`, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', glowBg: 'bg-red-500' },
    ];
  }, [opportunities, projects, proposals]);

  const approvalQueue = useMemo(() => 
    opportunities.filter(o => o.technicalStatus === 'WAITING_APPROVAL'),
    [opportunities]
  );

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

  const developments = useMemo(() => {
    const list: DevelopmentItem[] = [];

    // Add signed contracts
    opportunities.forEach(opp => {
      const contract = contracts.find(c => c.opportunityId === opp.id);
      if (contract && contract.status === 'SIGNED') {
        list.push({
          id: `dev-contract-${contract.id}`,
          title: 'Sözleşme İmzalandı',
          description: `"${opp.title}" fırsatı için sözleşme imzalanarak Proje Yönetimine devredildi.`,
          date: contract.signedDate || 'Canlı Güncelleme',
          icon: FileSignature,
          color: 'text-emerald-600 bg-emerald-500/10'
        });
      }
    });

    // Match procurement/PM unit IDs by name keywords (DB IDs are cuid, not hardcoded)
    const procurementIds = new Set(
      units.filter(u => /satın|lojistik|procurement/i.test(u.name)).map(u => u.id)
    );
    const pmIds = new Set(
      units.filter(u => /proje|yönetim|project/i.test(u.name)).map(u => u.id)
    );

    tasks.filter(t => procurementIds.has(t.unitId) || pmIds.has(t.unitId)).forEach(task => {
      const isProcurement = procurementIds.has(task.unitId);
      const unitName = units.find(u => u.id === task.unitId)?.name || (isProcurement ? 'Satın Alma' : 'Proje Yönetimi');
      list.push({
        id: `dev-task-${task.id}`,
        title: task.title,
        description: `Birim: ${unitName} | Durum: ${task.status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'} | ${task.description || ''}`,
        date: task.dueDate || 'Termin Belirtilmedi',
        icon: isProcurement ? ShoppingCart : Kanban,
        color: task.status === 'COMPLETED' ? 'text-emerald-600 bg-emerald-500/10' : 'text-amber-600 bg-amber-500/10'
      });
    });

    return list.slice(0, 6);
  }, [opportunities, contracts, tasks, units]);

  // Performance Data for Managers — uses real DB unit IDs
  const performanceByUnit = useMemo(() => {
    if (units.length === 0) return [];
    return units.map(unit => {
      const unitTasks = tasks.filter(t => t.unitId === unit.id);
      const completed = unitTasks.filter(t => t.status === 'COMPLETED').length;
      const total = unitTasks.length;
      const shortName = unit.name.length > 14 ? unit.name.slice(0, 13) + '…' : unit.name;
      return {
        name: shortName,
        tamamlanan: completed,
        toplam: total,
        performans: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    }).filter(u => u.toplam > 0);
  }, [tasks, units]);

  if (activeTab === 'performance' && isManager) {
    return (
      <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-geist bg-slate-50/30 custom-scrollbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('overview')}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 text-slate-400 hover:text-primary transition-all shadow-sm border border-white/40 dark:border-white/10"
            >
              ← Genel Bakış
            </button>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Performans & Raporlar</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Yönetici Paneli
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Unit Performance Chart */}
          <div className="lg:col-span-2 glass-panel rounded-[32px] p-8 space-y-8 border border-white/50 bg-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">Birim İş Akış Performansı</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Görev Tamamlama Oranları</p>
              </div>
              <BarChart3 className="text-primary opacity-50" size={24} />
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceByUnit}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: '900' }}
                  />
                  <Bar dataKey="tamamlanan" name="Tamamlanan" fill="hsl(151 86% 39%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="toplam" name="Toplam Görev" fill="rgba(100, 116, 139, 0.2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="space-y-6">
            <div className="glass-panel rounded-[32px] p-6 border-l-4 border-l-primary bg-white/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Target size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Genel Verimlilik</p>
                  <h4 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {performanceByUnit.length > 0 ? Math.round(performanceByUnit.reduce((a, b) => a + b.performans, 0) / performanceByUnit.length) : 0}%
                  </h4>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-6 border-l-4 border-l-amber-500 bg-white/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bekleyen Görevler</p>
                  <h4 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {tasks.filter(t => t.status === 'PENDING').length}
                  </h4>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-8 space-y-6 bg-white/40 border border-white/50">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Birim Bazlı Dağılım</h5>
              <div className="space-y-4">
                {performanceByUnit.map(unit => (
                  <div key={unit.name} className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-700">{unit.name}</span>
                      <span className="text-primary">{unit.performans}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${unit.performans}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Access Logs Table */}
        <div className="glass-panel rounded-[32px] p-8 space-y-8 bg-white/40 border border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-1">Bildirim & Sistem Erişim Kayıtları</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kullanıcı Etkileşim Takibi</p>
            </div>
            <History className="text-primary opacity-50" size={24} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">
                  <th className="px-6 py-2">Kullanıcı ID</th>
                  <th className="px-6 py-2">İşlem Detayı</th>
                  <th className="px-6 py-2">Zaman Damgası</th>
                  <th className="px-6 py-2 text-right">Durum</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : logs.length > 0 ? (
                  logs.map((log, idx) => (
                    <tr key={idx} className="glass-panel group hover:scale-[1.01] transition-all cursor-pointer bg-white/60">
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                          {log.userId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight italic">
                          {log.action}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          <Calendar size={12} />
                          {new Date(log.timestamp).toLocaleString('tr-TR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                          LOGLANDI
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Kurumsal Kokpit</h3>
          <p className="text-slate-500 font-medium text-sm mt-1">Sistem genelindeki canlı performans ve operasyonel veriler.</p>
        </div>
        <div className="flex items-center gap-4">
          {isManager && (
            <button 
              onClick={() => setActiveTab('performance')}
              className="px-8 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <BarChart3 size={16} />
              Performans & Raporlar
            </button>
          )}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => <KPICard key={kpi.label} kpi={kpi} index={i} />)}
      </div>

      {/* Approval Queue Section */}
      {approvalQueue.length > 0 && (
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-gradient-to-br from-white/70 to-white/40 border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Onay Kuyruğu</h4>
              <p className="text-xs text-slate-500 font-bold">Yönetici onayı bekleyen teknik teklifler</p>
            </div>
            <div className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-4 py-1.5 rounded-full border border-amber-500/20 uppercase tracking-widest animate-pulse">
              {approvalQueue.length} Bekleyen Onay
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvalQueue.map(opp => (
              <motion.div 
                layout
                key={opp.id}
                className="p-5 rounded-2xl bg-white/70 border border-white/80 hover:border-emerald-500/30 hover:shadow-lg transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors duration-200">{opp.title}</h5>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{opp.customer?.name || 'Müşteri Belirtilmedi'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600 tracking-tighter">{((opp.value || 0) / 1000).toFixed(1)}k $</p>
                  </div>
                </div>
                <button 
                  onClick={() => onApproveProposal?.(opp.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 hover:shadow-emerald-500/30 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <ShieldCheck size={14} /> Teklifi Onayla
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Lost Deals Section */}
      {opportunities.filter(o => o.status === 'LOST').length > 0 && (
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-gradient-to-br from-white/70 to-white/40 border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Kaybedilenler Listesi</h4>
              <p className="text-xs text-slate-500 font-bold">Pipedan düşen kaybedilen teklifler/fırsatlar</p>
            </div>
            <div className="bg-red-500/10 text-red-600 text-[10px] font-black px-4 py-1.5 rounded-full border border-red-500/20 uppercase tracking-widest">
              {opportunities.filter(o => o.status === 'LOST').length} Kaybedilen
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.filter(o => o.status === 'LOST').map(opp => (
              <motion.div 
                layout
                key={opp.id}
                className="p-5 rounded-2xl bg-white/60 border border-white/80 hover:border-red-500/20 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate">{opp.title}</h5>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{opp.customer?.name || 'Müşteri Belirtilmedi'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-500 tracking-tighter">{((opp.value || 0) / 1000).toFixed(1)}k $</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
            <button className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-500/5 px-4 py-2 rounded-xl transition-all border border-emerald-500/10 cursor-pointer">Tümünü Gör</button>
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
                        {{ IN_PROGRESS: 'Devam Ediyor', NOT_STARTED: 'Başlamadı', COMPLETED: 'Tamamlandı', DRAFT: 'Taslak', APPROVED: 'Onaylandı', ANALYSIS: 'Analiz', AWAITING_APPROVAL: 'Onay Bekliyor', WON: 'Kazanıldı', LOST: 'Kaybedildi' }[p.status] ?? p.status}
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

      {/* Live Developments Section */}
      {developments.length > 0 && (
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-gradient-to-br from-white/80 to-white/40 border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Canlı Operasyon Gelişmeleri</h4>
              <p className="text-xs text-slate-500 font-bold">Proje Yönetimi, Sözleşme ve Satın Alma süreçlerindeki canlı akış</p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black px-4 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest animate-pulse">
              {developments.length} Canlı Takip
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {developments.map((dev, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                key={dev.id}
                className="p-6 rounded-3xl bg-gradient-to-br from-white/85 to-white/45 border border-white/60 hover:border-emerald-500/20 hover:shadow-xl transition-all duration-300 group flex items-start gap-4 relative overflow-hidden"
              >
                {/* Glowing neon side border on hover */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-emerald-500/50 to-transparent transform -translate-y-full group-hover:translate-y-full transition-transform duration-1000" />
                
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative", dev.color)}>
                  {/* Ping Animation Indicator for Live Events */}
                  {dev.id.includes('task') && !dev.title.includes('Tamamlandı') && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                  )}
                  {dev.id.includes('contract') && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  )}
                  <dev.icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h5 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors duration-200">{dev.title}</h5>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-3 leading-relaxed">{dev.description}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 inline-block px-2.5 py-1 rounded-md">{dev.date}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
