import { useState, useEffect, useMemo, type FC } from 'react';
import {
  X, Printer, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  RefreshCw, Plus, Trash2, Upload, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../../services/apiService';
import { fmtCurrencyExact as fmt } from '../../lib/format';
import {
  Project, ProjectMilestone, MilestoneStatus, CostCategory, User,
} from '../../types';
import {
  PROJECT_TYPE_LABEL, PROJECT_TYPE_COLOR, MS_STATUS_CONFIG, COST_CAT_LABEL, COST_CAT_COLOR,
  HANDOVER_STATUS_BADGE, HANDOVER_STATUS_LABEL, type ProjectHandoverDoc,
} from './constants';
import { fmtDate, fmtShort, isOverdue, calcFinancials, isHandoverComplete } from './helpers';
import StatusBadge from './StatusBadge';
import MarginBadge from './MarginBadge';
import OverheadPanel from './OverheadPanel';
import CostForm from './CostForm';

interface ProjectDetailProps {
  project: Project;
  users: User[];
  currentUserRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onRefresh: () => void;
  onPrintReport: (p: Project) => void;
}

const ProjectDetail: FC<ProjectDetailProps> = ({ project: initialProject, currentUserRole, onClose, onRefresh, onPrintReport }) => {
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState<'overview' | 'milestones' | 'costs' | 'profitability' | 'handover'>('overview');
  const [loading, setLoading] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [expandedMs, setExpandedMs] = useState<string | null>(null);
  const [handoverDocs, setHandoverDocs] = useState<ProjectHandoverDoc[]>([]);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  useEffect(() => { setProject(initialProject); }, [initialProject]);

  useEffect(() => {
    apiService.getProjectHandoverDocs(project.id)
      .then((docs) => setHandoverDocs(docs as ProjectHandoverDoc[]))
      .catch(() => { /* sessizce geç */ });
  }, [project.id]);

  const handoverComplete = useMemo(() => isHandoverComplete(handoverDocs), [handoverDocs]);

  const handleHandoverUpload = async (docId: string, file: File) => {
    setUploadingDocId(docId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const effectiveTenantId = localStorage.getItem('enflow_active_tenant_id') || '';
      const effectiveToken = localStorage.getItem('enflow_auth_token') || 'mock-token';

      const res = await fetch(`/api/projects/${project.id}/handover-docs/${docId}/upload`, {
        method: 'POST',
        headers: { 'x-tenant-id': effectiveTenantId, 'Authorization': `Bearer ${effectiveToken}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setHandoverDocs(prev => prev.map(d => d.id === result.doc.id ? result.doc : d));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleHandoverWaive = async (docId: string) => {
    const updated = await apiService.updateProjectHandoverDoc(project.id, docId, { status: 'WAIVED' }) as ProjectHandoverDoc;
    setHandoverDocs(prev => prev.map(d => d.id === docId ? updated : d));
  };

  const fin = useMemo(() => calcFinancials(project), [project]);

  const refreshProject = async () => {
    const updated = await apiService.getProject(project.id) as Project;
    setProject(updated);
    onRefresh();
  };

  const handleMsStatus = async (ms: ProjectMilestone, status: MilestoneStatus) => {
    setLoading(true);
    try {
      await apiService.updateProjectMilestone(project.id, ms.id, { status, progress: status === 'COMPLETED' ? 100 : ms.progress });
      await refreshProject();
    } finally { setLoading(false); }
  };

  const handleMsProgress = async (ms: ProjectMilestone, progress: number) => {
    await apiService.updateProjectMilestone(project.id, ms.id, { progress });
    await refreshProject();
  };

  const handleAddCost = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      await apiService.createProjectCost(project.id, data);
      setShowCostForm(false);
      await refreshProject();
    } finally { setLoading(false); }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm('Bu maliyet kalemi silinsin mi?')) return;
    await apiService.deleteProjectCost(project.id, costId);
    await refreshProject();
  };

  const MS_STATUS_NEXT: Partial<Record<MilestoneStatus, MilestoneStatus>> = {
    NOT_STARTED: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
  };

  const TABS = [
    { key: 'overview',      label: 'Genel' },
    { key: 'milestones',    label: `Milestones (${project.milestones.length})` },
    { key: 'costs',         label: `Maliyetler (${project.projectCostItems.length})` },
    { key: 'profitability', label: 'Karlılık' },
    { key: 'handover',      label: 'Devir Paketi' },
  ] as const;

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl glass-card border-l border-white/10 shadow-2xl flex flex-col">

      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between shrink-0">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={project.status} />
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PROJECT_TYPE_COLOR[project.type]}`}>
              {PROJECT_TYPE_LABEL[project.type]}
            </span>
            {fin.delayedMs > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <AlertCircle size={11} />{fin.delayedMs} gecikmiş
              </span>
            )}
            {!handoverComplete && (
              <button onClick={() => setTab('handover')} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 hover:bg-amber-200 transition-colors">
                <AlertTriangle size={11} />Devir Bekliyor
              </button>
            )}
          </div>
          <h3 className="font-bold text-lg leading-tight">{project.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {project.code && <span className="font-mono text-slate-500">{project.code} · </span>}
            {project.customerName && <span>{project.customerName} · </span>}
            PM: {project.pmName ?? '—'} · Faz: {project.phase}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onPrintReport(project)} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-200" title="Rapor">
            <Printer size={16} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} /></button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-300">%{project.progress}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.key ? 'border-b-2 border-indigo-400 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* GENEL */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Sözleşme Bedeli', fmt(project.totalValue, project.contractCurrency)],
                ['Toplam Bütçe', fmt(project.budgetTotal)],
                ['Başlangıç', fmtDate(project.startDate)],
                ['Planlanan Bitiş', fmtDate(project.plannedEndDate)],
                ['Gerçekleşen Maliyet', fmt(fin.totalActual)],
                ['Kalan Bütçe', fmt(project.budgetTotal - fin.totalActual)],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <MarginBadge value={fin.plannedMargin} label="Planlanan Kar" />
              <MarginBadge value={fin.actualMargin}  label="Gerçekleşen Kar" />
              <MarginBadge value={fin.forecastMargin} label="Tahmini Kar" />
            </div>
            {project.description && (
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">Açıklama</p>
                <p className="text-sm">{project.description}</p>
              </div>
            )}
          </>
        )}

        {/* MİLESTONES */}
        {tab === 'milestones' && (
          <div className="space-y-2">
            {project.milestones.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Milestone yok.</p>
            )}
            {project.milestones.map(ms => {
              const sc = MS_STATUS_CONFIG[ms.status];
              const overdue = ms.status !== 'COMPLETED' && isOverdue(ms.plannedEnd);
              const expanded = expandedMs === ms.id;
              const nextStatus = MS_STATUS_NEXT[ms.status];
              return (
                <div key={ms.id} className={`rounded-xl border ${overdue ? 'border-red-500/30 bg-red-900/10' : 'border-white/10 bg-white/5'}`}>
                  <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedMs(expanded ? null : ms.id)}>
                    <span className={sc.color}>{sc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{ms.title}</span>
                        {ms.isParallel && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded font-medium">Paralel</span>}
                        {ms.requiresApproval && <span className="text-[10px] bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded font-medium">Onay</span>}
                        {overdue && <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded font-medium">Gecikmiş</span>}
                      </div>
                      <p className="text-xs text-slate-400">{sc.label} · {fmtShort(ms.plannedEnd)}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">%{ms.progress}</span>
                      {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-20">İlerleme</span>
                        <input type="range" min="0" max="100" value={ms.progress}
                          onChange={e => handleMsProgress(ms, Number(e.target.value))}
                          className="flex-1 accent-indigo-500" />
                        <span className="text-xs font-bold w-8 text-right text-slate-300">%{ms.progress}</span>
                      </div>
                      {ms.assignedToName && <p className="text-xs text-slate-400">Sorumlu: <span className="text-slate-200">{ms.assignedToName}</span></p>}
                      {ms.budgetAmount && <p className="text-xs text-slate-400">Bütçe: <span className="text-slate-200">{fmt(ms.budgetAmount)}</span></p>}
                      {ms.notes && <p className="text-xs text-slate-400 italic">{ms.notes}</p>}
                      {nextStatus && (
                        <button onClick={() => handleMsStatus(ms, nextStatus)} disabled={loading}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50">
                          {loading ? <RefreshCw size={12} className="animate-spin" /> : MS_STATUS_CONFIG[nextStatus].icon}
                          {MS_STATUS_CONFIG[nextStatus].label} Olarak İşaretle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MALİYETLER */}
        {tab === 'costs' && (
          <div className="space-y-3">
            <button onClick={() => setShowCostForm(true)} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2 w-full justify-center">
              <Plus size={14} /> Maliyet Kalemi Ekle
            </button>
            {['PROCUREMENT','TRAVEL','EXTERNAL_SERVICE','OTHER'].map(cat => {
              const items = project.projectCostItems.filter(c => c.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <p className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit mb-2 ${COST_CAT_COLOR[cat as CostCategory]}`}>
                    {COST_CAT_LABEL[cat as CostCategory]}
                  </p>
                  <div className="space-y-2">
                    {items.map(c => (
                      <div key={c.id} className="bg-white/5 rounded-xl p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{c.description}</p>
                          <div className="flex gap-3 text-xs text-slate-400 mt-1">
                            <span>Plan: {fmt(c.plannedAmount)}</span>
                            <span>Gerç: {fmt(c.amountTRY)}</span>
                            {c.invoiceNo && <span>Fatura: {c.invoiceNo}</span>}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCost(c.id)} className="text-slate-500 hover:text-red-400 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {project.projectCostItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Henüz maliyet kalemi yok.</p>
            )}
          </div>
        )}

        {/* KARLILIK */}
        {tab === 'profitability' && (
          <div className="space-y-4">
            <OverheadPanel projectId={project.id} canEdit={currentUserRole === 'GENERAL_MANAGER' || currentUserRole === 'FINANCE_MGR'} onApplied={onRefresh} />
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Sözleşme Bedeli', value: fmt(project.totalValue, project.contractCurrency), note: 'Kazanılan teklif' },
                { label: 'Planlanan Maliyet', value: fmt(fin.totalPlanned), note: `Hedef kar: %${fin.plannedMargin.toFixed(1)}` },
                { label: 'Gerçekleşen Maliyet', value: fmt(fin.totalActual), note: `Gerçek kar: %${fin.actualMargin.toFixed(1)}` },
                { label: 'Tahmini Toplam Maliyet', value: fmt(fin.forecastCost), note: `Tahmini kar: %${fin.forecastMargin.toFixed(1)}` },
              ].map(r => (
                <div key={r.label} className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{r.label}</p>
                    <p className="text-sm font-bold mt-0.5">{r.value}</p>
                  </div>
                  <p className="text-xs text-slate-400">{r.note}</p>
                </div>
              ))}
            </div>

            {/* Kategori dağılımı */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Maliyet Dağılımı</p>
              {Object.keys(COST_CAT_LABEL).map(cat => {
                const items = project.projectCostItems.filter(c => c.category === cat);
                const total = items.reduce((s, c) => s + c.amountTRY, 0);
                const pct = fin.totalActual > 0 ? (total / fin.totalActual) * 100 : 0;
                if (!total) return null;
                return (
                  <div key={cat} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-400 w-28 shrink-0">{COST_CAT_LABEL[cat as CostCategory]}</span>
                    <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-16 text-right">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>

            {/* Risk uyarısı */}
            {fin.actualMargin < fin.plannedMargin - 5 && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Gerçekleşen karlılık plandan <strong>%{(fin.plannedMargin - fin.actualMargin).toFixed(1)}</strong> geride. Maliyet kontrolü önerilir.
                </p>
              </div>
            )}
          </div>
        )}

        {/* DEVİR PAKETİ */}
        {tab === 'handover' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 flex items-center gap-3 ${handoverComplete ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-amber-900/20 border border-amber-500/30'}`}>
              {handoverComplete
                ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                : <AlertTriangle size={18} className="text-amber-400 shrink-0" />}
              <p className={`text-xs ${handoverComplete ? 'text-emerald-300' : 'text-amber-300'}`}>
                {handoverComplete
                  ? 'Tüm zorunlu devir evrakları tamamlandı — proje devir toplantısına hazır.'
                  : `${handoverDocs.filter(d => d.isRequired && ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status)).length} / ${handoverDocs.filter(d => d.isRequired).length} zorunlu evrak tamamlandı. Devir toplantısından en az 1 gün önce tüm evraklar yüklenmelidir.`}
              </p>
            </div>

            {handoverDocs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">Evrak listesi yükleniyor...</div>
            ) : (
              <div className="space-y-2">
                {handoverDocs.map(doc => (
                  <div key={doc.id} className="bg-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{doc.name}</p>
                      <p className="text-[11px] text-slate-400">{doc.isRequired ? 'Zorunlu' : 'Opsiyonel'}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${HANDOVER_STATUS_BADGE[doc.status]}`}>
                      {HANDOVER_STATUS_LABEL[doc.status]}
                    </span>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 shrink-0">
                        Görüntüle
                      </a>
                    ) : (
                      <label className="shrink-0 cursor-pointer">
                        <input type="file" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleHandoverUpload(doc.id, file);
                        }} />
                        <span className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-amber-600 transition-all">
                          {uploadingDocId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Yükle
                        </span>
                      </label>
                    )}
                    {doc.status === 'PENDING' && !doc.fileUrl && (
                      <button onClick={() => handleHandoverWaive(doc.id)} className="text-[10px] text-slate-400 hover:text-slate-200 shrink-0 underline">
                        Muaf
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cost Form Modal */}
      <AnimatePresence>
        {showCostForm && (
          <CostForm projectId={project.id} milestones={project.milestones} onSave={handleAddCost} onClose={() => setShowCostForm(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProjectDetail;
