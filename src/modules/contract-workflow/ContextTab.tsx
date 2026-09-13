import { CheckCircle2, Layers, Cpu, ChevronRight, Truck } from 'lucide-react';
import { Opportunity } from '../../types';
import { ContractWorkflow } from './types';
import DeliveryTimelinePanel from '../DeliveryTimelinePanel';

export default function ContextTab({
  selected, opportunities, onTenderNameBlur, onTenderNoBlur, onContractValueBlur, onDeadlineBlur, onNotesBlur, onGoToAnalysis, onDeliveryFieldsBlur,
}: {
  selected: ContractWorkflow;
  opportunities: Opportunity[];
  onTenderNameBlur: (value: string) => void;
  onTenderNoBlur: (value: string) => void;
  onContractValueBlur: (value: string) => void;
  onDeadlineBlur: (value: string) => void;
  onNotesBlur: (value: string) => void;
  onGoToAnalysis: () => void;
  onDeliveryFieldsBlur: (patch: Record<string, unknown>) => void;
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

      {/* Teslim süresi — sözleşmenin geçerlilik/hazırlık süresinden (yukarıdaki "İmza Son Tarihi")
          BAĞIMSIZ: imza gününden itibaren başlar, aşılması cezai şart doğurur. */}
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 space-y-3">
        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-3.5 h-3.5" /> Teslim Süresi ve Cezai Şart
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Teslim Süresi (gün, imza tarihinden itibaren)</label>
            <input
              key={`deliveryPeriodDays-${selected.id}`}
              className="input-glass w-full text-sm"
              type="number" min={0}
              defaultValue={selected.deliveryPeriodDays ?? ''}
              placeholder="Örn: 90"
              onBlur={e => onDeliveryFieldsBlur({ deliveryPeriodDays: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tahmini Teslim Tarihi</label>
            <input
              className="input-glass w-full text-sm bg-slate-50 text-slate-500"
              value={selected.deliveryDueDate ? new Date(selected.deliveryDueDate).toLocaleDateString('tr-TR') : '—'}
              disabled
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Cezai Şart Maddesi</label>
          <textarea
            key={`penaltyClauseText-${selected.id}`}
            className="input-glass w-full h-16 resize-none text-sm"
            defaultValue={selected.penaltyClauseText || ''}
            placeholder="Sözleşmedeki cezai şart maddesinin özeti..."
            onBlur={e => onDeliveryFieldsBlur({ penaltyClauseText: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Günlük Ceza Oranı (%)</label>
            <input
              key={`penaltyDailyRatePct-${selected.id}`}
              className="input-glass w-full text-sm"
              type="number" min={0} step={0.01}
              defaultValue={selected.penaltyDailyRatePct ?? ''}
              placeholder="Örn: 0.1"
              onBlur={e => onDeliveryFieldsBlur({ penaltyDailyRatePct: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Ceza Tavanı (%)</label>
            <input
              key={`penaltyCapPct-${selected.id}`}
              className="input-glass w-full text-sm"
              type="number" min={0} step={0.1}
              defaultValue={selected.penaltyCapPct ?? ''}
              placeholder="Örn: 10"
              onBlur={e => onDeliveryFieldsBlur({ penaltyCapPct: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>
        {selected.penaltyExposure && (
          <div className="p-2.5 rounded-lg bg-red-100 border border-red-300 text-xs text-red-700">
            <span className="font-semibold">Cezai Şart Riski:</span> {selected.penaltyExposure.overdueDays} gün gecikme —{' '}
            tahmini ceza ₺{selected.penaltyExposure.cappedPenalty.toLocaleString('tr-TR')}
            {selected.penaltyExposure.isCapped ? ' (tavana takıldı)' : ''}
          </div>
        )}
      </div>

      <DeliveryTimelinePanel steps={selected.deliveryTimeline} />

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
