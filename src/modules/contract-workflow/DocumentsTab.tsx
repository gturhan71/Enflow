import type { MutableRefObject } from 'react';
import {
  Shield, Plus, CheckSquare, Cpu, ExternalLink, CheckCircle2, ChevronDown, ChevronRight,
  Loader2, Upload, Trash2, Tag,
} from 'lucide-react';
import { ContractWorkflow } from './types';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS } from './constants';

export default function DocumentsTab({
  selected, expandedDoc, setExpandedDoc, uploadingDocId, fileInputRefs,
  onFileSelect, onAddDoc, onDeleteDoc, onDocStatusChange, onDocFieldUpdate, onMarkReadyAndSign,
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
}) {
  return (
    <div className="space-y-3">
      {/* Progress summary */}
      {selected.documents.length > 0 && (() => {
        const req = selected.documents.filter(d => d.isRequired);
        const uploaded = req.filter(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
        const pct = req.length > 0 ? Math.round((uploaded.length / req.length) * 100) : 0;
        const allUploaded = pct === 100;
        return (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Zorunlu belge yükleme</span>
                  <span className={allUploaded ? 'text-emerald-400' : 'text-slate-300'}>{uploaded.length}/{req.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${allUploaded ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className={`text-lg font-bold ${allUploaded ? 'text-emerald-400' : 'text-blue-400'}`}>{pct}%</span>
            </div>
            {allUploaded && selected.status !== 'READY_TO_SIGN' && selected.status !== 'SIGNED' && selected.status !== 'TRANSFERRED' && (
              <button
                onClick={onMarkReadyAndSign}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                <Shield className="w-4 h-4" /> Tüm belgeler yüklendi — İmzaya Hazır İşaretle
              </button>
            )}
          </div>
        );
      })()}

      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{selected.documents.length} belge</span>
        <button onClick={onAddDoc} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
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
            return (
              <div key={doc.id} className="border border-white/10 rounded-xl overflow-hidden bg-white/3">
                <div className="flex items-center gap-3 p-3">
                  <TypeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{doc.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">{DOC_TYPE_LABELS[doc.docType]?.label || doc.docType}</span>
                      {doc.isAiGenerated && (
                        <span className="text-xs text-purple-400 flex items-center gap-0.5">
                          <Cpu className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                      {doc.isRequired && <span className="text-xs text-red-400">Zorunlu</span>}
                      {hasFile && (
                        <a
                          href={doc.fileUrl!.startsWith('http') ? doc.fileUrl! : `http://localhost:3002${doc.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 max-w-[180px] truncate"
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
                      <span className="text-xs px-2 py-0.5 rounded border bg-slate-500/20 text-slate-400 border-slate-500/30">Muaf</span>
                    ) : doc.status === 'VERIFIED' ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Onaylandı
                      </span>
                    ) : hasFile ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <button
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                          disabled={isUploading}
                          className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                        >
                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Değiştir'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[doc.id]?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                      >
                        {isUploading
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...</>
                          : <><Upload className="w-3 h-3" /> Yükle</>
                        }
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
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
                  <div className="px-3 pb-3 border-t border-white/10 space-y-2 pt-3">
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
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
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
