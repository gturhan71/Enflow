import { useState, useCallback } from 'react';
import { Folder, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OpportunityDocumentRow } from '../../types';
import { apiService } from '../../services/apiService';

const SOURCE_TONE: Record<string, string> = {
  'Fırsat Evrakı': 'text-indigo-700 bg-indigo-50 border-indigo-100',
  'Sözleşme': 'text-emerald-700 bg-emerald-50 border-emerald-100',
  'İhale': 'text-amber-700 bg-amber-50 border-amber-100',
  'BoM Teklifi': 'text-sky-700 bg-sky-50 border-sky-100',
  'Proje Devir': 'text-purple-700 bg-purple-50 border-purple-100',
  'Teminat': 'text-rose-700 bg-rose-50 border-rose-100',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });

// Fırsat→Proje boyunca üretilen tüm dökümanların (zorunlu evrak, sözleşme, ihale,
// BoM teklifi, proje devir, teminat) tek listede görünümü — dosyalar farklı
// modüllerde dağınık olsa da Fırsat detayından hepsine buradan ulaşılır.
export default function OpportunityDocumentsPanel({ opportunityId }: { opportunityId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<OpportunityDocumentRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiService.getOpportunityDocuments(opportunityId);
      setRows(d);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && rows === null && !loading) load();
  };

  return (
    <div className="border-t border-slate-100 pt-2 -mt-1">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest transition-all"
      >
        <Folder size={12} />
        Tüm Dökümanlar {rows ? `· ${rows.length}` : ''}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5">
          {loading && !rows && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium py-1">
              <Loader2 size={12} className="animate-spin" /> Yükleniyor…
            </div>
          )}
          {rows?.length === 0 && (
            <p className="text-[11px] text-slate-400 font-medium italic">Henüz döküman yok.</p>
          )}
          {rows?.map((r) => (
            <div key={`${r.source}-${r.id}`} className="flex items-center justify-between gap-2 bg-slate-50/60 rounded-xl px-3 py-1.5">
              <div className="min-w-0 flex items-center gap-2">
                <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0', SOURCE_TONE[r.source] || 'text-slate-600 bg-slate-100 border-slate-200')}>
                  {r.source}
                </span>
                <span className="text-[11px] font-bold text-slate-700 truncate">{r.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(r.updatedAt)}</span>
              </div>
              {r.fileUrl && (
                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline shrink-0">
                  Görüntüle
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
