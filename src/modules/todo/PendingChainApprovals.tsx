import { useState, useEffect } from 'react';
import { Landmark, X, CheckCircle2, Loader2, Building2, Calendar, Tag, UserCog } from 'lucide-react';
import { motion } from 'motion/react';
import { ApprovalChain, Opportunity } from '../../types';
import AgentTag from '../../components/AgentTag';
import { isAgentActor } from '../../lib/agentProvenance';
import { CHAIN_ROLE_LABEL, CHAIN_ENTITY_LABEL } from './helpers';
import { PROCUREMENT_METHODS } from '../../lib/procurementCosts';
import { fmtCurrency } from '../../lib/format';
import { apiService } from '../../services/apiService';

// Bekleyen Onaylarım — Onay Zinciri (Finans/İGB/Üst Yönetim/KSU swimlane'i).
// Kullanıcının rolü zincirde hangi aşamadaysa, sırası gelmiş onaylar burada listelenir.
// role null olan aşamalar (Süreç Motoru — yalnız-birim aşaması) için etiket.
const stageLabel = (role: string | null | undefined) => (role ? (CHAIN_ROLE_LABEL[role] || role) : 'Birim onayı');

export default function PendingChainApprovals({
  chains,
  currentUserRole,
  currentUserUnitId,
  actionLoading,
  onAction,
  opportunities,
}: {
  chains: ApprovalChain[];
  currentUserRole?: string;
  currentUserUnitId?: string;
  actionLoading: string | null;
  onAction: (chain: ApprovalChain, stageId: string, action: 'approve' | 'reject', note?: string, assigneeUserId?: string) => void;
  opportunities?: Opportunity[];
}) {
  // Presales Müdürü teknik değerlendirmeyi onaylarken BoM'u kimin üstleneceğini
  // (hangi Presales Mühendisi) seçmesi zorunlu — birim-geneli sessiz yayın yerine
  // garanti bir devir + ileride birim utilizasyonu için Opportunity.presalesId.
  // Tam kullanıcı listesi (`GET /users`) GM-only olduğundan (bkz. users.ts) burada
  // hafif, herkese-açık `/users/lookup` ucu kullanılır — Presales Müdürü GM
  // olmasa da mühendis listesini görebilsin.
  const [assigneeByChain, setAssigneeByChain] = useState<Record<string, string>>({});
  const [presalesEngs, setPresalesEngs] = useState<{ id: string; name: string; unitId: string | null }[]>([]);
  useEffect(() => {
    apiService.getUsersByRole('PRESALES_ENG')
      .then((list) => setPresalesEngs(list as { id: string; name: string; unitId: string | null }[]))
      .catch(() => setPresalesEngs([]));
  }, []);

  // Red her zaman bir gerekçe taşımalı (backend de zorunlu kılıyor — bkz.
  // approvalChains.ts /reject) ki ilgili taraflar "neden?" sorusuna cevap bulsun.
  const handleReject = (chain: ApprovalChain, stageId: string) => {
    const note = window.prompt('Red gerekçesi (zorunlu):');
    if (!note || !note.trim()) return;
    onAction(chain, stageId, 'reject', note.trim());
  };
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
          // Süreç Motoru (Faz A): rol-bazlı aşamalar role eşleşmesiyle, yalnız-birim
          // aşamaları (role=null) kullanıcının kendi birimiyle (unitId) eşleşir.
          const myStage = chain.stages.find(s => s.status === 'PENDING' && (
            s.role === currentUserRole || (!s.role && !!s.unitId && s.unitId === currentUserUnitId)
          ));
          if (!myStage) return null;
          // Fırsatın adı/kapanış tarihi/alım türü gibi bağlam bilgisi olmadan
          // yalnız "OPPORTUNITY" etiketiyle onaylayan kişi neyi onayladığını
          // göremiyordu — chain.entityId ile eşleşen fırsat burada gösterilir.
          const opp = chain.entityType === 'OPPORTUNITY' ? opportunities?.find(o => o.id === chain.entityId) : undefined;
          const methodLabel = opp?.procurementMethod ? PROCUREMENT_METHODS.find(m => m.key === opp.procurementMethod)?.label : null;
          const needsAssignee = chain.processKey === 'CRM_HANDOFF' && myStage.role === 'PRESALES_MGR';
          const selectedAssignee = assigneeByChain[chain.id] || '';
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
                {opp && (
                  <div className="pt-1">
                    <p className="text-sm font-black text-slate-800 truncate">{opp.title} · {fmtCurrency(opp.value)}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-0.5 text-[11px] text-slate-500 font-bold">
                      {opp.customer?.name && (
                        <span className="flex items-center gap-1"><Building2 size={11} /> {opp.customer.name}</span>
                      )}
                      {opp.expectedCloseDate && (
                        <span className="flex items-center gap-1"><Calendar size={11} /> Beklenen kapanış: {new Date(opp.expectedCloseDate).toLocaleDateString('tr-TR')}</span>
                      )}
                      {methodLabel && (
                        <span className="flex items-center gap-1"><Tag size={11} /> {methodLabel}</span>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Zincir: {chain.stages.map(s => stageLabel(s.role)).join(' → ')}
                </p>
                {/* Köken etiketi — önceki aşamalardan sanal agent tarafından onaylananlar */}
                {chain.stages.filter(s => isAgentActor(s.approverId)).map(s => (
                  <div key={s.id} className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {stageLabel(s.role)} aşaması:
                    </span>
                    <AgentTag actorId={s.approverId} agentRunId={s.agentRunId} />
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0">
                {needsAssignee && (
                  <div className="flex items-center gap-2">
                    <UserCog size={14} className="text-slate-400 shrink-0" />
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setAssigneeByChain(prev => ({ ...prev, [chain.id]: e.target.value }))}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none min-w-[200px]"
                    >
                      <option value="">BoM'u devredilecek mühendis...</option>
                      {presalesEngs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleReject(chain, myStage.id)}
                    disabled={actionLoading === myStage.id}
                    className="flex items-center gap-2 bg-white border border-red-200 text-red-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <X size={14} /> Reddet
                  </button>
                  <button
                    onClick={() => onAction(chain, myStage.id, 'approve', undefined, needsAssignee ? selectedAssignee : undefined)}
                    disabled={actionLoading === myStage.id || (needsAssignee && !selectedAssignee)}
                    title={needsAssignee && !selectedAssignee ? 'Önce BoM\'u devredilecek mühendisi seçin' : undefined}
                    className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-violet-100"
                  >
                    {actionLoading === myStage.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Onayla
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
