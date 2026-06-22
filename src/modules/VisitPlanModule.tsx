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
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// Diyagramdaki "süreç öncesi" katman: haftalık müşteri ziyaret planı + günlük
// rapor. ContractWorkflow/ContractWorkflowDoc konvansiyonuna uyarak tipler
// burada lokal tanımlanır (types.ts'e taşınmaz).

type VisitType = 'DEMO' | 'TECHNICAL_MEETING' | 'PRESENTATION' | 'OTHER';
type VisitStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';
type MeetingKind = 'INTRO' | 'PLANNED' | 'FOLLOWUP' | 'OTHER';
type LinkType = 'NEW_CONTACT' | 'VISIT' | 'OPPORTUNITY' | 'PROJECT';

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
  meetingKind?: MeetingKind;
  linkType?: LinkType;
  linkId?: string | null;
  linkLabel?: string | null;
  isKnownToSystem?: boolean;
  sharedWithManager: boolean;
  sharedAt?: string | null;
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

const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  INTRO: 'Tanışma',
  PLANNED: 'Planlı',
  FOLLOWUP: 'Takip',
  OTHER: 'Diğer',
};
const LINK_TYPE_LABEL: Record<LinkType, string> = {
  NEW_CONTACT: 'Yeni İletişim',
  VISIT: 'Planlı Ziyaret',
  OPPORTUNITY: 'Fırsat',
  PROJECT: 'Proje',
};
const MEETING_KINDS: MeetingKind[] = ['INTRO', 'PLANNED', 'FOLLOWUP', 'OTHER'];
const LINK_TYPES: LinkType[] = ['NEW_CONTACT', 'VISIT', 'OPPORTUNITY', 'PROJECT'];

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
  opportunities?: { id: string; title: string }[];
  projects?: { id: string; name: string }[];
}

