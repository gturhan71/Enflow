import React, { useState, useEffect, useCallback } from 'react';
import {
  Lightbulb, ShieldAlert, BarChart3, BookMarked, Plus, Trash2,
  X, TrendingUp, TrendingDown, AlertTriangle, Target, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// ── Tipler (lokal — ContractWorkflowDoc/VisitPlan konvansiyonu) ──────────────
interface Lesson {
  id: string; title: string; category: string; situation: string;
  rootCause?: string | null; action?: string | null; impact: string; status: string;
  projectId?: string | null; createdByName?: string | null; docNumber?: string | null; createdAt: string;
}
interface Risk {
  id: string; type: string; title: string; description?: string | null; category: string;
  probability: number; impact: number; score: number; response?: string | null;
  owner?: string | null; status: string; docNumber?: string | null;
}
interface Metric {
  id: string; name: string; period: string; targetValue?: number | null;
  actualValue?: number | null; unit?: string | null; category: string; note?: string | null;
}
interface ExternalDoc {
  id: string; name: string; source?: string | null; externalRef?: string | null;
  version?: string | null; status: string; notes?: string | null; docNumber?: string | null;
}

type TabKey = 'lessons' | 'risks' | 'metrics' | 'external';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'lessons', label: 'Alınan Dersler', icon: <Lightbulb size={16} /> },
  { key: 'risks', label: 'Risk & Fırsat', icon: <ShieldAlert size={16} /> },
  { key: 'metrics', label: 'Kurumsal KPI', icon: <BarChart3 size={16} /> },
  { key: 'external', label: 'Dış Doküman Sicili', icon: <BookMarked size={16} /> },
];

const IMPACT_BADGE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-700', MEDIUM: 'bg-amber-100 text-amber-700', HIGH: 'bg-red-100 text-red-700',
};

// Risk skoru rengi (1-25 matris)
const scoreColor = (s: number) =>
  s >= 15 ? 'bg-red-500 text-white' : s >= 8 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';

