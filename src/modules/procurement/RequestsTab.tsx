import type { FC, Dispatch, SetStateAction } from 'react';
import { Search, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { PurchaseRequest } from '../../types';
import { fmtCurrencyOrDash as formatCurrency } from '../../lib/format';
import { STATUS_CONFIG, URGENCY_CONFIG, SOURCE_LABEL, formatDate } from './constants';
import StatusBadge from './StatusBadge';

interface RequestsTabProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  loading: boolean;
  filtered: PurchaseRequest[];
  selectedPR: PurchaseRequest | null;
  setSelectedPR: Dispatch<SetStateAction<PurchaseRequest | null>>;
  onDelete: (id: string) => void;
}

const RequestsTab: FC<RequestsTabProps> = ({
  search, setSearch, filterStatus, setFilterStatus, loading, filtered, selectedPR, setSelectedPR, onDelete,
}) => (
  <div className="space-y-3">
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Talep ara…"
          className="input-glass w-full pl-9 pr-3 py-2 text-sm rounded-xl" />
      </div>
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        className="input-glass px-3 py-2 text-sm rounded-xl">
        <option value="">Tüm Durumlar</option>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>

    {loading ? (
      <div className="flex justify-center py-12 text-slate-400"><RefreshCw size={20} className="animate-spin" /></div>
    ) : filtered.length === 0 ? (
      <div className="text-center py-12 text-slate-400">
        <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Talep bulunamadı</p>
      </div>
    ) : (
      filtered.map(pr => (
        <div key={pr.id}
          onClick={() => setSelectedPR(prev => prev?.id === pr.id ? null : pr)}
          className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:border-indigo-500/40 ${selectedPR?.id === pr.id ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <StatusBadge status={pr.status} />
                <span className={`text-xs font-semibold ${URGENCY_CONFIG[pr.urgency].color}`}>{URGENCY_CONFIG[pr.urgency].label}</span>
                <span className="text-xs text-slate-500">{SOURCE_LABEL[pr.sourceType]}</span>
                {pr.poNumber && <span className="text-xs bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded-full font-medium">{pr.poNumber}</span>}
              </div>
              <h4 className="font-semibold text-sm truncate">{pr.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {pr.unitName && <span>{pr.unitName} · </span>}
                {pr.selectedVendorName && <span>Tedarikçi: {pr.selectedVendorName} · </span>}
                {formatDate(pr.createdAt)}
              </p>
            </div>
            <div className="text-right shrink-0">
              {pr.budgetAmountTRY && <p className="font-bold text-sm">{formatCurrency(pr.budgetAmountTRY, 'TRY')}</p>}
              <p className="text-xs text-slate-400 mt-0.5">{pr.items.length} kalem</p>
            </div>
          </div>
          {pr.status !== 'CLOSED' && pr.status !== 'REJECTED' && (
            <div className="mt-2 flex justify-end">
              <button onClick={e => { e.stopPropagation(); onDelete(pr.id); }}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                <Trash2 size={12} /> Sil
              </button>
            </div>
          )}
        </div>
      ))
    )}
  </div>
);

export default RequestsTab;
