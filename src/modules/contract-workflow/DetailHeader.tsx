import { Fragment } from 'react';
import { Calendar, XCircle, ChevronRight } from 'lucide-react';
import { ContractWorkflow } from './types';
import { TABS, TabId, WORKFLOW_STATUS_STEPS, CANCEL_TERMINATE_ROLES } from './constants';
import { stepIndex } from './helpers';

export default function DetailHeader({
  selected, currentUserRole, onCancelClick, tab, setTab,
}: {
  selected: ContractWorkflow;
  currentUserRole?: string;
  onCancelClick: () => void;
  tab: TabId;
  setTab: (t: TabId) => void;
}) {
  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{selected.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {selected.contractValue > 0 && (
              <span className="text-sm text-emerald-400 font-medium">₺{selected.contractValue.toLocaleString('tr-TR')}</span>
            )}
            {selected.deadline && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Son: {new Date(selected.deadline).toLocaleDateString('tr-TR')}
              </span>
            )}
          </div>
        </div>
        {/* İptal / Fesih (B-01+B-14) */}
        {currentUserRole && CANCEL_TERMINATE_ROLES.includes(currentUserRole) &&
          !['TRANSFERRED', 'CANCELLED', 'TERMINATED'].includes(selected.status) && (
          <button
            onClick={onCancelClick}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <XCircle className="w-3.5 h-3.5" /> {selected.status === 'SIGNED' ? 'Feshet' : 'İptal Et'}
          </button>
        )}
        {/* Status progress */}
        <div className="hidden lg:flex items-center gap-1">
          {WORKFLOW_STATUS_STEPS.map((step, i) => {
            const current = stepIndex(selected.status);
            const done = i <= current;
            return (
              <Fragment key={step.key}>
                <div className={`text-xs px-2 py-1 rounded border transition-colors ${
                  done ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-500'
                }`}>{step.label}</div>
                {i < WORKFLOW_STATUS_STEPS.length - 1 && (
                  <ChevronRight className={`w-3 h-3 ${done && i < current ? 'text-blue-400' : 'text-slate-600'}`} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              tab === t.id
                ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
