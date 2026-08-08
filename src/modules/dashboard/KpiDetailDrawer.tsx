import React from 'react';
import { fmtCurrency as cfmt } from '../../lib/format';
import DrawerShell from './DrawerShell';

export type KpiKey = 'pipeline' | 'won' | 'lost' | 'projects' | 'winProbability';

interface OppItem { id: string; title: string; value: number; status: string; probability?: number }
interface ProjectItem { id: string; name: string; status: string; progress: number }

const KPI_META: Record<KpiKey, { title: string; philosophy: string; targetTab: string }> = {
  pipeline: {
    title: 'Toplam Pipeline',
    philosophy: 'Henüz kazanılmamış/kaybedilmemiş tüm aktif fırsatların toplam değeri; satış hattının o anki büyüklüğünü ve gelecek gelir potansiyelini gösterir.',
    targetTab: 'crm-opportunities',
  },
  won: {
    title: 'Kazanılan Değer',
    philosophy: 'Bu dönemde kazanılan fırsatların toplam değeri; satış performansının somut çıktısı.',
    targetTab: 'crm-opportunities',
  },
  lost: {
    title: 'Kaybedilen Değer',
    philosophy: 'Kaybedilen fırsatların toplam değeri; kayıp nedenleri ile birlikte incelendiğinde satış sürecindeki zayıf noktaları gösterir.',
    targetTab: 'crm-opportunities',
  },
  winProbability: {
    title: 'Ort. Kazanma Olasılığı',
    philosophy: 'Pipeline aşamalarını sayı yerine yüzde üzerinden okur: kapanan (kazanılan) bir fırsat 100 kabul edilir, her aktif fırsatın kendi kazanma olasılığı kapanışa ne kadar yaklaştığını gösterir. Liste en yüksek olasılıklı (kapanışa en yakın) fırsattan başlar.',
    targetTab: 'crm-opportunities',
  },
  projects: {
    title: 'Aktif Projeler',
    philosophy: 'Uygulama aşamasındaki (devam eden) projeler; teslim taahhütlerinin ve kaynak yükünün o anki tablosu.',
    targetTab: 'project-mgmt',
  },
};

interface Props {
  kpiKey: KpiKey;
  oppItems?: OppItem[];
  projectItems?: ProjectItem[];
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const KpiDetailDrawer: React.FC<Props> = ({ kpiKey, oppItems, projectItems, onClose, onNavigate }) => {
  const meta = KPI_META[kpiKey];

  return (
    <DrawerShell
      title={meta.title}
      philosophy={meta.philosophy}
      onClose={onClose}
      onNavigate={() => { onNavigate(meta.targetTab); onClose(); }}
    >
      {kpiKey === 'projects' ? (
        (projectItems || []).length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-8">Aktif proje yok.</p>
        ) : (
          <div className="space-y-1.5">
            {(projectItems || []).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400">{p.status} · %{p.progress} ilerleme</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        (oppItems || []).length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-8">Kayıt yok.</p>
        ) : (
          <div className="space-y-1.5">
            {(oppItems || []).map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{o.title}</p>
                  <p className="text-[10px] text-slate-400">{o.status}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-slate-700 block">{cfmt(o.value)}</span>
                  {o.probability != null && (
                    <span className={`text-[10px] font-black ${o.probability >= 70 ? 'text-emerald-600' : o.probability >= 40 ? 'text-amber-600' : 'text-slate-400'}`}>%{o.probability}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </DrawerShell>
  );
};

export default KpiDetailDrawer;
