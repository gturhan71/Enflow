import React, { useState } from 'react';
import { Plus, Check, X, Loader2, Package } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { WorkOrderMaterialRequest, WorkOrderMaterialStatus, WORK_ORDER_MATERIAL_STATUS_LABEL } from '../../types';

const STATUS_BADGE: Record<WorkOrderMaterialStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-sky-100 text-sky-700',
  ORDERED: 'bg-indigo-100 text-indigo-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
};

interface Props {
  workOrderId: string;
  materialRequests: WorkOrderMaterialRequest[];
  isManager: boolean;
  canEdit: boolean; // iş emrini görme/yürütme yetkisi olan (teknisyen sahibi ya da yönetici)
  requesterName?: string;
  onChange: () => void;
}

// Faz 3 — dış kaynak malzeme/hizmet talebi. PurchaseRequest'in 9 statülü tam
// onay zincirinin KASITLI DIŞINDA, hafif/tek-adımlı (yalnız birim yöneticisi
// onayı). Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md Kullanıcı Kararı 4.
export function MaterialRequestsPanel({ workOrderId, materialRequests, isManager, canEdit, requesterName, onChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', vendorName: '', estimatedCost: '', currency: 'TRY', notes: '' });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState('');

  const resetForm = () => setForm({ description: '', vendorName: '', estimatedCost: '', currency: 'TRY', notes: '' });

  const handleCreate = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await apiService.createMaterialRequest(workOrderId, {
        description: form.description.trim(),
        vendorName: form.vendorName || undefined,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        currency: form.currency,
        notes: form.notes || undefined,
        requestedByName: requesterName,
      });
      setShowForm(false);
      resetForm();
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Talep oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (matId: string) => {
    setSaving(true);
    try {
      await apiService.approveMaterialRequest(workOrderId, matId);
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Onaylanamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (matId: string) => {
    setSaving(true);
    try {
      await apiService.rejectMaterialRequest(workOrderId, matId, rejectionNote || undefined);
      setRejectingId(null);
      setRejectionNote('');
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reddedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleOrdered = async (matId: string) => {
    setSaving(true);
    try {
      await apiService.updateMaterialRequest(workOrderId, matId, { status: 'ORDERED' });
      onChange();
    } finally {
      setSaving(false);
    }
  };

  const handleReceived = async (matId: string) => {
    if (!actualCost) return;
    setSaving(true);
    try {
      await apiService.updateMaterialRequest(workOrderId, matId, { status: 'RECEIVED', actualCost: Number(actualCost) });
      setReceivingId(null);
      setActualCost('');
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matId: string) => {
    if (!window.confirm('Bu talebi silmek istediğinize emin misiniz?')) return;
    setSaving(true);
    try {
      await apiService.deleteMaterialRequest(workOrderId, matId);
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Package size={12} /> Malzeme/Hizmet Talepleri</p>
        {canEdit && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus size={12} /> Talep Ekle</button>
        )}
      </div>

      {materialRequests.length === 0 && !showForm && <p className="text-[11px] text-slate-400">Henüz talep yok.</p>}

      <div className="space-y-2">
        {materialRequests.map(m => (
          <div key={m.id} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{m.description}</p>
                <p className="text-[10px] text-slate-400">
                  {m.vendorName || m.vendor?.name || 'Tedarikçi belirtilmedi'}
                  {m.estimatedCost != null && <> · Tahmini: {m.estimatedCost.toLocaleString('tr-TR')} {m.currency}</>}
                  {m.actualCost != null && <> · Gerçekleşen: {m.actualCost.toLocaleString('tr-TR')} {m.currency}</>}
                </p>
                {m.status === 'REJECTED' && m.rejectionNote && <p className="text-[10px] text-red-600 mt-0.5">Red: {m.rejectionNote}</p>}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_BADGE[m.status]}`}>{WORK_ORDER_MATERIAL_STATUS_LABEL[m.status]}</span>
            </div>

            {isManager && m.status === 'REQUESTED' && (
              rejectingId === m.id ? (
                <div className="flex gap-1.5">
                  <input value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} placeholder="Red nedeni (opsiyonel)" className="input-glass flex-1 text-[11px] py-1" />
                  <button onClick={() => handleReject(m.id)} disabled={saving} className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-50">Reddet</button>
                  <button onClick={() => setRejectingId(null)} className="px-2 py-1 text-slate-400 text-[10px]">Vazgeç</button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => handleApprove(m.id)} disabled={saving} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-50">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Onayla
                  </button>
                  <button onClick={() => setRejectingId(m.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg">
                    <X size={11} /> Reddet
                  </button>
                </div>
              )
            )}
            {isManager && m.status === 'APPROVED' && (
              <button onClick={() => handleOrdered(m.id)} disabled={saving} className="w-full px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-50">Sipariş Edildi Olarak İşaretle</button>
            )}
            {isManager && m.status === 'ORDERED' && (
              receivingId === m.id ? (
                <div className="flex gap-1.5">
                  <input type="number" min="0" step="0.01" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="Gerçekleşen tutar *" className="input-glass flex-1 text-[11px] py-1" />
                  <button onClick={() => handleReceived(m.id)} disabled={saving || !actualCost} className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-50">Kaydet</button>
                </div>
              ) : (
                <button onClick={() => setReceivingId(m.id)} className="w-full px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg">Teslim Alındı Olarak İşaretle</button>
              )
            )}
            {(isManager || m.status === 'REQUESTED') && canEdit && (
              <button onClick={() => handleDelete(m.id)} className="text-[10px] text-slate-400 hover:text-red-600 underline">Sil</button>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ne gerekiyor? *" className="input-glass w-full text-xs" />
          <input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} placeholder="Tedarikçi (opsiyonel)" className="input-glass w-full text-xs" />
          <div className="flex gap-1.5">
            <input type="number" min="0" step="0.01" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="Tahmini tutar" className="input-glass flex-1 text-xs" />
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-glass w-20 text-xs">
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="flex gap-1.5 justify-end pt-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-1.5 text-[11px] font-bold text-slate-500">İptal</button>
            <button onClick={handleCreate} disabled={saving || !form.description.trim()} className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg disabled:opacity-50">
              {saving ? <Loader2 size={11} className="animate-spin inline" /> : 'Talep Gönder'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialRequestsPanel;
