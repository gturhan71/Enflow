import { Gavel } from 'lucide-react';
import { Opportunity, Proposal } from '../../types';

export default function ProposalSelectorHeader({
  openProposals, opportunities, selectedProposalId, disabled, onSelect,
}: {
  openProposals: Proposal[];
  opportunities: Opportunity[];
  selectedProposalId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="p-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
          <Gavel size={26} />
        </span>
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Canlı Pazarlık Kokpiti</h3>
          <p className="text-slate-500 font-medium text-xs mt-2">Müşteri fırsatları ve teknik maliyetler üzerinden akıllı, dip maliyet korumalı yapay pazarlık ve açık eksiltme simülatörü.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedProposalId}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-white border border-slate-100 px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none w-full sm:w-auto sm:min-w-[320px] transition-all cursor-pointer disabled:opacity-50"
        >
          <option value="">Pazarlığa Açık Tekliflerden Seçin</option>
          {openProposals.map(p => {
            const opp = opportunities.find(o => o.id === p.opportunityId);
            const oppTitle = opp ? opp.title : 'Bilinmeyen Fırsat';
            let priceVal = opp ? opp.value : 0;
            if (p.totalPrice) priceVal = p.totalPrice;
            else if (p.content) {
              try {
                const content = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
                priceVal = content.totalPrice || priceVal;
              } catch (e) {}
            }
            let currency = 'USD';
            if (p.content) {
              try {
                const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
                currency = c.currency || currency;
              } catch { /* ignore */ }
            }
            const currSym: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
            const sym = currSym[currency] || currency;
            return (
              <option key={p.id} value={p.id}>
                {oppTitle} — V{p.version} — {sym}{priceVal?.toLocaleString('tr-TR')}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
