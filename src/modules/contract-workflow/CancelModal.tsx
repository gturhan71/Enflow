import { XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CancelModal({
  target, reasonInput, setReasonInput, cancelling, onClose, onConfirm,
}: {
  target: 'CANCELLED' | 'TERMINATED' | null;
  reasonInput: string;
  setReasonInput: (v: string) => void;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { if (!cancelling) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="glass-card w-full max-w-md p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-red-300 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {target === 'CANCELLED' ? 'Süreci İptal Et' : 'Sözleşmeyi Feshet'}
            </h3>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Gerekçe (zorunlu)</label>
              <textarea
                className="input-glass w-full min-h-[90px]"
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                placeholder="İptal/fesih gerekçesini yazın..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={cancelling}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={onConfirm}
                disabled={cancelling || !reasonInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Onayla
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