const VisitPlanModule: React.FC<VisitPlanModuleProps> = ({ customers = [], opportunities = [], projects = [] }) => {
  const { currentUser } = useAuth();
  const canSetInterval = currentUser?.role === 'SALES_MGR' || currentUser?.role === 'GENERAL_MANAGER';
  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewVisitRow, setShowNewVisitRow] = useState<string | null>(null);
  const [newVisit, setNewVisit] = useState<{ customerId: string; type: VisitType; plannedDate: string }>({
    customerId: '', type: 'DEMO', plannedDate: mondayOf(new Date()),
  });
  const [reportContent, setReportContent] = useState('');
  // Günlük rapor iş-bağlantısı formu (2 eksen)
  const [reportForm, setReportForm] = useState<{ meetingKind: MeetingKind; linkType: LinkType; linkId: string; linkLabel: string }>({
    meetingKind: 'INTRO', linkType: 'NEW_CONTACT', linkId: '', linkLabel: '',
  });
  const [shareInterval, setShareInterval] = useState(7);
  const [targetRate, setTargetRate] = useState(80);
  const [sharing, setSharing] = useState(false);
  // Personel skor tablosu (yalnız yönetici) — bu haftanın konsolidasyonu
  const [scoreboard, setScoreboard] = useState<{ userId: string; name: string; isManager: boolean; plannedVisits: number; completedVisits: number; matchedVisits: number; matchRate: number }[]>([]);

  const currentWeek = mondayOf(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [planList, reportList, settings] = await Promise.all([
        apiService.getVisitPlans() as Promise<VisitPlan[]>,
        apiService.getDailyReports({ userId: currentUser?.id || '' }) as Promise<DailyReport[]>,
        apiService.getReportSettings().catch(() => ({ shareIntervalDays: 7, visitTargetRate: 80 })) as Promise<{ shareIntervalDays: number; visitTargetRate: number }>,
      ]);
      setPlans(planList);
      setReports(reportList);
      setShareInterval(settings?.shareIntervalDays ?? 7);
      setTargetRate(settings?.visitTargetRate ?? 80);
      // Yönetici: bu hafta için personel ziyaret-eşleşme skorları
      if (canSetInterval) {
        const wEnd = new Date(currentWeek); wEnd.setDate(wEnd.getDate() + 6);
        apiService.getReportConsolidation('CRM', { start: currentWeek, end: wEnd.toISOString().slice(0, 10) })
          .then((c: { people?: typeof scoreboard }) => setScoreboard(c?.people ?? []))
          .catch(() => setScoreboard([]));
      }
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

  // Seçilen kaynağa göre linkId/linkLabel'ı çöz
  const resolveLink = (): { linkId: string | null; linkLabel: string | null } => {
    const { linkType, linkId, linkLabel } = reportForm;
    if (linkType === 'NEW_CONTACT') return { linkId: null, linkLabel: linkLabel.trim() || null };
    if (linkType === 'VISIT') {
      const v = visits.find(x => x.id === linkId);
      return { linkId, linkLabel: v?.customerName ?? null };
    }
    if (linkType === 'OPPORTUNITY') {
      const o = opportunities.find(x => x.id === linkId);
      return { linkId, linkLabel: o?.title ?? null };
    }
    const p = projects.find(x => x.id === linkId);
    return { linkId, linkLabel: p?.name ?? null };
  };

  const handleAddReport = async () => {
    if (!reportContent.trim()) return alert('Rapor içeriği boş olamaz.');
    const { linkType } = reportForm;
    const { linkId, linkLabel } = resolveLink();
    if (linkType === 'NEW_CONTACT' && !linkLabel) return alert('Yeni iletişim için kişi/firma adı girin.');
    if (linkType !== 'NEW_CONTACT' && !linkId) return alert(`${LINK_TYPE_LABEL[linkType]} seçin.`);
    setLoading(true);
    try {
      const report = await apiService.createDailyReport({
        userId: currentUser?.id,
        userName: currentUser?.name,
        date: new Date().toISOString(),
        content: reportContent.trim(),
        meetingKind: reportForm.meetingKind,
        linkType,
        linkId,
        linkLabel,
      }) as DailyReport;
      setReports(prev => [report, ...prev]);
      setReportContent('');
      setReportForm({ meetingKind: 'INTRO', linkType: 'NEW_CONTACT', linkId: '', linkLabel: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rapor kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  // Dönem-toplu paylaşım: son `shareInterval` günün raporlarını yöneticiyle paylaş
  const handleSharePeriod = async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - shareInterval);
    setSharing(true);
    try {
      const res = await apiService.shareReportPeriod({
        userId: currentUser?.id || '',
        start: start.toISOString(),
        end: end.toISOString(),
      }) as { count: number };
      await refresh();
      alert(res.count > 0 ? `${res.count} rapor yöneticiyle paylaşıldı.` : 'Bu dönemde paylaşılacak yeni rapor yok.');
    } catch {
      alert('Paylaşılamadı.');
    } finally {
      setSharing(false);
    }
  };

  const handleUpdateInterval = async (days: number) => {
    setShareInterval(days);
    try { await apiService.updateReportSettings({ shareIntervalDays: days }); }
    catch { alert('Aralık güncellenemedi (yetki?).'); }
  };

  const handleUpdateTarget = async (rate: number) => {
    setTargetRate(rate);
    try { await apiService.updateReportSettings({ visitTargetRate: rate }); }
    catch { alert('Hedef güncellenemedi (yetki?).'); }
  };

  // ── İş-bağlantısı matrisi (Toplantı Türü × Kaynak adet) — son `shareInterval` gün ──
  const periodStart = new Date(); periodStart.setDate(periodStart.getDate() - shareInterval);
  const periodReports = reports.filter(r => new Date(r.date) >= periodStart);
  const matrix: Record<MeetingKind, Record<LinkType, number>> = {
    INTRO: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
    PLANNED: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
    FOLLOWUP: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
    OTHER: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
  };
  periodReports.forEach(r => { matrix[(r.meetingKind ?? 'OTHER') as MeetingKind][(r.linkType ?? 'NEW_CONTACT') as LinkType]++; });
  const knownCount = periodReports.filter(r => r.isKnownToSystem).length;
  const newCount = periodReports.length - knownCount;

  const visits = currentPlan?.visits || [];

  // Haftalık ziyaret planını + günlük raporları Excel'e (.xlsx) aktar (xlsx/SheetJS).
  const exportWeekToExcel = () => {
    if (!visits.length) { alert('Bu hafta için ziyaret kaydı yok.'); return; }
    const STATUS: Record<string, string> = { PLANNED: 'Planlandı', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal' };
    const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '');

    const wb = XLSX.utils.book_new();

    const visitRows = visits.map((v, i) => ({
      '#': i + 1,
      'Planlanan Tarih': fmt(v.plannedDate),
      'Müşteri': v.customerName ?? '',
      'Tür': VISIT_TYPE_LABEL[v.type] ?? v.type,
      'Durum': STATUS[v.status] ?? v.status,
      'Gerçekleşen Tarih': fmt(v.actualDate),
      'İhtiyaç / Görüşme Notu': v.needsCaptured ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(visitRows);
    ws['!cols'] = [{ wch: 4 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 44 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Ziyaretler');

    // Bu haftaya ait günlük raporlar → ikinci sayfa
    const weekStart = new Date(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekReports = reports.filter((r) => {
      const d = new Date(r.date);
      return d >= weekStart && d < weekEnd;
    });
    if (weekReports.length) {
      const reportRows = weekReports.map((r) => ({
        'Tarih': fmt(r.date),
        'Kişi': r.userName ?? '',
        'Toplantı Türü': MEETING_KIND_LABEL[(r.meetingKind ?? 'OTHER') as MeetingKind],
        'Kaynak': LINK_TYPE_LABEL[(r.linkType ?? 'NEW_CONTACT') as LinkType],
        'Sistemde mi': r.isKnownToSystem ? 'Evet' : 'Yeni',
        'Bağlı İş': r.linkLabel ?? '',
        'Günlük Rapor': r.content,
        'Paylaşıldı': r.sharedWithManager ? 'Evet' : 'Hayır',
        'Paylaşım Tarihi': fmt(r.sharedAt),
      }));
      const rws = XLSX.utils.json_to_sheet(reportRows);
      rws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 50 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, rws, 'Günlük Raporlar');

      // Özet Matris: Toplantı Türü × Kaynak adet (bu haftanın raporları)
      const wm: Record<MeetingKind, Record<LinkType, number>> = {
        INTRO: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
        PLANNED: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
        FOLLOWUP: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
        OTHER: { NEW_CONTACT: 0, VISIT: 0, OPPORTUNITY: 0, PROJECT: 0 },
      };
      weekReports.forEach(r => { wm[(r.meetingKind ?? 'OTHER') as MeetingKind][(r.linkType ?? 'NEW_CONTACT') as LinkType]++; });
      const matrixRows = MEETING_KINDS.map(mk => ({
        'Toplantı Türü': MEETING_KIND_LABEL[mk],
        ...Object.fromEntries(LINK_TYPES.map(lt => [LINK_TYPE_LABEL[lt], wm[mk][lt]])),
        'Toplam': LINK_TYPES.reduce((s, lt) => s + wm[mk][lt], 0),
      }));
      const mws = XLSX.utils.json_to_sheet(matrixRows);
      mws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, mws, 'Özet Matris');
    }

    XLSX.writeFile(wb, `ziyaret-plani-${currentWeek}.xlsx`);
  };

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
          <div className="flex items-center gap-2">
            <button
              onClick={exportWeekToExcel}
              disabled={!visits.length}
              title="Bu haftanın ziyaret planını ve günlük raporları Excel'e aktar"
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Excel'e Aktar
            </button>
            <button
              onClick={() => setShowNewVisitRow(currentPlan?.id || 'new')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus size={14} /> Ziyaret Ekle
            </button>
          </div>
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

      {/* ── Personel Hedefleri & Skor (yalnız yönetici) ─────────────────── */}
      {canSetInterval && (
        <div className="glass-panel rounded-[32px] p-8 bg-white border border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500" size={20} />
              <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Personel Hedefleri & Skor</h4>
              <span className="text-[10px] text-slate-400 font-bold normal-case tracking-normal">— planlanan ↔ yapılan+raporlanan ziyaret eşleşmesi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Birim hedefi:</span>
              <input
                type="number" min={1} max={100} value={targetRate}
                onChange={e => handleUpdateTarget(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                title="Birim geneli ziyaret-eşleşme hedefi (%)"
                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none"
              />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">%</span>
            </div>
          </div>
          {scoreboard.filter(p => p.plannedVisits > 0).length === 0 ? (
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-6">Bu hafta planlanan ziyaret yok.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="font-black uppercase tracking-widest py-2">Personel</th>
                  <th className="font-black uppercase tracking-widest text-center">Planlanan</th>
                  <th className="font-black uppercase tracking-widest text-center">Tamamlanan</th>
                  <th className="font-black uppercase tracking-widest text-center">Eşleşen</th>
                  <th className="font-black uppercase tracking-widest text-center">Skor</th>
                </tr>
              </thead>
              <tbody>
                {scoreboard.filter(p => p.plannedVisits > 0).map(p => {
                  const met = p.matchRate >= targetRate;
                  return (
                    <tr key={p.userId} className="border-t border-slate-100">
                      <td className="font-bold text-slate-700 py-2">{p.name}{p.isManager ? ' (yönetici)' : ''}</td>
                      <td className="text-center text-slate-600 font-bold">{p.plannedVisits}</td>
                      <td className="text-center text-slate-600 font-bold">{p.completedVisits}</td>
                      <td className="text-center text-slate-600 font-bold">{p.matchedVisits}</td>
                      <td className="text-center">
                        <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black', met ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                          %{p.matchRate}{met ? ' ✓' : ` / %${targetRate}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Günlük Rapor ───────────────────────────────────────────────── */}
      <div className="glass-panel rounded-[32px] p-8 bg-white border border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <FileText className="text-indigo-500" size={20} />
            <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">Günlük Rapor</h4>
          </div>
          {/* Paylaşım kadansı */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Paylaşım aralığı:</span>
            {canSetInterval ? (
              <input
                type="number" min={1} max={365} value={shareInterval}
                onChange={e => handleUpdateInterval(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                title="Satış Müdürü: paylaşım aralığı (gün)"
                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none"
              />
            ) : (
              <span className="text-xs font-black text-slate-700">{shareInterval}</span>
            )}
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">gün</span>
            <button
              onClick={handleSharePeriod}
              disabled={sharing}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <Share2 size={12} /> {sharing ? 'Paylaşılıyor…' : `Dönemi Yöneticiyle Paylaş`}
            </button>
          </div>
        </div>

        {/* Form: 2-eksenli iş bağlantısı */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select
            value={reportForm.meetingKind}
            onChange={e => setReportForm(f => ({ ...f, meetingKind: e.target.value as MeetingKind }))}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
          >
            {MEETING_KINDS.map(k => <option key={k} value={k}>Toplantı: {MEETING_KIND_LABEL[k]}</option>)}
          </select>
          <select
            value={reportForm.linkType}
            onChange={e => setReportForm(f => ({ ...f, linkType: e.target.value as LinkType, linkId: '', linkLabel: '' }))}
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
          >
            {LINK_TYPES.map(t => <option key={t} value={t}>Kaynak: {LINK_TYPE_LABEL[t]}</option>)}
          </select>
          {/* Kaynağa göre varlık seçici / yeni iletişim etiketi */}
          {reportForm.linkType === 'NEW_CONTACT' ? (
            <input
              placeholder="Yeni kişi / firma adı…"
              value={reportForm.linkLabel}
              onChange={e => setReportForm(f => ({ ...f, linkLabel: e.target.value }))}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none md:col-span-2"
            />
          ) : (
            <select
              value={reportForm.linkId}
              onChange={e => setReportForm(f => ({ ...f, linkId: e.target.value }))}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none md:col-span-2"
            >
              <option value="">{LINK_TYPE_LABEL[reportForm.linkType]} seçin…</option>
              {reportForm.linkType === 'VISIT' && visits.map(v => <option key={v.id} value={v.id}>{v.customerName} — {VISIT_TYPE_LABEL[v.type]}</option>)}
              {reportForm.linkType === 'OPPORTUNITY' && opportunities.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              {reportForm.linkType === 'PROJECT' && projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
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

        {/* İş bağlantısı özet matrisi (son N gün) */}
        {periodReports.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Son {shareInterval} gün — İş Bağlantısı Matrisi</span>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Sistemde {knownCount}</span>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Yeni İletişim {newCount}</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left font-black uppercase tracking-widest py-1.5 pr-3">Toplantı \ Kaynak</th>
                  {LINK_TYPES.map(lt => <th key={lt} className="text-center font-black uppercase tracking-widest px-2">{LINK_TYPE_LABEL[lt]}</th>)}
                </tr>
              </thead>
              <tbody>
                {MEETING_KINDS.map(mk => (
                  <tr key={mk} className="border-t border-slate-100">
                    <td className="font-bold text-slate-700 py-1.5 pr-3">{MEETING_KIND_LABEL[mk]}</td>
                    {LINK_TYPES.map(lt => (
                      <td key={lt} className={cn('text-center font-black', matrix[mk][lt] ? 'text-slate-900' : 'text-slate-300')}>{matrix[mk][lt]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-6">Henüz günlük rapor yok.</p>
          ) : (
            reports.slice(0, 14).map(report => (
              <div key={report.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{report.date.slice(0, 10)}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase tracking-wider">{MEETING_KIND_LABEL[(report.meetingKind ?? 'OTHER') as MeetingKind]}</span>
                    {report.isKnownToSystem ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 uppercase tracking-wider">✓ {LINK_TYPE_LABEL[(report.linkType ?? 'NEW_CONTACT') as LinkType]}{report.linkLabel ? `: ${report.linkLabel}` : ''}</span>
                    ) : (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 uppercase tracking-wider">✦ Yeni İletişim{report.linkLabel ? `: ${report.linkLabel}` : ''}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{report.content}</p>
                </div>
                {report.sharedWithManager && (
                  <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full">
                    <Share2 size={12} /> Paylaşıldı
                  </span>
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
