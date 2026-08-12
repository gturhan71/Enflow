import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Gavel, Plus, Calendar, ClipboardCheck, ShieldCheck, Trash2,
  CheckCircle2, Clock, AlertTriangle, Upload, FileText, X, ExternalLink,
  Sparkles, Building2, Loader2, FileSearch,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useAIGate } from '../contexts/AIGateContext';
import { fmtCurrency as fmt } from '../lib/format';
import { sampleGuaranteeText } from '../lib/guaranteeText';
import type { Tender, TenderChecklistItem, GuaranteeLetter, Opportunity } from '../types';

interface SalesSupportProps {
  opportunities?: Opportunity[];
}

type TabKey = 'list' | 'calendar' | 'checklist' | 'guarantees' | 'submitted';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'list', label: 'İhale Listesi', icon: Gavel },
  { key: 'calendar', label: 'İhale Takvimi', icon: Calendar },
  { key: 'checklist', label: 'Uygunluk Denetimi', icon: ClipboardCheck },
  { key: 'guarantees', label: 'Teminat', icon: ShieldCheck },
  { key: 'submitted', label: 'Girilen İhaleler', icon: FileText },
];

const SUBMITTED_STATUSES = ['SUBMITTED', 'EVALUATING', 'WON', 'LOST'];

// Son teklif tarihine kalan süreye göre eşik rozeti (3g/2g/12s/6s)
function deadlineBadge(deadline?: string | null): { label: string; tone: string } | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { label: 'Süre doldu', tone: 'bg-red-100 text-red-700' };
  const h = ms / 3_600_000;
  if (h <= 6) return { label: '6 saat kaldı', tone: 'bg-red-100 text-red-700' };
  if (h <= 12) return { label: '12 saat kaldı', tone: 'bg-orange-100 text-orange-700' };
  if (h <= 48) return { label: '2 gün kaldı', tone: 'bg-amber-100 text-amber-700' };
  if (h <= 72) return { label: '3 gün kaldı', tone: 'bg-yellow-100 text-yellow-700' };
  return null;
}

const METHOD_LABELS: Record<string, string> = {
  OPEN: 'Açık İhale', RESTRICTED: 'Belli İstekliler', NEGOTIATED: 'Pazarlık', DIRECT: 'Doğrudan Temin',
  PRIVATE: 'Özel/Ticari Teklif',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', PREPARING: 'Hazırlık', SUBMITTED: 'Teklif Verildi', EVALUATING: 'Değerlendirme',
  WON: 'Kazanıldı', LOST: 'Kaybedildi', CANCELLED: 'İptal', WITHDRAWN: 'İştirak Edilmedi',
};
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PREPARING: 'bg-blue-100 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  EVALUATING: 'bg-amber-100 text-amber-700 border-amber-200',
  WON: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOST: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
  WITHDRAWN: 'bg-slate-100 text-slate-500 border-slate-300',
};
// Aktif sekmelerden çıkarılan terminal/arşiv durumları
const ARCHIVED_STATUSES = ['SUBMITTED', 'EVALUATING', 'WON', 'LOST', 'WITHDRAWN'];

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
const daysUntil = (d?: string | null) => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};

