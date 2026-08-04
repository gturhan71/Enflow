import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import type { UnitReport, UnitDefinition, UnitMetrics } from '../../types';
import { TONE_CLASSES, fmtValue, type ConsolidationResult } from './helpers';
import ConsolidationView from './ConsolidationView';

// ── Rapor formu (yönetici-yazımı, ön-dolu metriklerle) ───────────────────────
export default function ReportForm({ report, units, onClose, onSaved }: {
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
