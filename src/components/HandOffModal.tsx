import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowRight, Loader2, GitBranch } from 'lucide-react';

interface HandOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { note: string }) => void | Promise<void>;
  itemTitle: string;
}

// Değişmez kural: hedef birim/kişi burada artık serbestçe seçilmez — tenant'ın
// Ayarlar → İş Akışı Tasarımcısı'nda kurguladığı haritaya göre backend (processEngine.ts
// advanceProcess) çözer. Bu modal yalnız bir devir notunu onaylatır; süreç henüz
// yapılandırılmadıysa çağıran (`onConfirm`) 409 hatasını yakalayıp burada gösterir.
export const HandOffModal: React.FC<HandOffModalProps> = ({ isOpen, onClose, onConfirm, itemTitle }) => {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ note });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Devir sırasında hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h4 className="text-xl font-bold text-white italic uppercase tracking-tighter">İş Akışı Devri</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <GitBranch size={18} className="text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-slate-300">
              <span className="font-bold text-white">{itemTitle}</span> — hedef birim/kişi, Ayarlar → İş Akışı Tasarımcısı'nda
              kurgulanan haritaya göre otomatik belirlenir.
            </p>
          </div>

          <textarea
            rows={3}
            placeholder="Devir notu (opsiyonel)..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary resize-none"
            onChange={(e) => setNote(e.target.value)}
            value={note}
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-medium">{error}</div>
          )}
        </div>
        <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-white">İptal</button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Devret
          </button>
        </div>
      </motion.div>
    </div>
  );
};
