import {
  CheckCircle2, XCircle, Shield, PenTool, Loader2, UserCheck, Clock, UserX,
} from 'lucide-react';
import { ContractWorkflow } from './types';

export default function SigningTab({
  selected, signedDate, setSignedDate, onMarkReadyToSign, onSendForApproval, loading,
  onRejectSignature, onApproveSignature, transferring,
}: {
  selected: ContractWorkflow;
  signedDate: string;
  setSignedDate: (v: string) => void;
  onMarkReadyToSign: () => void;
  onSendForApproval: () => void;
  loading: boolean;
  onRejectSignature: () => void;
  onApproveSignature: () => void;
  transferring: boolean;
}) {
  return (
    <div className="space-y-6 max-w-lg">
      {/* Pre-signing checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">İmzalama Öncesi Kontrol</h3>
        {[
          { label: 'AI analizi yapıldı', ok: !!selected.aiAnalysis },
          { label: 'Zorunlu belgeler tamamlandı', ok: selected.documents.filter(d => d.isRequired).every(d => ['VERIFIED', 'UPLOADED', 'WAIVED'].includes(d.status)) },
          { label: 'Sözleşme bedeli girildi', ok: selected.contractValue > 0 },
        ].map((item, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
            item.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
          }`}>
            {item.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />}
            <span className={`text-sm ${item.ok ? 'text-slate-200' : 'text-slate-500'}`}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1 — mark ready (if not already past this stage) */}
      {!['READY_TO_SIGN', 'PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'TRANSFERRED'].includes(selected.status) && (
        <button
          onClick={onMarkReadyToSign}
          className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" /> İmzaya Hazır İşaretle
        </button>
      )}

      {/* STEP 2 — send for approval (READY_TO_SIGN) */}
      {selected.status === 'READY_TO_SIGN' && (
        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-4">
          <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
            <PenTool className="w-4 h-4" /> Sözleşme İmzalama
          </h3>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">İmzalanma Tarihi</label>
            <input
              className="input-glass w-full"
              type="date"
              value={signedDate}
              onChange={e => setSignedDate(e.target.value)}
            />
          </div>
          <button
            onClick={onSendForApproval}
            disabled={loading || !signedDate}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <UserCheck className="w-4 h-4" />}
            Birim Yöneticisinin Onayına Gönder
          </button>
        </div>
      )}

      {/* STEP 3 — pending approval (PENDING_SIGNATURE_APPROVAL) */}
      {selected.status === 'PENDING_SIGNATURE_APPROVAL' && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">Birim Yöneticisi Onayı Bekleniyor</h3>
              {selected.signedDate && (
                <p className="text-xs text-slate-400 mt-0.5">
                  İmza tarihi: {new Date(selected.signedDate).toLocaleDateString('tr-TR')}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Onaylandığında sözleşme imzalanmış olarak kaydedilecek ve görevler otomatik olarak Proje Yönetimine aktarılacak.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onRejectSignature}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm transition-colors"
            >
              <UserX className="w-4 h-4" /> Reddet
            </button>
            <button
              onClick={onApproveSignature}
              disabled={transferring}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {transferring
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <UserCheck className="w-4 h-4" />}
              Onayla &amp; Aktar
            </button>
          </div>
        </div>
      )}

      {/* CANCELLED/TERMINATED banner (B-01) */}
      {(selected.status === 'CANCELLED' || selected.status === 'TERMINATED') && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">
              {selected.status === 'CANCELLED' ? 'Süreç İptal Edildi' : 'Sözleşme Feshedildi'}
            </p>
            {selected.cancelledAt && (
              <p className="text-xs text-slate-400 mt-0.5">{new Date(selected.cancelledAt).toLocaleDateString('tr-TR')}</p>
            )}
            {selected.cancelReason && (
              <p className="text-xs text-slate-300 mt-1.5">Gerekçe: {selected.cancelReason}</p>
            )}
          </div>
        </div>
      )}

      {/* STEP 4 — signed/transferred */}
      {(selected.status === 'SIGNED' || selected.status === 'TRANSFERRED') && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Sözleşme İmzalandı</p>
            {selected.signedDate && (
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(selected.signedDate).toLocaleDateString('tr-TR')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
