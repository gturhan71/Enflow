import type { Dispatch, SetStateAction } from 'react';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { Opportunity, Proposal } from '../../types';
import { ContractWorkflow } from './types';
import { DOC_STATUS_STYLES, WORKFLOW_STATUS_STEPS, TERMINAL_STATUS_LABELS } from './constants';
import { bestProposalPrice } from './helpers';

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
  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-3">
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          Sözleşme Süreçleri
          <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">TEST</span>
        </h2>

        {/* New workflow form */}
        <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
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
              setForm(f => ({
                ...f,
                opportunityId: oppId,
                ...(price !== null && { contractValue: String(price) }),
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
            placeholder="Sözleşme bedeli (₺) — fırsat seçince otomatik dolar"
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

        {/* Workflow list */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-380px)]">
          {loading && workflows.length === 0 && (
            <div className="flex items-center justify-center py-4 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Yükleniyor...
            </div>
          )}
          {workflows.map(wf => (
            <button
              key={wf.id}
              onClick={() => onSelectWorkflow(wf)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedId === wf.id
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="text-sm font-medium text-slate-200 truncate">{wf.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded border ${DOC_STATUS_STYLES[wf.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                  {WORKFLOW_STATUS_STEPS.find(s => s.key === wf.status)?.label || TERMINAL_STATUS_LABELS[wf.status] || wf.status}
                </span>
                <span className="text-xs text-slate-500">{wf.documents.length} belge</span>
              </div>
              {wf.contractValue > 0 && (
                <div className="text-xs text-emerald-400 mt-1">
                  ₺{wf.contractValue.toLocaleString('tr-TR')}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
