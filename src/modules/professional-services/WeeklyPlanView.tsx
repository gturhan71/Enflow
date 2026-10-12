import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, X, Save } from 'lucide-react';
import { apiService } from '../../services/apiService';
import {
  WorkOrder, WorkOrderStatus, WORK_ORDER_TYPE_LABEL, WORK_ORDER_STATUS_LABEL,
  ServiceWorkPlan, ServiceWorkPlanStatus, SERVICE_WORK_PLAN_STATUS_LABEL, WorkOrderTechnician,
} from '../../types';

// O haftanın Pazartesi tarihini ISO (YYYY-MM-DD) olarak döner — VisitPlanModule.tsx
// mondayOf() ile birebir aynı (haftalık plan deseni, bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md).
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const OPEN_STATUSES: WorkOrderStatus[] = ['DRAFT', 'PENDING_SCHEDULE', 'SCHEDULED', 'WAITING_PART'];

interface Props {
  technicians: WorkOrderTechnician[];
  preparedByName?: string;
}

export function WeeklyPlanView({ technicians, preparedByName }: Props) {
  const [selectedWeek, setSelectedWeek] = useState(mondayOf(new Date()));
  const [plan, setPlan] = useState<ServiceWorkPlan | null>(null);
  const [unplanned, setUnplanned] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingId, setAddingId] = useState('');
  const [rowForm, setRowForm] = useState<Record<string, { assignedTechnicianId: string; scheduledDate: string; slaHours: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const plans = await apiService.getServiceWorkPlans({ weekOf: selectedWeek }) as ServiceWorkPlan[];
      setPlan(plans[0] || null);
      const all = await apiService.getWorkOrders() as WorkOrder[];
      setUnplanned(all.filter(o => !o.servicePlanId && OPEN_STATUSES.includes(o.status)));
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const next: Record<string, { assignedTechnicianId: string; scheduledDate: string; slaHours: string }> = {};
    for (const wo of plan?.workOrders || []) {
      next[wo.id] = {
        assignedTechnicianId: wo.assignedTechnician?.id || '',
        scheduledDate: wo.scheduledDate ? wo.scheduledDate.slice(0, 10) : selectedWeek,
        slaHours: '',
      };
    }
    setRowForm(next);
  }, [plan, selectedWeek]);

  const shiftWeek = (deltaWeeks: number) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setSelectedWeek(mondayOf(d));
  };

  const ensurePlan = async (): Promise<ServiceWorkPlan> => {
    if (plan) return plan;
    const created = await apiService.createServiceWorkPlan({ weekOf: selectedWeek, preparedByName }) as ServiceWorkPlan;
    setPlan(created);
    return created;
  };

  const handleAddToPlan = async () => {
    if (!addingId) return;
    setSaving(true);
    try {
      const target = await ensurePlan();
      await apiService.updateWorkOrder(addingId, { servicePlanId: target.id });
      setAddingId('');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Plana eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromPlan = async (workOrderId: string) => {
    setSaving(true);
    try {
      await apiService.updateWorkOrder(workOrderId, { servicePlanId: null });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleRowSchedule = async (workOrderId: string) => {
    const f = rowForm[workOrderId];
    if (!f?.assignedTechnicianId || !f?.scheduledDate) return;
    setSaving(true);
    try {
      await apiService.scheduleWorkOrder(workOrderId, f.assignedTechnicianId, f.scheduledDate, f.slaHours ? { slaHours: Number(f.slaHours) } : undefined);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sevkiyat başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanStatus = async (status: ServiceWorkPlanStatus) => {
    const target = await ensurePlan();
    setSaving(true);
    try {
      const updated = await apiService.updateServiceWorkPlan(target.id, { status }) as ServiceWorkPlan;
      setPlan(updated);
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = new Date(selectedWeek).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={16} /></button>
          <div className="text-sm font-black text-slate-800">{weekLabel} haftası</div>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronRight size={16} /></button>
          <button onClick={() => setSelectedWeek(mondayOf(new Date()))} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 ml-1">Bu Hafta</button>
        </div>
        {plan && (
          <select value={plan.status} onChange={e => handlePlanStatus(e.target.value as ServiceWorkPlanStatus)} className="input-glass text-xs">
            {(Object.keys(SERVICE_WORK_PLAN_STATUS_LABEL) as ServiceWorkPlanStatus[]).map(s => <option key={s} value={s}>{SERVICE_WORK_PLAN_STATUS_LABEL[s]}</option>)}
          </select>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <select value={addingId} onChange={e => setAddingId(e.target.value)} className="input-glass flex-1 text-sm">
            <option value="">Plana eklenecek iş emri seçin…</option>
            {unplanned.map(o => <option key={o.id} value={o.id}>{o.title} — {WORK_ORDER_TYPE_LABEL[o.type]}{o.customerName ? ` (${o.customerName})` : ''}</option>)}
          </select>
          <button onClick={handleAddToPlan} disabled={!addingId || saving} className="btn-primary px-4 text-sm rounded-xl disabled:opacity-50 flex items-center gap-1.5 shrink-0">
            <Plus size={14} /> Ekle
          </button>
        </div>
        {unplanned.length === 0 && <p className="text-[11px] text-slate-400">Plana eklenebilecek bekleyen iş emri yok.</p>}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : !plan || plan.workOrders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Bu hafta için planlanmış iş emri yok.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {plan.workOrders.map(wo => (
              <div key={wo.id} className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-bold text-slate-800">{wo.title}</p>
                  <p className="text-[11px] text-slate-400">{WORK_ORDER_TYPE_LABEL[wo.type]} · {WORK_ORDER_STATUS_LABEL[wo.status]}{wo.customerName ? ` · ${wo.customerName}` : ''}</p>
                </div>
                <select value={rowForm[wo.id]?.assignedTechnicianId || ''} onChange={e => setRowForm(f => ({ ...f, [wo.id]: { ...f[wo.id], assignedTechnicianId: e.target.value } }))} className="input-glass text-xs w-40">
                  <option value="">Teknisyen</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name} ({t.openCount} açık iş){t.costRate != null ? ` — ${t.costRate}${t.costCurrency || ''}/${t.costRateUnit === 'DAILY' ? 'gün' : 'saat'}` : ''}</option>)}
                </select>
                <input type="date" value={rowForm[wo.id]?.scheduledDate || ''} onChange={e => setRowForm(f => ({ ...f, [wo.id]: { ...f[wo.id], scheduledDate: e.target.value } }))} className="input-glass text-xs w-36" />
                <input type="number" min="1" placeholder="SLA (saat)" value={rowForm[wo.id]?.slaHours || ''} onChange={e => setRowForm(f => ({ ...f, [wo.id]: { ...f[wo.id], slaHours: e.target.value } }))} className="input-glass text-xs w-24" />
                <button onClick={() => handleRowSchedule(wo.id)} disabled={saving} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50" title="Sevk Et">
                  <Save size={14} />
                </button>
                <button onClick={() => handleRemoveFromPlan(wo.id)} disabled={saving} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Plandan Çıkar">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WeeklyPlanView;
