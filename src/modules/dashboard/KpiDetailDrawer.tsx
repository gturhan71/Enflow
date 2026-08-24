import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fmtCurrency as cfmt } from '../../lib/format';
import DrawerShell from './DrawerShell';

export type KpiKey = 'pipeline' | 'won' | 'lost' | 'projects' | 'winProbability';

interface OppItem { id: string; title: string; value: number; status: string; probability?: number }
interface ProjectItem { id: string; name: string; status: string; progress: number; value?: number }

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
  const hasRows = kpiKey === 'projects' ? (projectItems || []).length > 0 : (oppItems || []).length > 0;

  const handleExport = () => {
    const rows = kpiKey === 'projects'
      ? (projectItems || []).map(p => ({ Proje: p.name, Durum: p.status, 'İlerleme (%)': p.progress, Değer: p.value ?? 0 }))
      : (oppItems || []).map(o => ({
          Fırsat: o.title,
          Durum: o.status,
          Değer: o.value,
          ...(kpiKey === 'winProbability' ? { 'Olasılık (%)': o.probability ?? 0 } : {}),
        }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), meta.title.slice(0, 31));
    XLSX.writeFile(wb, `${meta.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <DrawerShell
      title={meta.title}
      philosophy={meta.philosophy}
      onClose={onClose}
      onNavigate={() => { onNavigate(meta.targetTab); onClose(); }}
    >
      {hasRows && (
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-600 hover:bg-emerald-500/5 px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-500/20 transition-all mb-4 ml-auto"
        >
          <Download size={12} /> Excel'e Aktar (.xlsx)
        </button>
      )}
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
                {p.value != null && p.value > 0 && (
                  <span className="text-xs font-black text-slate-700 shrink-0">{cfmt(p.value)}</span>
                )}
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
