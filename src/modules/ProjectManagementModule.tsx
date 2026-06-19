import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, X, RefreshCw, ChevronRight, Edit2, Trash2,
  CheckCircle2, Clock, AlertTriangle, Ban, Layers, TrendingUp,
  TrendingDown, DollarSign, Calendar, Users, FileText, BarChart3,
  Package, Truck, Code2, CheckSquare, ShieldCheck, Receipt, Banknote,
  Wrench, ArrowRight, Target, Activity, Printer, AlertCircle, Flag,
  MoreVertical, ChevronDown, ChevronUp, Upload, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import {
  Project, ProjectMilestone, ProjectCostItem,
  ProjectType, ProjectStatus, MilestoneStatus, CostCategory,
  User, Unit, Opportunity
} from '../types';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  HARDWARE: 'Donanım', SOFTWARE: 'Yazılım', SERVICE: 'Hizmet', MIXED: 'Karma',
};
const PROJECT_TYPE_COLOR: Record<ProjectType, string> = {
  HARDWARE: 'bg-blue-100 text-blue-700',
  SOFTWARE: 'bg-purple-100 text-purple-700',
  SERVICE: 'bg-emerald-100 text-emerald-700',
  MIXED: 'bg-amber-100 text-amber-700',
};
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  PLANNING:    { label: 'Planlama',     color: 'text-slate-600',  bg: 'bg-slate-100'  },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'text-blue-700',   bg: 'bg-blue-100'   },
  ON_HOLD:     { label: 'Beklemede',    color: 'text-amber-700',  bg: 'bg-amber-100'  },
  COMPLETED:   { label: 'Tamamlandı',   color: 'text-green-700',  bg: 'bg-green-100'  },
  CANCELLED:   { label: 'İptal',        color: 'text-red-700',    bg: 'bg-red-100'    },
};
const MS_STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; icon: React.ReactNode }> = {
  NOT_STARTED: { label: 'Başlamadı',   color: 'text-slate-400',  icon: <Clock size={14} /> },
  IN_PROGRESS: { label: 'Devam Ediyor',color: 'text-blue-500',   icon: <Activity size={14} /> },
  COMPLETED:   { label: 'Tamamlandı',  color: 'text-green-500',  icon: <CheckCircle2 size={14} /> },
  BLOCKED:     { label: 'Engellendi',  color: 'text-red-500',    icon: <AlertTriangle size={14} /> },
  CANCELLED:   { label: 'İptal',       color: 'text-slate-400',  icon: <Ban size={14} /> },
};
const MS_TYPE_ICON: Record<string, React.ReactNode> = {
  PLANNING:     <Target size={14} />,
  PROCUREMENT:  <Package size={14} />,
  SHIPMENT:     <Truck size={14} />,
  INSTALLATION: <Wrench size={14} />,
  DEVELOPMENT:  <Code2 size={14} />,
  TESTING:      <CheckSquare size={14} />,
  ACCEPTANCE:   <ShieldCheck size={14} />,
  WARRANTY:     <ShieldCheck size={14} />,
  INVOICING:    <Receipt size={14} />,
  COLLECTION:   <Banknote size={14} />,
  CUSTOM:       <Flag size={14} />,
};
const COST_CAT_LABEL: Record<CostCategory, string> = {
  PROCUREMENT: 'Satınalma', TRAVEL: 'Seyahat/Lojistik',
  EXTERNAL_SERVICE: 'Harici Hizmet', OTHER: 'Diğer',
};
const COST_CAT_COLOR: Record<CostCategory, string> = {
  PROCUREMENT: 'bg-blue-100 text-blue-700',
  TRAVEL: 'bg-amber-100 text-amber-700',
  EXTERNAL_SERVICE: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

const fmt = (v: number, c = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c, minimumFractionDigits: 0 }).format(v);
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—';
const isOverdue = (d?: string | null) => !!d && new Date(d) < new Date();

// ── Yardımcı hesaplamalar ──────────────────────────────────────────────────────

