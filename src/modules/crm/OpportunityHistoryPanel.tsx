import { useState } from 'react';
import { History, ChevronDown, ChevronUp, FileSignature, Calculator, Edit2, ArrowUpRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Opportunity, Proposal, CostAnalysisVersion } from '../../types';
import { apiService } from '../../services/apiService';
import { PROPOSAL_STATUS_LABEL, proposalStatusTone } from './constants';
import { getContentJson } from './helpers';

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const COST_STATUS_LABEL: Record<string, string> = { PENDING_APPROVAL: 'Onay Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };
const costStatusTone = (status: string) =>
  status === 'APPROVED' ? 'text-emerald-600' : status === 'REJECTED' ? 'text-red-500' : 'text-slate-500';

// Fırsat kartı — verilen tekliflere ve yapılan maliyet analizlerine kronolojik geçiş +
// düzenleme. Teklifler zaten her kayıtta ayrı versiyon (Proposal.version) olarak tutuluyor;
// maliyet analizi geçmişi ise backend CostAnalysisVersion snapshot'larından (lazy) çekilir.
export default function OpportunityHistoryPanel({
  opportunity, proposals, onEditProposal, onGoToCostAnalysis,
}: {
  opportunity: Opportunity;
  proposals: Proposal[];
  onEditProposal: (proposal: Proposal) => void;
  onGoToCostAnalysis: (opp: Opportunity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [costVersions, setCostVersions] = useState<CostAnalysisVersion[] | null>(null);
  const [loadingCostVersions, setLoadingCostVersions] = useState(false);

  const sortedProposals = [...proposals].sort((a, b) => (b.version || 0) - (a.version || 0));

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && costVersions === null && !loadingCostVersions) {
      setLoadingCostVersions(true);
      apiService.getCostAnalysisVersions(opportunity.id)
        .then((v) => setCostVersions(v as CostAnalysisVersion[]))
        .catch(() => setCostVersions([]))
        .finally(() => setLoadingCostVersions(false));
    }
  };

  return (
    <div className="border-t border-slate-100 pt-2 -mt-1">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-all"
      >
        <History size={12} />
        Geçmiş · {proposals.length} teklif · {costVersions ? `${costVersions.length} analiz` : '… analiz'}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {/* ── Teklifler ── */}
          <div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <FileSignature size={10} /> Teklifler
            </p>
            {sortedProposals.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-medium italic">Henüz teklif verilmedi.</p>
            ) : (
              <div className="space-y-1">
                {sortedProposals.map((p) => {
                  const c = getContentJson(p);
                  const price = (c.totalPrice as number | undefined) ?? p.totalPrice;
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-slate-50/60 rounded-xl px-3 py-1.5">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-600 shrink-0">v{p.version || 1}</span>
                        <span className={cn('text-[10px] font-bold shrink-0', proposalStatusTone(p.status))}>
                          {PROPOSAL_STATUS_LABEL[p.status] || p.status}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">{fmtDateTime(p.createdAt)}</span>
                        {price != null && <span className="text-[10px] font-black text-slate-700 shrink-0">{price.toLocaleString('tr-TR')}</span>}
                      </div>
                      <button
                        onClick={() => onEditProposal(p)}
                        title="Bu teklifi düzenle (yeni versiyon olarak kaydedilir)"
                        className="flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0 transition-all"
                      >
                        <Edit2 size={10} /> Düzenle
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Maliyet Analizleri ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Calculator size={10} /> Maliyet Analizleri
              </p>
              <button
                onClick={() => onGoToCostAnalysis(opportunity)}
                className="flex items-center gap-1 text-primary hover:underline text-[9px] font-black uppercase tracking-widest"
              >
                Güncel Analize Git <ArrowUpRight size={10} />
              </button>
            </div>
            {loadingCostVersions ? (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium py-1">
                <Loader2 size={12} className="animate-spin" /> Yükleniyor…
              </div>
            ) : !costVersions || costVersions.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-medium italic">Henüz maliyet analizi yapılmadı.</p>
            ) : (
              <div className="space-y-1">
                {costVersions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 bg-slate-50/60 rounded-xl px-3 py-1.5">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-600 shrink-0">v{v.version}</span>
                      <span className={cn('text-[10px] font-bold shrink-0', costStatusTone(v.status))}>
                        {COST_STATUS_LABEL[v.status] || v.status}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{fmtDateTime(v.createdAt)}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 shrink-0">
                      Marj %{v.marginPct.toFixed(1)} · {v.offer.toLocaleString('tr-TR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
