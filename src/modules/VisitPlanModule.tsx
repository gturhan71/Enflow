import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Calendar,
  CheckCircle2,
  Loader2,
  Users as UsersIcon,
  FileText,
  Trash2,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// Diyagramdaki "süreç öncesi" katman: haftalık müşteri ziyaret planı + günlük
// rapor. ContractWorkflow/ContractWorkflowDoc konvansiyonuna uyarak tipler
// burada lokal tanımlanır (types.ts'e taşınmaz).

type VisitType = 'DEMO' | 'TECHNICAL_MEETING' | 'PRESENTATION' | 'OTHER';
type VisitStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';

interface Visit {
  id: string;
  visitPlanId: string;
  customerId?: string | null;
  customerName?: string | null;
  type: VisitType;
  plannedDate: string;
  actualDate?: string | null;
  status: VisitStatus;
  needsCaptured?: string | null;
}

interface VisitPlan {
  id: string;
  weekOf: string;
  preparedById: string;
  preparedByName?: string | null;
  status: string;
  notes?: string | null;
  visits: Visit[];
}

interface DailyReport {
  id: string;
  userId: string;
  userName?: string | null;
  date: string;
  content: string;
  sharedWithManager: boolean;
}

const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  DEMO: 'Demo',
  TECHNICAL_MEETING: 'Teknik Toplantı',
  PRESENTATION: 'Sunum',
  OTHER: 'Diğer',
};

