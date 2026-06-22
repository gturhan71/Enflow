import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  BarChart3, AlertTriangle, RefreshCw, TrendingUp, Clock, LayoutGrid, Building2,
  FileText, Inbox, Plus, Send, Pencil, Trash2, Check, Undo2, X, Printer,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../constants';
import type {
  ReportOverview, UnitMetrics, ReportMetric, ReportChartSeries, UnitDefinition, UnitReport,
} from '../types';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Taslak', cls: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Sunuldu', cls: 'bg-sky-100 text-sky-700' },
  REVIEWED: { label: 'Onaylandı', cls: 'bg-emerald-100 text-emerald-700' },
  RETURNED: { label: 'İade Edildi', cls: 'bg-amber-100 text-amber-700' },
};

const PIE_COLORS = ['hsl(151 86% 39%)', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];

const TONE_CLASSES: Record<string, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

function fmtValue(m: ReportMetric): string {
  if (typeof m.value === 'number' && m.unit === '₺') {
    return new Intl.NumberFormat('tr-TR').format(m.value) + ' ₺';
  }
  if (m.unit === '%') return `${m.value}%`;
  if (m.unit && m.unit !== '₺') return `${m.value} ${m.unit}`;
  return String(m.value);
}

// ── Dönem karşılaştırma: önceki dönem (aynı uzunlukta, hemen öncesi) ──────────
function prevRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start), e = new Date(end);
  const lenMs = Math.max(0, e.getTime() - s.getTime());
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lenMs);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(prevStart), end: iso(prevEnd) };
}

// ── Yazdırma / çıktı (window.print HTML — ProjectManagementModule deseni) ──────
function printReportWindow(title: string, body: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#1e293b;max-width:900px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}td,th{padding:6px 8px;border:1px solid #e2e8f0;text-align:left}
  th{background:#f8fafc;font-weight:600}.muted{color:#64748b;font-size:13px}.narr{white-space:pre-wrap;font-size:13px;line-height:1.5}</style>
  </head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* */ } }, 350);
}

const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

const MK_LABEL_PR: Record<string, string> = { INTRO: 'Tanışma', PLANNED: 'Planlı', FOLLOWUP: 'Takip', OTHER: 'Diğer' };
const LT_LABEL_PR: Record<string, string> = { NEW_CONTACT: 'Yeni İletişim', VISIT: 'Planlı Ziyaret', OPPORTUNITY: 'Fırsat', PROJECT: 'Proje' };

