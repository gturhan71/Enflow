import { ROLE_LABELS } from '../../constants';
import type { ReportOverview, ReportMetric, UnitReport, UnitMetrics } from '../../types';

export const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Taslak', cls: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Sunuldu', cls: 'bg-sky-100 text-sky-700' },
  REVIEWED: { label: 'Onaylandı', cls: 'bg-emerald-100 text-emerald-700' },
  RETURNED: { label: 'İade Edildi', cls: 'bg-amber-100 text-amber-700' },
};

export const PIE_COLORS = ['hsl(151 86% 39%)', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];

export const TONE_CLASSES: Record<string, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

export function fmtValue(m: ReportMetric): string {
  if (typeof m.value === 'number' && m.unit === '₺') {
    return new Intl.NumberFormat('tr-TR').format(m.value) + ' ₺';
  }
  if (m.unit === '%') return `${m.value}%`;
  if (m.unit && m.unit !== '₺') return `${m.value} ${m.unit}`;
  return String(m.value);
}

// ── Dönem karşılaştırma: önceki dönem (aynı uzunlukta, hemen öncesi) ──────────
export function prevRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start), e = new Date(end);
  const lenMs = Math.max(0, e.getTime() - s.getTime());
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lenMs);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(prevStart), end: iso(prevEnd) };
}

// ── Yazdırma / çıktı (window.print HTML — ProjectManagementModule deseni) ──────
export function printReportWindow(title: string, body: string) {
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

export const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export const MK_LABEL_PR: Record<string, string> = { INTRO: 'Tanışma', PLANNED: 'Planlı', FOLLOWUP: 'Takip', OTHER: 'Diğer' };
export const LT_LABEL_PR: Record<string, string> = { NEW_CONTACT: 'Yeni İletişim', VISIT: 'Planlı Ziyaret', OPPORTUNITY: 'Fırsat', PROJECT: 'Proje' };

// ── Konsolidasyon (personel günlük rapor + ziyaret plan-gerçekleşen) ─────────
export interface ConsolidationPerson { userId: string; name: string; role: string; isManager: boolean; reportCount: number; knownCount: number; newCount: number; sharedCount: number; plannedVisits?: number; completedVisits?: number; matchedVisits?: number; matchRate?: number; }
export interface ConsolidationEntry { date: string; userName: string; meetingKind: string; linkType: string; linkLabel: string | null; content: string }
export interface ConsolidationVisit { date: string; customerName: string | null; type: string; status: string; note: string | null }
export interface ConsolidationResult {
  unitKey: string; staffCount: number; totalReports: number; knownToSystem: number; newContacts: number;
  managerName: string | null; people: ConsolidationPerson[];
  matrix?: Record<string, Record<string, number>>;
  reportEntries?: ConsolidationEntry[];
  visits?: ConsolidationVisit[];
  targetRate?: number;
  visitReconciliation: { applicable: boolean; planned: number; completed: number; cancelled: number; pending: number; coveragePct: number };
}

function consolidationHtml(c: ConsolidationResult): string {
  const tgt = c.targetRate ?? 80;
  const peopleRows = c.people.filter(p => p.reportCount > 0 || (p.plannedVisits ?? 0) > 0)
    .map(p => {
      const score = (p.plannedVisits ?? 0) > 0 ? `%${p.matchRate} (${p.matchedVisits}/${p.plannedVisits}, hedef %${tgt})` : '—';
      return `<tr><td>${esc(p.name)}${p.isManager ? ' <b>(yönetici)</b>' : ''}</td><td>${p.reportCount}</td><td>${p.knownCount}</td><td>${p.newCount}</td><td>${p.sharedCount}</td><td>${score}</td></tr>`;
    }).join('');
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
  ${peopleRows ? `<table><tr><th>Personel</th><th>Rapor</th><th>Sistemde</th><th>Yeni</th><th>Paylaşılan</th><th>Ziyaret Skoru</th></tr>${peopleRows}</table>` : '<p class="muted">Dönemde personel günlük raporu yok.</p>'}
  ${entryRows ? `<h2>Günlük Rapor İçerikleri</h2><table><tr><th>Tarih</th><th>Personel</th><th>Toplantı</th><th>İş / Kaynak</th><th>Not / İçerik</th></tr>${entryRows}</table>` : ''}
  ${vrHtml}
  ${visitRows ? `<h2>Ziyaretler (girilen detay)</h2><table><tr><th>Tarih</th><th>Müşteri</th><th>Tür</th><th>Durum</th><th>Görüşme Notu</th></tr>${visitRows}</table>` : ''}
  <h2>İş Bağlantısı Matrisi (Toplantı Türü × Kaynak)</h2>
  <table><tr><th>Toplantı \\ Kaynak</th>${lt.map(l => `<th>${LT_LABEL_PR[l]}</th>`).join('')}<th>Toplam</th></tr>${matrixRows}</table>`;
}

export function printUnitReport(r: UnitReport) {
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

export function printOverview(overview: ReportOverview, start: string, end: string) {
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

export const STAGE_LABELS: Record<string, string> = {
  NEW: 'Yeni', CONTACTED: 'İletişim', QUALIFIED: 'Nitelikli', PROPOSAL: 'Teklif', NEGOTIATION: 'Müzakere',
};

export const REC_STYLE: Record<string, { label: string; badge: string; bar: string }> = {
  BID: { label: 'Katıl', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  REVIEW: { label: 'İncele', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  NO_BID: { label: 'Katılma', badge: 'bg-red-100 text-red-600', bar: 'bg-red-500' },
};

export const DMO_STATUS_TR: Record<string, string> = { EVALUATION: 'Değerlendirme', CONFIRMED: 'Onaylı', IN_DELIVERY: 'Sevkiyat', DELIVERED: 'Teslim', INVOICED: 'Faturalı', CLOSED: 'Kapandı', REJECTED: 'Ret', CANCELLED: 'İptal' };
