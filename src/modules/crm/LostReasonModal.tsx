import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Opportunity, Proposal } from '../../types';
import { LOST_REASON_OPTIONS } from './constants';

export default function LostReasonModal({
  target, choice, setChoice, custom, setCustom, loading, onCancel, onConfirm,
}: {
  target: { opp: Opportunity; proposal?: Proposal };
  choice: string;
  setChoice: (v: string) => void;
  custom: string;
  setCustom: (v: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-3xl p-8 w-full max-w-md space-y-6"
      >
        <div>
          <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Kaybedilen Fırsat — Neden</h3>
          <p className="text-xs text-slate-500 font-bold mt-1">"{target.opp.title}" fırsatı KAYBEDİLDİ olarak işaretlenecek ve otomatik arşivlenecek.</p>
        </div>
        <div className="space-y-3">
          {LOST_REASON_OPTIONS.map(reason => (
            <label key={reason} className={cn(
              "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all text-sm font-bold",
              choice === reason ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 hover:border-slate-300"
            )}>
              <input
                type="radio"
                name="lostReason"
                value={reason}
                checked={choice === reason}
                onChange={() => setChoice(reason)}
                className="accent-red-500"
              />
              {reason}
            </label>
          ))}
          {choice === 'Diğer' && (
            <input
              type="text"
              autoFocus
              placeholder="Nedeni yazın..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="input-glass w-full"
            />
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-xs font-black text-slate-500 uppercase tracking-widest"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !choice}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Kaybedildi Olarak İşaretle
          </button>
        </div>
      </motion.div>
    </div>
  );
}
