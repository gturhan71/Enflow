import { Target, Building, FileSignature, Activity, TrendingUp, Trophy, BarChart2, ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Opportunity, Customer, Proposal } from '../../types';
import { STATUS_LABEL, getStatusStyle } from './constants';
import InfoTooltip from '../../components/InfoTooltip';

// Kural: her dashboard itemı (kart, bölüm başlığı) ⓘ ile "ne gösteriyor, neye
// göre düzenli" açıklaması taşır (bkz. Dashboard.tsx / Yönetim Raporları'ndaki aynı kural).
const METRIC_PHILOSOPHY: Record<string, string> = {
  'Aktif Müşteri': 'Durumu ACTIVE olan müşteri sayısı — pasif/arşivlenmiş müşteriler dahil değil.',
  'Pipeline Değeri': 'Henüz kazanılmamış/kaybedilmemiş/iştirak-edilmemiş tüm aktif fırsatların toplam değeri.',
  'Kazanılan Değer': 'Durumu WON olan fırsatların toplam değeri (tüm zamanlar, döneme göre filtrelenmez).',
  'Kazanma Oranı': 'Kazanılan / (kazanılan + kaybedilen) — yönetim kararıyla iştirak edilmeyenler (WITHDRAWN) paydadan hariç tutulur, KPI\'yı etkilemez.',
};
const MODULE_PHILOSOPHY: Record<string, string> = {
  'crm-opportunities': 'Rakam, WON/LOST/WITHDRAWN dışındaki tüm aktif fırsat sayısıdır.',
  'crm-customers': 'Rakam, durumu ACTIVE olan müşteri sayısıdır.',
  'crm-proposals': 'Onay bekleyen teklif varsa öncelikli gösterilir, yoksa toplam teklif sayısı.',
  'crm-negotiation': 'Rakam, şu an NEGOTIATION aşamasındaki fırsat sayısıdır — canlı müzakere sayısıyla aynı değildir.',
};

