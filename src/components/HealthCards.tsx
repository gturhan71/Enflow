import { HeartPulse } from 'lucide-react';
import type { ProjectHealthReport, CustomerHealthReport } from '../types';
import { fmtCurrency as fmtTRY } from '../lib/format';
import InfoTooltip from './InfoTooltip';

// Sağlık skoru kartları — Yönetim Raporları + Proje Yönetimi + CRM ortak kullanır.

export const healthColor = (n: number) => n >= 75 ? 'text-emerald-600' : n >= 55 ? 'text-amber-600' : 'text-red-600';
export const healthBar = (n: number) => n >= 75 ? 'bg-emerald-500' : n >= 55 ? 'bg-amber-500' : 'bg-red-500';

const HEALTH_STATUS: Record<string, { label: string; badge: string }> = {
  HEALTHY: { label: 'Sağlıklı', badge: 'bg-emerald-100 text-emerald-700' },
  WATCH: { label: 'İzlemede', badge: 'bg-amber-100 text-amber-700' },
  CRITICAL: { label: 'Kritik', badge: 'bg-red-100 text-red-600' },
};

export function ProjectHealthCard({ p, className = 'lg:col-span-2' }: { p: ProjectHealthReport; className?: string }) {
  return (
    <div className={`glass-card p-6 space-y-4 ${className}`}>
      <div className="flex items-center gap-2"><HeartPulse size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Proje Sağlığı</h4>
        <InfoTooltip text="Marj, takvim ve bütçe faktörlerinden oluşan 0-100 proje sağlık skoru; en düşük skorlu (en kritik) proje en üstte listelenir." />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aktif</p><p className="text-2xl font-black text-slate-800">{p.summary.total}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kritik</p><p className="text-2xl font-black text-red-600">{p.summary.critical}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">İzlemede</p><p className="text-2xl font-black text-amber-600">{p.summary.watch}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sağlıklı</p><p className="text-2xl font-black text-emerald-600">{p.summary.healthy}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ort. Skor</p><p className="text-2xl font-black text-primary">{p.summary.avgScore}</p></div>
      </div>
      {p.projects.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">Aktif proje yok.</p>
      ) : (
        <div className="space-y-2">
          {p.projects.map(pr => {
            const st = HEALTH_STATUS[pr.status];
            return (
              <div key={pr.id} className="flex items-center gap-3 border-b border-slate-100 pb-2 last:border-0">
                <div className="w-8 shrink-0 text-center"><span className={`text-lg font-black ${healthColor(pr.score)}`}>{pr.score}</span></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{pr.code ? `${pr.code} · ` : ''}{pr.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {`marj %${Math.round(pr.actualMarginPct * 100)}`}
                    {` · ilerleme %${pr.progress}`}
                    {pr.milestoneCount > 0 && ` · ${pr.overdueMilestones}/${pr.milestoneCount} geciken`}
                    {pr.budgetUsedPct > 0 && ` · bütçe %${Math.round(pr.budgetUsedPct * 100)}`}
                    {pr.deadlineRisk && ' · ⚠ son tarih geçti'}
                  </p>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    <div className="bg-emerald-400 rounded-sm" style={{ width: `${pr.factors.margin * 0.4}%` }} title="Marj" />
                    <div className="bg-sky-400 rounded-sm" style={{ width: `${pr.factors.schedule * 0.35}%` }} title="Takvim" />
                    <div className="bg-amber-400 rounded-sm" style={{ width: `${pr.factors.budget * 0.25}%` }} title="Bütçe" />
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded ${st.badge}`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{p.note}</p>
    </div>
  );
}

const CUST_STATUS: Record<string, { label: string; badge: string }> = {
  LOYAL: { label: 'Sadık', badge: 'bg-emerald-100 text-emerald-700' },
  STABLE: { label: 'İstikrarlı', badge: 'bg-amber-100 text-amber-700' },
  AT_RISK: { label: 'Riskli', badge: 'bg-red-100 text-red-600' },
};

export function CustomerHealthCard({ c, className = 'lg:col-span-2' }: { c: CustomerHealthReport; className?: string }) {
  return (
    <div className={`glass-card p-6 space-y-4 ${className}`}>
      <div className="flex items-center gap-2"><HeartPulse size={16} className="text-primary" /><h4 className="font-black text-slate-900 uppercase italic tracking-tighter">Müşteri Sağlığı</h4>
        <InfoTooltip text="Ödeme, kazanma oranı, aktivite ve sadakat faktörlerinden oluşan 0-100 müşteri sağlık skoru; en riskli (en düşük skorlu) müşteri en üstte listelenir." />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aktif</p><p className="text-2xl font-black text-slate-800">{c.summary.total}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sadık</p><p className="text-2xl font-black text-emerald-600">{c.summary.loyal}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">İstikrarlı</p><p className="text-2xl font-black text-amber-600">{c.summary.stable}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Riskli</p><p className="text-2xl font-black text-red-600">{c.summary.atRisk}</p></div>
        <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ort. Skor</p><p className="text-2xl font-black text-primary">{c.summary.avgScore}</p></div>
      </div>
      {c.customers.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">Aktivitesi olan müşteri yok.</p>
      ) : (
        <div className="space-y-2">
          {c.customers.slice(0, 8).map(cu => {
            const st = CUST_STATUS[cu.status];
            return (
              <div key={cu.id} className="flex items-center gap-3 border-b border-slate-100 pb-2 last:border-0">
                <div className="w-8 shrink-0 text-center"><span className={`text-lg font-black ${healthColor(cu.score)}`}>{cu.score}</span></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{cu.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {cu.winPct !== null && `kazanma %${Math.round(cu.winPct * 100)} · `}
                    {`${cu.oppCount} fırsat`}
                    {cu.wonRevenue > 0 && ` · gelir ${fmtTRY(cu.wonRevenue)}`}
                    {cu.overdueAmount > 0 && ` · ⚠ gecikmiş ${fmtTRY(cu.overdueAmount)}`}
                    {cu.lastActivityDays !== null && ` · son ${cu.lastActivityDays}g`}
                  </p>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    <div className="bg-indigo-400 rounded-sm" style={{ width: `${cu.factors.payment * 0.35}%` }} title="Ödeme" />
                    <div className="bg-emerald-400 rounded-sm" style={{ width: `${cu.factors.winRate * 0.30}%` }} title="Kazanma" />
                    <div className="bg-sky-400 rounded-sm" style={{ width: `${cu.factors.activity * 0.20}%` }} title="Aktivite" />
                    <div className="bg-amber-400 rounded-sm" style={{ width: `${cu.factors.loyalty * 0.15}%` }} title="Sadakat" />
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded ${st.badge}`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-slate-400 italic">{c.note}</p>
    </div>
  );
}
