import { Fragment } from 'react';
import { Plus, ArrowRight, Building, FileSignature, XCircle, GitBranch, Edit2, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Opportunity, Customer, Proposal } from '../../types';
import { SaveButton } from '../../components/SaveButton';
import { PermissionGate } from '../../components/PermissionGate';
import { PIPELINE_STAGES, STATUS_LABEL, getStatusStyle } from './constants';

export default function OpportunitiesView({
  filteredOpportunities, customers, proposals, loading, onSaveAll, onNewOpportunity,
  onProgressStatus, onMarkLost, onHandOff, onEdit,
}: {
  filteredOpportunities: Opportunity[];
  customers: Customer[];
  proposals: Proposal[];
  loading: boolean;
  onSaveAll: () => void;
  onNewOpportunity: () => void;
  onProgressStatus: (opp: Opportunity, toStatus: Opportunity['status']) => void;
  onMarkLost: (opp: Opportunity) => void;
  onHandOff: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
}) {
  // Group by status for pipeline view
  const grouped: Partial<Record<Opportunity['status'], Opportunity[]>> = {};
  for (const stage of PIPELINE_STAGES) grouped[stage] = [];
  grouped['LOST'] = [];
  for (const opp of filteredOpportunities) {
    (grouped[opp.status] ?? []).push(opp);
  }

  const stageColors: Record<string, string> = {
    NEW: 'border-t-blue-400', CONTACTED: 'border-t-sky-400',
    QUALIFIED: 'border-t-primary', PROPOSAL: 'border-t-amber-400',
    NEGOTIATION: 'border-t-purple-400', WON: 'border-t-emerald-500', LOST: 'border-t-red-400',
  };

  const allStages: Opportunity['status'][] = [...PIPELINE_STAGES, 'LOST'];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Satış Boru Hattı</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">{filteredOpportunities.length} fırsat · {filteredOpportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON' && o.status !== 'WITHDRAWN').length} aktif</p>
        </div>
        <div className="flex items-center gap-4">
          <SaveButton onClick={onSaveAll} loading={loading} />
          <PermissionGate permission="CRM_EDIT">
            <button
              onClick={onNewOpportunity}
              className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all"
            >
              <Plus size={18} /> Yeni Fırsat
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {PIPELINE_STAGES.filter(s => s !== 'WON').map((stage, idx) => {
          const count = (grouped[stage] ?? []).length;
          const isActive = count > 0;
          return (
            <Fragment key={stage}>
              <div className={cn(
                "flex-1 min-w-[80px] text-center py-2 px-3 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                isActive ? getStatusStyle(stage) : 'text-slate-300 bg-slate-50'
              )}>
                {STATUS_LABEL[stage]}
                <span className="ml-1 opacity-70">({count})</span>
              </div>
              {idx < PIPELINE_STAGES.filter(s => s !== 'WON').length - 1 && (
                <ArrowRight size={12} className="text-slate-300 shrink-0 mx-0.5" />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Cards grouped by stage */}
      {allStages.filter(stage => (grouped[stage] ?? []).length > 0).map(stage => (
        <div key={stage}>
          <div className="flex items-center gap-3 mb-4">
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", getStatusStyle(stage))}>
              {STATUS_LABEL[stage]}
            </span>
            <span className="text-xs text-slate-400 font-bold">{(grouped[stage] ?? []).length} fırsat</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(grouped[stage] ?? []).map(opp => {
              const customer = customers.find(c => c.id === opp.customerId);
              const oppProposals = proposals.filter(p => p.opportunityId === opp.id);
              const latestProposal = oppProposals.length > 0
                ? [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0]
                : null;
              const stageIdx = PIPELINE_STAGES.indexOf(opp.status);
              const nextStage = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1
                ? PIPELINE_STAGES[stageIdx + 1]
                : null;
              return (
                <motion.div
                  layout key={opp.id}
                  className={cn("glass-panel p-6 rounded-[24px] border-t-4 flex flex-col gap-4 hover:shadow-xl transition-all", stageColors[opp.status] || 'border-t-slate-200')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="font-black text-slate-900 text-sm leading-snug truncate">{opp.title}</h5>
                      {customer && (
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                          <Building size={10} />{customer.name}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border shrink-0", getStatusStyle(opp.status))}>
                      {STATUS_LABEL[opp.status]}
                    </span>
                  </div>

                  {opp.value > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Değer</span>
                      <span className="font-black text-slate-800">{opp.value.toLocaleString('tr-TR')} {customer?.currency || ''}</span>
                    </div>
                  )}

                  {opp.probability > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>Olasılık</span><span>{opp.probability}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${opp.probability}%` }} />
                      </div>
                    </div>
                  )}

                  {latestProposal && (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold">
                      <FileSignature size={11} />
                      Teklif v{latestProposal.version} ·{' '}
                      <span className={cn("font-black", latestProposal.status === 'APPROVED' ? 'text-emerald-600' : latestProposal.status === 'REJECTED' ? 'text-red-500' : 'text-slate-500')}>
                        {latestProposal.status === 'DRAFT' ? 'Taslak' : latestProposal.status === 'PENDING_APPROVAL' ? 'Onay Bekliyor' : latestProposal.status === 'APPROVED' ? 'Onaylandı' : latestProposal.status === 'SENT' ? 'Gönderildi' : latestProposal.status === 'ACCEPTED' ? 'Kabul Edildi' : latestProposal.status === 'REJECTED' ? 'Reddedildi' : latestProposal.status}
                      </span>
                    </div>
                  )}

                  {(opp.agentTriage?.igpd || opp.agentTriage?.crm) && (
                    <div className="flex flex-col gap-1">
                      {opp.agentTriage.igpd && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                          🤖 BD: {opp.agentTriage.igpd.expectedValue.toLocaleString('tr-TR')} ₺ · {opp.agentTriage.igpd.recommendation}
                        </span>
                      )}
                      {opp.agentTriage.crm && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                          🤖 CRM: {opp.agentTriage.crm.recommendation}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                    {nextStage && opp.status !== 'WON' && opp.status !== 'LOST' && (
                      <button
                        onClick={() => onProgressStatus(opp, nextStage)}
                        className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <ArrowRight size={11} /> {STATUS_LABEL[nextStage]}
                      </button>
                    )}
                    {opp.status !== 'WON' && opp.status !== 'LOST' && (
                      <button
                        onClick={() => onMarkLost(opp)}
                        className="flex items-center gap-1 bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <XCircle size={11} /> Kaybedildi
                      </button>
                    )}
                    {opp.status === 'LOST' && (
                      <button
                        onClick={() => onProgressStatus(opp, 'NEW')}
                        className="flex items-center gap-1 bg-blue-50 text-blue-500 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <ArrowRight size={11} /> Yeniden Aç
                      </button>
                    )}
                    <button
                      onClick={() => onHandOff(opp)}
                      className="flex items-center gap-1 text-slate-400 hover:text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                    >
                      <GitBranch size={11} /> Aktar
                    </button>
                    <PermissionGate permission="CRM_EDIT">
                      <button
                        onClick={() => onEdit(opp)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                      >
                        <Edit2 size={11} /> Düzenle
                      </button>
                    </PermissionGate>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {filteredOpportunities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Target size={48} className="mb-4 opacity-20" />
          <p className="font-black text-sm uppercase tracking-widest">Henüz fırsat kaydı bulunmuyor</p>
        </div>
      )}
    </div>
  );
}
