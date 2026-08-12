import type { Dispatch, SetStateAction } from 'react';
import { FileText, Plus, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Opportunity, Proposal } from '../../types';
import { ContractWorkflow } from './types';
import { DOC_STATUS_STYLES, WORKFLOW_STATUS_STEPS, TERMINAL_STATUS_LABELS } from './constants';
import { bestProposalPrice, computeDeadlineAlarm } from './helpers';

const ALARM_STYLES: Record<'warning' | 'critical', string> = {
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
};

export interface WorkflowFormState {
  title: string; opportunityId: string; contractValue: string; deadline: string; notes: string; tenderName: string; tenderNo: string;
}

export default function WorkflowListPanel({
  form, setForm, opportunities, proposals, onCreate, loading, workflows, selectedId, onSelectWorkflow,
}: {
  form: WorkflowFormState;
  setForm: Dispatch<SetStateAction<WorkflowFormState>>;
  opportunities: Opportunity[];
  proposals: Proposal[];
  onCreate: () => void;
  loading: boolean;
  workflows: ContractWorkflow[];
  selectedId?: string;
  onSelectWorkflow: (wf: ContractWorkflow) => void;
}) {
  // Sözleşmeye hazır (fırsata bağlı, kazanılmış bir işi temsil eden) vs bilgi amaçlı
  // (fırsata bağlı olmayan, manuel/referans) kayıtlar ayrı değerlendirilir.
  const readyWorkflows = workflows.filter(w => !!w.opportunityId);
  const infoWorkflows = workflows.filter(w => !w.opportunityId);
  const readyAlarmCount = readyWorkflows.filter(w => computeDeadlineAlarm(w).level !== 'none').length;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-3">
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Sözleşme Süreçleri
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">TEST</span>
        </h2>

        {/* New workflow form */}
        <div className="space-y-2 mb-4 pb-4 border-b border-slate-200/70">
          <input
            className="input-glass w-full text-sm"
            placeholder="Sözleşme başlığı..."
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <select
            className="input-glass w-full text-sm"
            value={form.opportunityId}
            onChange={e => {
              const oppId = e.target.value;
              const price = oppId ? bestProposalPrice(oppId, proposals) : null;
              const opp = oppId ? opportunities.find(o => o.id === oppId) : null;
              setForm(f => ({
                ...f,
                opportunityId: oppId,
                ...(price !== null && { contractValue: String(price) }),
                // Fırsat seçilince başlık da otomatik önerilir — kullanıcı elle yazmak
                // zorunda kalmasın; henüz bir şey girilmemişse doldurulur, üzerine yazılmaz.
                ...(opp && !f.tenderName.trim() && !f.title.trim() && { title: opp.title }),
              }));
            }}
          >
            <option value="">Fırsat seçin (opsiyonel)</option>
            {opportunities.filter(o => o.status === 'WON').map(o => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
          <input
            className="input-glass w-full text-sm"
            placeholder="İhale adı (idari şartnamedeki resmi ad)..."
            value={form.tenderName}
            onChange={e => setForm(f => ({ ...f, tenderName: e.target.value }))}
          />
          <input
            className="input-glass w-full text-sm"
            placeholder="İKN (İhale Kayıt No) — örn: 2024/123456"
            value={form.tenderNo}
            onChange={e => setForm(f => ({ ...f, tenderNo: e.target.value }))}
          />
          <input
            className="input-glass w-full text-sm"
            placeholder="Sözleşme bedeli (₺, KDV hariç) — fırsat seçince kazanılan teklifin alt toplamından otomatik dolar"
            type="number"
            value={form.contractValue}
            onChange={e => setForm(f => ({ ...f, contractValue: e.target.value }))}
          />
          <input
            className="input-glass w-full text-sm"
            type="date"
            title="İmza son tarihi"
            value={form.deadline}
            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
          />
          <button
            onClick={onCreate}
            disabled={loading}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Yeni Süreç
          </button>
        </div>

        {/* Workflow list — kazanılan/sözleşmeye hazır işler (fırsata bağlı) ile
            bilgi amaçlı kayıtlar (fırsata bağlı olmayan) ayrı bölümlerde. */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-380px)]">
          {loading && workflows.length === 0 && (
            <div className="flex items-center justify-center py-4 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Yükleniyor...
            </div>
          )}
          {!loading && workflows.length === 0 && (
            <p className="text-xs text-slate-500 italic py-2">Henüz sözleşme süreci yok.</p>
          )}

          {readyWorkflows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <FileText className="w-3 h-3" /> Sözleşmeye Hazır İşler ({readyWorkflows.length})
                {readyAlarmCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-amber-700 normal-case font-semibold">
                    <AlertTriangle className="w-3 h-3" /> {readyAlarmCount} evrak eksik
                  </span>
                )}
              </div>
              {readyWorkflows.map(wf => (
                <WorkflowCard key={wf.id} wf={wf} selected={selectedId === wf.id} onSelect={() => onSelectWorkflow(wf)} />
              ))}
            </div>
          )}

          {infoWorkflows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-1 border-t border-slate-200/70">
                <Info className="w-3 h-3" /> Bilgi Amaçlı Kayıtlar ({infoWorkflows.length})
              </div>
              <p className="text-[10px] text-slate-500 -mt-1">Fırsata bağlı olmayan, kazanılmış bir işi temsil etmeyen kayıtlar.</p>
              {infoWorkflows.map(wf => (
                <WorkflowCard key={wf.id} wf={wf} selected={selectedId === wf.id} onSelect={() => onSelectWorkflow(wf)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ wf, selected, onSelect }: { wf: ContractWorkflow; selected: boolean; onSelect: () => void }) {
  const alarm = computeDeadlineAlarm(wf);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected ? 'border-blue-400 bg-blue-100' : 'border-slate-200/70 bg-slate-100/70 hover:border-slate-300'
      }`}
    >
      <div className="text-sm font-medium text-slate-700 truncate">{wf.title}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded border ${DOC_STATUS_STYLES[wf.status] || 'bg-slate-100 text-slate-400 border-slate-300'}`}>
          {WORKFLOW_STATUS_STEPS.find(s => s.key === wf.status)?.label || TERMINAL_STATUS_LABELS[wf.status] || wf.status}
        </span>
        <span className="text-xs text-slate-500">{wf.documents.length} belge</span>
      </div>
      {wf.contractValue > 0 && (
        <div className="text-xs text-emerald-600 mt-1">
          ₺{wf.contractValue.toLocaleString('tr-TR')}
        </div>
      )}
      {alarm.level !== 'none' && (
        <div className={`text-[10px] px-2 py-1 rounded border mt-1.5 flex items-center gap-1 font-semibold ${ALARM_STYLES[alarm.level]}`}>
          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {alarm.label}
        </div>
      )}
    </button>
  );
}
