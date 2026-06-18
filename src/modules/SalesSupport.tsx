import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Gavel, Plus, Calendar, ClipboardCheck, ShieldCheck, Landmark, Trash2,
  CheckCircle2, Clock, AlertTriangle, Upload, FileText, X, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import type { Tender, TenderChecklistItem, GuaranteeLetter, Opportunity } from '../types';

interface SalesSupportProps {
  opportunities?: Opportunity[];
}

type TabKey = 'list' | 'calendar' | 'checklist' | 'guarantees' | 'ekap';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'list', label: 'İhale Listesi', icon: Gavel },
  { key: 'calendar', label: 'İhale Takvimi', icon: Calendar },
  { key: 'checklist', label: 'Uygunluk Denetimi', icon: ClipboardCheck },
  { key: 'guarantees', label: 'Teminat', icon: ShieldCheck },
  { key: 'ekap', label: 'EKAP', icon: Landmark },
];

const METHOD_LABELS: Record<string, string> = {
  OPEN: 'Açık İhale', RESTRICTED: 'Belli İstekliler', NEGOTIATED: 'Pazarlık', DIRECT: 'Doğrudan Temin',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', PREPARING: 'Hazırlık', SUBMITTED: 'Teklif Verildi', EVALUATING: 'Değerlendirme',
  WON: 'Kazanıldı', LOST: 'Kaybedildi', CANCELLED: 'İptal',
};
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PREPARING: 'bg-blue-100 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  EVALUATING: 'bg-amber-100 text-amber-700 border-amber-200',
  WON: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOST: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200',
};

const fmt = (n: number, c = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n || 0);
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
  const [ekapPrefix, setEkapPrefix] = useState('');

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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Gavel className="text-primary" /> Satış Destek & İhale (İSAB)
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

      {tab === 'list' && <TenderList tenders={tenders} selectedId={selectedId} onSelect={setSelectedId} onChanged={load} />}
      {tab === 'calendar' && <TenderCalendar tenders={tenders} />}
      {tab === 'checklist' && <ChecklistTab tender={selected} tenders={tenders} onSelectTender={setSelectedId} />}
      {tab === 'guarantees' && <GuaranteesTab tender={selected} tenders={tenders} onSelectTender={setSelectedId} userName={currentUser?.name} />}
      {tab === 'ekap' && <EkapTab prefix={ekapPrefix} setPrefix={setEkapPrefix} />}

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
function TenderList({ tenders, selectedId, onSelect, onChanged }: {
  tenders: Tender[]; selectedId: string | null; onSelect: (id: string) => void; onChanged: () => void;
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
function ChecklistTab({ tender, tenders, onSelectTender }: {
  tender: Tender | null; tenders: Tender[]; onSelectTender: (id: string) => void;
}) {
  const [items, setItems] = useState<TenderChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-black text-slate-900">{tender.name}</h4>
          <span className="text-sm font-bold text-primary">{done.length}/{required.length} zorunlu ({pct}%)</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
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
                <p className="font-semibold text-slate-900 truncate">{item.name}
                  {item.isRequired && <span className="ml-2 text-[10px] font-bold text-red-500">ZORUNLU</span>}</p>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Teminat (BID_BOND — Finans ile paylaşımlı) ───────────────────────────────────
function GuaranteesTab({ tender, tenders, onSelectTender, userName }: {
  tender: Tender | null; tenders: Tender[]; onSelectTender: (id: string) => void; userName?: string;
}) {
  const [guarantees, setGuarantees] = useState<GuaranteeLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<Record<string, string>>({ bankName: '', amount: '', expiryDate: '', refNo: '' });

  const load = useCallback(async () => {
    if (!tender) { setGuarantees([]); return; }
    setLoading(true);
    try { setGuarantees((await apiService.getGuarantees({ tenderId: tender.id, type: 'BID_BOND' })) as GuaranteeLetter[]); }
    finally { setLoading(false); }
  }, [tender]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!tender) return;
    await apiService.createGuarantee({
      type: 'BID_BOND', tenderId: tender.id, bankName: f.bankName || null,
      amount: parseFloat(f.amount) || 0, expiryDate: f.expiryDate || null, refNo: f.refNo || null,
      notes: userName ? `Oluşturan: ${userName}` : null,
    });
    setShowForm(false); setF({ bankName: '', amount: '', expiryDate: '', refNo: '' }); load();
  };

  if (!tender)
    return <TenderSelectorEmpty tenders={tenders} onSelectTender={onSelectTender} text="Geçici teminat için bir ihale seçin." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500"><b className="text-slate-700">{tender.name}</b> — geçici teminat mektupları (Finans modülüyle paylaşımlı)</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Teminat Ekle</button>
      </div>
      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}
      {guarantees.length === 0
        ? <div className="glass-card p-12 text-center text-slate-400 italic">Bu ihaleye bağlı geçici teminat yok.</div>
        : guarantees.map(g => {
            const dleft = daysUntil(g.expiryDate);
            return (
              <div key={g.id} className="glass-card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{g.bankName || 'Banka belirtilmedi'} · {fmt(g.amount, g.currency)}</p>
                  <p className="text-xs text-slate-500">{g.refNo ? `Ref: ${g.refNo} · ` : ''}Geçerlilik: {fmtDate(g.expiryDate)}
                    {dleft !== null && <span className={`ml-1 font-bold ${dleft < 0 ? 'text-red-600' : dleft <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                      ({dleft < 0 ? 'süresi doldu' : `${dleft} gün`})</span>}</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">{g.status}</span>
              </div>
            );
          })}

      <AnimatePresence>
        {showForm && (
          <Modal title="Geçici Teminat (BID_BOND)" onClose={() => setShowForm(false)}>
            <input className="input-glass w-full text-sm" placeholder="Banka adı" value={f.bankName} onChange={e => setF({ ...f, bankName: e.target.value })} />
            <input className="input-glass w-full text-sm" type="number" placeholder="Tutar" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
            <input className="input-glass w-full text-sm" placeholder="Referans No" value={f.refNo} onChange={e => setF({ ...f, refNo: e.target.value })} />
            <label className="text-xs text-slate-500">Geçerlilik sonu</label>
            <input className="input-glass w-full text-sm" type="date" value={f.expiryDate} onChange={e => setF({ ...f, expiryDate: e.target.value })} />
            <button onClick={save} className="btn-primary w-full text-sm">Kaydet</button>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── EKAP iskeleti ────────────────────────────────────────────────────────────────
function EkapTab({ prefix, setPrefix }: { prefix: string; setPrefix: (v: string) => void }) {
  return (
    <div className="glass-card p-8 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Landmark size={24} /></div>
        <div>
          <h4 className="font-black text-slate-900">EKAP — Kamu İhale Platformu</h4>
          <p className="text-xs text-slate-500">Manuel İKN takibi için yer tutucu. Gerçek EKAP web servisi bağlantısı henüz yok.</p>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Varsayılan İKN Öneki (opsiyonel)</label>
        <input className="input-glass w-full text-sm" placeholder="örn. 2026/" value={prefix} onChange={e => setPrefix(e.target.value)} />
        <p className="text-[11px] text-slate-400 italic">İKN değerleri ihale kayıtlarında manuel tutulur; bu alan ileride otomatik senkronizasyon için zemindir (kalıcılık yok).</p>
      </div>
    </div>
  );
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────────
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