const calcFinancials = (p: Project) => {
  const totalPlanned = p.projectCostItems.reduce((s, c) => s + c.plannedAmount, 0);
  const totalActual  = p.projectCostItems.reduce((s, c) => s + c.amountTRY, 0);
  const contractVal  = p.totalValue;
  const plannedMargin = contractVal > 0 ? ((contractVal - totalPlanned) / contractVal) * 100 : 0;
  const actualMargin  = contractVal > 0 ? ((contractVal - totalActual)  / contractVal) * 100 : 0;
  const forecastCost  = totalActual + (totalPlanned > totalActual ? totalPlanned - totalActual : 0);
  const forecastMargin = contractVal > 0 ? ((contractVal - forecastCost) / contractVal) * 100 : 0;
  const delayedMs = p.milestones.filter(m =>
    m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && isOverdue(m.plannedEnd)
  ).length;
  return { totalPlanned, totalActual, plannedMargin, actualMargin, forecastMargin, forecastCost, delayedMs };
};

// ── Bileşenler ────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const c = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.color}`}>{c.label}</span>;
};

const MarginBadge: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
  const color = value >= 20 ? 'text-green-600 bg-green-50' : value >= 0 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
      {value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {label && <span className="font-normal">{label}:</span>} %{value.toFixed(1)}
    </span>
  );
};

// ── Fırsat Seçici ─────────────────────────────────────────────────────────────

interface OpportunityPickerProps {
  opportunities: Opportunity[];
  existingProjectOppIds: Set<string>;
  onSelect: (opp: Opportunity) => void;
  onBlank: () => void;
  onClose: () => void;
}

