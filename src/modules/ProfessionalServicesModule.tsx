import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HardHat, Plus, X, RefreshCw, Loader2, CheckCircle2, Upload, PlayCircle, PauseCircle, RotateCcw, CalendarClock, ShoppingCart, Kanban, CalendarDays, List, Gauge,
  Paperclip, Trash2, Phone, Mail, Ticket, Star,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useWorkSpecialties } from '../hooks/useEnflowQueries';
import { WeeklyPlanView } from './professional-services/WeeklyPlanView';
import { UtilizationReport } from './professional-services/UtilizationReport';
import { MaterialRequestsPanel } from './professional-services/MaterialRequestsPanel';
import {
  Project, WorkOrder, WorkOrderType, WorkOrderPriority, WorkOrderStatus,
  WORK_ORDER_TYPE_LABEL, WORK_ORDER_PRIORITY_LABEL, WORK_ORDER_STATUS_LABEL, WORK_ORDER_SLA_DEFAULT_HOURS,
  WorkSpecialty, WorkOrderSummary, WorkOrderTechnician,
} from '../types';

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-500',
  PENDING_SCHEDULE: 'bg-amber-100 text-amber-700',
  SCHEDULED: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  WAITING_PART: 'bg-violet-100 text-violet-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-500',
  CANCELLED: 'bg-red-100 text-red-600',
};
const PRIORITY_BADGE: Record<WorkOrderPriority, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  NORMAL: 'bg-slate-100 text-slate-600',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-600',
};
const MANAGER_ROLES = new Set(['GENERAL_MANAGER', 'OPERATIONS_MGR', 'PROJECT_MGR']);

interface Props {
  projects: Project[];
  customers: { id: string; name: string }[];
  onNavigate?: (tab: string) => void;
  initialItemId?: string | null; // bildirim/deep-link ile açılan iş emri id'si
}