function consolidationHtml(c: ConsolidationResult): string {
  const peopleRows = c.people.filter(p => p.reportCount > 0)
    .map(p => `<tr><td>${esc(p.name)}${p.isManager ? ' <b>(yönetici)</b>' : ''}</td><td>${p.reportCount}</td><td>${p.knownCount}</td><td>${p.newCount}</td><td>${p.sharedCount}</td></tr>`).join('');
  const mk = ['INTRO', 'PLANNED', 'FOLLOWUP', 'OTHER']; const lt = ['NEW_CONTACT', 'VISIT', 'OPPORTUNITY', 'PROJECT'];
  const m = (c.matrix || {}) as Record<string, Record<string, number>>;
  const matrixRows = mk.map(k => {
    const cells = lt.map(l => `<td>${(m[k] && m[k][l]) || 0}</td>`).join('');
    const tot = lt.reduce((s, l) => s + ((m[k] && m[k][l]) || 0), 0);
    return `<tr><td>${MK_LABEL_PR[k]}</td>${cells}<td><b>${tot}</b></td></tr>`;
  }).join('');
  const vr = c.visitReconciliation;
  const vrHtml = vr.applicable
    ? `<h2>Ziyaret Plan-Gerçekleşen</h2><table><tr><th>Planlanan</th><th>Gerçekleşen</th><th>İptal</th><th>Bekleyen</th><th>Kapsama</th></tr>
       <tr><td>${vr.planned}</td><td>${vr.completed}</td><td>${vr.cancelled}</td><td>${vr.pending}</td><td><b>%${vr.coveragePct}</b></td></tr></table>` : '';
  const dt = (s: string) => s.slice(0, 10);
  const entryRows = (c.reportEntries || [])
    .map(e => `<tr><td>${dt(e.date)}</td><td>${esc(e.userName)}</td><td>${MK_LABEL_PR[e.meetingKind] || e.meetingKind}</td><td>${LT_LABEL_PR[e.linkType] || e.linkType}${e.linkLabel ? ': ' + esc(e.linkLabel) : ''}</td><td>${esc(e.content)}</td></tr>`).join('');
  const visitRows = (c.visits || [])
    .map(v => `<tr><td>${dt(v.date)}</td><td>${esc(v.customerName || '')}</td><td>${esc(v.type)}</td><td>${esc(v.status)}</td><td>${esc(v.note || '')}</td></tr>`).join('');
  return `<h2>Konsolidasyon — Personel Günlük Raporları</h2>
  <p class="muted">${c.staffCount} personel · ${c.totalReports} rapor · Sistemde ${c.knownToSystem} · Yeni İletişim ${c.newContacts}</p>
  ${peopleRows ? `<table><tr><th>Personel</th><th>Rapor</th><th>Sistemde</th><th>Yeni</th><th>Paylaşılan</th></tr>${peopleRows}</table>` : '<p class="muted">Dönemde personel günlük raporu yok.</p>'}
  ${entryRows ? `<h2>Günlük Rapor İçerikleri</h2><table><tr><th>Tarih</th><th>Personel</th><th>Toplantı</th><th>İş / Kaynak</th><th>Not / İçerik</th></tr>${entryRows}</table>` : ''}
  ${vrHtml}
  ${visitRows ? `<h2>Ziyaretler (girilen detay)</h2><table><tr><th>Tarih</th><th>Müşteri</th><th>Tür</th><th>Durum</th><th>Görüşme Notu</th></tr>${visitRows}</table>` : ''}
  <h2>İş Bağlantısı Matrisi (Toplantı Türü × Kaynak)</h2>
  <table><tr><th>Toplantı \\ Kaynak</th>${lt.map(l => `<th>${LT_LABEL_PR[l]}</th>`).join('')}<th>Toplam</th></tr>${matrixRows}</table>`;
}

function printUnitReport(r: UnitReport) {
  let snap: UnitMetrics | null = null;
  try { snap = r.metricsSnapshot ? JSON.parse(r.metricsSnapshot) : null; } catch { snap = null; }
  let cons: ConsolidationResult | null = null;
  try { cons = r.consolidationSnapshot ? JSON.parse(r.consolidationSnapshot) : null; } catch { cons = null; }
  const metricRows = snap ? snap.metrics.map(m => `<tr><td>${esc(m.label)}</td><td>${fmtValue(m)}</td><td>${esc(m.hint ?? '')}</td></tr>`).join('') : '';
  const narr = (label: string, v?: string | null) => v ? `<h2>${label}</h2><p class="narr">${esc(v)}</p>` : '';
  const body = `
  <h1>Birim Raporu — ${esc(r.unitLabel)}</h1>
  <p class="muted">${r.periodLabel ? esc(r.periodLabel) + ' · ' : ''}${r.periodStart.slice(0, 10)} — ${r.periodEnd.slice(0, 10)} · Durum: ${STATUS_BADGE[r.status]?.label ?? r.status}${r.docNumber ? ` · ${esc(r.docNumber)}` : ''}${r.authorName ? ` · ${esc(r.authorName)}` : ''}</p>
  ${r.escalatedToName ? `<p class="muted">Üst birim yöneticisine sunuldu: <b>${esc(r.escalatedToName)}</b></p>` : ''}
  ${cons ? consolidationHtml(cons) : ''}
  ${metricRows ? `<h2>Otomatik Metrikler (gönderim anı)</h2><table><tr><th>Metrik</th><th>Değer</th><th>Not</th></tr>${metricRows}</table>` : ''}
  ${narr('Öne Çıkanlar', r.highlights)}
  ${narr('Sorunlar', r.issues)}
  ${narr('Planlanan Aksiyonlar', r.plannedActions)}
  ${narr('Riskler', r.risks)}
  ${narr('Özet', r.summary)}
  ${r.reviewNote ? `<h2>İnceleme Notu</h2><p class="narr">${esc(r.reviewNote)}</p>` : ''}`;
  printReportWindow(`Birim Raporu — ${r.unitLabel}`, body);
}