const SalesSupport: React.FC<SalesSupportProps> = ({ opportunities = [] }) => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('list');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getTenders();
      const list = (data as Tender[]) || [];
      setTenders(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } finally { setLoading(false); }
  }, [selectedId]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => tenders.find(t => t.id === selectedId) || null, [tenders, selectedId]);
  const isGM = currentUser?.role === 'GENERAL_MANAGER';
  const [withdrawTarget, setWithdrawTarget] = useState<Tender | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const confirmWithdraw = async () => {
    if (!withdrawTarget || !withdrawReason.trim()) return;
    setWithdrawing(true);
    try {
      await apiService.withdrawTender(withdrawTarget.id, { reason: withdrawReason.trim() });
      setWithdrawTarget(null); setWithdrawReason('');
      await load();
    } catch (e) { alert('İşlem hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setWithdrawing(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Gavel className="text-primary" /> Satış Destek & İhale (İYB)
          </h2>
          <p className="text-slate-500 italic">İhale dosyaları, takvim, idari uygunluk denetimi ve geçici teminat takibi</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Yeni İhale
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}

      {tab === 'list' && <TenderList tenders={tenders.filter(t => !ARCHIVED_STATUSES.includes(t.status))} selectedId={selectedId} onSelect={setSelectedId} onChanged={load} isGM={isGM} onWithdraw={setWithdrawTarget} />}
      {tab === 'calendar' && <TenderCalendar tenders={tenders.filter(t => !ARCHIVED_STATUSES.includes(t.status))} />}
      {tab === 'checklist' && <ChecklistTab tender={selected && !ARCHIVED_STATUSES.includes(selected.status) ? selected : null} tenders={tenders.filter(t => !ARCHIVED_STATUSES.includes(t.status))} onSelectTender={setSelectedId} onChanged={load} isGM={isGM} onWithdraw={setWithdrawTarget} />}
      {tab === 'guarantees' && <GuaranteesTab tender={selected} tenders={tenders} onSelectTender={setSelectedId} userName={currentUser?.name} />}
      {tab === 'submitted' && <SubmittedTenders tenders={tenders.filter(t => ARCHIVED_STATUSES.includes(t.status))} />}

      <AnimatePresence>
        {withdrawTarget && (
          <Modal title="Yönetim Kararı — İhaleye İştirak Etme" onClose={() => setWithdrawTarget(null)}>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <strong>{withdrawTarget.name}</strong> ihalesine iştirak edilmeyecek olarak işaretlenecek. Akış kesilir; bu karar <strong>kayıp sayılmaz</strong> ve Satış/Satış Destek/Presales birimlerinin KPI'sını olumsuz etkilemez. İlgili birimler bilgilendirilir.
              </div>
              <textarea value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} rows={3} placeholder="Çekilme gerekçesi (zorunlu)..."
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setWithdrawTarget(null)} className="btn-secondary text-xs">Vazgeç</button>
                <button onClick={confirmWithdraw} disabled={!withdrawReason.trim() || withdrawing}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {withdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} İştirak Etme — Akışı Kes
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <TenderForm
            opportunities={opportunities}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── İhale Listesi ────────────────────────────────────────────────────────────────
function TenderList({ tenders, selectedId, onSelect, onChanged, isGM, onWithdraw }: {
  tenders: Tender[]; selectedId: string | null; onSelect: (id: string) => void; onChanged: () => void;
  isGM?: boolean; onWithdraw?: (t: Tender) => void;
}) {
  if (tenders.length === 0)
    return <div className="glass-card p-16 text-center text-slate-400 italic">Henüz ihale yok. "Yeni İhale" ile başlayın.</div>;
  return (
    <div className="space-y-3">
      {tenders.map(t => {
        const dleft = daysUntil(t.submissionDeadline);
        return (
          <div key={t.id} onClick={() => onSelect(t.id)}
            className={`glass-card p-5 cursor-pointer transition-all ${selectedId === t.id ? 'ring-2 ring-primary/40' : 'hover:shadow-lg'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-slate-900 truncate">{t.name}</h4>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${STATUS_STYLES[t.status] || ''}`}>{STATUS_LABELS[t.status] || t.status}</span>
                  {(() => { const b = deadlineBadge(t.submissionDeadline); return b ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.tone}`}>{b.label}</span> : null; })()}
                  {t.docNumber && <span className="text-[10px] font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg">{t.docNumber}</span>}
                </div>
                <p className="text-xs text-slate-500">
                  {t.ikn ? `İKN: ${t.ikn} · ` : ''}{t.authority ? `${t.authority} · ` : ''}{METHOD_LABELS[t.method] || t.method}
                </p>
                <p className="text-sm font-bold text-slate-700">{fmt(t.estimatedValue, t.currency)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Son teklif</p>
                  <p className="text-sm font-bold text-slate-700">{fmtDate(t.submissionDeadline)}</p>
                  {dleft !== null && (
                    <span className={`text-[10px] font-bold ${dleft < 0 ? 'text-red-600' : dleft <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {dleft < 0 ? `${Math.abs(dleft)} gün geçti` : `${dleft} gün kaldı`}
                    </span>
                  )}
                </div>
                {isGM && onWithdraw && (
                  <button onClick={(e) => { e.stopPropagation(); onWithdraw(t); }} title="Yönetim: İhaleye iştirak etme (KPI-nötr)"
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2 py-1 transition-colors">İştirak Etme</button>
                )}
                <button onClick={async (e) => { e.stopPropagation(); if (confirm('İhale silinsin mi?')) { await apiService.deleteTender(t.id); onChanged(); } }}
                  className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── İhale Takvimi ────────────────────────────────────────────────────────────────
function TenderCalendar({ tenders }: { tenders: Tender[] }) {
  const upcoming = [...tenders]
    .filter(t => t.submissionDeadline && !['WON', 'LOST', 'CANCELLED'].includes(t.status))
    .sort((a, b) => new Date(a.submissionDeadline!).getTime() - new Date(b.submissionDeadline!).getTime());
  if (upcoming.length === 0)
    return <div className="glass-card p-16 text-center text-slate-400 italic">Yaklaşan son tarihi olan aktif ihale yok.</div>;
  return (
    <div className="space-y-3">
      {upcoming.map(t => {
        const dleft = daysUntil(t.submissionDeadline)!;
        const tone = dleft < 0 ? 'red' : dleft <= 7 ? 'amber' : 'emerald';
        return (
          <div key={t.id} className="glass-card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {tone === 'red' ? <AlertTriangle size={22} /> : <Clock size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-900 truncate">{t.name}</h4>
              <p className="text-xs text-slate-500">{fmtDate(t.submissionDeadline)} · {STATUS_LABELS[t.status]}</p>
            </div>
            <span className={`text-sm font-black ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>
              {dleft < 0 ? `${Math.abs(dleft)} gün geçti` : `${dleft} gün`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Uygunluk Denetimi (Checklist) ────────────────────────────────────────────────
function ChecklistTab({ tender, tenders, onSelectTender, onChanged, isGM, onWithdraw }: {
  tender: Tender | null; tenders: Tender[]; onSelectTender: (id: string) => void; onChanged?: () => void;
  isGM?: boolean; onWithdraw?: (t: Tender) => void;
}) {
  const { requireAI } = useAIGate();
  const [items, setItems] = useState<TenderChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [specText, setSpecText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [manualName, setManualName] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    if (!tender) { setItems([]); return; }
    setLoading(true);
    try { setItems((await apiService.getTenderChecklist(tender.id)) as TenderChecklistItem[]); }
    finally { setLoading(false); }
  }, [tender]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (item: TenderChecklistItem, status: string) => {
    if (!tender) return;
    await apiService.updateTenderChecklistItem(tender.id, item.id, { status });
    load();
  };

  // Analiz: şartname metniyle AI
  const analyzeText = async () => {
    if (!tender || !specText.trim()) return;
    if (!(await requireAI('İhale şartname analizi'))) return;
    setAnalyzing(true); setInfo('');
    try {
      const r = await apiService.analyzeTender(tender.id, { specText }) as { usedAI: boolean; autoMatched: number };
      setInfo(`${r.usedAI ? 'AI' : 'Standart liste'} ile döküman listesi oluşturuldu · ${r.autoMatched} evrak Şirket Evraklarından otomatik eklendi.`);
      await load();
    } catch (e) { setInfo('Analiz hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setAnalyzing(false); }
  };

  // Analiz: dosya (PDF/TXT) yükle
  const analyzeFile = async (file: File) => {
    if (!tender) return;
    if (!(await requireAI('İhale şartname analizi'))) return;
    setAnalyzing(true); setInfo('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const tid = localStorage.getItem('enflow_active_tenant_id') || '';
      const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
      const res = await fetch(`/api/tenders/${tender.id}/analyze`, {
        method: 'POST', headers: { 'x-tenant-id': tid, 'Authorization': `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(`${data.usedAI ? 'AI' : 'Standart liste'} ile döküman listesi oluşturuldu · ${data.autoMatched} otomatik eklendi.`);
      await load();
    } catch (e) { setInfo('Dosya analizi hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setAnalyzing(false); }
  };

  // Manuel kalem ekle (AI'sız)
  const addManual = async () => {
    if (!tender || !manualName.trim()) return;
    await apiService.addTenderChecklistItem(tender.id, { name: manualName.trim() });
    setManualName(''); load();
  };

  const deleteItem = async (item: TenderChecklistItem) => {
    if (!tender) return;
    await apiService.deleteTenderChecklistItem(tender.id, item.id);
    load();
  };

  const autoMatch = async () => {
    if (!tender) return;
    setAnalyzing(true); setInfo('');
    try {
      const r = await apiService.autoMatchTender(tender.id) as { autoMatched: number };
      setInfo(`${r.autoMatched} evrak Şirket Evrakları envanterinden otomatik eklendi.`);
      await load();
    } finally { setAnalyzing(false); }
  };

  // "Teklif İletildi" — dosyayı Girilen İhaleler'e taşı (eksik dökümanda onay ister)
  const submitBid = async () => {
    if (!tender) return;
    const reqMissing = items.filter(i => i.isRequired && !['DONE', 'WAIVED'].includes(i.status));
    if (reqMissing.length > 0 && !window.confirm(`${reqMissing.length} zorunlu döküman eksik:\n• ${reqMissing.map(m => m.name).join('\n• ')}\n\nYine de teklifi iletildi olarak işaretleyip Girilen İhaleler'e taşımak istiyor musunuz?`)) return;
    if (!window.confirm('Teklif iletildi olarak işaretlenecek ve dosya "Girilen İhaleler" arşivine taşınacak. Onaylıyor musunuz?')) return;
    try {
      await apiService.submitTender(tender.id, { force: reqMissing.length > 0 });
      onChanged?.();
    } catch (e) { alert('İşlem hatası: ' + (e instanceof Error ? e.message : '')); }
  };

  const upload = async (item: TenderChecklistItem, file: File) => {
    if (!tender) return;
    setUploadingId(item.id);
    try {
      const fd = new FormData(); fd.append('file', file);
      const tid = localStorage.getItem('enflow_active_tenant_id') || '';
      const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
      const res = await fetch(`/api/tenders/${tender.id}/checklist/${item.id}/upload`, {
        method: 'POST', headers: { 'x-tenant-id': tid, 'Authorization': `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) { alert('Yükleme hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setUploadingId(null); }
  };

  if (!tender)
    return <TenderSelectorEmpty tenders={tenders} onSelectTender={onSelectTender} text="Uygunluk denetimi için bir ihale seçin." />;

  const required = items.filter(i => i.isRequired);
  const done = required.filter(i => ['DONE', 'WAIVED'].includes(i.status));
  const pct = required.length ? Math.round((done.length / required.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-1 gap-3">
          <h4 className="font-black text-slate-900 truncate">{tender.name}</h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(() => { const b = deadlineBadge(tender.submissionDeadline); return b ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${b.tone}`}>{b.label}</span> : null; })()}
            <span className="text-sm font-bold text-primary">{done.length}/{required.length} zorunlu ({pct}%)</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">Son teklif: {fmtDate(tender.submissionDeadline)} · Dosyalama: {tender.ikn || '—'} / {tender.name}</p>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={submitBid} className="btn-primary text-xs w-full justify-center">
          <CheckCircle2 className="w-4 h-4" /> Teklif İletildi — Girilen İhaleler'e Taşı
        </button>
        {isGM && onWithdraw && (
          <button onClick={() => onWithdraw(tender)} className="mt-2 text-xs font-bold w-full justify-center flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
            <X className="w-3.5 h-3.5" /> Yönetim: İhaleye İştirak Etme (akışı kes, KPI-nötr)
          </button>
        )}
      </div>

      {/* İhale Dosyası Analizi — 3 mod: AI-metin / AI-dosya / manuel */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-primary" />
          <h5 className="font-black text-slate-900 text-sm">İhale Dosyası Analizi — Verilecek Dökümanlar</h5>
        </div>
        <p className="text-[11px] text-slate-500">İdari/teknik şartname + atıf yapılan hususları yapıştırın ya da dosya yükleyin; sistem verilecek döküman listesini çıkarır ve geçerli evrakları Şirket Evraklarından otomatik ekler.</p>
        <textarea value={specText} onChange={e => setSpecText(e.target.value)} rows={3} placeholder="Şartname metnini buraya yapıştırın..."
          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20" />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={analyzeText} disabled={analyzing || !specText.trim()} className="btn-primary text-xs disabled:opacity-50">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI ile Analiz Et
          </button>
          <label className="btn-secondary text-xs cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> PDF / TXT Yükle
            <input type="file" accept=".pdf,.txt" className="hidden" disabled={analyzing}
              onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f); e.target.value = ''; }} />
          </label>
          <button onClick={autoMatch} disabled={analyzing} className="btn-secondary text-xs disabled:opacity-50">
            <Building2 className="w-3.5 h-3.5" /> Şirket Evrakları ile Eşle
          </button>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <input value={manualName} onChange={e => setManualName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManual(); }}
            placeholder="Manuel evrak ekle (AI'sız)..." className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none" />
          <button onClick={addManual} disabled={!manualName.trim()} className="btn-secondary text-xs disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Ekle</button>
        </div>
        {info && <p className="text-[11px] font-semibold text-emerald-600">{info}</p>}
      </div>

      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="glass-card p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {item.status === 'DONE' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                : item.status === 'WAIVED' ? <CheckCircle2 className="w-5 h-5 text-slate-300 flex-shrink-0" />
                : <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate flex items-center gap-1.5 flex-wrap">{item.name}
                  {item.isRequired && <span className="text-[10px] font-bold text-red-500">ZORUNLU</span>}
                  {item.isAiGenerated && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full"><Sparkles className="w-2.5 h-2.5" />AI</span>}
                  {item.source === 'CORPORATE_DOC' && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full"><Building2 className="w-2.5 h-2.5" />Şirket Evrakı</span>}
                </p>
                {item.source === 'CORPORATE_DOC' && item.notes && <p className="text-[10px] text-emerald-600">{item.notes}</p>}
                {item.fileUrl && (
                  <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Yüklenen dosya <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {uploadingId === item.id ? '...' : item.fileUrl ? 'Değiştir' : 'Yükle'}
                <input type="file" className="hidden" disabled={uploadingId === item.id}
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(item, f); e.target.value = ''; }} />
              </label>
              {item.status !== 'DONE'
                ? <button onClick={() => setStatus(item, 'DONE')} className="text-xs text-emerald-600 hover:underline">Tamam</button>
                : <button onClick={() => setStatus(item, 'PENDING')} className="text-xs text-slate-400 hover:underline">Geri Al</button>}
              {item.status !== 'WAIVED' && <button onClick={() => setStatus(item, 'WAIVED')} className="text-xs text-slate-400 hover:underline">Muaf</button>}
              <button onClick={() => deleteItem(item)} title="Sil" className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Teminat (Finans'a talep — geçici/kesin, süresiz, örnek metin) ─────────────────
const GUARANTEE_STATUS_TR: Record<string, string> = { REQUESTED: 'Talep Edildi', ACTIVE: 'Aktif', RELEASED: 'İade', EXPIRED: 'Süresi Doldu', CALLED: 'Nakde Çevrildi' };

function GuaranteesTab({ tender, tenders, onSelectTender, userName }: {
  tender: Tender | null; tenders: Tender[]; onSelectTender: (id: string) => void; userName?: string;
}) {
  const [guarantees, setGuarantees] = useState<GuaranteeLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ type: 'BID_BOND', amount: '', currency: 'TRY', expiryDate: '', indefinite: false, requestNote: '', sampleText: '' });

  const load = useCallback(async () => {
    if (!tender) { setGuarantees([]); return; }
    setLoading(true);
    try { setGuarantees((await apiService.getGuarantees({ tenderId: tender.id })) as GuaranteeLetter[]); }
    finally { setLoading(false); }
  }, [tender]);
  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    setF(prev => ({ ...prev, sampleText: sampleGuaranteeText(tender?.name || '', tender?.ikn, prev.type, prev.amount, prev.currency, prev.expiryDate, prev.indefinite) }));
    setShowForm(true);
  };
  const regenSample = (next: typeof f) => setF({ ...next, sampleText: sampleGuaranteeText(tender?.name || '', tender?.ikn, next.type, next.amount, next.currency, next.expiryDate, next.indefinite) });

  const save = async () => {
    if (!tender) return;
    await apiService.createGuarantee({
      type: f.type, tenderId: tender.id, amount: parseFloat(f.amount) || 0, currency: f.currency,
      expiryDate: f.indefinite ? null : (f.expiryDate || null), isIndefinite: f.indefinite,
      status: 'REQUESTED', sampleText: f.sampleText || null,
      requestNote: f.requestNote || (userName ? `Talep eden: ${userName}` : null),
    });
    setShowForm(false); setF({ type: 'BID_BOND', amount: '', currency: 'TRY', expiryDate: '', indefinite: false, requestNote: '', sampleText: '' }); load();
  };

  if (!tender)
    return <TenderSelectorEmpty tenders={tenders} onSelectTender={onSelectTender} text="Teminat talebi için bir ihale seçin." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500"><b className="text-slate-700">{tender.name}</b> — teminat mektupları (Finans'a talep + düzenleme)</p>
        <button onClick={openForm} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Finans'a Teminat Talebi</button>
      </div>
      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}
      {guarantees.length === 0
        ? <div className="glass-card p-12 text-center text-slate-400 italic">Bu ihaleye bağlı teminat talebi yok.</div>
        : guarantees.map(g => {
            const dleft = g.isIndefinite ? null : daysUntil(g.expiryDate);
            return (
              <div key={g.id} className="glass-card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{METHOD_LABELS[g.type] || (g.type === 'BID_BOND' ? 'Geçici Teminat' : g.type === 'PERFORMANCE' ? 'Kesin Teminat' : g.type)} · {fmt(g.amount, g.currency)}
                    {g.isIndefinite && <span className="ml-2 text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">SÜRESİZ</span>}</p>
                  <p className="text-xs text-slate-500">{g.bankName ? `${g.bankName} · ` : ''}{g.isIndefinite ? 'Süresiz' : `Geçerlilik: ${fmtDate(g.expiryDate)}`}
                    {dleft !== null && <span className={`ml-1 font-bold ${dleft < 0 ? 'text-red-600' : dleft <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>({dleft < 0 ? 'süresi doldu' : `${dleft} gün`})</span>}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${g.status === 'REQUESTED' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>{GUARANTEE_STATUS_TR[g.status] || g.status}</span>
              </div>
            );
          })}

      <AnimatePresence>
        {showForm && (
          <Modal title="Finans'a Teminat Mektubu Talebi" onClose={() => setShowForm(false)}>
            <div className="space-y-2">
              <select className="input-glass w-full text-sm" value={f.type} onChange={e => regenSample({ ...f, type: e.target.value })}>
                <option value="BID_BOND">Geçici Teminat</option><option value="PERFORMANCE">Kesin Teminat</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-glass text-sm" type="number" placeholder="Tutar" value={f.amount} onChange={e => regenSample({ ...f, amount: e.target.value })} />
                <select className="input-glass text-sm" value={f.currency} onChange={e => regenSample({ ...f, currency: e.target.value })}>
                  <option>TRY</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={f.indefinite} onChange={e => regenSample({ ...f, indefinite: e.target.checked })} /> Süresiz teminat
              </label>
              {!f.indefinite && <>
                <label className="text-xs text-slate-500">Vade (geçerlilik sonu)</label>
                <input className="input-glass w-full text-sm" type="date" value={f.expiryDate} onChange={e => regenSample({ ...f, expiryDate: e.target.value })} />
              </>}
              <label className="text-xs text-slate-500">Örnek teminat metni (şartnameden — Finans düzenler)</label>
              <textarea className="input-glass w-full text-xs" rows={5} value={f.sampleText} onChange={e => setF({ ...f, sampleText: e.target.value })} />
              <input className="input-glass w-full text-sm" placeholder="Talep notu (opsiyonel)" value={f.requestNote} onChange={e => setF({ ...f, requestNote: e.target.value })} />
              <button onClick={save} disabled={!f.amount || (!f.indefinite && !f.expiryDate)} className="btn-primary w-full text-sm disabled:opacity-50">Finans'a Talep Gönder</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────────
// ── Girilen İhaleler (arşiv: teklif iletilmiş/sonuçlanmış dosyalar) ───────────────
function SubmittedTenders({ tenders }: { tenders: Tender[] }) {
  if (tenders.length === 0)
    return <div className="glass-card p-16 text-center text-slate-400 italic">Henüz teklif iletilen ihale yok. Uygunluk Denetimi'nde "Teklif İletildi" ile dosyayı buraya taşıyın.</div>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 px-1">Sonuçlanan/teslim dosyalar İKN + işin adı ile arşivlenir. İş <strong>kazanılırsa</strong> teklif detay raporu + açık BoM + maliyet analizi Satınalma ve Proje Yönetimi'ne devredilir. <strong>İştirak Edilmedi</strong> kayıtları yönetimsel karardır — kayıp sayılmaz, KPI'yı etkilemez.</p>
      {tenders.map(t => (
        <div key={t.id} className="glass-card p-5 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-slate-900 truncate">{t.name}</h4>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${STATUS_STYLES[t.status] || ''}`}>{STATUS_LABELS[t.status] || t.status}</span>
            </div>
            <p className="text-xs text-slate-500">{t.ikn ? `İKN: ${t.ikn} · ` : ''}{METHOD_LABELS[t.method] || t.method} · {fmt(t.estimatedValue, t.currency)}</p>
            {t.status === 'WITHDRAWN'
              ? <p className="text-[11px] text-slate-500">İştirak edilmedi: {fmtDate(t.withdrawnAt)} · Gerekçe: {t.withdrawReason || '—'}</p>
              : <p className="text-[11px] text-slate-400">Teklif iletildi: {fmtDate(t.submittedAt)} · Dosyalama: {t.ikn || '—'} / {t.name}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TenderSelectorEmpty({ tenders, onSelectTender, text }: { tenders: Tender[]; onSelectTender: (id: string) => void; text: string }) {
  return (
    <div className="glass-card p-12 text-center space-y-4">
      <p className="text-slate-400 italic">{text}</p>
      {tenders.length > 0 && (
        <select className="input-glass text-sm mx-auto" onChange={e => e.target.value && onSelectTender(e.target.value)} defaultValue="">
          <option value="" disabled>İhale seç...</option>
          {tenders.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="glass-card p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function TenderForm({ opportunities, onClose, onSaved }: {
  opportunities: Opportunity[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({ name: '', ikn: '', authority: '', method: 'OPEN', estimatedValue: '', submissionDeadline: '', opportunityId: '', categoryCode: 'IHL' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.name) throw new Error('İhale adı zorunlu.');
      await apiService.createTender({
        name: f.name, ikn: f.ikn || null, authority: f.authority || null, method: f.method,
        estimatedValue: parseFloat(f.estimatedValue) || 0,
        submissionDeadline: f.submissionDeadline || null,
        opportunityId: f.opportunityId || null,
        categoryCode: f.categoryCode || 'IHL',
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <Modal title="Yeni İhale" onClose={onClose}>
      <input className="input-glass w-full text-sm" placeholder="İhale adı" value={f.name} onChange={e => set('name', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className="input-glass w-full text-sm" placeholder="İKN (örn. 2026/123456)" value={f.ikn} onChange={e => set('ikn', e.target.value)} />
        <input className="input-glass w-full text-sm" placeholder="İdare adı" value={f.authority} onChange={e => set('authority', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select className="input-glass w-full text-sm" value={f.method} onChange={e => set('method', e.target.value)}>
          {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input-glass w-full text-sm" type="number" placeholder="Yaklaşık maliyet" value={f.estimatedValue} onChange={e => set('estimatedValue', e.target.value)} />
      </div>
      <label className="text-xs text-slate-500">Son teklif tarihi</label>
      <input className="input-glass w-full text-sm" type="date" value={f.submissionDeadline} onChange={e => set('submissionDeadline', e.target.value)} />
      {opportunities.length > 0 && (
        <select className="input-glass w-full text-sm" value={f.opportunityId} onChange={e => set('opportunityId', e.target.value)}>
          <option value="">İlgili fırsat (opsiyonel)</option>
          {opportunities.map(o => <option key={o.id} value={o.id}>{o.title || o.id}</option>)}
        </select>
      )}
      {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
      <button onClick={save} disabled={saving} className="btn-primary w-full text-sm disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
    </Modal>
  );
}

export default SalesSupport;
