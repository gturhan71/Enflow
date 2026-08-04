import { MK_LABEL_PR, LT_LABEL_PR, type ConsolidationResult } from './helpers';

export default function ConsolidationView({ c }: { c: ConsolidationResult }) {
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
      {c.people.some(p => p.reportCount > 0 || (p.plannedVisits ?? 0) > 0) && (
        <div className="space-y-1 mb-2">
          {c.people.filter(p => p.reportCount > 0 || (p.plannedVisits ?? 0) > 0).map(p => {
            const tgt = c.targetRate ?? 80;
            const hasVisits = (p.plannedVisits ?? 0) > 0;
            const met = (p.matchRate ?? 0) >= tgt;
            return (
              <div key={p.userId} className="flex items-center justify-between text-[11px] gap-2">
                <span className="font-bold text-slate-700">{p.name}{p.isManager ? ' (yönetici)' : ''}</span>
                <span className="text-slate-500 flex items-center gap-2">
                  <span>{p.reportCount} rapor · sistemde {p.knownCount} · yeni {p.newCount}</span>
                  {hasVisits && (
                    <span className={`px-1.5 py-0.5 rounded-full font-black ${met ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      Skor %{p.matchRate} ({p.matchedVisits}/{p.plannedVisits}, hedef %{tgt})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
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