function printOverview(overview: ReportOverview, start: string, end: string) {
  const unitTables = overview.units.map(u => {
    const rows = u.headline.map(m => `<tr><td>${esc(m.label)}</td><td>${fmtValue(m)}</td></tr>`).join('');
    return `<h2>${esc(u.label)}</h2><table><tr><th>Metrik</th><th>Değer</th></tr>${rows}</table>`;
  }).join('');
  const bn = (overview.bottlenecks || []).map(b => `<tr><td>${ROLE_LABELS[b.role] || b.role}</td><td>${b.pendingCount}</td><td>${b.oldestWaitingDays} gün</td></tr>`).join('');
  const body = `<h1>Konsolide Yönetim Raporu</h1><p class="muted">${start} — ${end}</p>
  ${bn ? `<h2>İş Akışı Darboğazı</h2><table><tr><th>Birim/Rol</th><th>Bekleyen</th><th>En Eski Bekleyiş</th></tr>${bn}</table>` : ''}
  ${unitTables}`;
  printReportWindow('Konsolide Yönetim Raporu', body);
}

// ── Ortak parçalar ───────────────────────────────────────────────────────────
function MetricCard({ m, prev }: { m: ReportMetric; prev?: number }) {
  let delta: { up: boolean; pct: number } | null = null;
  if (typeof m.value === 'number' && typeof prev === 'number' && prev !== 0 && m.value !== prev) {
    const d = m.value - prev;
    delta = { up: d > 0, pct: Math.abs((d / Math.abs(prev)) * 100) };
  }
  return (
    <div className="glass-card p-4 rounded-2xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{m.label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-black tracking-tighter ${TONE_CLASSES[m.tone || 'default']}`}>{fmtValue(m)}</p>
        {delta && (
          <span className="text-[11px] font-bold text-slate-500" title="Önceki döneme göre">
            {delta.up ? '▲' : '▼'} {delta.pct.toFixed(0)}%
          </span>
        )}
      </div>
      {m.hint && <p className="text-[10px] text-slate-400 mt-1">{m.hint}</p>}
    </div>
  );
}

