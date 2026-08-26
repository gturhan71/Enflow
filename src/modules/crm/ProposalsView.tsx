import { Building, DollarSign, ThumbsUp, ThumbsDown, Plus, Loader2, Download, Send, Package } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Opportunity, Customer, Proposal } from '../../types';
import { getContentJson } from './helpers';

export default function ProposalsView({
  opportunities, proposals, customers, loading, generatingPdfId,
  onCreateProposal, onWonOpportunity, onLostOpportunity, onEditProposal,
  onSendForApproval, onGeneratePdf, onMarkDelivered, onWonProposal, onLostProposal,
}: {
  opportunities: Opportunity[];
  proposals: Proposal[];
  customers: Customer[];
  loading: boolean;
  generatingPdfId: string | null;
  onCreateProposal: (opp: Opportunity) => void;
  onWonOpportunity: (opp: Opportunity) => void;
  onLostOpportunity: (opp: Opportunity) => void;
  onEditProposal: (proposal: Proposal) => void;
  onSendForApproval: (proposal: Proposal) => void;
  onGeneratePdf: (proposal: Proposal) => void;
  onMarkDelivered: (proposal: Proposal, delivered: boolean) => void;
  onWonProposal: (proposal: Proposal) => void;
  onLostProposal: (proposal: Proposal) => void;
}) {
  // Maliyet analizi tamamlanmış fırsatlar: Satış Müdürü'nün maliyet analizini
  // ONAYLAMASI (technicalStatus==='APPROVED') zorunlu — yalnız BoM/maliyet
  // kalemi varlığı yeterli değil, onaysız teklif oluşturma adımına geçilemez.
  // Sadece aktif (DRAFT/PENDING_APPROVAL/APPROVED/SENT) teklifi olmayan fırsatları göster;
  // REJECTED teklifi olan fırsatlar yeniden listeye girer.
  const readyForProposalOpps = opportunities.filter(opp => {
    const hasCostAnalysis = opp.technicalStatus === 'APPROVED';
    // Presales BoM onay teklifleri bloklucu sayılmaz;
    // sadece CRM'den oluşturulan gerçek müşteri teklifleri bloklucu.
    const isBoMApproval = (p: Proposal) => {
      try {
        const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
        const obj = c as Record<string, unknown>;
        return !!(
          obj?.isBomApproval ||
          (typeof obj?.description === 'string' && obj.description.startsWith('BoM bazlı'))
        );
      } catch { return false; }
    };
    // WON/LOST fırsatlar listede görünmemeli
    if (opp.status === 'WON' || opp.status === 'LOST') return false;
    const hasBlockingProposal = proposals.some(p =>
      p.opportunityId === opp.id &&
      ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(p.status) &&
      !isBoMApproval(p)
    );
    return hasCostAnalysis && !hasBlockingProposal;
  });

  // Aktif teklifler: ACCEPTED (kazanıldı) ve kaybedilen REJECTED'lar gösterilmez
  const activeProposals = [...proposals.filter(p => {
    if (p.status === 'SENT' || p.status === 'ACCEPTED') return false;
    if (p.status === 'REJECTED') {
      // Yönetici reddi → revize edilebilir, göster
      // Kaybedilen anlaşma → fırsat LOST → gizle
      const opp = opportunities.find(o => o.id === p.opportunityId);
      return opp?.status !== 'LOST';
    }
    return true;
  })].sort((a, b) => {
    if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
    if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
    return 0;
  });

  // Yollanan teklifler: WON veya LOST olan fırsatların teklifleri kaldırılır
  const sentProposals = proposals.filter(p => {
    if (p.status !== 'SENT') return false;
    const opp = opportunities.find(o => o.id === p.opportunityId);
    return opp?.status !== 'WON' && opp?.status !== 'LOST';
  });

  const statusLabel = (s: string) => {
    if (s === 'DRAFT') return 'TASLAK';
    if (s === 'PENDING_APPROVAL') return 'YÖNETİCİ ONAYINDA';
    if (s === 'REJECTED') return 'REDDEDİLDİ';
    if (s === 'APPROVED') return 'ONAYLANDI';
    if (s === 'ACCEPTED') return 'MÜŞTERİ KABUL';
    if (s === 'SENT') return 'GÖNDERİLDİ';
    return s;
  };
  const statusCls = (s: string) =>
    s === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
    s === 'REJECTED' ? 'bg-red-100 text-red-700' :
    s === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-700';

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-black">Teklifler</h3>
      </div>

      {/* Aktif Teklifler — teklif bekleyen fırsatlar + mevcut taslak/onay teklifleri */}
      {(readyForProposalOpps.length > 0 || activeProposals.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">
              Aktif Teklifler ({readyForProposalOpps.length + activeProposals.length})
            </h4>
          </div>
          <div className="space-y-4">
            {/* 1. Maliyet analizi tamamlanmış, teklif henüz oluşturulmamış fırsatlar */}
            {readyForProposalOpps.map(opp => {
              const cust = customers.find(c => c.id === opp.customerId);
              const currency = cust?.currency ?? 'TRY';
              const bomTotal = opp.bomItems && opp.bomItems.length > 0
                ? opp.bomItems.reduce((sum, item) => {
                    const sp = item.unitSalePrice
                      ?? ((item.purchaseCost ?? 0) * (1 + (item.marginPercentage ?? 0) / 100));
                    return sum + sp * (item.quantity ?? 1);
                  }, 0)
                : null;
              const displayTotal = bomTotal ?? opp.value;
              const hasRejectedProposal = proposals.some(
                p => p.opportunityId === opp.id && p.status === 'REJECTED'
              );
              return (
                <div
                  key={`ready-${opp.id}`}
                  className="glass-panel p-5 rounded-2xl border-l-4 border-emerald-400 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-800 text-sm truncate">{opp.title}</h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">
                        Teklif Bekliyor
                      </span>
                      {hasRejectedProposal && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 uppercase tracking-widest">
                          Önceki Reddedildi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                      {cust && <span className="flex items-center gap-1"><Building size={11} />{cust.name}</span>}
                      {displayTotal > 0 && (
                        <span className="flex items-center gap-1 font-black text-slate-700">
                          <DollarSign size={11} />
                          {Math.round(displayTotal).toLocaleString('tr-TR')} {currency}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onWonOpportunity(opp)}
                      disabled={loading}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      title="Teklif olmadan direkt kazanıldı işaretle"
                    >
                      <ThumbsUp size={12} />
                      Kazanıldı
                    </button>
                    <button
                      onClick={() => onLostOpportunity(opp)}
                      disabled={loading}
                      className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      title="Teklif olmadan direkt kaybedildi işaretle"
                    >
                      <ThumbsDown size={12} />
                      Kaybedildi
                    </button>
                    <button
                      onClick={() => onCreateProposal(opp)}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-primary/20"
                    >
                      <Plus size={13} />
                      Teklif Oluştur
                    </button>
                  </div>
                </div>
              );
            })}
            {activeProposals.map(proposal => {
              const opp = opportunities.find(o => o.id === proposal.opportunityId);
              const customer = opp ? customers.find(c => c.id === opp.customerId) : null;
              const currency = customer?.currency ?? 'TRY';
              const c = getContentJson(proposal);
              const totalPrice = (c.totalPrice as number | undefined) ?? proposal.totalPrice;
              // Revize edilecek teklif için bir önceki versiyonun tutarı+tarihi — PDF/teklife
              // çevirmeden önce kıyaslama yapılabilsin diye kartta gösterilir.
              const prevProposal = [...proposals]
                .filter(p => p.opportunityId === proposal.opportunityId && (p.version || 1) < (proposal.version || 1))
                .sort((a, b) => (b.version || 0) - (a.version || 0))[0];
              const prevTotalPrice = prevProposal
                ? ((getContentJson(prevProposal).totalPrice as number | undefined) ?? prevProposal.totalPrice)
                : undefined;
              return (
                <div key={proposal.id} className={cn(
                  "glass-panel p-6 rounded-2xl flex justify-between items-center",
                  proposal.status === 'APPROVED' && "border-l-4 border-emerald-400"
                )}>
                  <div>
                    <h4 className="font-bold">
                      {customer?.name || 'Bilinmeyen Müşteri'} · {opp?.title || 'Bilinmeyen İş'} · v{proposal.version || 1}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Durum:
                      <span className={cn("ml-2 font-black uppercase text-[10px] px-2 py-0.5 rounded-full", statusCls(proposal.status))}>
                        {statusLabel(proposal.status)}
                      </span>
                      {totalPrice != null && (
                        <span className="ml-3 font-black text-slate-700">
                          {Math.round(totalPrice).toLocaleString('tr-TR')} {currency}
                        </span>
                      )}
                    </p>
                    {prevProposal && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Önceki (v{prevProposal.version || 1} · {prevProposal.createdAt ? new Date(prevProposal.createdAt).toLocaleDateString('tr-TR') : '-'}):{' '}
                        {prevTotalPrice != null ? `${Math.round(prevTotalPrice).toLocaleString('tr-TR')} ${currency}` : '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(proposal.status === 'DRAFT' || proposal.status === 'REJECTED') && (
                      <button
                        onClick={() => onEditProposal(proposal)}
                        className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        {proposal.status === 'REJECTED' ? 'Revize Et' : 'Düzenle'}
                      </button>
                    )}
                    {proposal.status === 'DRAFT' && (
                      <button
                        onClick={() => onSendForApproval(proposal)}
                        className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
                      >
                        Onaya Gönder
                      </button>
                    )}
                    {proposal.status === 'APPROVED' && (
                      <button
                        disabled={generatingPdfId === proposal.id}
                        onClick={() => onGeneratePdf(proposal)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60"
                      >
                        {generatingPdfId === proposal.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Download size={14} />}
                        PDF Oluştur
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeProposals.length === 0 && sentProposals.length === 0 && readyForProposalOpps.length === 0 && (
        <p className="text-slate-400 font-bold text-sm">Henüz teklif bulunmuyor.</p>
      )}

      {/* Yollanan Teklifler */}
      {sentProposals.length > 0 && (
        <div>
          <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Send size={14} />
            Yollanan Teklifler ({sentProposals.length})
          </h4>
          <div className="space-y-3">
            {sentProposals.map(proposal => {
              const opp = opportunities.find(o => o.id === proposal.opportunityId);
              const cust = opp ? customers.find(c => c.id === opp.customerId) : null;
              const c = getContentJson(proposal);
              const pdfDateRaw = c.pdfGeneratedAt as string | undefined;
              const pdfDate = pdfDateRaw
                ? new Date(pdfDateRaw).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '-';
              const totalPrice = c.totalPrice as number | undefined;
              const currency = cust?.currency ?? 'TRY';
              const delivered = !!(c.deliveredToCustomer as boolean | undefined);
              return (
                <div key={proposal.id} className="glass-panel p-5 rounded-2xl border-l-4 border-blue-400">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm">
                        {cust?.name || 'Bilinmeyen Müşteri'} · {opp?.title || 'Bilinmeyen Fırsat'} · v{proposal.version || 1}
                      </h4>
                      <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Package size={11} />
                          PDF: {pdfDate}
                        </span>
                        {totalPrice != null && (
                          <span className="font-black text-slate-700">
                            {totalPrice.toLocaleString('tr-TR')} {currency}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0 flex-wrap justify-end">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          onClick={() => onMarkDelivered(proposal, !delivered)}
                          className={cn(
                            "relative w-10 h-5 rounded-full transition-colors cursor-pointer",
                            delivered ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                            delivered && "translate-x-5"
                          )} />
                        </div>
                        <span className={cn("text-xs font-black uppercase whitespace-nowrap", delivered ? "text-emerald-600" : "text-slate-400")}>
                          {delivered ? 'İletildi' : 'İletilmedi'}
                        </span>
                      </label>
                      <div className="w-px h-6 bg-slate-200" />
                      <button
                        onClick={() => onWonProposal(proposal)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm shadow-emerald-200"
                      >
                        <ThumbsUp size={12} />
                        Kazanıldı
                      </button>
                      <button
                        onClick={() => onLostProposal(proposal)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                        <ThumbsDown size={12} />
                        Kaybedildi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
