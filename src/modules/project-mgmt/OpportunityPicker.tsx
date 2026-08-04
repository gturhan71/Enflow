import { useState, type FC } from 'react';
import { Search, X, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Opportunity } from '../../types';
import { fmtCurrencyExact as fmt } from '../../lib/format';

interface OpportunityPickerProps {
  opportunities: Opportunity[];
  existingProjectOppIds: Set<string>;
  onSelect: (opp: Opportunity) => void;
  onBlank: () => void;
  onClose: () => void;
}

const OpportunityPicker: FC<OpportunityPickerProps> = ({ opportunities, existingProjectOppIds, onSelect, onBlank, onClose }) => {
  const [search, setSearch] = useState('');
  const won = opportunities.filter(o =>
    o.status === 'WON' && !existingProjectOppIds.has(o.id) &&
    (!search || o.title.toLowerCase().includes(search.toLowerCase()) || o.customer?.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-lg font-bold">Kazanılan Teklif Seç</h4>
            <p className="text-xs text-slate-400 mt-0.5">Proje olarak açmak istediğiniz fırsatı seçin</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara…"
              className="input-glass w-full pl-8 pr-3 py-2 text-sm rounded-xl" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {won.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {search ? 'Eşleşen fırsat yok.' : 'Henüz projeye dönüştürülmemiş kazanılmış fırsat yok.'}
            </div>
          ) : won.map(opp => (
            <button key={opp.id} onClick={() => onSelect(opp)}
              className="w-full text-left glass-card rounded-xl p-3 hover:border-indigo-500/40 transition-all group">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold group-hover:text-indigo-300 transition-colors truncate">{opp.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {opp.customer?.name ?? '—'}
                    {opp.value ? ` · ${fmt(opp.value)}` : ''}
                  </p>
                </div>
                <ChevronRight size={14} className="text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/10 shrink-0">
          <button onClick={onBlank} className="w-full btn-secondary py-2 text-sm rounded-xl flex items-center justify-center gap-2">
            <Plus size={14} /> Fırsatsız Boş Proje Aç
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OpportunityPicker;
