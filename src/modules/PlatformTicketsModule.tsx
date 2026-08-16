import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Plus, X, RefreshCw, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import {
  PlatformTicket, PlatformTicketStatus, PlatformTicketReportedType,
  PLATFORM_TICKET_CATEGORY_LABEL, PLATFORM_TICKET_PRIORITY_LABEL,
  PLATFORM_TICKET_STATUS_LABEL, PLATFORM_TICKET_SCOPE_LABEL, PLATFORM_TICKET_REPORTED_TYPE_LABEL,
} from '../types';

const STATUS_BADGE: Record<PlatformTicketStatus, string> = {
  NEW: 'bg-slate-100 text-slate-600',
  TRIAGED: 'bg-sky-100 text-sky-700',
  PLANNED: 'bg-violet-100 text-violet-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
};
const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-600',
  HIGH: 'bg-amber-100 text-amber-700',
  MEDIUM: 'bg-sky-100 text-sky-700',
  LOW: 'bg-slate-100 text-slate-500',
};

export function PlatformTicketsModule() {
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailTicket, setDetailTicket] = useState<PlatformTicket | null>(null);
  const [form, setForm] = useState({ title: '', description: '', reportedType: 'BUG' as PlatformTicketReportedType });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getPlatformTickets({ status: statusFilter || undefined });
      setTickets(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ title: '', description: '', reportedType: 'BUG' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      await apiService.createPlatformTicket({ title: form.title.trim(), description: form.description.trim(), reportedType: form.reportedType });
      setShowNewModal(false);
      resetForm();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Talep kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2">
            <MessageSquarePlus size={22} className="text-primary" /> Talep & Geri Bildirim
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Enflow'a ürün talebi, hata bildirimi veya iyileştirme önerisi gönderin — değerlendirme sonucu burada görünür</p>
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
          {(Object.keys(PLATFORM_TICKET_STATUS_LABEL) as PlatformTicketStatus[]).map(s => <option key={s} value={s}>{PLATFORM_TICKET_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-3">Talep</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Öncelik</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Hedef Zaman</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            )}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Henüz talep gönderilmedi.</td></tr>
            )}
            {tickets.map(t => (
              <tr key={t.id} onClick={() => setDetailTicket(t)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{t.title}</div>
                  <div className="text-xs text-slate-400">{t.userName}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{PLATFORM_TICKET_REPORTED_TYPE_LABEL[t.reportedType]}</td>
                <td className="px-4 py-3 text-slate-600">{t.category ? PLATFORM_TICKET_CATEGORY_LABEL[t.category] : 'Değerlendiriliyor'}</td>
                <td className="px-4 py-3">
                  {t.priority ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[t.priority]}`}>{PLATFORM_TICKET_PRIORITY_LABEL[t.priority]}</span>
                  ) : <span className="text-slate-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[t.status]}`}>{PLATFORM_TICKET_STATUS_LABEL[t.status]}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{t.targetTimeline || '—'}</td>
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
              <h4 className="text-lg font-black text-slate-900">Yeni Talep</h4>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3 overflow-y-auto">
              <select value={form.reportedType} onChange={e => setForm(f => ({ ...f, reportedType: e.target.value as PlatformTicketReportedType }))} className="input-glass w-full">
                {(Object.keys(PLATFORM_TICKET_REPORTED_TYPE_LABEL) as PlatformTicketReportedType[]).map(t => <option key={t} value={t}>{PLATFORM_TICKET_REPORTED_TYPE_LABEL[t]}</option>)}
              </select>
              <input type="text" required placeholder="Başlık *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-glass w-full" />
              <textarea required placeholder="Açıklama *" rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-glass w-full resize-none" />
              <p className="text-[10px] text-slate-400">Nihai kategori ve öncelik değerlendirme sonrası belirlenir — yukarıdaki tip yalnız ilk izleniminiz.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary text-sm">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null} Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay Modalı */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-lg font-black text-slate-900">{detailTicket.title}</h4>
              <button onClick={() => setDetailTicket(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[detailTicket.status]}`}>{PLATFORM_TICKET_STATUS_LABEL[detailTicket.status]}</span>
                <span className="text-[10px] font-black uppercase text-slate-400">Bildirilen tip: {PLATFORM_TICKET_REPORTED_TYPE_LABEL[detailTicket.reportedType]}</span>
                {detailTicket.priority && <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGE[detailTicket.priority]}`}>{PLATFORM_TICKET_PRIORITY_LABEL[detailTicket.priority]}</span>}
                {detailTicket.category && <span className="text-[10px] font-black uppercase text-slate-400">{PLATFORM_TICKET_CATEGORY_LABEL[detailTicket.category]}</span>}
                {detailTicket.scope && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{PLATFORM_TICKET_SCOPE_LABEL[detailTicket.scope]}</span>}
              </div>
              <p className="text-sm text-slate-600">{detailTicket.description}</p>
              {detailTicket.targetTimeline && (
                <p className="text-xs text-slate-400">Hedef zaman çizelgesi: <strong className="text-slate-600">{detailTicket.targetTimeline}</strong></p>
              )}
              {detailTicket.resolutionNote && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                  <strong>Değerlendirme notu:</strong> {detailTicket.resolutionNote}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformTicketsModule;