export function ProfessionalServicesModule({ projects, customers, onNavigate, initialItemId }: Props) {
  const { currentUser } = useAuth();
  const isManager = MANAGER_ROLES.has(currentUser?.role || '');
  const specialties = (useWorkSpecialties(currentUser?.tenantId ?? '').data ?? []) as WorkSpecialty[];

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<WorkOrderSummary | null>(null);
  const [technicians, setTechnicians] = useState<WorkOrderTechnician[]>([]);
  const [view, setView] = useState<'list' | 'calendar' | 'utilization'>('list'); // Faz 2/5 — haftalık takvim + ekip utilizasyonu
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [form, setForm] = useState({
    type: 'INSTALLATION' as WorkOrderType, title: '', description: '', priority: 'NORMAL' as WorkOrderPriority,
    customerId: '', projectId: '', requiredSpecialtyId: '',
  });
  const [scheduleForm, setScheduleForm] = useState({ assignedTechnicianId: '', scheduledDate: '', slaHours: '', dueAt: '' });
  const [completeForm, setCompleteForm] = useState({ completionNotes: '', customerSignOffName: '', costAmount: '', costCurrency: 'TRY', satisfactionScore: 0 });

  const resetForm = () => setForm({ type: 'INSTALLATION', title: '', description: '', priority: 'NORMAL', customerId: '', projectId: '', requiredSpecialtyId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getWorkOrders({ status: statusFilter || undefined, type: typeFilter || undefined }) as WorkOrder[];
      setOrders(data);
      if (isManager) {
        const s = await apiService.getWorkOrderSummary().catch(() => null) as WorkOrderSummary | null;
        setSummary(s);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, isManager]);
  useEffect(() => { load(); }, [load]);
  // Haftalık Takvim'de yapılan sevkiyat/plan mutasyonları bu modülün kendi
  // `orders` state'ini güncellemiyor — Liste'ye dönüldüğünde yeniden çekilir.
  useEffect(() => { if (view === 'list') load(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isManager) return;
    apiService.getTechnicians().then((us) => setTechnicians(us as WorkOrderTechnician[])).catch(() => setTechnicians([]));
  }, [isManager]);

  const applyDetail = (o: WorkOrder) => {
    setDetailOrder(o);
    // Hiç sevk edilmemiş (henüz slaHours/dueAt girilmemiş) bir iş emrinde,
    // önceliğe göre varsayılan hedef saat ÖNERİ olarak otomatik doldurulur —
    // zorunlu değil, yönetici değiştirebilir/boşaltabilir.
    const suggestedSlaHours = !o.slaHours && !o.dueAt ? String(WORK_ORDER_SLA_DEFAULT_HOURS[o.priority]) : '';
    setScheduleForm({
      assignedTechnicianId: o.assignedTechnicianId || '', scheduledDate: o.scheduledDate ? o.scheduledDate.slice(0, 10) : '',
      slaHours: o.slaHours ? String(o.slaHours) : suggestedSlaHours, dueAt: o.dueAt ? o.dueAt.slice(0, 10) : '',
    });
    setCompleteForm({ completionNotes: o.completionNotes || '', customerSignOffName: o.customerSignOffName || '', costAmount: o.costAmount ? String(o.costAmount) : '', costCurrency: o.costCurrency || 'TRY', satisfactionScore: 0 });
  };

  const openDetail = (o: WorkOrder) => {
    applyDetail(o);
    // Liste satırı hafif — bağlı projenin özeti (status/progress) ve açık
    // satınalma talebi sayısı yalnız tek-kayıt GET'inde hesaplanır (N+1 olmasın).
    apiService.getWorkOrder(o.id).then((full) => setDetailOrder(full as WorkOrder)).catch(() => {});
  };

  // Bildirimden gelen deep-link: liste beklenmeden ilgili iş emri doğrudan açılır.
  useEffect(() => {
    if (!initialItemId) return;
    apiService.getWorkOrder(initialItemId).then((full) => applyDetail(full as WorkOrder)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItemId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiService.createWorkOrder({
        type: form.type, title: form.title, description: form.description || null, priority: form.priority,
        customerId: form.customerId || null, projectId: form.projectId || null, requiredSpecialtyId: form.requiredSpecialtyId || null,
      });
      setShowNewModal(false);
      resetForm();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İş emri oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!detailOrder || !scheduleForm.assignedTechnicianId || !scheduleForm.scheduledDate) return;
    setSaving(true);
    try {
      const sla = scheduleForm.dueAt
        ? { dueAt: new Date(scheduleForm.dueAt).toISOString() }
        : scheduleForm.slaHours ? { slaHours: Number(scheduleForm.slaHours) } : undefined;
      const updated = await apiService.scheduleWorkOrder(detailOrder.id, scheduleForm.assignedTechnicianId, scheduleForm.scheduledDate, sla) as WorkOrder;
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sevkiyat başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    if (!detailOrder) return;
    setSaving(true);
    try {
      const updated = await apiService.startWorkOrder(detailOrder.id) as WorkOrder;
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Başlatma başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleWaitForPart = async () => {
    if (!detailOrder) return;
    const note = window.prompt('Parça/malzeme bekleme notu (opsiyonel):') || undefined;
    setSaving(true);
    try {
      const updated = await apiService.waitForPartWorkOrder(detailOrder.id, note) as WorkOrder;
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşaretleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!detailOrder) return;
    const reason = window.prompt('Yeniden açma gerekçesi (zorunlu):');
    if (!reason || !reason.trim()) return;
    setSaving(true);
    try {
      const updated = await apiService.reopenWorkOrder(detailOrder.id, reason.trim()) as WorkOrder;
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Yeniden açma başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!detailOrder) return;
    setUploadingFile(true);
    try {
      const updated = await apiService.uploadWorkOrderSignOff(detailOrder.id, file);
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Dosya yüklenemedi.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Bağlam dosyaları (log, ekran görüntüsü, saha fotoğrafı) — kapanış kanıtından
  // farklı, serbest sayıda/opsiyonel; teknisyenin işi doğru yapabilmesi için.
  const handleAttachmentUpload = async (file: File) => {
    if (!detailOrder) return;
    setUploadingAttachment(true);
    try {
      await apiService.uploadWorkOrderAttachment(detailOrder.id, file);
      const full = await apiService.getWorkOrder(detailOrder.id) as WorkOrder;
      setDetailOrder(full);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Dosya yüklenemedi.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!detailOrder) return;
    try {
      await apiService.deleteWorkOrderAttachment(detailOrder.id, attachmentId);
      const full = await apiService.getWorkOrder(detailOrder.id) as WorkOrder;
      setDetailOrder(full);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ek silinemedi.');
    }
  };

  const handleComplete = async () => {
    if (!detailOrder) return;
    setSaving(true);
    try {
      const updated = await apiService.completeWorkOrder(detailOrder.id, {
        completionNotes: completeForm.completionNotes || undefined,
        customerSignOffName: completeForm.customerSignOffName || undefined,
        costAmount: completeForm.costAmount ? Number(completeForm.costAmount) : undefined,
        costCurrency: completeForm.costAmount ? completeForm.costCurrency : undefined,
        satisfactionScore: completeForm.satisfactionScore || undefined,
      }) as WorkOrder;
      setDetailOrder(updated);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kapanış başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const canStart = (o: WorkOrder) => (isManager || o.assignedTechnicianId === currentUser?.id) && ['SCHEDULED', 'WAITING_PART'].includes(o.status);
  const canUploadAndComplete = (o: WorkOrder) => (isManager || o.assignedTechnicianId === currentUser?.id) && o.status === 'IN_PROGRESS';
  const canMarkWaitingPart = (o: WorkOrder) => (isManager || o.assignedTechnicianId === currentUser?.id) && o.status === 'IN_PROGRESS';
  const canReopen = (o: WorkOrder) => isManager && ['COMPLETED', 'CLOSED'].includes(o.status);
  const canSchedule = (o: WorkOrder) => isManager && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(o.status);
  const canManageMaterials = (o: WorkOrder) => isManager || o.assignedTechnicianId === currentUser?.id;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2">
            <HardHat size={22} className="text-primary" /> Profesyonel Hizmetler
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {isManager ? 'Kurulum/arıza/bakım iş emirleri — teknisyen sevkiyatı ve takip' : 'Size atanan iş emirleri'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><RefreshCw size={16} /></button>
          {isManager && (
            <button onClick={() => { resetForm(); setShowNewModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> Yeni İş Emri
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Açık</p>
            <p className="text-2xl font-black text-slate-900">{summary.open}</p>
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tamamlanan</p>
            <p className="text-2xl font-black text-slate-900">{summary.completed}</p>
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ort. Çözüm (gün)</p>
            <p className="text-2xl font-black text-slate-900">{summary.avgResolutionDays ?? '—'}</p>
          </div>
        </div>
      )}

      {isManager && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            <List size={13} /> Liste
          </button>
          <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${view === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            <CalendarDays size={13} /> Haftalık Takvim
          </button>
          <button onClick={() => setView('utilization')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${view === 'utilization' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            <Gauge size={13} /> Ekip Utilizasyonu
          </button>
        </div>
      )}

      {view === 'calendar' && isManager ? (
        <WeeklyPlanView technicians={technicians} preparedByName={currentUser?.name} />
      ) : view === 'utilization' && isManager ? (
        <UtilizationReport />
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-glass text-sm">
              <option value="">Tüm Durumlar</option>
              {(Object.keys(WORK_ORDER_STATUS_LABEL) as WorkOrderStatus[]).map(s => <option key={s} value={s}>{WORK_ORDER_STATUS_LABEL[s]}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-glass text-sm">
              <option value="">Tüm Tipler</option>
              {(Object.keys(WORK_ORDER_TYPE_LABEL) as WorkOrderType[]).map(t => <option key={t} value={t}>{WORK_ORDER_TYPE_LABEL[t]}</option>)}
            </select>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-3">İş Emri</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Öncelik</th>
                  <th className="px-4 py-3">Teknisyen</th>
                  <th className="px-4 py-3">Planlanan</th>
                  <th className="px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                )}
                {!loading && orders.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">İş emri bulunamadı.</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o.id} onClick={() => openDetail(o)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{o.title}</div>
                      {o.workOrderNo && <div className="text-xs text-slate-400">{o.workOrderNo}</div>}
                      {o.requiredSpecialty && <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full inline-block mt-1">{o.requiredSpecialty.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.customerName || o.customer?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{WORK_ORDER_TYPE_LABEL[o.type]}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[o.priority]}`}>{WORK_ORDER_PRIORITY_LABEL[o.priority]}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.assignedTechnician?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.scheduledDate ? new Date(o.scheduledDate).toLocaleDateString('tr-TR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[o.status]}`}>{WORK_ORDER_STATUS_LABEL[o.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Yeni İş Emri Modalı */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-lg font-black text-slate-900">Yeni İş Emri</h4>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3 overflow-y-auto">
              <input type="text" required placeholder="Başlık *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-glass w-full" />
              <textarea placeholder="Açıklama" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-glass w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as WorkOrderType }))} className="input-glass">
                  {(Object.keys(WORK_ORDER_TYPE_LABEL) as WorkOrderType[]).map(t => <option key={t} value={t}>{WORK_ORDER_TYPE_LABEL[t]}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as WorkOrderPriority }))} className="input-glass">
                  {(Object.keys(WORK_ORDER_PRIORITY_LABEL) as WorkOrderPriority[]).map(p => <option key={p} value={p}>{WORK_ORDER_PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} className="input-glass w-full">
                <option value="">Müşteri (opsiyonel)</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="input-glass w-full">
                <option value="">Proje (opsiyonel)</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
              </select>
              <select value={form.requiredSpecialtyId} onChange={e => setForm(f => ({ ...f, requiredSpecialtyId: e.target.value }))} className="input-glass w-full" title="Gereken uzmanlık (opsiyonel — sevkiyatta öneri/filtre)">
                <option value="">Gereken uzmanlık (opsiyonel)</option>
                {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary text-sm">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null} Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay Modalı */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h4 className="text-lg font-black text-slate-900">{detailOrder.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{detailOrder.workOrderNo || detailOrder.customerName || '—'}</p>
              </div>
              <button onClick={() => setDetailOrder(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[detailOrder.status]}`}>{WORK_ORDER_STATUS_LABEL[detailOrder.status]}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[detailOrder.priority]}`}>{WORK_ORDER_PRIORITY_LABEL[detailOrder.priority]}</span>
                <span className="text-[10px] font-black uppercase text-slate-400">{WORK_ORDER_TYPE_LABEL[detailOrder.type]}</span>
                {detailOrder.requiredSpecialty && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{detailOrder.requiredSpecialty.name}</span>}
                {detailOrder.dueAt && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(detailOrder.status) && (
                  new Date(detailOrder.dueAt).getTime() < Date.now() ? (
                    <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">SLA Aşıldı — {new Date(detailOrder.dueAt).toLocaleDateString('tr-TR')}</span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500">SLA: {new Date(detailOrder.dueAt).toLocaleDateString('tr-TR')}</span>
                  )
                )}
              </div>
              {detailOrder.description && <p className="text-sm text-slate-600">{detailOrder.description}</p>}

              {detailOrder.sourceTicket && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1.5">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1"><Ticket size={12} /> Kaynak Servis Talebi — müşteri bildirimi</p>
                  {detailOrder.sourceTicket.reportedByName && (
                    <p className="text-xs text-slate-700"><strong>Bildiren:</strong> {detailOrder.sourceTicket.reportedByName}</p>
                  )}
                  {detailOrder.sourceTicket.reportedByContact && (
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      {detailOrder.sourceTicket.reportedByContact.phone && <span className="flex items-center gap-1"><Phone size={11} /> {detailOrder.sourceTicket.reportedByContact.phone}</span>}
                      {detailOrder.sourceTicket.reportedByContact.email && <span className="flex items-center gap-1"><Mail size={11} /> {detailOrder.sourceTicket.reportedByContact.email}</span>}
                    </div>
                  )}
                  {(detailOrder.sourceTicket.brand || detailOrder.sourceTicket.productCategory) && (
                    <div className="flex gap-1">
                      {detailOrder.sourceTicket.brand && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{detailOrder.sourceTicket.brand.name}</span>}
                      {detailOrder.sourceTicket.productCategory && <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">{detailOrder.sourceTicket.productCategory.name}</span>}
                    </div>
                  )}
                  {detailOrder.sourceTicket.description && detailOrder.sourceTicket.description !== detailOrder.description && (
                    <p className="text-xs text-slate-500 italic">"{detailOrder.sourceTicket.description}"</p>
                  )}
                  {!!detailOrder.sourceTicket.attachments?.length && (
                    <ul className="space-y-1 pt-1 border-t border-indigo-200/60">
                      {detailOrder.sourceTicket.attachments.map(a => (
                        <li key={a.id}>
                          <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-bold underline flex items-center gap-1"><Paperclip size={11} /> {a.description || a.fileName}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Paperclip size={12} /> Bağlam Dosyaları — log / foto / saha notu</p>
                  <input ref={attachmentInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachmentUpload(f); e.target.value = ''; }} />
                  <button onClick={() => attachmentInputRef.current?.click()} disabled={uploadingAttachment} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50">
                    {uploadingAttachment ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Ekle
                  </button>
                </div>
                {!detailOrder.attachments?.length ? (
                  <p className="text-[11px] text-slate-400">Henüz ek yok.</p>
                ) : (
                  <ul className="space-y-1">
                    {detailOrder.attachments.map(a => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline truncate">{a.description || a.fileName}</a>
                        <button onClick={() => handleAttachmentDelete(a.id)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {(detailOrder.estimatedLaborCost != null || detailOrder.estimatedMaterialCost != null) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahmini Maliyet (bilgi amaçlı — otomatik işlenmez)</p>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {detailOrder.estimatedLaborCost != null && (
                      <p>İşçilik: {detailOrder.estimatedLaborCost.toLocaleString('tr-TR')} {detailOrder.costCurrency || 'TRY'}
                        {detailOrder.technicianCostRate != null && ` (${detailOrder.technicianCostRate}${detailOrder.costCurrency || ''}/${detailOrder.technicianCostRateUnit === 'DAILY' ? 'gün' : 'saat'})`}
                      </p>
                    )}
                    {detailOrder.estimatedMaterialCost != null && <p>Malzeme: {detailOrder.estimatedMaterialCost.toLocaleString('tr-TR')} {detailOrder.costCurrency || 'TRY'}</p>}
                    {detailOrder.estimatedTotalCost != null && <p className="font-bold text-slate-800">Toplam: {detailOrder.estimatedTotalCost.toLocaleString('tr-TR')} {detailOrder.costCurrency || 'TRY'}</p>}
                  </div>
                </div>
              )}

              {detailOrder.project && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bağlı Proje</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{detailOrder.project.code ? `${detailOrder.project.code} — ` : ''}{detailOrder.project.name}</p>
                    {detailOrder.project.progress != null && <p className="text-[11px] text-slate-400">İlerleme: %{detailOrder.project.progress}</p>}
                  </div>
                  {onNavigate && (
                    <button onClick={() => onNavigate('project-mgmt')} className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                      <Kanban size={13} /> Projeye Git
                    </button>
                  )}
                </div>
              )}
              {!!detailOrder.openPurchaseRequestCount && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-amber-700">Bu projede {detailOrder.openPurchaseRequestCount} açık satınalma talebi var</p>
                  {onNavigate && (
                    <button onClick={() => onNavigate('procurement')} className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800">
                      <ShoppingCart size={13} /> Satınalma'ya Git
                    </button>
                  )}
                </div>
              )}

              {canSchedule(detailOrder) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><CalendarClock size={12} /> Sevkiyat</p>
                  <select value={scheduleForm.assignedTechnicianId} onChange={e => setScheduleForm(f => ({ ...f, assignedTechnicianId: e.target.value }))} className="input-glass w-full text-sm">
                    <option value="">Teknisyen seçin</option>
                    {technicians.map(t => {
                      const specNames = t.specialties.map(s => s.name).join(', ');
                      const costLabel = t.costRate != null ? ` — ${t.costRate}${t.costCurrency || ''}/${t.costRateUnit === 'DAILY' ? 'gün' : 'saat'}` : '';
                      const loadLabel = ` (${t.openCount} açık iş)`;
                      return <option key={t.id} value={t.id}>{t.name}{specNames ? ` — ${specNames}` : ''}{loadLabel}{costLabel}</option>;
                    })}
                  </select>
                  <input type="date" value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(f => ({ ...f, scheduledDate: e.target.value }))} className="input-glass w-full text-sm" />

                  <div className="pt-1 border-t border-slate-200/60 space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      SLA — Tamamlanma Hedefi
                      {!detailOrder.slaHours && !detailOrder.dueAt && (
                        <span className="normal-case font-bold text-slate-400 tracking-normal"> · önceliğe göre önerildi, değiştirebilirsiniz</span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <input type="number" min="1" placeholder="Süre (saat)" value={scheduleForm.slaHours}
                        onChange={e => setScheduleForm(f => ({ ...f, slaHours: e.target.value, dueAt: e.target.value ? '' : f.dueAt }))}
                        className="input-glass flex-1 text-sm" />
                      <input type="date" value={scheduleForm.dueAt}
                        onChange={e => setScheduleForm(f => ({ ...f, dueAt: e.target.value, slaHours: e.target.value ? '' : f.slaHours }))}
                        className="input-glass flex-1 text-sm" title="Özel/sözleşmeden kopyalanan hedef tarih" />
                    </div>
                    {detailOrder.contractDeliverySla?.dueAt && (
                      <button type="button"
                        onClick={() => setScheduleForm(f => ({ ...f, dueAt: detailOrder.contractDeliverySla!.dueAt!.slice(0, 10), slaHours: '' }))}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">
                        Sözleşmeden Kopyala — {new Date(detailOrder.contractDeliverySla.dueAt).toLocaleDateString('tr-TR')}
                        {detailOrder.contractDeliverySla.penaltyDailyRatePct != null && ` (günlük %${detailOrder.contractDeliverySla.penaltyDailyRatePct} ceza riski)`}
                      </button>
                    )}
                  </div>

                  <button onClick={handleSchedule} disabled={saving || !scheduleForm.assignedTechnicianId || !scheduleForm.scheduledDate} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null} Sevk Et
                  </button>
                </div>
              )}

              {canManageMaterials(detailOrder) && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(detailOrder.status) && (
                <MaterialRequestsPanel
                  workOrderId={detailOrder.id}
                  materialRequests={detailOrder.materialRequests || []}
                  isManager={isManager}
                  canEdit={canManageMaterials(detailOrder)}
                  requesterName={currentUser?.name}
                  onChange={() => apiService.getWorkOrder(detailOrder.id).then((full) => setDetailOrder(full as WorkOrder)).catch(() => {})}
                />
              )}

              {canStart(detailOrder) && (
                <button onClick={handleStart} disabled={saving} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} İşe Başla
                </button>
              )}

              {canMarkWaitingPart(detailOrder) && (
                <button onClick={handleWaitForPart} disabled={saving} className="btn-secondary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />} Parça Bekliyor Olarak İşaretle
                </button>
              )}

              {canUploadAndComplete(detailOrder) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kapanış Kanıtı (müşteri imza/foto — zorunlu)</p>
                  {detailOrder.customerSignOffFileUrl ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold"><CheckCircle2 size={14} /> Dosya yüklendi</div>
                  ) : (
                    <>
                      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="btn-secondary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {uploadingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Dosya Yükle
                      </button>
                    </>
                  )}
                  <textarea placeholder="Tamamlama notu" rows={2} value={completeForm.completionNotes} onChange={e => setCompleteForm(f => ({ ...f, completionNotes: e.target.value }))} className="input-glass w-full resize-none text-sm" />
                  <input type="text" placeholder="Müşteri adı (imza sahibi)" value={completeForm.customerSignOffName} onChange={e => setCompleteForm(f => ({ ...f, customerSignOffName: e.target.value }))} className="input-glass w-full text-sm" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memnuniyet (opsiyonel)</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" onClick={() => setCompleteForm(f => ({ ...f, satisfactionScore: f.satisfactionScore === n ? 0 : n }))} title={`${n}/5`}>
                          <Star size={16} className={n <= completeForm.satisfactionScore ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" placeholder="Maliyet (opsiyonel)" value={completeForm.costAmount} onChange={e => setCompleteForm(f => ({ ...f, costAmount: e.target.value }))} className="input-glass flex-1 text-sm" />
                    <select value={completeForm.costCurrency} onChange={e => setCompleteForm(f => ({ ...f, costCurrency: e.target.value }))} className="input-glass w-24 text-sm">
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <button onClick={handleComplete} disabled={saving || !detailOrder.customerSignOffFileUrl} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Tamamlandı Olarak İşaretle
                  </button>
                  {!detailOrder.customerSignOffFileUrl && <p className="text-[10px] text-slate-400">Kapanış için önce kanıt dosyası yüklenmelidir.</p>}
                </div>
              )}

              {['COMPLETED', 'CLOSED'].includes(detailOrder.status) && (
                <>
                  {detailOrder.costAmount != null && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                      <strong>Maliyet:</strong> {detailOrder.costAmount.toLocaleString('tr-TR')} {detailOrder.costCurrency || 'TRY'}
                    </div>
                  )}
                  {detailOrder.completionNotes && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                      <strong>Tamamlama Notu:</strong> {detailOrder.completionNotes}
                    </div>
                  )}
                  {detailOrder.customerSignOffFileUrl && (
                    <a href={detailOrder.customerSignOffFileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-bold underline">Kapanış kanıtını görüntüle</a>
                  )}
                  {detailOrder.customerSatisfactionScore != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memnuniyet:</span>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={13} className={n <= detailOrder.customerSatisfactionScore! ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {canReopen(detailOrder) && (
                <button onClick={handleReopen} disabled={saving} className="btn-secondary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Yeniden Aç
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessionalServicesModule;