const VISIT_TYPE_COLOR: Record<VisitType, string> = {
  DEMO: 'bg-violet-100 text-violet-700',
  TECHNICAL_MEETING: 'bg-blue-100 text-blue-700',
  PRESENTATION: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

// O haftanın Pazartesi tarihini ISO (YYYY-MM-DD) olarak döner.
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface VisitPlanModuleProps {
  customers?: { id: string; name: string }[];
}

const VisitPlanModule: React.FC<VisitPlanModuleProps> = ({ customers = [] }) => {
  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewVisitRow, setShowNewVisitRow] = useState<string | null>(null);
  const [newVisit, setNewVisit] = useState<{ customerId: string; type: VisitType; plannedDate: string }>({
    customerId: '', type: 'DEMO', plannedDate: mondayOf(new Date()),
  });
  const [reportContent, setReportContent] = useState('');

  const currentWeek = mondayOf(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [planList, reportList] = await Promise.all([
        apiService.getVisitPlans() as Promise<VisitPlan[]>,
        apiService.getDailyReports({ userId: currentUser?.id || '' }) as Promise<DailyReport[]>,
      ]);
      setPlans(planList);
      setReports(reportList);
    } catch {
      // sessizce geç
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const currentPlan = plans.find(p => p.weekOf.slice(0, 10) === currentWeek);

  const ensureCurrentPlan = async (): Promise<VisitPlan> => {
    if (currentPlan) return currentPlan;
    const created = await apiService.createVisitPlan({
      weekOf: currentWeek,
      preparedById: currentUser?.id,
      preparedByName: currentUser?.name,
    }) as VisitPlan;
    setPlans(prev => [created, ...prev]);
    return created;
  };

  const handleAddVisit = async () => {
    if (!newVisit.plannedDate) return alert('Ziyaret tarihi zorunludur.');
    setLoading(true);
    try {
      const plan = await ensureCurrentPlan();
      const customer = customers.find(c => c.id === newVisit.customerId);
      const visit = await apiService.addVisit(plan.id, {
        customerId: newVisit.customerId || null,
        customerName: customer?.name || null,
        type: newVisit.type,
        plannedDate: newVisit.plannedDate,
      }) as Visit;
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, visits: [...p.visits, visit] } : p));
      setShowNewVisitRow(null);
      setNewVisit({ customerId: '', type: 'DEMO', plannedDate: currentWeek });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ziyaret eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteVisit = async (planId: string, visit: Visit) => {
    try {
      const updated = await apiService.updateVisit(visit.id, {
        status: 'COMPLETED',
        actualDate: new Date().toISOString(),
      }) as Visit;
      setPlans(prev => prev.map(p => p.id === planId
        ? { ...p, visits: p.visits.map(v => v.id === visit.id ? updated : v) }
        : p));
    } catch {
      alert('Ziyaret güncellenemedi.');
    }
  };

  const handleNeedsChange = async (planId: string, visit: Visit, needsCaptured: string) => {
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, visits: p.visits.map(v => v.id === visit.id ? { ...v, needsCaptured } : v) }
      : p));
  };

  const handleNeedsBlur = async (visit: Visit, needsCaptured: string) => {
    try {
      await apiService.updateVisit(visit.id, { needsCaptured });
    } catch { /* sessizce geç */ }
  };

  const handleDeleteVisit = async (planId: string, visitId: string) => {
    if (!window.confirm('Bu ziyareti silmek istediğinize emin misiniz?')) return;
    try {
      await apiService.deleteVisit(visitId);
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, visits: p.visits.filter(v => v.id !== visitId) } : p));
    } catch {
      alert('Ziyaret silinemedi.');
    }
  };

  const handleAddReport = async () => {
    if (!reportContent.trim()) return alert('Rapor içeriği boş olamaz.');
    setLoading(true);
    try {
      const report = await apiService.createDailyReport({
        userId: currentUser?.id,
        userName: currentUser?.name,
        date: new Date().toISOString(),
        content: reportContent.trim(),
      }) as DailyReport;
      setReports(prev => [report, ...prev]);
      setReportContent('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rapor kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareReport = async (report: DailyReport) => {
    try {
      const updated = await apiService.updateDailyReport(report.id, { sharedWithManager: true }) as DailyReport;
      setReports(prev => prev.map(r => r.id === report.id ? updated : r));
    } catch {
      alert('Paylaşılamadı.');
    }
  };

  const visits = currentPlan?.visits || [];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-geist">
      <div>
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Ziyaret Planı & Günlük Rapor</h3>
        <p className="text-slate-500 font-medium">Haftalık müşteri ziyaret planı ve günlük saha raporu — bağlı bulunan yöneticiyle haftalık paylaşılır.</p>
      </div>

      {/* ── Bu haftanın ziyaret planı ──────────────────────────────────── */}
      <div className="glass-panel rounded-[32px] p-8 bg-white border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-indigo-500" size={20} />
            <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Bu Hafta — {currentWeek}</h4>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
              {visits.length} ziyaret
            </span>
          </div>
          <button
            onClick={() => setShowNewVisitRow(currentPlan?.id || 'new')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus size={14} /> Ziyaret Ekle
          </button>
        </div>

        {showNewVisitRow && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <select
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
              value={newVisit.customerId}
              onChange={e => setNewVisit({ ...newVisit, customerId: e.target.value })}
            >
              <option value="">Müşteri seçin...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
              value={newVisit.type}
              onChange={e => setNewVisit({ ...newVisit, type: e.target.value as VisitType })}
            >
              {Object.entries(VISIT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              type="date"
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
              value={newVisit.plannedDate}
              onChange={e => setNewVisit({ ...newVisit, plannedDate: e.target.value })}
            />
            <div className="flex gap-2">
              <button onClick={handleAddVisit} disabled={loading} className="flex-1 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Kaydet'}
              </button>
              <button onClick={() => setShowNewVisitRow(null)} className="px-4 text-xs font-black text-slate-500 uppercase tracking-widest">İptal</button>
            </div>
          </div>
        )}

        {visits.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
            <UsersIcon size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Bu hafta için planlanmış ziyaret yok.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map(visit => (
              <motion.div layout key={visit.id} className={cn(
                "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center gap-4",
                visit.status === 'COMPLETED' ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest", VISIT_TYPE_COLOR[visit.type])}>
                    {VISIT_TYPE_LABEL[visit.type]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{visit.customerName || 'Müşteri belirtilmedi'}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Planlanan: {visit.plannedDate.slice(0, 10)}
                      {visit.actualDate && ` · Gerçekleşen: ${visit.actualDate.slice(0, 10)}`}
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Müşteri ihtiyaçları / görüşme notu..."
                  value={visit.needsCaptured || ''}
                  onChange={e => handleNeedsChange(currentPlan!.id, visit, e.target.value)}
                  onBlur={e => handleNeedsBlur(visit, e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none min-w-[180px]"
                />
                <div className="flex items-center gap-2 shrink-0">
                  {visit.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleCompleteVisit(currentPlan!.id, visit)}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                    >
                      <CheckCircle2 size={12} /> Tamamlandı
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteVisit(currentPlan!.id, visit.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Günlük Rapor ───────────────────────────────────────────────── */}
      <div className="glass-panel rounded-[32px] p-8 bg-white border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="text-indigo-500" size={20} />
          <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Günlük Rapor</h4>
        </div>
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <textarea
            rows={2}
            placeholder="Bugünkü saha çalışmaları, görüşmeler, sonuçlar..."
            value={reportContent}
            onChange={e => setReportContent(e.target.value)}
            className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none resize-none"
          />
          <button
            onClick={handleAddReport}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Raporu Kaydet'}
          </button>
        </div>

        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-6">Henüz günlük rapor yok.</p>
          ) : (
            reports.slice(0, 14).map(report => (
              <div key={report.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{report.date.slice(0, 10)}</p>
                  <p className="text-sm text-slate-700 font-medium">{report.content}</p>
                </div>
                {report.sharedWithManager ? (
                  <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full">
                    <Share2 size={12} /> Paylaşıldı
                  </span>
                ) : (
                  <button
                    onClick={() => handleShareReport(report)}
                    className="shrink-0 flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-all"
                  >
                    <Share2 size={12} /> Yöneticiyle Paylaş
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitPlanModule;
