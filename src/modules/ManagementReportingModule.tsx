import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, LayoutGrid, TrendingUp, Building2, FileText, Inbox, Info } from 'lucide-react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import type {
  ReportOverview, UnitMetrics, UnitDefinition, UnitReport,
} from '../types';
import { prevRange } from './reporting/helpers';
import AnalyticsTab from './reporting/AnalyticsTab';
import OverviewTab from './reporting/OverviewTab';
import UnitDetailTab from './reporting/UnitDetailTab';
import MyReportsTab from './reporting/MyReportsTab';
import IncomingReportsTab from './reporting/IncomingReportsTab';
import ReportForm from './reporting/ReportForm';

type ReportTab = 'overview' | 'analytics' | 'unit' | 'my-reports' | 'incoming';

// Her sekmenin ne gösterdiği + neye göre düzenlendiği — sekme çubuğunun altında
// aktif sekme için her zaman görünür açıklama olarak gösterilir.
const TAB_META: Record<ReportTab, string> = {
  overview: 'Her birimin dönemsel öne çıkan metrikleri + KPI grafikleri (bar/çizgi/pasta) + onay zincirinde en uzun bekleyen aşamalar (darboğazlar); birimler sabit/kanonik sırayla, darboğazlar bekleme süresine göre azalan sıralı listelenir.',
  analytics: 'Şirket geneli büyüme/sağlık göstergeleri (iş sağlığı skoru, kârlılık, kazanma oranı, doküman portföyü vb.) — her kart kendi ⓘ açıklamasını taşır, veriler dönemden bağımsız güncel durumu yansıtır.',
  unit: 'Seçtiğiniz tek bir birimin dönem metrikleri + grafiği, önceki dönemle karşılaştırmalı (▲/▼); üstteki birim seçiciyle değiştirilir.',
  'my-reports': 'Kendi biriminiz için hazırladığınız dönemsel raporlar, en yeni en üstte; durum etiketiyle (taslak/sunuldu/incelendi) sıralı.',
  incoming: 'Size (yöneticinize) sunulmuş, henüz incelenmemiş birim raporları; en eski sunulan en üstte — SLA gecikmesini önlemek için.',
};

export default function ManagementReportingModule({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentUser } = useAuth();
  const isGM = currentUser.role === 'GENERAL_MANAGER';
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [tab, setTab] = useState<ReportTab>('overview');
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(monthEnd);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('CRM');
  const [unitData, setUnitData] = useState<UnitMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [myReports, setMyReports] = useState<UnitReport[]>([]);
  const [incoming, setIncoming] = useState<UnitReport[]>([]);
  const [formReport, setFormReport] = useState<UnitReport | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getReportOverview({ start, end });
      setOverview(data);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const loadUnit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getUnitMetrics(selectedUnit, { start, end });
      setUnitData(data);
      // Dönem karşılaştırma: önceki dönem metriklerini de çek (delta için)
      const pr = prevRange(start, end);
      const prevData = await apiService.getUnitMetrics(selectedUnit, { start: pr.start, end: pr.end }).catch(() => null);
      const map: Record<string, number> = {};
      if (prevData) for (const m of prevData.metrics) if (typeof m.value === 'number') map[m.label] = m.value;
      setPrevMetrics(map);
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, start, end]);

  const loadMyReports = useCallback(async () => {
    const data = await apiService.getUnitReports();
    setMyReports(Array.isArray(data) ? data : []);
  }, []);

  const loadIncoming = useCallback(async () => {
    // GM tümünü görür; diğer yöneticiler yalnız kendilerine yönlenen (escalate) raporları
    const data = isGM
      ? await apiService.getUnitReports({ status: 'SUBMITTED' })
      : await apiService.getUnitReports({ pendingForReviewer: currentUser.id });
    setIncoming(Array.isArray(data) ? data : []);
  }, [isGM, currentUser.id]);

  useEffect(() => {
    apiService.getReportUnits().then((u: UnitDefinition[]) => setUnits(u)).catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    else if (tab === 'unit') loadUnit();
    else if (tab === 'my-reports') loadMyReports();
    else if (tab === 'incoming') loadIncoming();
  }, [tab, loadOverview, loadUnit, loadMyReports, loadIncoming]);

  const refresh = () => {
    if (tab === 'overview') loadOverview();
    else if (tab === 'unit') loadUnit();
    else if (tab === 'my-reports') loadMyReports();
    else loadIncoming();
  };

  const submitReport = async (id: string) => { await apiService.submitUnitReport(id); loadMyReports(); };
  const deleteReport = async (id: string) => { await apiService.deleteUnitReport(id); loadMyReports(); };

  return (
    <div className={embedded ? 'space-y-6' : 'p-6 space-y-6'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {embedded ? <div /> : (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="text-primary" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Yönetim Raporları</h1>
              <p className="text-xs text-slate-400 font-bold">Birim performansı ve iş akışı izleme</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="input-glass text-xs px-3 py-2 rounded-xl" />
          <span className="text-slate-400 text-xs">—</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="input-glass text-xs px-3 py-2 rounded-xl" />
          <button onClick={refresh} className="btn-secondary px-3 py-2 rounded-xl flex items-center gap-1 text-xs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tab === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
          <LayoutGrid size={15} /> Genel Bakış
        </button>
        <button onClick={() => setTab('analytics')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tab === 'analytics' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
          <TrendingUp size={15} /> Büyüme Analitiği
        </button>
        <button onClick={() => setTab('unit')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tab === 'unit' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
          <Building2 size={15} /> Birim Detayı
        </button>
        <button onClick={() => setTab('my-reports')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tab === 'my-reports' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
          <FileText size={15} /> Raporlarım
        </button>
        {isGM && (
          <button onClick={() => setTab('incoming')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tab === 'incoming' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            <Inbox size={15} /> Gelen Raporlar
            {incoming.length > 0 && <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 rounded-full">{incoming.length}</span>}
          </button>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-slate-400 leading-relaxed -mt-2">
        <Info size={12} className="shrink-0 mt-0.5 text-slate-300" />
        {TAB_META[tab]}
      </p>

      {/* Büyüme Analitiği */}
      {tab === 'analytics' && <AnalyticsTab />}

      {/* Genel Bakış */}
      {tab === 'overview' && overview && <OverviewTab overview={overview} start={start} end={end} />}

      {/* Birim Detayı */}
      {tab === 'unit' && (
        <UnitDetailTab
          units={units}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          unitData={unitData}
          prevMetrics={prevMetrics}
          start={start}
          end={end}
        />
      )}

      {/* Raporlarım */}
      {tab === 'my-reports' && (
        <MyReportsTab
          myReports={myReports}
          onNewReport={() => { setFormReport(null); setShowForm(true); }}
          onEdit={(r) => { setFormReport(r); setShowForm(true); }}
          onSubmit={submitReport}
          onDelete={deleteReport}
        />
      )}

      {/* Gelen Raporlar (GM) */}
      {tab === 'incoming' && isGM && <IncomingReportsTab incoming={incoming} onReviewed={loadIncoming} />}

      {showForm && (
        <ReportForm
          report={formReport}
          units={units}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadMyReports(); }}
        />
      )}
    </div>
  );
}
