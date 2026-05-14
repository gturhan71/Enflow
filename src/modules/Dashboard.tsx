import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  X, 
  TrendingUp, 
  DollarSign, 
  Briefcase, 
  History, 
  Activity,
  Building,
  Users,
  GitBranch,
  Target,
  ShoppingCart,
  FileSearch,
  FileCheck2,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { 
  MOCK_PROJECTS, 
  MOCK_OPPORTUNITIES,
  MOCK_UNITS,
  MOCK_SYSTEM_USERS
} from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { PermissionGate } from '../components/PermissionGate';

const PIPELINE_DATA = [
  { month: 'Ocak', value: 4200000 },
  { month: 'Şubat', value: 5100000 },
  { month: 'Mart', value: 4800000 },
  { month: 'Nisan', value: 6200000 },
  { month: 'Mayıs', value: 8500000 },
];

const UNIT_LOAD_DATA = [
  { name: 'Teknik', value: 45, color: '#6366f1' },
  { name: 'Satış', value: 25, color: '#10b981' },
  { name: 'Hukuk', value: 15, color: '#f59e0b' },
  { name: 'Proje', value: 15, color: '#ef4444' },
];

const Dashboard = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  
  // Logic for filtering data based on role
  const totalPipelineValue = MOCK_OPPORTUNITIES.reduce((sum, o) => sum + o.value, 0);
  const pendingBoMs = MOCK_OPPORTUNITIES.filter(o => o.bomStatus === 'SUBMITTED').length;

  // Role-based Alert Logic
  const getAlerts = () => {
    const common = [
      { title: 'Şartname Analizi Tamamlandı', desc: 'Global Bank projesi için BoM hazır.', type: 'info' },
    ];

    if (role === 'GENERAL_MANAGER') return [
      ...common,
      { title: 'Düşük Marjlı Teklif', desc: 'P2 projesi %9.2 marj ile onay bekliyor.', type: 'danger' },
      { title: 'Birim Ataması Bekleniyor', desc: 'Yeni müşteri fırsatı için teknik birim atanmadı.', type: 'warning' },
    ];

    if (role === 'PRESALES_ENG') return [
      ...common,
      { title: 'Yeni Şartname Atandı', desc: 'Kamu Hastanesi projesi analiz bekliyor.', type: 'warning' },
      { title: 'BoM Revizyonu', desc: 'Veri Merkezi BoM listesi reddedildi.', type: 'danger' },
    ];

    if (role === 'PROCUREMENT_MGR') return [
      ...common,
      { title: 'Geciken Sipariş', desc: 'Dell Sunucu ETA süresi 3 gün geçti.', type: 'danger' },
      { title: 'Fiyat Onayı', desc: 'Cisco yedek parça alımı onay bekliyor.', type: 'warning' },
    ];

    return common;
  };

  const renderRoleStats = () => {
    const stats = {
      GENERAL_MANAGER: [
        { label: 'Pipeline Değeri', value: `$${(totalPipelineValue / 1000000).toFixed(1)}M`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Aylık Büyüme', value: '+%24', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Aktif Devirler', value: '12', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Bekleyen Onaylar', value: pendingBoMs, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
      ],
      PRESALES_ENG: [
        { label: 'Bekleyen Analiz', value: '3', icon: FileSearch, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Aktif BoM', value: '8', icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Onaylı Listeler', value: '142', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'İş Yükü Skoru', value: '82/100', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
      ],
      PROCUREMENT_MGR: [
        { label: 'Açık Siparişler', value: '14', icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Geciken ETA', value: '2', icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Teslim Alınan', value: '45', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Bütçe Kullanımı', value: '%64', icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
      ],
      SALES_REP: [
        { label: 'Kişisel Pipeline', value: '$840K', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Teklif Verilen', value: '5', icon: FileCheck2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Kazanılan (Ay)', value: '2', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Toplantı (Hafta)', value: '6', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
      ]
    };

    const currentStats = stats[role as keyof typeof stats] || stats.GENERAL_MANAGER;

    return currentStats.map((stat, i) => (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} key={i} className="glass-panel p-6 rounded-[32px] border border-slate-100 hover:shadow-2xl transition-all">
        <div className={cn("p-3 rounded-2xl w-fit mb-4", stat.bg)}>
          <stat.icon size={24} className={stat.color} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
        <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
      </motion.div>
    ));
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24">
      {/* Welcome & Role Badge */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-3xl font-black text-slate-900 tracking-tight underline decoration-indigo-500/30 decoration-8 underline-offset-8">HOŞ GELDİN, {currentUser?.name?.split(' ')[0].toUpperCase()}!</h2>
             <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase border border-indigo-100">
               {role?.replace('_', ' ')}
             </span>
          </div>
          <p className="text-slate-500 font-medium mt-3">Bugün odaklanmanız gereken {(role === 'PRESALES_ENG' ? 'teknik analizler' : role === 'PROCUREMENT_MGR' ? 'satın alma kalemleri' : 'fırsatlar')} aşağıdadır.</p>
        </div>
      </div>

      {/* Dynamic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderRoleStats()}
      </div>

      {/* Main Charts / Focused Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Contextual Chart or List */}
        <div className="lg:col-span-2 space-y-8">
          {role === 'GENERAL_MANAGER' ? (
            <div className="glass-panel rounded-[40px] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-100/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg"><TrendingUp size={20} className="text-emerald-500" />Şirket Geneli Pipeline Trendi</h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={PIPELINE_DATA}>
                    <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(v) => `$${v/1000000}M`} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-[40px] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-100/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                  <Activity size={20} className="text-indigo-600" />
                  Birim İçi Görev Dağılımı
                </h3>
              </div>
              <div className="space-y-6">
                {MOCK_PROJECTS.slice(0, 4).map(p => (
                   <div key={p.id} className="p-5 bg-slate-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-indigo-100">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><Briefcase size={20} /></div>
                         <div>
                            <h5 className="font-bold text-slate-900">{p.name}</h5>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.status}</p>
                         </div>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-600" style={{ width: `${p.progress}%` }} />
                      </div>
                   </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-panel rounded-[40px] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-100/50">
            <h3 className="font-bold text-slate-900 mb-8 flex items-center gap-2 text-lg"><History size={20} className="text-blue-600" />Son Aksiyonlar (Biriminiz)</h3>
            <div className="space-y-6">
               {[
                 { from: 'Sistem', desc: 'Yeni şartname dosyası yüklendi.', time: '12 dk önce' },
                 { from: 'Ahmet Y.', desc: 'Maliyet listesi onaylandı.', time: '1 saat önce' },
                 { from: 'Zeynep K.', desc: 'Teklif revizyonu yapıldı.', time: 'Dün' },
               ].map((log, i) => (
                 <div key={i} className="flex items-start gap-4">
                    <div className="w-1 h-10 rounded-full bg-indigo-500/20" />
                    <div>
                       <p className="text-sm font-bold text-slate-900">{log.desc}</p>
                       <p className="text-xs text-slate-400">{log.from} • {log.time}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right Column: Notifications & Role-Specific Tools */}
        <div className="space-y-6">
          <div className="glass-panel rounded-[40px] p-8 bg-slate-900 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/20 blur-[60px] rounded-full" />
            <h3 className="font-bold mb-8 flex items-center justify-between relative z-10 text-lg">
              Kritik Bildirimler
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{getAlerts().length}</span>
            </h3>
            <div className="space-y-6 relative z-10">
              {getAlerts().map((alert, i) => (
                <div key={i} className="flex gap-4 group cursor-pointer">
                  <div className={cn(
                    "w-1 h-12 rounded-full",
                    alert.type === 'danger' ? "bg-red-500" : alert.type === 'warning' ? "bg-amber-500" : "bg-blue-500"
                  )} />
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">{alert.title}</h5>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-10 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black tracking-widest transition-all border border-white/5 backdrop-blur-md uppercase">
              TÜMÜNÜ GÖR
            </button>
          </div>

          <div className="glass-panel rounded-[40px] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-100/50">
             <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg"><Users size={20} className="text-indigo-600" />İş Yükü Dağılımı</h3>
             <div className="h-[200px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={UNIT_LOAD_DATA} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                     {UNIT_LOAD_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