function ChartBlock({ c }: { c: ReportChartSeries }) {
  const data = c.data.filter(d => d.value !== 0 || c.type === 'bar');
  if (data.length === 0) return null;
  return (
    <div className="glass-card p-5 rounded-2xl">
      <h4 className="text-sm font-black text-slate-900 mb-3">{c.title}</h4>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {c.type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`} labelLine={false} fontSize={10}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
            </PieChart>
          ) : c.type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
              <Line type="monotone" dataKey="value" stroke="hsl(151 86% 39%)" strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── İş Akışı Darboğazı paneli ────────────────────────────────────────────────
function BottleneckPanel({ overview }: { overview: ReportOverview }) {
  const { bottlenecks } = overview;
  return (
    <div className="glass-card p-5 rounded-2xl border-l-4 border-amber-400">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-amber-500" size={18} />
        <h3 className="text-base font-black text-slate-900">İş Akışı Darboğazı</h3>
        <span className="text-[10px] text-slate-400 font-bold">— onay zinciri hangi birimde bekliyor</span>
      </div>
      {bottlenecks.length === 0 ? (
        <p className="text-sm text-slate-500">Bekleyen onay zinciri yok — iş akışı temiz. ✓</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bottlenecks.map(b => (
            <div key={b.role} className="bg-white border border-slate-100 rounded-xl p-3">
              <p className="text-sm font-bold text-slate-900">{ROLE_LABELS[b.role] || b.role}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-black text-amber-600">{b.pendingCount} bekleyen</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                  <Clock size={11} /> en eski {b.oldestWaitingDays} gün
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Konsolidasyon (personel günlük rapor + ziyaret plan-gerçekleşen) ─────────
interface ConsolidationPerson { userId: string; name: string; role: string; isManager: boolean; reportCount: number; knownCount: number; newCount: number; sharedCount: number; }
interface ConsolidationEntry { date: string; userName: string; meetingKind: string; linkType: string; linkLabel: string | null; content: string }
interface ConsolidationVisit { date: string; customerName: string | null; type: string; status: string; note: string | null }
interface ConsolidationResult {
  unitKey: string; staffCount: number; totalReports: number; knownToSystem: number; newContacts: number;
  managerName: string | null; people: ConsolidationPerson[];
  matrix?: Record<string, Record<string, number>>;
  reportEntries?: ConsolidationEntry[];
  visits?: ConsolidationVisit[];
  visitReconciliation: { applicable: boolean; planned: number; completed: number; cancelled: number; pending: number; coveragePct: number };
}

function ConsolidationView({ c }: { c: ConsolidationResult }) {
  const vr = c.visitReconciliation;
  return (
    <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Konsolidasyon — Personel Günlük Raporları</p>
      <div className="flex items-center gap-2 flex-wrap mb-2 text-[11px] font-black">
        <span className="bg-white px-2 py-0.5 rounded-full border border-slate-100 text-slate-600">{c.staffCount} personel</span>
        <span className="bg-white px-2 py-0.5 rounded-full border border-slate-100 text-slate-600">{c.totalReports} rapor</span>
        <span className="bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-700">Sistemde {c.knownToSystem}</span>
        <span className="bg-amber-50 px-2 py-0.5 rounded-full text-amber-700">Yeni İletişim {c.newContacts}</span>
      </div>
      {c.people.some(p => p.reportCount > 0) && (
        <div className="space-y-1 mb-2">
          {c.people.filter(p => p.reportCount > 0).map(p => (
            <div key={p.userId} className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700">{p.name}{p.isManager ? ' (yönetici)' : ''}</span>
              <span className="text-slate-500">{p.reportCount} rapor · sistemde {p.knownCount} · yeni {p.newCount}</span>
            </div>
          ))}
        </div>
      )}
      {vr.applicable && (
        <div className="mt-2 pt-2 border-t border-indigo-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Ziyaret Plan-Gerçekleşen</p>
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-black">
            <span className="bg-white px-2 py-0.5 rounded-full border border-slate-100 text-slate-600">Planlanan {vr.planned}</span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-700">Gerçekleşen {vr.completed}</span>
            <span className="bg-red-50 px-2 py-0.5 rounded-full text-red-600">İptal {vr.cancelled}</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Bekleyen {vr.pending}</span>
            <span className={`px-2 py-0.5 rounded-full ${vr.coveragePct >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Kapsama %{vr.coveragePct}</span>
          </div>
        </div>
      )}
      {/* Girilen içerikler — günlük rapor notları + ziyaret detayları */}
      {!!(c.reportEntries && c.reportEntries.length) && (
        <details className="mt-2 pt-2 border-t border-indigo-100">
          <summary className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 cursor-pointer">Günlük Rapor İçerikleri ({c.reportEntries.length})</summary>
          <div className="space-y-1.5 mt-2">
            {c.reportEntries.map((e, i) => (
              <div key={i} className="bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-bold mb-0.5">
                  <span>{e.date.slice(0, 10)}</span>
                  <span className="text-indigo-500">{e.userName}</span>
                  <span className="bg-indigo-50 text-indigo-600 px-1.5 rounded">{MK_LABEL_PR[e.meetingKind] || e.meetingKind}</span>
                  <span className={`px-1.5 rounded ${e.linkType === 'NEW_CONTACT' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{LT_LABEL_PR[e.linkType] || e.linkType}{e.linkLabel ? `: ${e.linkLabel}` : ''}</span>
                </div>
                <p className="text-[11px] text-slate-600">{e.content}</p>
              </div>
            ))}
          </div>
        </details>
      )}
      {!!(c.visits && c.visits.length) && (
        <details className="mt-2 pt-2 border-t border-indigo-100">
          <summary className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 cursor-pointer">Ziyaretler ({c.visits.length})</summary>
          <div className="space-y-1.5 mt-2">
            {c.visits.map((v, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-slate-100 text-[11px]">
                <div className="min-w-0">
                  <span className="font-bold text-slate-700">{v.customerName || '—'}</span>
                  {v.note && <span className="text-slate-500"> — {v.note}</span>}
                </div>
                <span className="text-[10px] text-slate-400 font-bold shrink-0">{v.date.slice(0, 10)} · {v.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Rapor formu (yönetici-yazımı, ön-dolu metriklerle) ───────────────────────
function ReportForm({ report, units, onClose, onSaved }: {
  report: UnitReport | null;
  units: UnitDefinition[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currentUser } = useAuth();
  const today = new Date();
  const defStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [unitKey, setUnitKey] = useState(report?.unitKey || units[0]?.key || 'CRM');
  const [periodStart, setPeriodStart] = useState(report ? report.periodStart.slice(0, 10) : defStart);
  const [periodEnd, setPeriodEnd] = useState(report ? report.periodEnd.slice(0, 10) : defEnd);
  const [highlights, setHighlights] = useState(report?.highlights || '');
  const [issues, setIssues] = useState(report?.issues || '');
  const [plannedActions, setPlannedActions] = useState(report?.plannedActions || '');
  const [risks, setRisks] = useState(report?.risks || '');
  const [summary, setSummary] = useState(report?.summary || '');
  const [preview, setPreview] = useState<UnitMetrics | null>(null);
  const [consolidation, setConsolidation] = useState<ConsolidationResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Ön-dolu metrik + konsolidasyon önizlemesi (salt-okunur) — seçili birim+döneme göre
  useEffect(() => {
    let active = true;
    apiService.getUnitMetrics(unitKey, { start: periodStart, end: periodEnd })
      .then((m: UnitMetrics) => { if (active) setPreview(m); })
      .catch(() => { if (active) setPreview(null); });
    apiService.getReportConsolidation(unitKey, { start: periodStart, end: periodEnd })
      .then((c: ConsolidationResult) => { if (active) setConsolidation(c); })
      .catch(() => { if (active) setConsolidation(null); });
    return () => { active = false; };
  }, [unitKey, periodStart, periodEnd]);

  const isEditing = !!report;
  const locked = isEditing && report.status !== 'DRAFT' && report.status !== 'RETURNED';

  const save = async () => {
    setSaving(true);
    try {
      const payload = { highlights, issues, plannedActions, risks, summary, periodStart, periodEnd };
      if (isEditing) {
        await apiService.updateUnitReport(report.id, payload);
      } else {
        await apiService.createUnitReport({
          ...payload, unitKey, categoryCode: 'RPR',
          authorId: currentUser.id, authorName: currentUser.name,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">{isEditing ? 'Raporu Düzenle' : 'Yeni Birim Raporu'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Birim</label>
            <select value={unitKey} disabled={isEditing} onChange={e => setUnitKey(e.target.value)} className="input-glass w-full px-3 py-2 rounded-xl text-sm disabled:opacity-60">
              {units.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Dönem Başı</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="input-glass w-full px-3 py-2 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400">Dönem Sonu</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="input-glass w-full px-3 py-2 rounded-xl text-sm" />
          </div>
        </div>

        {/* Ön-dolu otomatik metrikler (salt-okunur) */}
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Otomatik Metrikler (sistem)</p>
          {preview ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {preview.metrics.map((m, i) => (
                <div key={i} className="bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                  <span className="text-[9px] text-slate-400 block">{m.label}</span>
                  <span className={`text-sm font-black ${TONE_CLASSES[m.tone || 'default']}`}>{fmtValue(m)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Metrikler yükleniyor…</p>}
        </div>

        {consolidation && (consolidation.totalReports > 0 || consolidation.visitReconciliation.applicable) && (
          <ConsolidationView c={consolidation} />
        )}

        {([
          ['Öne Çıkanlar', highlights, setHighlights],
          ['Sorunlar', issues, setIssues],
          ['Planlanan Aksiyonlar', plannedActions, setPlannedActions],
          ['Riskler', risks, setRisks],
          ['Genel Değerlendirme', summary, setSummary],
        ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
          <div key={label}>
            <label className="text-[10px] font-bold uppercase text-slate-400">{label}</label>
            <textarea value={val} disabled={locked} onChange={e => setter(e.target.value)} rows={2} className="input-glass w-full px-3 py-2 rounded-xl text-sm disabled:opacity-60" />
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-xl text-sm">Vazgeç</button>
          {!locked && (
            <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-60">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gelen rapor inceleme kartı (GM) ──────────────────────────────────────────
function IncomingReportCard({ report, onReviewed }: { report: UnitReport; onReviewed: () => void }) {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const snapshot: UnitMetrics | null = report.metricsSnapshot ? JSON.parse(report.metricsSnapshot) : null;
  let consolidation: ConsolidationResult | null = null;
  try { consolidation = report.consolidationSnapshot ? JSON.parse(report.consolidationSnapshot) : null; } catch { consolidation = null; }

  const review = async (decision: 'APPROVE' | 'RETURN') => {
    setBusy(true);
    try {
      await apiService.reviewUnitReport(report.id, {
        decision, reviewedById: currentUser.id, reviewedByName: currentUser.name, reviewNote: note,
      });
      onReviewed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div>
          <p className="font-bold text-slate-900">{report.unitLabel}</p>
          <p className="text-[11px] text-slate-400">
            {report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)} · {report.authorName || 'Bilinmeyen'}
            {report.docNumber && <span className="ml-2 font-mono">{report.docNumber}</span>}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_BADGE[report.status].cls}`}>{STATUS_BADGE[report.status].label}</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {snapshot && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {snapshot.metrics.map((m, i) => (
                <div key={i} className="bg-slate-50 rounded-lg px-2 py-1.5">
                  <span className="text-[9px] text-slate-400 block">{m.label}</span>
                  <span className={`text-sm font-black ${TONE_CLASSES[m.tone || 'default']}`}>{fmtValue(m)}</span>
                </div>
              ))}
            </div>
          )}
          {consolidation && <ConsolidationView c={consolidation} />}
          {report.escalatedToName && (
            <p className="text-[11px] text-slate-500"><span className="font-bold">Üst birim yöneticisi:</span> {report.escalatedToName}</p>
          )}
          {([['Öne Çıkanlar', report.highlights], ['Sorunlar', report.issues], ['Planlanan Aksiyonlar', report.plannedActions], ['Riskler', report.risks], ['Genel Değerlendirme', report.summary]] as [string, string | null | undefined][])
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{v}</p>
              </div>
            ))}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="İnceleme notu (opsiyonel)" className="input-glass w-full px-3 py-2 rounded-xl text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => printUnitReport(report)} className="btn-secondary px-4 py-2 rounded-xl text-sm flex items-center gap-1">
                <Printer size={14} /> Yazdır
              </button>
              <button onClick={() => review('RETURN')} disabled={busy} className="btn-secondary px-4 py-2 rounded-xl text-sm flex items-center gap-1 disabled:opacity-60">
                <Undo2 size={14} /> İade Et
              </button>
              <button onClick={() => review('APPROVE')} disabled={busy} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1 disabled:opacity-60">
                <Check size={14} /> Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ana modül ────────────────────────────────────────────────────────────────
export default function ManagementReportingModule() {
  const { currentUser } = useAuth();
  const isGM = currentUser.role === 'GENERAL_MANAGER';
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [tab, setTab] = useState<'overview' | 'unit' | 'my-reports' | 'incoming'>('overview');
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Yönetim Raporları</h1>
            <p className="text-xs text-slate-400 font-bold">Birim performansı ve iş akışı izleme</p>
          </div>
        </div>
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

      {/* Genel Bakış */}
      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => printOverview(overview, start, end)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Printer size={13} /> Konsolide Yazdır
            </button>
          </div>
          <BottleneckPanel overview={overview} />
          {overview.units.map(u => (
            <div key={u.unitKey} className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary" size={16} />
                <h3 className="text-base font-black text-slate-900">{u.label}</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ROLE_LABELS[u.role] || u.role}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {u.headline.map((m, i) => <MetricCard key={i} m={m} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Birim Detayı */}
      {tab === 'unit' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {units.map(u => (
              <button key={u.key} onClick={() => setSelectedUnit(u.key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedUnit === u.key ? 'bg-primary text-white shadow shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
                {u.label}
              </button>
            ))}
          </div>
          {unitData && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400 font-bold">Δ önceki döneme göre</p>
                <button onClick={() => unitData && printReportWindow(`Birim Metrikleri — ${unitData.label}`, `<h1>${esc(unitData.label)} — Metrikler</h1><p class="muted">${start} — ${end}</p><table><tr><th>Metrik</th><th>Değer</th><th>Not</th></tr>${unitData.metrics.map(m => `<tr><td>${esc(m.label)}</td><td>${fmtValue(m)}</td><td>${esc(m.hint ?? '')}</td></tr>`).join('')}</table>`)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                  <Printer size={13} /> Yazdır
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {unitData.metrics.map((m, i) => <MetricCard key={i} m={m} prev={prevMetrics[m.label]} />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {unitData.charts.map((c, i) => <ChartBlock key={i} c={c} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Raporlarım */}
      {tab === 'my-reports' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setFormReport(null); setShowForm(true); }} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1">
              <Plus size={15} /> Yeni Rapor
            </button>
          </div>
          {myReports.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Henüz rapor yok. "Yeni Rapor" ile başlayın.</p>
          ) : (
            <div className="space-y-3">
              {myReports.map(r => {
                const editable = r.status === 'DRAFT' || r.status === 'RETURNED';
                return (
                  <div key={r.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{r.unitLabel}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status].cls}`}>{STATUS_BADGE[r.status].label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {r.periodStart.slice(0, 10)} — {r.periodEnd.slice(0, 10)}
                        {r.docNumber && <span className="ml-2 font-mono">{r.docNumber}</span>}
                      </p>
                      {r.status === 'RETURNED' && r.reviewNote && (
                        <p className="text-[11px] text-amber-600 mt-1">İade notu: {r.reviewNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {editable && (
                        <>
                          <button onClick={() => { setFormReport(r); setShowForm(true); }} title="Düzenle" className="p-2 text-slate-400 hover:text-primary"><Pencil size={16} /></button>
                          <button onClick={() => submitReport(r.id)} title="Yönetime Sun" className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Send size={13} /> Sun</button>
                        </>
                      )}
                      <button onClick={() => printUnitReport(r)} title="Yazdır" className="p-2 text-slate-400 hover:text-primary"><Printer size={16} /></button>
                      <button onClick={() => deleteReport(r.id)} title="Sil" className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Gelen Raporlar (GM) */}
      {tab === 'incoming' && isGM && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">İncelenecek sunulmuş rapor yok.</p>
          ) : (
            incoming.map(r => <IncomingReportCard key={r.id} report={r} onReviewed={loadIncoming} />)
          )}
        </div>
      )}

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
