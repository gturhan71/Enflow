import { Plus, Pencil, Send, Printer, Trash2 } from 'lucide-react';
import type { UnitReport } from '../../types';
import { STATUS_BADGE, printUnitReport } from './helpers';

export default function MyReportsTab({
  myReports, onNewReport, onEdit, onSubmit, onDelete,
}: {
  myReports: UnitReport[];
  onNewReport: () => void;
  onEdit: (r: UnitReport) => void;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onNewReport} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-1">
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
                      <button onClick={() => onEdit(r)} title="Düzenle" className="p-2 text-slate-400 hover:text-primary"><Pencil size={16} /></button>
                      <button onClick={() => onSubmit(r.id)} title="Yönetime Sun" className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Send size={13} /> Sun</button>
                    </>
                  )}
                  <button onClick={() => printUnitReport(r)} title="Yazdır" className="p-2 text-slate-400 hover:text-primary"><Printer size={16} /></button>
                  <button onClick={() => onDelete(r.id)} title="Sil" className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
