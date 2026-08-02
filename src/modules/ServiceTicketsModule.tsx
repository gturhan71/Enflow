import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench, Plus, X, RefreshCw, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import {
  Project, ServiceTicket, ServiceTicketCategory, ServiceTicketPriority, ServiceTicketStatus,
  SERVICE_TICKET_CATEGORY_LABEL, SERVICE_TICKET_PRIORITY_LABEL, SERVICE_TICKET_STATUS_LABEL,
} from '../types';

const STATUS_BADGE: Record<ServiceTicketStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-700',
  WAITING_PART: 'bg-violet-100 text-violet-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-500',
};
const PRIORITY_BADGE: Record<ServiceTicketPriority, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  NORMAL: 'bg-slate-100 text-slate-600',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-600',
};
const OPEN_STATUSES: ServiceTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_PART'];

interface Props {
  projects: Project[];
}

export function ServiceTicketsModule({ projects }: Props) {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailTicket, setDetailTicket] = useState<ServiceTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const [form, setForm] = useState({
    projectId: '', title: '', description: '', category: 'FAULT' as ServiceTicketCategory,
    priority: 'NORMAL' as ServiceTicketPriority, reportedByName: '', slaHours: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getServiceTickets({ status: statusFilter || undefined, projectId: projectFilter || undefined }) as ServiceTicket[];
      setTickets(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, projectFilter]);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ projectId: '', title: '', description: '', category: 'FAULT', priority: 'NORMAL', reportedByName: '', slaHours: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId || !form.title.trim()) return;
    setSaving(true);
    try {
      await apiService.createServiceTicket({
        projectId: form.projectId, title: form.title, description: form.description || null,
        category: form.category, priority: form.priority, reportedByName: form.reportedByName || null,
        slaHours: form.slaHours ? Number(form.slaHours) : null,
      });
      setShowNewModal(false);
      resetForm();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Servis talebi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!detailTicket) return;
    setResolving(true);
    try {
      await apiService.resolveServiceTicket(detailTicket.id, resolutionNotes || undefined);
      setDetailTicket(null);
      setResolutionNotes('');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setResolving(false);
    }
  };

  const isOverdue = (t: ServiceTicket) => !!t.dueAt && OPEN_STATUSES.includes(t.status) && new Date(t.dueAt).getTime() < Date.now();

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2">
            <Wrench size={22} className="text-primary" /> Garanti & Servis
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Kabul sonrası arıza bildirimi, yedek parça ve bakım talepleri — SLA takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><RefreshCw size={16} /></button>
          <button onClick={() => { resetForm(); setShowNewModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Yeni Talep
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-glass text-sm">
          <option value="">Tüm Durumlar</option>
          {(Object.keys(SERVICE_TICKET_STATUS_LABEL) as ServiceTicketStatus[]).map(s => <option key={s} value={s}>{SERVICE_TICKET_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="input-glass text-sm">
          <option value="">Tüm Projeler</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-3">Talep</th>
              <th className="px-4 py-3">Proje</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Öncelik</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            )}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Servis talebi bulunamadı.</td></tr>
            )}
            {tickets.map(t => (
              <tr key={t.id} onClick={() => { setDetailTicket(t); setResolutionNotes(t.resolutionNotes || ''); }} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{t.title}</div>
                  {t.reportedByName && <div className="text-xs text-slate-400">{t.reportedByName}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.project?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{SERVICE_TICKET_CATEGORY_LABEL[t.category]}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[t.priority]}`}>{SERVICE_TICKET_PRIORITY_LABEL[t.priority]}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[t.status]}`}>{SERVICE_TICKET_STATUS_LABEL[t.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {isOverdue(t) ? (
                    <span className="flex items-center gap-1 text-xs font-black text-red-600"><AlertTriangle size={12} /> Aşıldı</span>
                  ) : t.dueAt ? (
                    <span className="text-xs text-slate-400">{new Date(t.dueAt).toLocaleString('tr-TR')}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.status === 'RESOLVED' || t.status === 'CLOSED' ? <CheckCircle2 size={16} className="text-emerald-500 inline" /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yeni Talep Modalı */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-lg font-black text-slate-900">Yeni Servis Talebi</h4>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3 overflow-y-auto">
              <select required value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="input-glass w-full">
                <option value="">Proje Seçin *</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
              </select>
              <input type="text" required placeholder="Başlık *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-glass w-full" />
              <textarea placeholder="Açıklama" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-glass w-full resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ServiceTicketCategory }))} className="input-glass">
                  {(Object.keys(SERVICE_TICKET_CATEGORY_LABEL) as ServiceTicketCategory[]).map(c => <option key={c} value={c}>{SERVICE_TICKET_CATEGORY_LABEL[c]}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as ServiceTicketPriority }))} className="input-glass">
                  {(Object.keys(SERVICE_TICKET_PRIORITY_LABEL) as ServiceTicketPriority[]).map(p => <option key={p} value={p}>{SERVICE_TICKET_PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Bildiren kişi (opsiyonel)" value={form.reportedByName} onChange={e => setForm(f => ({ ...f, reportedByName: e.target.value }))} className="input-glass" />
                <input type="number" min={1} placeholder="SLA (saat)" value={form.slaHours} onChange={e => setForm(f => ({ ...f, slaHours: e.target.value }))} className="input-glass" />
              </div>
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

      {/* Detay / Çöz Modalı */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-slate-900">{detailTicket.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{detailTicket.project?.name}</p>
              </div>
              <button onClick={() => setDetailTicket(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[detailTicket.status]}`}>{SERVICE_TICKET_STATUS_LABEL[detailTicket.status]}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[detailTicket.priority]}`}>{SERVICE_TICKET_PRIORITY_LABEL[detailTicket.priority]}</span>
                <span className="text-[10px] font-black uppercase text-slate-400">{SERVICE_TICKET_CATEGORY_LABEL[detailTicket.category]}</span>
              </div>
              {detailTicket.description && <p className="text-sm text-slate-600">{detailTicket.description}</p>}
              {detailTicket.dueAt && (
                <p className="text-xs text-slate-400">SLA: {new Date(detailTicket.dueAt).toLocaleString('tr-TR')} {isOverdue(detailTicket) && <span className="text-red-600 font-black">— AŞILDI</span>}</p>
              )}
              {OPEN_STATUSES.includes(detailTicket.status) ? (
                <div className="pt-2 space-y-2">
                  <textarea placeholder="Çözüm notu (opsiyonel)" rows={3} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} className="input-glass w-full resize-none" />
                  <button onClick={handleResolve} disabled={resolving} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Çözüldü Olarak İşaretle
                  </button>
                </div>
              ) : (
                detailTicket.resolutionNotes && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                    <strong>Çözüm:</strong> {detailTicket.resolutionNotes}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceTicketsModule;
