import type { MutableRefObject } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, CheckSquare, Cpu, ExternalLink, CheckCircle2, ChevronDown, ChevronRight,
  Loader2, Upload, Trash2, Tag, Landmark, X, Paperclip,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../../services/apiService';
import { GuaranteeLetter } from '../../types';
import { sampleGuaranteeText, uploadGuaranteeSampleFile } from '../../lib/guaranteeText';
import { ContractWorkflow } from './types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from './constants';

const GTYPE_TR: Record<string, string> = { PERFORMANCE: 'Kesin Teminat', ADVANCE: 'Avans Teminatı', WARRANTY: 'Garanti Teminatı' };
const GSTATUS_TR: Record<string, string> = { REQUESTED: 'Talep Edildi', ACTIVE: 'Aktif', RELEASED: 'İade', EXPIRED: 'Süresi Doldu', CALLED: 'Nakde Çevrildi' };
const fmtAmount = (n: number, c: string) => `${n.toLocaleString('tr-TR')} ${c}`;

// Sözleşme evrakları hazırlanırken Finans'tan teminat mektubu talep edilebilir — gerekli
// bilgiler (tutar/süre/döviz/örnek metin) burada girilir, GuaranteeLetter kaydı contractId
// ile bu sözleşmeye bağlanarak Finans → Teminatlar ekranında otomatik görünür (talep bildirimi dahil).
function GuaranteeRequestSection({ selected }: { selected: ContractWorkflow }) {
  const [guarantees, setGuarantees] = useState<GuaranteeLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ type: 'PERFORMANCE', amount: '', currency: 'TRY', expiryDate: '', indefinite: false, requestNote: '', sampleText: '' });
  const [sampleFile, setSampleFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGuarantees((await apiService.getGuarantees({ contractId: selected.id })) as GuaranteeLetter[]); }
    finally { setLoading(false); }
  }, [selected.id]);
  useEffect(() => { load(); }, [load]);

  const workName = selected.tenderName || selected.title;
  const regen = (next: typeof f) => setF({ ...next, sampleText: sampleGuaranteeText(workName, selected.tenderNo, next.type, next.amount, next.currency, next.expiryDate, next.indefinite) });
  const openForm = () => { regen(f); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const created = await apiService.createGuarantee({
        type: f.type, contractId: selected.id, amount: parseFloat(f.amount) || 0, currency: f.currency,
        expiryDate: f.indefinite ? null : (f.expiryDate || null), isIndefinite: f.indefinite,
        status: 'REQUESTED', sampleText: f.sampleText || null, requestNote: f.requestNote || null,
      }) as GuaranteeLetter;
      // Örnek teminat mektubu dosyası eklendiyse, kayıt oluştuktan hemen sonra yüklenir —
      // Finans, banka ile teminat mektubunu düzenlerken metni doğrudan bu dosyadan alabilir.
      if (sampleFile) await uploadGuaranteeSampleFile(created.id, sampleFile);
      setShowForm(false);
      setF({ type: 'PERFORMANCE', amount: '', currency: 'TRY', expiryDate: '', indefinite: false, requestNote: '', sampleText: '' });
      setSampleFile(null);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/70 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-blue-600" /> Teminat Mektupları (Finans)
          {guarantees.length > 0 && <span className="text-slate-400 font-normal">— {guarantees.length} kayıt</span>}
        </span>
        <button onClick={openForm} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Finans'a Teminat Talebi
        </button>
      </div>

      {loading && <p className="text-xs text-slate-400 italic">Yükleniyor...</p>}
      {!loading && guarantees.length > 0 && (
        <div className="space-y-1.5">
          {guarantees.map(g => (
            <div key={g.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-700">{GTYPE_TR[g.type] || g.type} · {fmtAmount(g.amount, g.currency)}
                {g.isIndefinite ? ' · Süresiz' : g.expiryDate ? ` · Vade: ${new Date(g.expiryDate).toLocaleDateString('tr-TR')}` : ''}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {g.sampleFileUrl && (
                  <a
                    href={g.sampleFileUrl.startsWith('http') ? g.sampleFileUrl : `http://localhost:3002${g.sampleFileUrl}`}
                    target="_blank" rel="noreferrer" title="Örnek teminat mektubu dosyasını gör"
                    className="text-slate-400 hover:text-blue-600"
                    onClick={e => e.stopPropagation()}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </a>
                )}
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${g.status === 'REQUESTED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {GSTATUS_TR[g.status] || g.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Finans'a Teminat Mektubu Talebi</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-500">İş: <span className="font-medium text-slate-700">{workName}</span>{selected.tenderNo ? ` · İKN: ${selected.tenderNo}` : ''}</p>

              <select className="input-glass w-full text-sm" value={f.type} onChange={e => regen({ ...f, type: e.target.value })}>
                {Object.entries(GTYPE_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-glass text-sm" type="number" placeholder="Tutar" value={f.amount} onChange={e => regen({ ...f, amount: e.target.value })} />
                <select className="input-glass text-sm" value={f.currency} onChange={e => regen({ ...f, currency: e.target.value })}>
                  <option>TRY</option><option>USD</option><option>EUR</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={f.indefinite} onChange={e => regen({ ...f, indefinite: e.target.checked })} /> Süresiz teminat
              </label>
              {!f.indefinite && <>
                <label className="text-xs text-slate-500">Teminat süresi (geçerlilik sonu)</label>
                <input className="input-glass w-full text-sm" type="date" value={f.expiryDate} onChange={e => regen({ ...f, expiryDate: e.target.value })} />
              </>}
              <label className="text-xs text-slate-500">Teminat mektubu metni örneği (Finans düzenler)</label>
              <textarea className="input-glass w-full text-xs" rows={5} value={f.sampleText} onChange={e => setF({ ...f, sampleText: e.target.value })} />
              <label className="text-xs text-slate-500">Örnek teminat mektubu dosyası (opsiyonel — varsa Finans metni doğrudan bu dosyadan alır)</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 input-glass text-xs cursor-pointer text-slate-500 hover:text-slate-700">
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sampleFile ? sampleFile.name : 'Dosya seç (.pdf, .doc, .docx)'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={e => setSampleFile(e.target.files?.[0] || null)}
                  />
                </label>
                {sampleFile && (
                  <button onClick={() => setSampleFile(null)} className="text-slate-400 hover:text-red-500 shrink-0" title="Kaldır">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input className="input-glass w-full text-sm" placeholder="Talep notu (opsiyonel)" value={f.requestNote} onChange={e => setF({ ...f, requestNote: e.target.value })} />
              <button onClick={save} disabled={saving || !f.amount || (!f.indefinite && !f.expiryDate)} className="btn-primary w-full text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Finans'a Talep Gönder"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DocumentsTab({
  selected, expandedDoc, setExpandedDoc, uploadingDocId, fileInputRefs,
  onFileSelect, onAddDoc, onDeleteDoc, onDocStatusChange, onDocFieldUpdate, onMarkReadyAndSign, onFetchFromArchive,
}: {
  selected: ContractWorkflow;
  expandedDoc: string | null;
  setExpandedDoc: (id: string | null) => void;
  uploadingDocId: string | null;
  fileInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFileSelect: (docId: string, file: File) => void;
  onAddDoc: () => void;
  onDeleteDoc: (docId: string) => void;
  onDocStatusChange: (docId: string, status: string) => void;
  onDocFieldUpdate: (docId: string, field: string, value: string) => void;
  onMarkReadyAndSign: () => void;
  onFetchFromArchive: (docId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <GuaranteeRequestSection selected={selected} />

      {/* Progress summary */}
      {selected.documents.length > 0 && (() => {
        const req = selected.documents.filter(d => d.isRequired);
        const uploaded = req.filter(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
        const pct = req.length > 0 ? Math.round((uploaded.length / req.length) * 100) : 0;
        const allUploaded = pct === 100;
        return (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/70 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Zorunlu belge yükleme</span>
                  <span className={allUploaded ? 'text-emerald-600' : 'text-slate-500'}>{uploaded.length}/{req.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${allUploaded ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className={`text-lg font-bold ${allUploaded ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%</span>
            </div>
            {allUploaded && selected.status !== 'READY_TO_SIGN' && selected.status !== 'SIGNED' && selected.status !== 'TRANSFERRED' && (
              <button
                onClick={onMarkReadyAndSign}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-200 transition-colors"
              >
                <Shield className="w-4 h-4" /> Tüm belgeler yüklendi — İmzaya Hazır İşaretle
              </button>
            )}
          </div>
        );
      })()}

      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{selected.documents.length} belge</span>
        <button onClick={onAddDoc} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Manuel Ekle
        </button>
      </div>

      {selected.documents.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Henüz belge yok.</p>
          <p className="text-xs mt-1">Analiz sekmesinde AI ile belge listesini otomatik oluşturun.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selected.documents.map(doc => {
            const TypeIcon = DOC_TYPE_LABELS[doc.docType]?.icon || Tag;
            const isExpanded = expandedDoc === doc.id;
            const isUploading = uploadingDocId === doc.id;
            const hasFile = !!doc.fileUrl;
            const isFromArchive = !!doc.notes?.includes('arşivinden otomatik alındı');
            const isFirmCert = doc.docType?.toUpperCase() === 'FIRM_CERT';
            return (
              <div key={doc.id} className="border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50">
                <div className="flex items-center gap-3 p-3">
                  <TypeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 truncate">{doc.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">{DOC_TYPE_LABELS[doc.docType]?.label || doc.docType}</span>
                      {doc.isAiGenerated && (
                        <span className="text-xs text-purple-600 flex items-center gap-0.5">
                          <Cpu className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                      {doc.isRequired && <span className="text-xs text-red-600">Zorunlu</span>}
                      {isFromArchive && (
                        <span className="text-xs text-indigo-600 flex items-center gap-0.5">
                          <Landmark className="w-2.5 h-2.5" /> Arşivden
                        </span>
                      )}
                      {hasFile && (
                        <a
                          href={doc.fileUrl!.startsWith('http') ? doc.fileUrl! : `http://localhost:3002${doc.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 max-w-[180px] truncate"
                        >
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          {doc.fileUrl!.split('/').pop()}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: upload action or status badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.status === 'WAIVED' ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 text-slate-400 border-slate-300">Muaf</span>
                    ) : doc.status === 'VERIFIED' ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Onaylandı
                      </span>
                    ) : hasFile ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <button
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                          disabled={isUploading}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50"
                        >
                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Değiştir'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {isFirmCert && (
                          <button
                            onClick={() => onFetchFromArchive(doc.id)}
                            disabled={isUploading}
                            title="Şirket Evrakları arşivinden geçerli bir belge varsa otomatik bağlar"
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-100 border border-indigo-200 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                          >
                            {isUploading
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><Landmark className="w-3 h-3" /> Arşivden Getir</>
                            }
                          </button>
                        )}
                        <button
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-100 border border-amber-200 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                          {isUploading
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...</>
                            : <><Upload className="w-3 h-3" /> Yükle</>
                          }
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                      className="text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={el => { fileInputRefs.current[doc.id] = el; }}
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) onFileSelect(doc.id, file);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Expanded: status/date/notes/delete */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-200/70 space-y-2 pt-3">
                    {doc.description && <p className="text-xs text-slate-400">{doc.description}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Durum</label>
                        <select
                          className="input-glass w-full text-xs"
                          value={doc.status}
                          onChange={e => onDocStatusChange(doc.id, e.target.value)}
                        >
                          {Object.entries(DOC_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Son Tarih</label>
                        <input
                          className="input-glass w-full text-xs"
                          type="date"
                          defaultValue={doc.deadline?.slice(0, 10) || ''}
                          onBlur={e => onDocFieldUpdate(doc.id, 'deadline', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Notlar</label>
                      <input
                        className="input-glass w-full text-xs"
                        defaultValue={doc.notes || ''}
                        placeholder="Belge hakkında not..."
                        onBlur={e => onDocFieldUpdate(doc.id, 'notes', e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => onDeleteDoc(doc.id)}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
