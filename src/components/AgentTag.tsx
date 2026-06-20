import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Loader2, X, ShieldAlert } from 'lucide-react';
import { apiService } from '../services/apiService';
import { agentDisplayLabel, isAgentActor } from '../lib/agentProvenance';
import type { AgentRun } from '../types';

interface AgentTagProps {
  /** Aktör kimliği — 'AGENT:<pluginKey>' veya legacy 'VIRTUAL_AGENT' */
  actorId?: string | null;
  /** Drill-down için ilgili AgentRun id'si */
  agentRunId?: string | null;
  /** Etiket metnini override et (verilmezse actorId'den çözülür) */
  label?: string | null;
  /** Otonom-onaylı işleme insan itirazı/geri-al aksiyonu (opsiyonel) */
  onContest?: () => void;
  contestLabel?: string;
  className?: string;
}

const MODE_LABEL: Record<string, string> = { ADVISORY: 'Danışman', AUTONOMOUS: 'Otonom' };
const STATUS_LABEL: Record<string, string> = {
  PENDING_RATIFICATION: 'Onay bekliyor',
  RATIFIED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

/**
 * "🤖 {agent adı} tarafından yapıldı" köken rozeti. Tıklanınca AgentRun
 * detayını (gerekçe + çıktı + ratifikasyon durumu) açar. Böylece bir sonraki
 * adım işlemin hangi agent tarafından yapıldığını BİLİR, GÖRÜR ve KONTROL EDER.
 */
export default function AgentTag({
  actorId,
  agentRunId,
  label,
  onContest,
  contestLabel = 'İtiraz et / Geri al',
  className = '',
}: AgentTagProps) {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);

  const display = label ?? agentDisplayLabel(actorId) ?? 'Sanal Agent';
  // actorId yoksa ama agentRunId varsa yine de göster (köken bilinir)
  if (!isAgentActor(actorId) && !agentRunId) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && agentRunId && !run) {
      setLoading(true);
      try {
        const data = await apiService.getAgentRun(agentRunId);
        setRun(data as AgentRun);
      } catch {
        setRun(null);
      } finally {
        setLoading(false);
      }
    }
  };

  let parsedOutput: Record<string, unknown> | null = null;
  if (run?.outputJson) {
    try { parsedOutput = JSON.parse(run.outputJson); } catch { parsedOutput = null; }
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={toggle}
        title="Köken: sanal agent — detay için tıkla"
        className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
      >
        <Bot size={12} /> {display} tarafından yapıldı
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute z-50 top-full mt-2 left-0 w-80 bg-white rounded-2xl shadow-2xl shadow-slate-300/40 border border-slate-100 p-4 text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-indigo-600" />
                <span className="text-xs font-black text-slate-900">{display}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={15} />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-3">
                <Loader2 size={14} className="animate-spin" /> Detay yükleniyor…
              </div>
            )}

            {!loading && !agentRunId && (
              <p className="text-xs text-slate-500">Bu işlem bir sanal agent tarafından yapıldı. Detay kaydı yok (eski kayıt).</p>
            )}

            {!loading && run && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {MODE_LABEL[run.mode] ?? run.mode}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                    run.status === 'RATIFIED' ? 'bg-emerald-100 text-emerald-700'
                    : run.status === 'REJECTED' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {STATUS_LABEL[run.status] ?? run.status}
                  </span>
                </div>

                {run.rationale && (
                  <p className="text-xs text-slate-600 leading-relaxed">{run.rationale}</p>
                )}

                {run.actionTaken && (
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    ✅ Otonom eylem: {run.actionTaken}
                  </div>
                )}

                {parsedOutput && (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-1 border border-slate-100">
                    {Object.entries(parsedOutput).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 text-[11px]">
                        <span className="font-bold text-slate-500">{k}</span>
                        <span className="text-slate-800 text-right font-medium break-words">
                          {Array.isArray(v) ? (v.length ? v.join(', ') : '—') : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {onContest && (
                  <button
                    onClick={() => { setOpen(false); onContest(); }}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 mt-1"
                  >
                    <ShieldAlert size={13} /> {contestLabel}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
