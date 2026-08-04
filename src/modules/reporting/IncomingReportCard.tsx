import { useState } from 'react';
import { Printer, Undo2, Check } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import type { UnitReport, UnitMetrics } from '../../types';
import { STATUS_BADGE, TONE_CLASSES, fmtValue, printUnitReport, type ConsolidationResult } from './helpers';
import ConsolidationView from './ConsolidationView';

// ── Gelen rapor inceleme kartı (GM) ──────────────────────────────────────────
export default function IncomingReportCard({ report, onReviewed }: { report: UnitReport; onReviewed: () => void }) {
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
