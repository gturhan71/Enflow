import { useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { Customer } from '../types';
import { normalizeCompanyName, similarityRatio, DUPLICATE_SIMILARITY_THRESHOLD } from '../utils/textSimilarity';

// Bellek-içi (ağ çağrısı yok — useCustomers zaten tam listeyi tutuyor) canlı
// müşteri önerisi. İki mod:
// - mükerrer-öneri (parentOnly=false): dıştan gelen `query` (isim alanı) ile
//   benzerlik-eşiği üzerinden en fazla 5 eşleşme gösterir.
// - üst-müşteri seçici (parentOnly=true): kendi arama kutusuna sahiptir, boşken
//   tüm en-üst-seviye müşterileri listeler (benzerlik eşiği aranmaz — göz atma).
export default function CustomerCombobox({
  customers, query, onPick, excludeId, parentOnly = false, actionLabel = 'Şube olarak ekle',
}: {
  customers: Customer[];
  query: string;
  onPick: (customer: Customer) => void;
  excludeId?: string;
  parentOnly?: boolean;
  actionLabel?: string;
}) {
  const [browseQuery, setBrowseQuery] = useState('');

  const matches = useMemo(() => {
    const pool = customers.filter((c) => c.id !== excludeId && (!parentOnly || !c.parentId));

    if (parentOnly) {
      const q = browseQuery.trim().toLowerCase();
      return pool
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
        .slice(0, 20)
        .map((c) => ({ customer: c, similarity: null as number | null }));
    }

    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const normalizedQuery = normalizeCompanyName(q);
    return pool
      .map((c) => ({ customer: c, similarity: similarityRatio(normalizedQuery, normalizeCompanyName(c.name)) }))
      .filter((m) => (m.similarity as number) >= DUPLICATE_SIMILARITY_THRESHOLD)
      .sort((a, b) => (b.similarity as number) - (a.similarity as number))
      .slice(0, 5);
  }, [customers, query, excludeId, parentOnly, browseQuery]);

  if (!parentOnly && matches.length === 0) return null;

  return (
    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
      {parentOnly ? (
        <div className="relative px-3 pt-3">
          <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
            placeholder="Üst müşteri ara..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      ) : (
        <p className="px-4 pt-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Benzer müşteri kayıtları
        </p>
      )}
      <div className="max-h-56 overflow-y-auto custom-scrollbar mt-2">
        {matches.length === 0 ? (
          <p className="px-4 py-3 text-xs text-slate-400">Eşleşme bulunamadı.</p>
        ) : matches.map(({ customer, similarity }) => (
          <div key={customer.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 size={14} className="text-slate-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{customer.name}</p>
                {similarity !== null && (
                  <p className="text-[10px] text-slate-400 font-medium">%{Math.round(similarity * 100)} benzer</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPick(customer)}
              className="shrink-0 text-[10px] font-black text-primary uppercase tracking-widest px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
            >
              {parentOnly ? 'Seç' : actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
