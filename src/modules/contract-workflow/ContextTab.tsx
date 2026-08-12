import { CheckCircle2, Layers, Cpu, ChevronRight } from 'lucide-react';
import { Opportunity } from '../../types';
import { ContractWorkflow } from './types';

export default function ContextTab({
  selected, opportunities, onTenderNameBlur, onTenderNoBlur, onContractValueBlur, onDeadlineBlur, onNotesBlur, onGoToAnalysis,
}: {
  selected: ContractWorkflow;
  opportunities: Opportunity[];
  onTenderNameBlur: (value: string) => void;
  onTenderNoBlur: (value: string) => void;
  onContractValueBlur: (value: string) => void;
  onDeadlineBlur: (value: string) => void;
  onNotesBlur: (value: string) => void;
  onGoToAnalysis: () => void;
}) {
  return (
    <div className="space-y-5">

      {/* Fırsat bağlantısı */}
      {selected.opportunityId && (
        <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="font-medium">Kazanılan Fırsat:</span>{' '}
            {opportunities.find(o => o.id === selected.opportunityId)?.title || selected.opportunityId}
          </div>
        </div>
      )}

      {/* İhale bilgileri */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" /> İhale Bilgileri
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">İhale / Proje Adı</label>
            <input
              key={`tenderName-${selected.id}`}
              className="input-glass w-full text-sm"
              defaultValue={selected.tenderName || ''}
              placeholder="İdari şartnamenin resmi adı..."
              onBlur={e => onTenderNameBlur(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">İKN (İhale Kayıt No)</label>
            <input
              key={`tenderNo-${selected.id}`}
              className="input-glass w-full text-sm"
              defaultValue={selected.tenderNo || ''}
              placeholder="Örn: 2024/123456"
              onBlur={e => onTenderNoBlur(e.target.value.trim())}
            />
          </div>
        </div>
        {selected.projectName && (
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-purple-600" />
            AI çıkardı: <span className="text-purple-700 font-medium">{selected.projectName}</span>
          </div>
        )}
      </div>

      {/* Sözleşme bedeli ve tarih */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Sözleşme Bedeli (₺)</label>
          <input
            key={`val-${selected.id}`}
            className="input-glass w-full"
            type="number"
            defaultValue={selected.contractValue}
            onBlur={e => onContractValueBlur(e.target.value)}
          />
          {selected.contractValue > 0 && (
            <p className="text-xs text-emerald-600 mt-1">
              ₺{selected.contractValue.toLocaleString('tr-TR')} — kazanılan tekliften
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">İmza Son Tarihi</label>
          <input
            className="input-glass w-full"
            type="date"
            defaultValue={selected.deadline?.slice(0, 10)}
            onBlur={e => onDeadlineBlur(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Notlar</label>
        <textarea
          className="input-glass w-full h-20 resize-none"
          defaultValue={selected.notes || ''}
          placeholder="Sözleşme ile ilgili önemli notlar..."
          onBlur={e => onNotesBlur(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <button onClick={onGoToAnalysis} className="btn-primary flex items-center gap-2">
          Analize Geç <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
