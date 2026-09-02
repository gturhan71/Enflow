import { Fragment } from 'react';
import { Calendar, XCircle, ChevronRight, AlertTriangle } from 'lucide-react';
import { ContractWorkflow } from './types';
import { TABS, TabId, WORKFLOW_STATUS_STEPS, CANCEL_TERMINATE_ROLES } from './constants';
import { stepIndex, computeDeadlineAlarm } from './helpers';
import { fmtCurrency } from '../../lib/format';
import ProcessTriggerButton from '../../components/ProcessTriggerButton';

const ALARM_BANNER_STYLES: Record<'warning' | 'critical', string> = {
  warning: 'bg-amber-100 border-amber-200 text-amber-700',
  critical: 'bg-red-100 border-red-200 text-red-700',
};

export default function DetailHeader({
  selected, currency = 'TRY', currentUserRole, onCancelClick, tab, setTab,
}: {
  selected: ContractWorkflow;
  currency?: string;
  currentUserRole?: string;
  onCancelClick: () => void;
  tab: TabId;
  setTab: (t: TabId) => void;
}) {
  const alarm = computeDeadlineAlarm(selected);
  return (
    <div className="p-4 border-b border-slate-200/70">
      {alarm.level !== 'none' && (
        <div className={`mb-3 px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${ALARM_BANNER_STYLES[alarm.level]}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Esas: son sözleşme tarihine kadar tüm zorunlu evraklar tamamlanmalı — {alarm.label}.
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{selected.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {selected.contractValue > 0 && (
              <span className="text-sm text-emerald-600 font-medium">{fmtCurrency(selected.contractValue, currency)}</span>
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <ProcessTriggerButton entityType="CONTRACT_WORKFLOW_SIGNING" entityId={selected.id} />
          {currentUserRole && CANCEL_TERMINATE_ROLES.includes(currentUserRole) &&
            !['TRANSFERRED', 'CANCELLED', 'TERMINATED'].includes(selected.status) && (
            <button
              onClick={onCancelClick}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-100 text-red-700 hover:bg-red-200 transition-colors flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> {selected.status === 'SIGNED' ? 'Feshet' : 'İptal Et'}
            </button>
          )}
        </div>
        {/* Status progress */}
        <div className="hidden lg:flex items-center gap-1">
          {WORKFLOW_STATUS_STEPS.map((step, i) => {
            const current = stepIndex(selected.status);
            const done = i <= current;
            return (
              <Fragment key={step.key}>
                <div className={`text-xs px-2 py-1 rounded border transition-colors ${
                  done ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-slate-100/70 border-slate-200/70 text-slate-500'
                }`}>{step.label}</div>
                {i < WORKFLOW_STATUS_STEPS.length - 1 && (
                  <ChevronRight className={`w-3 h-3 ${done && i < current ? 'text-blue-600' : 'text-slate-600'}`} />
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
                ? 'bg-blue-100 border border-blue-200 text-blue-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100/70'
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
