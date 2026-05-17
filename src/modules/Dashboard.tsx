import React, { useMemo } from 'react';
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
  Kanban
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
import { Opportunity, Project, TodoTask } from '../types';
import { cn } from '../lib/utils';

// Sub-component for KPI cards (Memoized for performance)
const KPICard = React.memo(({ kpi, index }: { kpi: any, index: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="glass-panel p-8 rounded-[32px] group relative overflow-hidden shadow-sm hover:shadow-xl transition-all border-white/40"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <kpi.icon size={80} />
    </div>
    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", kpi.bg, kpi.color)}>
      <kpi.icon size={28} />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
    <div className="flex items-baseline gap-2">
      <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h4>
      <ArrowUpRight size={16} className="text-primary" />
    </div>
    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic">{kpi.sub}</p>
  </motion.div>
));

const Dashboard = ({ 
  opportunities = [], 
  projects = [], 
  tasks = [],
  contracts = [],
  onApproveProposal
}: { 
  opportunities: Opportunity[], 
  projects: Project[], 
  tasks: TodoTask[],
  contracts?: any[],
  onApproveProposal?: (id: string) => void
}) => {
  
  // Optimization: useMemo for expensive calculations
  const kpis = useMemo(() => {
    const activeOpps = opportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON');
    const lostOpps = opportunities.filter(o => o.status === 'LOST');
    
    const totalPipelineValue = activeOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const weightedValue = activeOpps.reduce((sum, o) => sum + ((o.value || 0) * ((o.probability || 0) / 100)), 0);
    const lostValue = lostOpps.reduce((sum, o) => sum + (o.value || 0), 0);
    const activeProjects = projects.filter(p => ['IN_PROGRESS', 'NOT_STARTED'].includes(p.status)).length;

    return [
      { label: 'Toplam Pipeline', value: `${(totalPipelineValue / 1000000).toFixed(1)}M $`, sub: 'Aktif Fırsat Değeri', icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
      { label: 'Kaybedilen Değer', value: `${(lostValue / 1000000).toFixed(1)}M $`, sub: 'Pipedan Düşen', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
      { label: 'Aktif Projeler', value: activeProjects, sub: 'Uygulama Aşamasında', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
      { label: 'Ağırlıklı Değer', value: `${(weightedValue / 1000000).toFixed(1)}M $`, sub: 'Olasılık Bazlı Tahmin', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
    ];
  }, [opportunities, projects, tasks]);

  const approvalQueue = useMemo(() => 
    opportunities.filter(o => o.technicalStatus === 'WAITING_APPROVAL'),
    [opportunities]
  );

  const pipelineChartData = useMemo(() => [
    { name: 'Yeni', value: opportunities.filter(o => o.status === 'NEW').length },
    { name: 'Nitelikli', value: opportunities.filter(o => o.status === 'QUALIFIED').length },
    { name: 'Teklif', value: opportunities.filter(o => o.status === 'PROPOSAL').length },
    { name: 'Pazarlık', value: opportunities.filter(o => o.status === 'NEGOTIATION').length },
    { name: 'Kazanıldı', value: opportunities.filter(o => o.status === 'WON').length },
  ], [opportunities]);

  const developments = useMemo(() => {
    const list: any[] = [];
    
    // Add signed contracts
    opportunities.forEach(opp => {
      const contract = contracts.find(c => c.opportunityId === opp.id);
      if (contract && contract.status === 'SIGNED') {
        list.push({
          id: `dev-contract-${contract.id}`,
          title: `Sözleşme İmzalandı`,
          description: `"${opp.title}" fırsatı için sözleşme imzalanarak Proje Yönetimine devredildi.`,
          date: contract.signedDate || 'Canlı Güncelleme',
          icon: FileSignature,
          color: 'text-emerald-600 bg-emerald-50'
        });
      }
    });

    // Add active PM/Procurement tasks
    tasks.filter(t => ['u3', 'u4'].includes(t.unitId)).forEach(task => {
      const icon = task.unitId === 'u3' ? ShoppingCart : Kanban;
      const unitLabel = task.unitId === 'u3' ? 'Satın Alma' : 'Proje Yönetimi';
      list.push({
        id: `dev-task-${task.id}`,
        title: task.title,
        description: `Birim: ${unitLabel} | Durum: ${task.status === 'COMPLETED' ? 'Tamamlandı' : 'Bekliyor'} | ${task.description || ''}`,
        date: task.dueDate || 'Termin Belirtilmedi',
        icon: icon,
        color: task.status === 'COMPLETED' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
      });
    });

    return list.slice(0, 6);
  }, [opportunities, contracts, tasks]);

  const COLORS = ['hsla(151, 86%, 39%, 0.8)', 'hsla(217, 91%, 60%, 0.8)', 'hsla(271, 91%, 65%, 0.8)', 'hsla(14, 91%, 60%, 0.8)', 'hsla(151, 86%, 39%, 1)'];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Kurumsal Kokpit</h3>
          <p className="text-slate-500 font-medium text-sm">Sistem genelindeki canlı performans ve operasyonel veriler.</p>
        </div>
        <div className="flex items-center gap-3 glass-card p-3 rounded-2xl bg-white/40 border-white/60">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sistem Durumu</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/40" />
              <p className="text-xs font-bold text-slate-900 italic">Senkronize</p>
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
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-white/40 border-white/40">
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
                className="p-5 rounded-2xl bg-white/60 border border-white hover:border-primary/20 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate">{opp.title}</h5>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{opp.customer?.name || 'Müşteri Belirtilmedi'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-primary tracking-tighter">{((opp.value || 0) / 1000).toFixed(1)}k $</p>
                  </div>
                </div>
                <button 
                  onClick={() => onApproveProposal?.(opp.id)}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
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
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-white/40 border-white/40">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Kaybedilenler Listesi</h4>
              <p className="text-xs text-slate-500 font-bold">Pipedan düşen kaybedilen teklifler/fırsatlar</p>
            </div>
            <div className="bg-red-500/10 text-red-600 text-[10px] font-black px-4 py-1.5 rounded-full border border-red-500/20 uppercase tracking-widest animate-pulse">
              {opportunities.filter(o => o.status === 'LOST').length} Kaybedilen
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.filter(o => o.status === 'LOST').map(opp => (
              <motion.div 
                layout
                key={opp.id}
                className="p-5 rounded-2xl bg-white/60 border border-white hover:border-red-500/20 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate">{opp.title}</h5>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{opp.customer?.name || 'Müşteri Belirtilmedi'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-600 tracking-tighter">{((opp.value || 0) / 1000).toFixed(1)}k $</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Sales Pipeline Chart */}
        <div className="lg:col-span-3 glass-panel p-8 rounded-[32px] flex flex-col min-h-[450px] shadow-sm bg-white/40 border-white/40">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Satış Boru Hattı</h4>
              <p className="text-xs text-slate-500 font-bold">Fırsatların aşamalara göre dağılımı</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
              <ShieldCheck size={12} /> Doğrulanmış Veri
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="rgba(0,0,0,0.03)" />
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
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.2)', padding: '20px', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={45}>
                  {pipelineChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Projects List */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-[32px] flex flex-col max-h-[450px] shadow-sm bg-white/40 border-white/40">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Aktif Projeler</h4>
              <p className="text-xs text-slate-500 font-bold">Kritik uygulama süreçleri</p>
            </div>
            <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 px-4 py-2 rounded-xl transition-all border border-primary/10">Tümünü Gör</button>
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
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-slate-100 group cursor-pointer shadow-none hover:shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all shrink-0">
                    <Briefcase size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-black text-slate-900 truncate group-hover:text-primary transition-colors">{p.name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                        p.status === 'IN_PROGRESS' ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                      )}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">{((p.totalValue || 0) / 1000).toFixed(0)}k $</p>
                    <div className="w-16 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${p.progress || 0}%` }}
                        className="h-full bg-primary rounded-full shadow-sm shadow-primary/40"
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
        <div className="glass-panel p-8 rounded-[32px] shadow-sm bg-white/40 border-white/40">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Canlı Operasyon Gelişmeleri</h4>
              <p className="text-xs text-slate-500 font-bold">Proje Yönetimi, Sözleşme ve Satın Alma süreçlerindeki canlı akış</p>
            </div>
            <div className="bg-primary/10 text-primary text-[10px] font-black px-4 py-1.5 rounded-full border border-primary/20 uppercase tracking-widest animate-pulse">
              {developments.length} Canlı Takip
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {developments.map(dev => (
              <motion.div 
                layout
                key={dev.id}
                className="p-6 rounded-2xl bg-white/60 border border-white hover:border-slate-200 transition-all group flex items-start gap-4"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", dev.color)}>
                  <dev.icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h5 className="text-sm font-black text-slate-900 truncate">{dev.title}</h5>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-3 leading-relaxed">{dev.description}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{dev.date}</p>
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
