import { CheckCircle2, AlertCircle, Send, Loader2, ShoppingCart, ClipboardList } from 'lucide-react';
import { ContractWorkflow, AiAnalysis } from './types';

export default function TransferTab({
  selected, transferProject, analysis, transferring, onTransfer, onHandoffProcurement,
}: {
  selected: ContractWorkflow;
  transferProject: { code?: string; name?: string } | null;
  analysis: AiAnalysis | null;
  transferring: boolean;
  onTransfer: () => void;
  onHandoffProcurement: () => void;
}) {
  return (
    <div className="space-y-6 max-w-lg">

      {/* Status banner */}
      {selected.status === 'TRANSFERRED' ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300 font-medium">Süreç tamamlandı</p>
          <p className="text-xs text-slate-400 mt-1">
            Görevler Proje Yönetimi modülünde görünür.
            {selected.signedDate && ` · İmzalandı: ${new Date(selected.signedDate).toLocaleDateString('tr-TR')}`}
          </p>
          {selected.projectId && (
            <p className="text-xs text-emerald-300 font-bold mt-2">
              ✓ Proje kaydı oluşturuldu{transferProject?.code ? `: ${transferProject.code}${transferProject.name ? ` — ${transferProject.name}` : ''}` : ''} (Proje Yönetimi modülünde)
            </p>
          )}
        </div>
      ) : (
        <div className={`p-4 rounded-xl border ${
          selected.status === 'SIGNED'
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-white/10 bg-white/5'
        }`}>
          <div className="flex items-center gap-3">
            {selected.status === 'SIGNED'
              ? <AlertCircle className="w-5 h-5 text-amber-400" />
              : <AlertCircle className="w-5 h-5 text-slate-500" />}
            <span className="text-sm font-medium text-slate-200">
              {selected.status === 'SIGNED'
                ? 'İmzalandı ama henüz aktarılmadı'
                : 'Aktarım için önce sözleşmenin onaylanması gerekiyor'}
            </span>
          </div>
          {selected.status === 'SIGNED' && (
            <button
              onClick={onTransfer}
              disabled={transferring}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
            >
              {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {transferring ? 'Aktarılıyor...' : 'Proje Yönetimine Aktar'}
            </button>
          )}
        </div>
      )}

      {/* Satınalmaya Aktar — BoM + referans alış fiyatları */}
      {(selected.status === 'SIGNED' || selected.status === 'TRANSFERRED') && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          {selected.procurementRequestId ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Satınalmaya aktarıldı</p>
                <p className="text-xs text-slate-400 mt-0.5">BoM ve referans alış fiyatları Satınalma Talebi olarak iletildi (Satın Alma modülünde DRAFT).</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-slate-200">İşi Satınalmaya devret — BoM + üretici/distribütör alış fiyatlarıyla</span>
              </div>
              <button onClick={onHandoffProcurement} disabled={transferring}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {transferring ? 'Aktarılıyor...' : 'Satınalmaya Aktar'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Task list */}
      {analysis?.tasks && analysis.tasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-purple-400" />
            {selected.status === 'TRANSFERRED' ? 'Aktarılan Görevler' : 'Aktarılacak Görevler'} ({analysis.tasks.length})
          </h3>
          <div className="space-y-2">
            {analysis.tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/3 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  t.priority === 'HIGH' ? 'bg-red-500/30 text-red-300' :
                  t.priority === 'LOW' ? 'bg-slate-500/30 text-slate-400' :
                  'bg-amber-500/30 text-amber-300'
                }`}>{t.order}</span>
                <div className="flex-1">
                  <div className="text-slate-200">[Sözleşme] {t.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">~{t.estimated_days}g</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
