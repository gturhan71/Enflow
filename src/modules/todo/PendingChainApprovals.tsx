import { Landmark, X, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ApprovalChain } from '../../types';
import AgentTag from '../../components/AgentTag';
import { isAgentActor } from '../../lib/agentProvenance';
import { CHAIN_ROLE_LABEL, CHAIN_ENTITY_LABEL } from './helpers';

// Bekleyen Onaylarım — Onay Zinciri (Finans/İGPD/Üst Yönetim/KSU swimlane'i).
// Kullanıcının rolü zincirde hangi aşamadaysa, sırası gelmiş onaylar burada listelenir.
export default function PendingChainApprovals({
  chains,
  currentUserRole,
  actionLoading,
  onAction,
}: {
  chains: ApprovalChain[];
  currentUserRole?: string;
  actionLoading: string | null;
  onAction: (chain: ApprovalChain, stageId: string, action: 'approve' | 'reject') => void;
}) {
  if (chains.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Landmark className="text-violet-500" size={20} />
        <h4 className="text-base font-black text-slate-800 uppercase tracking-widest">
          Bekleyen Onaylarım — {CHAIN_ROLE_LABEL[currentUserRole || ''] || currentUserRole}
        </h4>
        <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-violet-200">
          {chains.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {chains.map(chain => {
          const myStage = chain.stages.find(s => s.role === currentUserRole && s.status === 'PENDING');
          if (!myStage) return null;
          return (
            <motion.div
              layout
              key={chain.id}
              className="glass-panel p-6 rounded-[32px] bg-violet-50/40 border border-violet-100 flex flex-col md:flex-row md:items-center gap-6"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                  {CHAIN_ENTITY_LABEL[chain.entityType || ''] || chain.entityType}
                </span>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Zincir: {chain.stages.map(s => CHAIN_ROLE_LABEL[s.role] || s.role).join(' → ')}
                </p>
                {/* Köken etiketi — önceki aşamalardan sanal agent tarafından onaylananlar */}
                {chain.stages.filter(s => isAgentActor(s.approverId)).map(s => (
                  <div key={s.id} className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {CHAIN_ROLE_LABEL[s.role] || s.role} aşaması:
                    </span>
                    <AgentTag actorId={s.approverId} agentRunId={s.agentRunId} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onAction(chain, myStage.id, 'reject')}
                  disabled={actionLoading === myStage.id}
                  className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  <X size={14} /> Reddet
                </button>
                <button
                  onClick={() => onAction(chain, myStage.id, 'approve')}
                  disabled={actionLoading === myStage.id}
                  className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-violet-100"
                >
                  {actionLoading === myStage.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Onayla
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
