import { useState, useCallback, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OpportunityRequiredDoc } from '../../types';
import { apiService } from '../../services/apiService';

// Fırsat oluşturulurken zorunlu 3 evrak (teknik şartname/idari şartname/sözleşme
// taslağı) — Presales bu evraklara göre ürün pozisyonlar. Fırsat evraksız da
// oluşturulabilir; Presales BoM girişine geçmeden önce backend bu 3 evrağın
// UPLOADED olmasını zorunlu kılar (bkz. opportunities.ts POST /:id/bom).
export default function OpportunityRequiredDocsPanel({
  opportunityId, defaultExpanded = false,
}: {
  opportunityId: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [docs, setDocs] = useState<OpportunityRequiredDoc[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiService.getOpportunityRequiredDocs(opportunityId);
      setDocs(d);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (defaultExpanded) load();
  }, [defaultExpanded, load]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && docs === null && !loading) load();
  };

  const uploadedCount = docs?.filter(d => d.status === 'UPLOADED').length ?? 0;
  const requiredCount = docs?.filter(d => d.isRequired).length ?? 3;
  const allRequiredUploaded = docs !== null && docs.filter(d => d.isRequired).every(d => d.status === 'UPLOADED');

  const handleFileChange = async (doc: OpportunityRequiredDoc, file: File) => {
    setUploadingId(doc.id);
    try {
      await apiService.uploadOpportunityRequiredDoc(opportunityId, doc.id, file);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Yükleme hatası.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleAddExtraDoc = async () => {
    if (!newDocName.trim()) return;
    setAddingDoc(true);
    try {
      await apiService.addOpportunityExtraDoc(opportunityId, newDocName.trim());
      setNewDocName('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Evrak eklenemedi.');
    } finally {
      setAddingDoc(false);
    }
  };

  const handleDeleteExtraDoc = async (doc: OpportunityRequiredDoc) => {
    try {
      await apiService.deleteOpportunityRequiredDoc(opportunityId, doc.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Evrak silinemedi.');
    }
  };

  return (
    <div className="border-t border-slate-100 pt-2 -mt-1">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all"
      >
        <FileText size={12} className={allRequiredUploaded ? 'text-emerald-500' : 'text-amber-500'} />
        <span className={cn(allRequiredUploaded ? 'text-emerald-600' : 'text-amber-600', 'hover:text-primary')}>
          Evraklar · {docs ? `${uploadedCount}/${requiredCount + (docs.length - requiredCount)}` : '…'} yüklendi
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading && !docs && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium py-1">
              <Loader2 size={12} className="animate-spin" /> Yükleniyor…
            </div>
          )}
          {docs?.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 bg-slate-50/60 rounded-xl px-3 py-1.5">
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 truncate">{doc.name}</span>
                {!doc.isRequired && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">Ek</span>}
                {doc.status === 'UPLOADED' ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 shrink-0">
                    <CheckCircle2 size={11} /> Yüklendi
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 shrink-0">Bekliyor</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline">
                    {doc.fileName || 'Dosya'}
                  </a>
                )}
                <label className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border border-slate-200 rounded-lg px-2 py-1">
                  {uploadingId === doc.id ? '...' : doc.status === 'UPLOADED' ? 'Değiştir' : 'Yükle'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingId === doc.id}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(doc, f); e.target.value = ''; }}
                  />
                </label>
                {!doc.isRequired && (
                  <button onClick={() => handleDeleteExtraDoc(doc)} className="text-slate-300 hover:text-red-500" title="Sil">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {docs && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Ek evrak adı…"
                className="flex-1 px-3 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg outline-none"
              />
              <button
                onClick={handleAddExtraDoc}
                disabled={!newDocName.trim() || addingDoc}
                className="flex items-center gap-1 text-[10px] font-black text-primary border border-primary/30 rounded-lg px-2 py-1.5 disabled:opacity-40 uppercase tracking-widest"
              >
                <Plus size={12} /> Ekle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