const OpportunityPicker: React.FC<OpportunityPickerProps> = ({ opportunities, existingProjectOppIds, onSelect, onBlank, onClose }) => {
  const [search, setSearch] = useState('');
  const won = opportunities.filter(o =>
    o.status === 'WON' && !existingProjectOppIds.has(o.id) &&
    (!search || o.title.toLowerCase().includes(search.toLowerCase()) || o.customer?.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-lg font-bold">Kazanılan Teklif Seç</h4>
            <p className="text-xs text-slate-400 mt-0.5">Proje olarak açmak istediğiniz fırsatı seçin</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara…"
              className="input-glass w-full pl-8 pr-3 py-2 text-sm rounded-xl" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {won.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {search ? 'Eşleşen fırsat yok.' : 'Henüz projeye dönüştürülmemiş kazanılmış fırsat yok.'}
            </div>
          ) : won.map(opp => (
            <button key={opp.id} onClick={() => onSelect(opp)}
              className="w-full text-left glass-card rounded-xl p-3 hover:border-indigo-500/40 transition-all group">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold group-hover:text-indigo-300 transition-colors truncate">{opp.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {opp.customer?.name ?? '—'}
                    {opp.value ? ` · ${fmt(opp.value)}` : ''}
                  </p>
                </div>
                <ChevronRight size={14} className="text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/10 shrink-0">
          <button onClick={onBlank} className="w-full btn-secondary py-2 text-sm rounded-xl flex items-center justify-center gap-2">
            <Plus size={14} /> Fırsatsız Boş Proje Aç
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Proje Formu ───────────────────────────────────────────────────────────────

interface ProjectFormProps {
  initial?: Partial<Project>;
  users: User[];
  customers: { id: string; name: string }[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initial, users, customers, onSave, onClose }) => {
  const [form, setForm] = useState({
    opportunityId: (initial as Record<string, string> | undefined)?.opportunityId ?? '',
    name: initial?.name ?? '',
    type: (initial?.type ?? 'HARDWARE') as ProjectType,
    description: initial?.description ?? '',
    customerId: initial?.customerId ?? '',
    customerName: initial?.customerName ?? '',
    pmId: initial?.pmId ?? '',
    pmName: initial?.pmName ?? '',
    totalValue: initial?.totalValue?.toString() ?? '',
    contractCurrency: initial?.contractCurrency ?? 'TRY',
    budgetTotal: initial?.budgetTotal?.toString() ?? '',
    startDate: initial?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    plannedEndDate: initial?.plannedEndDate?.split('T')[0] ?? '',
    status: (initial?.status ?? 'PLANNING') as ProjectStatus,
    milestoneTemplate: initial?.type ?? 'HARDWARE',
  });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="text-lg font-bold">{initial?.id ? 'Proje Düzenle' : 'Yeni Proje'}</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Adı *</label>
              <input value={form.name} onChange={f('name')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" placeholder="Proje başlığı" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Tipi</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ProjectType, milestoneTemplate: e.target.value as ProjectType }))}
                className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Durum</label>
              <select value={form.status} onChange={f('status')} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Müşteri</label>
              <select value={form.customerId} onChange={e => {
                const c = customers.find(c => c.id === e.target.value);
                setForm(p => ({ ...p, customerId: e.target.value, customerName: c?.name ?? '' }));
              }} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Seçin…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Proje Yöneticisi</label>
              <select value={form.pmId} onChange={e => {
                const u = users.find(u => u.id === e.target.value);
                setForm(p => ({ ...p, pmId: e.target.value, pmName: u?.name ?? '' }));
              }} className="input-glass w-full px-3 py-2 text-sm rounded-xl">
                <option value="">Seçin…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sözleşme Bedeli</label>
              <div className="flex gap-1">
                <input type="number" value={form.totalValue} onChange={f('totalValue')} className="input-glass flex-1 px-3 py-2 text-sm rounded-l-xl" />
                <select value={form.contractCurrency} onChange={f('contractCurrency')} className="input-glass px-2 py-2 text-sm rounded-r-xl">
                  {['TRY','USD','EUR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Toplam Bütçe (TRY)</label>
              <input type="number" value={form.budgetTotal} onChange={f('budgetTotal')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Başlangıç Tarihi</label>
              <input type="date" value={form.startDate} onChange={f('startDate')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Planlanan Bitiş</label>
              <input type="date" value={form.plannedEndDate} onChange={f('plannedEndDate')} className="input-glass w-full px-3 py-2 text-sm rounded-xl" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={f('description')} rows={2}
              className="input-glass w-full px-3 py-2 text-sm rounded-xl resize-none" />
          </div>
          {!initial?.id && (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300">
              <span className="font-semibold">Milestone şablonu:</span> {PROJECT_TYPE_LABEL[form.type as ProjectType]} tipine göre otomatik oluşturulacak.
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, totalValue: Number(form.totalValue), budgetTotal: Number(form.budgetTotal) })}
            disabled={!form.name.trim()} className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">
            {initial?.id ? 'Güncelle' : 'Proje Oluştur'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Maliyet Formu ──────────────────────────────────────────────────────────────

interface CostFormProps {
  projectId: string;
  milestones: ProjectMilestone[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}
const CostForm: React.FC<CostFormProps> = ({ milestones, onSave, onClose }) => {
  const [form, setForm] = useState({
    category: 'OTHER' as CostCategory, description: '',
    plannedAmount: '', actualAmount: '', currency: 'TRY', amountTRY: '',
    milestoneId: '', date: new Date().toISOString().split('T')[0],
    invoiceNo: '', notes: '',
  });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <h4 className="font-bold">Maliyet Kalemi Ekle</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Kategori</label>
              <select value={form.category} onChange={f('category')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                {Object.entries(COST_CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Milestone</label>
              <select value={form.milestoneId} onChange={f('milestoneId')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1">
                <option value="">Genel</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 font-semibold">Açıklama *</label>
              <input value={form.description} onChange={f('description')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Planlanan (TRY)</label>
              <input type="number" value={form.plannedAmount} onChange={f('plannedAmount')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Gerçekleşen (TRY)</label>
              <input type="number" value={form.actualAmount} onChange={f('actualAmount')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Tarih</label>
              <input type="date" value={form.date} onChange={f('date')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Fatura No</label>
              <input value={form.invoiceNo} onChange={f('invoiceNo')} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 font-semibold">Not</label>
              <textarea value={form.notes} onChange={f('notes')} rows={2} className="input-glass w-full px-3 py-2 text-sm rounded-xl mt-1 resize-none" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-xl">İptal</button>
          <button onClick={() => onSave({ ...form, plannedAmount: Number(form.plannedAmount), actualAmount: Number(form.actualAmount), amountTRY: Number(form.actualAmount) })}
            disabled={!form.description} className="btn-primary px-4 py-2 text-sm rounded-xl disabled:opacity-50">
            Ekle
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Proje Devir Paketi (Faz 2) — ContractWorkflowDoc pattern'inin klonu ───────
// Tip burada lokal tanımlı (types.ts'e taşınmaz) — ContractWorkflowDoc/
// ContractWorkflow'un ContractWorkflowTest.tsx'te lokal tanımlanma konvansiyonuna uyar.

interface ProjectHandoverDoc {
  id: string;
  projectId: string;
  name: string;
  docType: string;
  description?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'UPLOADED' | 'VERIFIED' | 'WAIVED';
  fileUrl?: string | null;
  isRequired: boolean;
  sortOrder: number;
  notes?: string | null;
}

const HANDOVER_STATUS_BADGE: Record<ProjectHandoverDoc['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  UPLOADED: 'bg-emerald-100 text-emerald-700',
  VERIFIED: 'bg-emerald-600 text-white',
  WAIVED: 'bg-slate-200 text-slate-500',
};

const HANDOVER_STATUS_LABEL: Record<ProjectHandoverDoc['status'], string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  UPLOADED: 'Yüklendi',
  VERIFIED: 'Onaylandı',
  WAIVED: 'Muaf',
};

function isHandoverComplete(docs: ProjectHandoverDoc[]): boolean {
  if (docs.length === 0) return false;
  return docs.filter(d => d.isRequired).every(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
}

// ── Proje Detay Çekmecesi ─────────────────────────────────────────────────────

interface ProjectDetailProps {
  project: Project;
  users: User[];
  currentUserRole?: string;
  currentUserId?: string;
  onClose: () => void;
  onRefresh: () => void;
  onPrintReport: (p: Project) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project: initialProject, users, currentUserRole, currentUserId, onClose, onRefresh, onPrintReport }) => {
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

// ── PDF Rapor Yazdırma ────────────────────────────────────────────────────────

const printProjectReport = (project: Project, forCustomer = false) => {
  const fin = calcFinancials(project);
  const w = window.open('', '_blank');
  if (!w) return;
  const msRows = project.milestones.map(m => {
    const sc = MS_STATUS_CONFIG[m.status];
    return `<tr><td>${m.title}</td><td>${sc.label}</td><td>%${m.progress}</td><td>${fmtDate(m.plannedStart)}</td><td>${fmtDate(m.plannedEnd)}</td><td>${fmtDate(m.actualEnd)}</td></tr>`;
  }).join('');
  const costRows = forCustomer ? '' : project.projectCostItems.map(c =>
    `<tr><td>${COST_CAT_LABEL[c.category]}</td><td>${c.description}</td><td>${fmt(c.plannedAmount)}</td><td>${fmt(c.amountTRY)}</td></tr>`
  ).join('');

  w.document.write(`<!DOCTYPE html><html><head><title>Proje Raporu — ${project.name}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:900px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:6px 8px;border:1px solid #e2e8f0;text-align:left}
  th{background:#f8fafc;font-weight:600}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}.label{font-size:11px;color:#64748b}
  .val{font-size:16px;font-weight:700;margin-top:2px}.warn{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;color:#dc2626;font-size:12px}</style>
  </head><body>
  <h1>Proje Raporu${forCustomer ? ' (Müşteri)' : ''}</h1>
  <p style="color:#64748b;font-size:13px">${project.name} · ${fmtDate(new Date().toISOString())}</p>
  <div class="grid">
    <div class="card"><p class="label">Müşteri</p><p class="val" style="font-size:14px">${project.customerName ?? '—'}</p></div>
    <div class="card"><p class="label">Proje Yöneticisi</p><p class="val" style="font-size:14px">${project.pmName ?? '—'}</p></div>
    <div class="card"><p class="label">Sözleşme Bedeli</p><p class="val">${fmt(project.totalValue, project.contractCurrency)}</p></div>
    <div class="card"><p class="label">İlerleme</p><p class="val">%${project.progress}</p></div>
    <div class="card"><p class="label">Planlanan Bitiş</p><p class="val" style="font-size:14px">${fmtDate(project.plannedEndDate)}</p></div>
    <div class="card"><p class="label">Aktif Faz</p><p class="val" style="font-size:14px">${project.phase}</p></div>
  </div>
  <h2>Milestone Takibi</h2>
  <table><tr><th>Milestone</th><th>Durum</th><th>İlerleme</th><th>Plan Başlangıç</th><th>Plan Bitiş</th><th>Gerçek Bitiş</th></tr>${msRows}</table>
  ${!forCustomer ? `
  <h2>Finansal Özet</h2>
  <div class="grid">
    <div class="card"><p class="label">Planlanan Maliyet</p><p class="val">${fmt(fin.totalPlanned)}</p></div>
    <div class="card"><p class="label">Gerçekleşen Maliyet</p><p class="val">${fmt(fin.totalActual)}</p></div>
    <div class="card"><p class="label">Planlanan Kar Marjı</p><p class="val" style="color:${fin.plannedMargin >= 0 ? '#16a34a' : '#dc2626'}">%${fin.plannedMargin.toFixed(1)}</p></div>
    <div class="card"><p class="label">Gerçekleşen Kar Marjı</p><p class="val" style="color:${fin.actualMargin >= 0 ? '#16a34a' : '#dc2626'}">%${fin.actualMargin.toFixed(1)}</p></div>
  </div>
  ${costRows ? `<h2>Maliyet Kalemleri</h2><table><tr><th>Kategori</th><th>Açıklama</th><th>Planlanan</th><th>Gerçekleşen</th></tr>${costRows}</table>` : ''}
  ${fin.actualMargin < fin.plannedMargin - 5 ? `<div class="warn">⚠ Gerçekleşen karlılık plandan %${(fin.plannedMargin - fin.actualMargin).toFixed(1)} geride.</div>` : ''}
  ` : ''}
  </body></html>`);
  w.document.close();
  w.print();
};

// ── Ana Modül ─────────────────────────────────────────────────────────────────

interface ProjectManagementModuleProps {
  users?: User[];
  units?: Unit[];
  customers?: { id: string; name: string }[];
  setActiveTab?: (tab: string) => void;
}

const ProjectManagementModule: React.FC<ProjectManagementModuleProps> = ({ users = [], customers = [], setActiveTab }) => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [wonOpportunities, setWonOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showOppPicker, setShowOppPicker] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [prefilledProject, setPrefilledProject] = useState<Partial<Project> & { opportunityId?: string } | undefined>(undefined);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getProjects() as Project[];
      setProjects(data);
      if (selectedProject) {
        const upd = data.find(p => p.id === selectedProject.id);
        if (upd) setSelectedProject(upd);
      }
    } finally { setLoading(false); }
  }, [selectedProject?.id]);

  const loadWonOpportunities = useCallback(async () => {
    const data = await apiService.getOpportunities() as Opportunity[];
    setWonOpportunities(data.filter(o => o.status === 'WON'));
  }, []);

  useEffect(() => { loadProjects(); loadWonOpportunities(); }, []);

  const existingProjectOppIds = useMemo(
    () => new Set(projects.map(p => p.opportunityId).filter(Boolean) as string[]),
    [projects]
  );

  const handleNewProjectClick = () => {
    setEditProject(null);
    setPrefilledProject(undefined);
    setShowOppPicker(true);
  };

  const handleOppSelect = (opp: Opportunity) => {
    setShowOppPicker(false);
    setPrefilledProject({
      name: opp.title,
      customerId: opp.customerId ?? undefined,
      customerName: opp.customer?.name ?? undefined,
      totalValue: opp.value ?? 0,
      budgetTotal: opp.value ?? 0,
      opportunityId: opp.id,
    } as Partial<Project> & { opportunityId: string });
    setShowProjectForm(true);
  };

  const handleCreateProject = async (data: Record<string, unknown>) => {
    await apiService.createProject(data);
    setShowProjectForm(false);
    setPrefilledProject(undefined);
    loadProjects();
  };

  const handleUpdateProject = async (data: Record<string, unknown>) => {
    if (!editProject) return;
    await apiService.updateProject(editProject.id, data);
    setEditProject(null);
    setShowProjectForm(false);
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Bu proje silinsin mi?')) return;
    await apiService.deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
    loadProjects();
  };

  const filtered = useMemo(() => projects.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.customerName?.toLowerCase().includes(q) || false;
    const matchS = !filterStatus || p.status === filterStatus;
    const matchT = !filterType || p.type === filterType;
    return matchQ && matchS && matchT;
  }), [projects, search, filterStatus, filterType]);

  // Dashboard metrikleri
  const metrics = useMemo(() => {
    const active = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
    const totalVal = active.reduce((s, p) => s + p.totalValue, 0);
    const delayed = projects.filter(p => {
      const fin = calcFinancials(p);
      return fin.delayedMs > 0 && p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
    }).length;
    const avgMargin = active.length
      ? active.reduce((s, p) => s + calcFinancials(p).actualMargin, 0) / active.length
      : 0;
    return { active: active.length, totalVal, delayed, avgMargin };
  }, [projects]);

  // Kanban gruplandırma
  const kanbanGroups = useMemo(() => {
    const statuses: ProjectStatus[] = ['PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED'];
    return statuses.map(s => ({ status: s, projects: projects.filter(p => p.status === s) }));
  }, [projects]);

  // Risk paneli
  const riskProjects = useMemo(() => projects.filter(p => {
    if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
    const fin = calcFinancials(p);
    return fin.delayedMs > 0 || fin.actualMargin < fin.plannedMargin - 5 || (p.budgetTotal > 0 && fin.totalActual > p.budgetTotal * 0.85);
  }), [projects]);

  return (
    <div className="flex h-full">
      <div className={`flex-1 overflow-y-auto transition-all ${selectedProject ? 'mr-[640px]' : ''}`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Proje Yönetimi</h2>
              <p className="text-sm text-slate-400 mt-0.5">Satınalma'dan tahsilata tam proje yaşam döngüsü</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadProjects} className="p-2 hover:bg-white/10 rounded-xl text-slate-400">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={handleNewProjectClick}
                className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
                <Plus size={16} /> Yeni Proje
              </button>
            </div>
          </div>

          {/* Metrik kartlar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Aktif Proje',     value: metrics.active,            icon: <Layers size={20} />,    color: 'text-indigo-400' },
              { label: 'Toplam Değer',    value: fmt(metrics.totalVal),     icon: <DollarSign size={20} />,color: 'text-green-400'  },
              { label: 'Ort. Kar Marjı',  value: `%${metrics.avgMargin.toFixed(1)}`, icon: <TrendingUp size={20} />, color: metrics.avgMargin >= 15 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Gecikmiş Proje',  value: metrics.delayed,           icon: <AlertCircle size={20} />,color: metrics.delayed > 0 ? 'text-red-400' : 'text-slate-400' },
            ].map(m => (
              <div key={m.label} className="glass-card rounded-2xl p-4">
                <div className={`${m.color} mb-2`}>{m.icon}</div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
              {[{ key: 'dashboard', label: 'Kanban' }, { key: 'list', label: 'Liste' }].map(v => (
                <button key={v.key} onClick={() => setView(v.key as typeof view)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${view === v.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'list' && (
              <div className="flex gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara…"
                    className="input-glass pl-8 pr-3 py-1.5 text-sm rounded-xl w-48" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-glass px-2 py-1.5 text-sm rounded-xl">
                  <option value="">Tüm Durumlar</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-glass px-2 py-1.5 text-sm rounded-xl">
                  <option value="">Tüm Tipler</option>
                  {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* KANBAN */}
          {view === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kanbanGroups.map(({ status, projects: gProjects }) => {
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={status} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 font-semibold">{gProjects.length}</span>
                    </div>
                    {gProjects.map(p => {
                      const fin = calcFinancials(p);
                      return (
                        <div key={p.id} onClick={() => setSelectedProject(prev => prev?.id === p.id ? null : p)}
                          className={`glass-card rounded-xl p-3 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedProject?.id === p.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold leading-tight flex-1">{p.name}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PROJECT_TYPE_COLOR[p.type]} shrink-0`}>
                              {PROJECT_TYPE_LABEL[p.type].slice(0,3)}
                            </span>
                          </div>
                          {p.code && <p className="text-[10px] text-slate-500 font-mono mb-1">{p.code}</p>}
                          {p.customerName && <p className="text-xs text-slate-400 mb-2">{p.customerName}</p>}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">%{p.progress}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <MarginBadge value={fin.actualMargin} />
                            {fin.delayedMs > 0 && (
                              <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                <AlertCircle size={10} />{fin.delayedMs}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {gProjects.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-xl p-4 text-center text-xs text-slate-500">Proje yok</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* LİSTE */}
          {view === 'list' && (
            <div className="space-y-3">
              {loading ? <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-slate-400" /></div>
                : filtered.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Proje bulunamadı.</div>
                : filtered.map(p => {
                  const fin = calcFinancials(p);
                  return (
                    <div key={p.id} onClick={() => setSelectedProject(prev => prev?.id === p.id ? null : p)}
                      className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedProject?.id === p.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <StatusBadge status={p.status} />
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PROJECT_TYPE_COLOR[p.type]}`}>{PROJECT_TYPE_LABEL[p.type]}</span>
                            {fin.delayedMs > 0 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle size={11} />{fin.delayedMs} gecikmiş</span>}
                          </div>
                          <h4 className="font-semibold text-sm">{p.name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {p.code && <span className="font-mono text-slate-500">{p.code} · </span>}
                            {p.customerName && <span>{p.customerName} · </span>}
                            PM: {p.pmName ?? '—'} · Faz: {p.phase}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="font-bold text-sm">{fmt(p.totalValue, p.contractCurrency)}</p>
                          <div className="flex gap-1 justify-end">
                            <MarginBadge value={fin.actualMargin} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 font-bold">%{p.progress}</span>
                        <span className="text-xs text-slate-400">Bitiş: {fmtDate(p.plannedEndDate)}</span>
                        <button onClick={e => { e.stopPropagation(); setEditProject(p); setShowProjectForm(true); }}
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteProject(p.id); }}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Risk Paneli */}
          {riskProjects.length > 0 && (
            <div className="glass-card rounded-2xl p-5 border-amber-500/20 border bg-amber-900/5">
              <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> Risk Paneli
              </h4>
              <div className="space-y-2">
                {riskProjects.map(p => {
                  const fin = calcFinancials(p);
                  const risks: string[] = [];
                  if (fin.delayedMs > 0) risks.push(`${fin.delayedMs} gecikmiş milestone`);
                  if (fin.actualMargin < fin.plannedMargin - 5) risks.push(`Kar %${(fin.plannedMargin - fin.actualMargin).toFixed(1)} geride`);
                  if (p.budgetTotal > 0 && fin.totalActual > p.budgetTotal * 0.85) risks.push(`Bütçenin %${((fin.totalActual/p.budgetTotal)*100).toFixed(0)}'i kullanıldı`);
                  return (
                    <div key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl p-2 transition-colors"
                      onClick={() => setSelectedProject(p)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{p.name}</p>
                        <p className="text-xs text-amber-400">{risks.join(' · ')}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detay Çekmecesi */}
      <AnimatePresence>
        {selectedProject && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setSelectedProject(null)} />
            <ProjectDetail
              project={selectedProject}
              users={users}
              currentUserRole={currentUser?.role}
              currentUserId={currentUser?.id}
              onClose={() => setSelectedProject(null)}
              onRefresh={loadProjects}
              onPrintReport={printProjectReport}
            />
          </>
        )}
      </AnimatePresence>

      {/* Fırsat Seçici */}
      <AnimatePresence>
        {showOppPicker && (
          <OpportunityPicker
            opportunities={wonOpportunities}
            existingProjectOppIds={existingProjectOppIds}
            onSelect={handleOppSelect}
            onBlank={() => { setShowOppPicker(false); setPrefilledProject(undefined); setShowProjectForm(true); }}
            onClose={() => setShowOppPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Proje Formu */}
      <AnimatePresence>
        {showProjectForm && (
          <ProjectForm
            initial={editProject ?? prefilledProject as Partial<Project> | undefined}
            users={users}
            customers={customers}
            onSave={editProject ? handleUpdateProject : handleCreateProject}
            onClose={() => { setShowProjectForm(false); setEditProject(null); setPrefilledProject(undefined); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectManagementModule;