export default function DashboardView({
  opportunities, customers, proposals, setActiveTab,
}: {
  opportunities: Opportunity[];
  customers: Customer[];
  proposals: Proposal[];
  setActiveTab?: (tab: string) => void;
}) {
  const activeOpps = opportunities.filter(o => o.status !== 'WON' && o.status !== 'LOST' && o.status !== 'WITHDRAWN');
  const wonOpps = opportunities.filter(o => o.status === 'WON');
  // Win-rate paydası: yönetimsel "iştirak edilmedi" hariç (KPI nötr)
  const kpiOpps = opportunities.filter(o => o.status !== 'WITHDRAWN');
  const pipelineValue = activeOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const wonValue = wonOpps.reduce((s, o) => s + (o.value ?? 0), 0);
  const winRate = kpiOpps.length > 0
    ? Math.round((wonOpps.length / kpiOpps.length) * 100)
    : 0;
  const pendingProposals = proposals.filter(p => p.status === 'PENDING_APPROVAL').length;
  const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;

  const stageOrder: Opportunity['status'][] = ['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION'];
  const stageCounts = stageOrder.map(s => ({
    status: s,
    label: STATUS_LABEL[s],
    count: opportunities.filter(o => o.status === s).length,
  }));
  const maxStageCount = Math.max(...stageCounts.map(s => s.count), 1);

  const recentOpps = [...opportunities]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5);

  const fmtValue = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

  const modules = [
    {
      id: 'crm-opportunities',
      label: 'Fırsatlar',
      description: 'Satış boru hattı ve pipeline yönetimi',
      icon: <Target size={24} />,
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
      iconColor: 'text-blue-400',
      stat: `${activeOpps.length} aktif`,
    },
    {
      id: 'crm-customers',
      label: 'Müşteriler',
      description: 'Müşteri portföyü ve hesap yönetimi',
      icon: <Building size={24} />,
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
      iconColor: 'text-emerald-400',
      stat: `${activeCustomers} aktif`,
    },
    {
      id: 'crm-proposals',
      label: 'Teklifler',
      description: 'Teklif takibi ve onay süreci',
      icon: <FileSignature size={24} />,
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
      iconColor: 'text-amber-400',
      stat: pendingProposals > 0 ? `${pendingProposals} onay bekliyor` : `${proposals.length} toplam`,
    },
    {
      id: 'crm-negotiation',
      label: 'Canlı Pazarlıklar',
      description: 'Aktif müzakere ve anlaşma süreçleri',
      icon: <Activity size={24} />,
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
      iconColor: 'text-purple-400',
      stat: `${opportunities.filter(o => o.status === 'NEGOTIATION').length} müzakerede`,
    },
  ];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
      {/* Başlık */}
      <div>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">CRM Genel Bakış</h3>
        <p className="text-slate-400 text-sm font-medium mt-1">Satış ve müşteri yönetiminin özeti</p>
      </div>

      {/* Metrik kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktif Müşteri',   value: activeCustomers,          icon: <Building size={20} />,     color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Pipeline Değeri', value: fmtValue(pipelineValue),  icon: <TrendingUp size={20} />,   color: 'bg-blue-50 text-blue-600' },
          { label: 'Kazanılan Değer', value: fmtValue(wonValue),       icon: <Trophy size={20} />,       color: 'bg-amber-50 text-amber-700' },
          { label: 'Kazanma Oranı',   value: `%${winRate}`,            icon: <BarChart2 size={20} />,    color: 'bg-purple-50 text-purple-600' },
        ].map(m => (
          <div key={m.label} className="glass-panel rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div className={`inline-flex p-2 rounded-xl mb-3 ${m.color}`}>{m.icon}</div>
              <InfoTooltip text={METRIC_PHILOSOPHY[m.label]} />
            </div>
            <p className="text-2xl font-black text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Modül kartları */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Modüller</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map(mod => (
            <motion.div
              key={mod.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setActiveTab && setActiveTab(mod.id)}
              className={`cursor-pointer glass-panel rounded-2xl p-5 border bg-gradient-to-br ${mod.color} transition-all hover:shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div className={`${mod.iconColor} mb-3`}>{mod.icon}</div>
                <ChevronRight size={16} className="text-slate-400 mt-1" />
              </div>
              <h5 className="font-black text-slate-900 text-lg flex items-center gap-1.5">
                {mod.label}
                <InfoTooltip text={MODULE_PHILOSOPHY[mod.id]} />
              </h5>
              <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
              <p className={`text-xs font-bold mt-3 ${mod.iconColor}`}>{mod.stat}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Özeti */}
        <div className="glass-panel rounded-2xl p-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-1.5">
            Pipeline Dağılımı
            <InfoTooltip text="Fırsatların CRM aşamalarına (Yeni→İletişimde→Nitelikli→Teklif→Pazarlık) göre sayısal dağılımı, akış sırasıyla dizilir — kazanılan/kaybedilen/iştirak-edilmeyenler bu grafikte yok, sadece açık aşamalar." />
          </h4>
          <div className="space-y-3">
            {stageCounts.map(({ status, label, count }) => (
              <div
                key={status}
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
              >
                <span className="text-xs text-slate-500 w-24 shrink-0 font-medium group-hover:text-slate-700 transition-colors">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxStageCount) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${getStatusStyle(status).split(' ')[0].replace('bg-', 'bg-').replace('-50', '-400')}`}
                    style={{ backgroundColor: ({
                      NEW: '#60a5fa', CONTACTED: '#38bdf8', QUALIFIED: '#818cf8',
                      PROPOSAL: '#fbbf24', NEGOTIATION: '#c084fc',
                    } as Record<string, string>)[status] ?? '#94a3b8' }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Son Fırsatlar */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              Son Fırsatlar
              <InfoTooltip text="En son oluşturulan 5 fırsat, oluşturulma tarihine göre azalan sıralı — durumu ne olursa olsun (kazanılan/kaybedilen dahil) gösterilir." />
            </h4>
            <button
              onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Tümü <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {recentOpps.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Henüz fırsat yok.</p>
            )}
            {recentOpps.map(opp => {
              const cust = customers.find(c => c.id === opp.customerId);
              return (
                <div
                  key={opp.id}
                  onClick={() => setActiveTab && setActiveTab('crm-opportunities')}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{opp.title}</p>
                    <p className="text-xs text-slate-400">{cust?.name ?? '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(opp.status)}`}>
                      {STATUS_LABEL[opp.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