const CorporateGovernanceModule = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('lessons');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [externals, setExternals] = useState<ExternalDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, r, m, e] = await Promise.all([
        apiService.getLessons(), apiService.getRisks(),
        apiService.getMetrics(), apiService.getExternalDocs(),
      ]);
      setLessons(l as Lesson[]); setRisks(r as Risk[]);
      setMetrics(m as Metric[]); setExternals(e as ExternalDoc[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Genel Hususlar</h2>
          <p className="text-slate-500 italic">Kurumsal hafıza, risk yönetimi ve KY raporlama katmanı</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Kayıt
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              tab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400 italic px-2">Yükleniyor...</p>}

      {/* İçerik */}
      {tab === 'lessons' && <LessonsTab items={lessons} onDelete={async (id) => { await apiService.deleteLesson(id); load(); }} />}
      {tab === 'risks' && <RisksTab items={risks} onDelete={async (id) => { await apiService.deleteRisk(id); load(); }} />}
      {tab === 'metrics' && <MetricsTab items={metrics} onDelete={async (id) => { await apiService.deleteMetric(id); load(); }} />}
      {tab === 'external' && <ExternalTab items={externals} onDelete={async (id) => { await apiService.deleteExternalDoc(id); load(); }} />}

      <AnimatePresence>
        {showForm && (
          <RecordForm tab={tab} userName={currentUser?.name} onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Sekme İçerikleri ─────────────────────────────────────────────────────────

const EmptyState = ({ text }: { text: string }) => (
  <div className="glass-card p-16 text-center">
    <p className="text-slate-400 italic">{text}</p>
  </div>
);

const DocBadge = ({ n }: { n?: string | null }) => n ? (
  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
    <Hash size={10} /> {n}
  </span>
) : null;

const LessonsTab = ({ items, onDelete }: { items: Lesson[]; onDelete: (id: string) => void }) => {
  if (items.length === 0) return <EmptyState text="Henüz alınan ders kaydı yok. Proje/süreç deneyimlerini kurumsal hafızaya ekleyin." />;
  return (
    <div className="grid gap-4">
      {items.map(l => (
        <div key={l.id} className="glass-card p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-slate-900">{l.title}</h4>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${IMPACT_BADGE[l.impact] || 'bg-slate-100 text-slate-600'}`}>{l.impact}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">{l.category}</span>
                <DocBadge n={l.docNumber} />
              </div>
              <p className="text-sm text-slate-600">{l.situation}</p>
              {l.rootCause && <p className="text-xs text-slate-500"><span className="font-bold">Kök neden:</span> {l.rootCause}</p>}
              {l.action && <p className="text-xs text-slate-500"><span className="font-bold">Aksiyon:</span> {l.action}</p>}
            </div>
            <button onClick={() => onDelete(l.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
};

const RisksTab = ({ items, onDelete }: { items: Risk[]; onDelete: (id: string) => void }) => {
  if (items.length === 0) return <EmptyState text="Henüz risk/fırsat kaydı yok. Olasılık × etki matrisiyle değerlendirin." />;
  return (
    <div className="grid gap-4">
      {items.map(r => (
        <div key={r.id} className="glass-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${scoreColor(r.score)}`}>
                <span className="text-lg leading-none">{r.score}</span>
                <span className="text-[8px] uppercase opacity-80">skor</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.type === 'OPPORTUNITY'
                    ? <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600"><TrendingUp size={12} /> Fırsat</span>
                    : <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600"><AlertTriangle size={12} /> Risk</span>}
                  <h4 className="font-black text-slate-900">{r.title}</h4>
                  <DocBadge n={r.docNumber} />
                </div>
                {r.description && <p className="text-sm text-slate-600">{r.description}</p>}
                <p className="text-xs text-slate-500">Olasılık: <b>{r.probability}</b> · Etki: <b>{r.impact}</b>{r.owner ? ` · Sorumlu: ${r.owner}` : ''} · {r.status}</p>
                {r.response && <p className="text-xs text-slate-500"><span className="font-bold">Aksiyon:</span> {r.response}</p>}
              </div>
            </div>
            <button onClick={() => onDelete(r.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
};

const MetricsTab = ({ items, onDelete }: { items: Metric[]; onDelete: (id: string) => void }) => {
  if (items.length === 0) return <EmptyState text="Henüz KPI kaydı yok. Dönem bazlı hedef/gerçekleşen değerleri girin." />;
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(m => {
        const pct = m.targetValue && m.actualValue != null ? Math.round((m.actualValue / m.targetValue) * 100) : null;
        const onTrack = pct != null && pct >= 100;
        return (
          <div key={m.id} className="glass-card p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.period}</p>
                <h4 className="font-black text-slate-900">{m.name}</h4>
              </div>
              <button onClick={() => onDelete(m.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900">{m.actualValue ?? '—'}</span>
              <span className="text-sm text-slate-400 mb-1">/ {m.targetValue ?? '—'} {m.unit || ''}</span>
            </div>
            {pct != null && (
              <div className="flex items-center gap-2">
                {onTrack ? <Target size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-amber-500" />}
                <span className={`text-xs font-black ${onTrack ? 'text-emerald-600' : 'text-amber-600'}`}>%{pct} hedef</span>
              </div>
            )}
            {m.note && <p className="text-xs text-slate-500 italic">{m.note}</p>}
          </div>
        );
      })}
    </div>
  );
};

const ExternalTab = ({ items, onDelete }: { items: ExternalDoc[]; onDelete: (id: string) => void }) => {
  if (items.length === 0) return <EmptyState text="Henüz dış doküman kaydı yok. Standart/şartname/yönetmelik gibi kurum dışı referansları girin." />;
  return (
    <div className="grid gap-3">
      {items.map(d => (
        <div key={d.id} className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-slate-900">{d.name}</h4>
              {d.version && <span className="text-[10px] font-bold text-slate-400">v{d.version}</span>}
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.status}</span>
              <DocBadge n={d.docNumber} />
            </div>
            <p className="text-xs text-slate-500">{d.source || '—'}{d.externalRef ? ` · Ref: ${d.externalRef}` : ''}</p>
            {d.notes && <p className="text-xs text-slate-400 italic">{d.notes}</p>}
          </div>
          <button onClick={() => onDelete(d.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
};

// ── Kayıt Formu (sekmeye göre değişir) ───────────────────────────────────────

const RecordForm = ({ tab, userName, onClose, onSaved }: {
  tab: TabKey; userName?: string; onClose: () => void; onSaved: () => void;
}) => {
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (tab === 'lessons') {
        if (!f.title || !f.situation) throw new Error('Başlık ve durum zorunlu.');
        await apiService.createLesson({ ...f, createdByName: userName });
      } else if (tab === 'risks') {
        if (!f.title) throw new Error('Başlık zorunlu.');
        await apiService.createRisk({ ...f, probability: Number(f.probability) || 3, impact: Number(f.impact) || 3 });
      } else if (tab === 'metrics') {
        if (!f.name || !f.period) throw new Error('KPI adı ve dönem zorunlu.');
        await apiService.createMetric(f);
      } else {
        if (!f.name) throw new Error('Doküman adı zorunlu.');
        await apiService.createExternalDoc(f);
      }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  const title = TABS.find(t => t.key === tab)?.label;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-[2rem] p-8 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">Yeni: {title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>

        {tab === 'lessons' && (<>
          <Input label="Başlık" v={f.title} on={(v) => set('title', v)} />
          <Select label="Etki" v={f.impact || 'MEDIUM'} on={(v) => set('impact', v)} opts={['LOW', 'MEDIUM', 'HIGH']} />
          <Select label="Kategori" v={f.category || 'OTHER'} on={(v) => set('category', v)} opts={['TECHNICAL', 'COMMERCIAL', 'PROCESS', 'CUSTOMER', 'SUPPLIER', 'OTHER']} />
          <Textarea label="Durum" v={f.situation} on={(v) => set('situation', v)} />
          <Textarea label="Kök Neden" v={f.rootCause} on={(v) => set('rootCause', v)} />
          <Textarea label="Aksiyon" v={f.action} on={(v) => set('action', v)} />
        </>)}

        {tab === 'risks' && (<>
          <Select label="Tip" v={f.type || 'RISK'} on={(v) => set('type', v)} opts={['RISK', 'OPPORTUNITY']} />
          <Input label="Başlık" v={f.title} on={(v) => set('title', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Olasılık (1-5)" v={f.probability || '3'} on={(v) => set('probability', v)} opts={['1', '2', '3', '4', '5']} />
            <Select label="Etki (1-5)" v={f.impact || '3'} on={(v) => set('impact', v)} opts={['1', '2', '3', '4', '5']} />
          </div>
          <Input label="Sorumlu" v={f.owner} on={(v) => set('owner', v)} />
          <Textarea label="Açıklama" v={f.description} on={(v) => set('description', v)} />
          <Textarea label="Aksiyon / Yanıt" v={f.response} on={(v) => set('response', v)} />
        </>)}

        {tab === 'metrics' && (<>
          <Input label="KPI Adı" v={f.name} on={(v) => set('name', v)} />
          <Input label="Dönem (örn. 2026-Q2)" v={f.period} on={(v) => set('period', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hedef" v={f.targetValue} on={(v) => set('targetValue', v)} type="number" />
            <Input label="Gerçekleşen" v={f.actualValue} on={(v) => set('actualValue', v)} type="number" />
          </div>
          <Input label="Birim (%, adet, ₺...)" v={f.unit} on={(v) => set('unit', v)} />
          <Textarea label="Not" v={f.note} on={(v) => set('note', v)} />
        </>)}

        {tab === 'external' && (<>
          <Input label="Doküman Adı" v={f.name} on={(v) => set('name', v)} />
          <Input label="Kaynak (kurum/yayıncı)" v={f.source} on={(v) => set('source', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dış Referans No" v={f.externalRef} on={(v) => set('externalRef', v)} />
            <Input label="Versiyon" v={f.version} on={(v) => set('version', v)} />
          </div>
          <Textarea label="Not" v={f.notes} on={(v) => set('notes', v)} />
        </>)}

        {/* Opsiyonel doküman kodu üretimi */}
        <Input label="Doküman Kategori Kodu (opsiyonel — özgün kod üretir)" v={f.categoryCode} on={(v) => set('categoryCode', v.toUpperCase())} placeholder="örn. SOZ" />

        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ── Küçük form yardımcıları ──────────────────────────────────────────────────
const Input = ({ label, v, on, type = 'text', placeholder }: { label: string; v?: string; on: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input type={type} value={v || ''} placeholder={placeholder} onChange={(e) => on(e.target.value)}
      className="input-glass w-full mt-1" />
  </div>
);
const Textarea = ({ label, v, on }: { label: string; v?: string; on: (v: string) => void }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <textarea value={v || ''} onChange={(e) => on(e.target.value)} rows={2} className="input-glass w-full mt-1 resize-none" />
  </div>
);
const Select = ({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: string[] }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <select value={v} onChange={(e) => on(e.target.value)} className="input-glass w-full mt-1">
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default CorporateGovernanceModule;
