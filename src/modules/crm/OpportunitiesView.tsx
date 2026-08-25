import { Fragment, useMemo, useState } from 'react';
import { Plus, ArrowRight, Building, FileSignature, XCircle, GitBranch, Edit2, Target, Calendar, Printer, X, ClipboardCheck, LayoutGrid, Table2, Download } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { Opportunity, Customer, Proposal } from '../../types';
import { SaveButton } from '../../components/SaveButton';
import { PermissionGate } from '../../components/PermissionGate';
import { PIPELINE_STAGES, STATUS_LABEL, getStatusStyle, PROPOSAL_STATUS_LABEL, proposalStatusTone } from './constants';
import OpportunityHistoryPanel from './OpportunityHistoryPanel';
import OpportunityRequiredDocsPanel from './OpportunityRequiredDocsPanel';
import OpportunityDocumentsPanel from './OpportunityDocumentsPanel';
import { printReportWindow, esc } from '../reporting/helpers';
import { dleftBadge } from '../dashboard/helpers';

const PROGRESS_CHECKIN_INTERVAL_DAYS = 14; // tenant ayarıyla senkron varsayılan — bkz. opportunityProgressService.ts
const daysSinceCheckIn = (opp: Opportunity) => {
  const baseline = opp.lastProgressCheckAt || opp.createdAt;
  if (!baseline) return null;
  return Math.floor((Date.now() - new Date(baseline).getTime()) / 86_400_000);
};

const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const isoDaysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const isoToday = () => new Date().toISOString().slice(0, 10);
const fmtShortDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;

export default function OpportunitiesView({
  filteredOpportunities, customers, proposals, loading, onSaveAll, onNewOpportunity,
  onProgressStatus, onMarkLost, onHandOff, onEdit, onCheckIn, onEditProposal, onGoToCostAnalysis,
}: {
  filteredOpportunities: Opportunity[];
  customers: Customer[];
  proposals: Proposal[];
  loading: boolean;
  onSaveAll: () => void;
  onNewOpportunity: () => void;
  onProgressStatus: (opp: Opportunity, toStatus: Opportunity['status']) => void;
  onMarkLost: (opp: Opportunity) => void;
  onHandOff: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
  onCheckIn: (opp: Opportunity) => void;
  onEditProposal: (proposal: Proposal) => void;
  onGoToCostAnalysis: (opp: Opportunity) => void;
}) {
  // Açılış (createdAt — otomatik/mühürlenmiş) ve muhtemel kapanış (expectedCloseDate —
  // bilgi amaçlı) tarihlerine göre arama/listeleme + 30/60/90 günlük periyot raporu.
  const [openFrom, setOpenFrom] = useState('');
  const [openTo, setOpenTo] = useState('');
  const [closeFrom, setCloseFrom] = useState('');
  const [closeTo, setCloseTo] = useState('');
  const dateFilterActive = !!(openFrom || openTo || closeFrom || closeTo);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const dateFilteredOpportunities = useMemo(() => {
    if (!dateFilterActive) return filteredOpportunities;
    return filteredOpportunities.filter(opp => {
      const openedAt = opp.createdAt?.slice(0, 10);
      if (openFrom && (!openedAt || openedAt < openFrom)) return false;
      if (openTo && (!openedAt || openedAt > openTo)) return false;
      const closesAt = opp.expectedCloseDate?.slice(0, 10);
      if (closeFrom && (!closesAt || closesAt < closeFrom)) return false;
      if (closeTo && (!closesAt || closesAt > closeTo)) return false;
      return true;
    });
  }, [filteredOpportunities, dateFilterActive, openFrom, openTo, closeFrom, closeTo]);

  const dateReportSummary = useMemo(() => {
    const list = dateFilteredOpportunities;
    const totalValue = list.reduce((s, o) => s + (o.value || 0), 0);
    const avgProbability = list.length ? Math.round(list.reduce((s, o) => s + (o.probability || 0), 0) / list.length) : 0;
    return { count: list.length, totalValue, avgProbability };
  }, [dateFilteredOpportunities]);

  const handlePrintDateReport = () => {
    const rows = dateFilteredOpportunities.map(o => {
      const c = customers.find(cc => cc.id === o.customerId);
      return `<tr><td>${esc(o.title)}</td><td>${esc(c?.name || '-')}</td><td>${esc(STATUS_LABEL[o.status] || o.status)}</td>` +
        `<td>${fmtShortDate(o.createdAt) || '-'}</td><td>${fmtShortDate(o.expectedCloseDate) || '-'}</td>` +
        `<td style="text-align:right">${(o.value || 0).toLocaleString('tr-TR')}</td></tr>`;
    }).join('');
    const rangeParts = [
      (openFrom || openTo) ? `Açılış: ${openFrom || '—'} → ${openTo || '—'}` : '',
      (closeFrom || closeTo) ? `Beklenen Kapanış: ${closeFrom || '—'} → ${closeTo || '—'}` : '',
    ].filter(Boolean).join(' · ');
    const body = `<h1>Fırsat Açılış / Kapanış Raporu</h1>` +
      (rangeParts ? `<p class="muted">${esc(rangeParts)}</p>` : '') +
      `<p class="muted">${dateReportSummary.count} fırsat · Toplam ${dateReportSummary.totalValue.toLocaleString('tr-TR')} ₺ · Ort. olasılık %${dateReportSummary.avgProbability}</p>` +
      `<table><thead><tr><th>Fırsat</th><th>Müşteri</th><th>Aşama</th><th>Açılış</th><th>Beklenen Kapanış</th><th>Değer</th></tr></thead><tbody>${rows}</tbody></table>`;
    printReportWindow('Fırsat Açılış-Kapanış Raporu', body);
  };

  const handleExportXlsx = () => {
    const rows = dateFilteredOpportunities.map(o => {
      const c = customers.find(cc => cc.id === o.customerId);
      return {
        Fırsat: o.title,
        Müşteri: c?.name || '—',
        Aşama: STATUS_LABEL[o.status] || o.status,
        Değer: o.value || 0,
        'Olasılık (%)': o.probability || 0,
        Açılış: fmtShortDate(o.createdAt) || '—',
        'Beklenen Kapanış': fmtShortDate(o.expectedCloseDate) || '—',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Fırsatlar');
    XLSX.writeFile(wb, `Firsatlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Group by status for pipeline view
  const grouped: Partial<Record<Opportunity['status'], Opportunity[]>> = {};
  for (const stage of PIPELINE_STAGES) grouped[stage] = [];
  grouped['LOST'] = [];
  for (const opp of dateFilteredOpportunities) {
    (grouped[opp.status] ?? []).push(opp);
  }

  const stageColors: Record<string, string> = {
    NEW: 'border-t-blue-400', CONTACTED: 'border-t-sky-400',
    QUALIFIED: 'border-t-primary', PROPOSAL: 'border-t-amber-400',
    NEGOTIATION: 'border-t-purple-400', WON: 'border-t-emerald-500', LOST: 'border-t-red-400',
  };

  const allStages: Opportunity['status'][] = [...PIPELINE_STAGES, 'LOST'];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Satış Boru Hattı</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">
            {dateFilteredOpportunities.length} fırsat{dateFilterActive ? ` (${filteredOpportunities.length} toplam içinden)` : ''} · {dateFilteredOpportunities.filter(o => o.status !== 'LOST' && o.status !== 'WON' && o.status !== 'WITHDRAWN').length} aktif
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('card')}
              title="Kart görünümü"
              className={cn("p-2 rounded-lg transition-all", viewMode === 'card' ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Tablo görünümü"
              className={cn("p-2 rounded-lg transition-all", viewMode === 'table' ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600")}
            >
              <Table2 size={16} />
            </button>
          </div>
          <button
            onClick={handleExportXlsx}
            title="Excel'e Aktar (.xlsx)"
            className="flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-emerald-500/10 hover:text-emerald-600 px-4 py-3 rounded-xl text-xs font-black transition-all"
          >
            <Download size={15} /> Excel'e Aktar
          </button>
          <SaveButton onClick={onSaveAll} loading={loading} />
          <PermissionGate permission="CRM_EDIT">
            <button
              onClick={onNewOpportunity}
              className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all"
            >
              <Plus size={18} /> Yeni Fırsat
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Açılış / Beklenen Kapanış Tarihi Filtresi + 30/60/90 Günlük Rapor ── */}
      <div className="glass-panel rounded-[28px] p-5">
        <div className="flex flex-wrap items-start gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={11} /> Açılış Tarihi</label>
            <div className="flex items-center gap-2">
              <input type="date" value={openFrom} onChange={e => setOpenFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary" />
              <span className="text-slate-300 text-xs">–</span>
              <input type="date" value={openTo} onChange={e => setOpenTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => { setOpenFrom(isoDaysAgo(d)); setOpenTo(isoToday()); }}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all">
                  Son {d} Gün
                </button>
              ))}
              {(openFrom || openTo) && (
                <button onClick={() => { setOpenFrom(''); setOpenTo(''); }} className="p-1 text-slate-300 hover:text-red-500" title="Temizle"><X size={13} /></button>
              )}
            </div>
          </div>

          <div className="w-px h-16 bg-slate-100 hidden sm:block" />

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={11} /> Beklenen Kapanış</label>
            <div className="flex items-center gap-2">
              <input type="date" value={closeFrom} onChange={e => setCloseFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary" />
              <span className="text-slate-300 text-xs">–</span>
              <input type="date" value={closeTo} onChange={e => setCloseTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => { setCloseFrom(isoToday()); setCloseTo(isoDaysAhead(d)); }}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all">
                  Önümüzdeki {d} Gün
                </button>
              ))}
              {(closeFrom || closeTo) && (
                <button onClick={() => { setCloseFrom(''); setCloseTo(''); }} className="p-1 text-slate-300 hover:text-red-500" title="Temizle"><X size={13} /></button>
              )}
            </div>
          </div>
        </div>

        {dateFilterActive && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500">
              <span className="text-slate-900 font-black">{dateReportSummary.count}</span> fırsat ·
              {' '}Toplam <span className="text-slate-900 font-black">{dateReportSummary.totalValue.toLocaleString('tr-TR')} ₺</span> ·
              {' '}Ort. olasılık <span className="text-slate-900 font-black">%{dateReportSummary.avgProbability}</span>
            </p>
            <button onClick={handlePrintDateReport}
              className="flex items-center gap-1.5 text-primary hover:underline text-[11px] font-black uppercase tracking-widest">
              <Printer size={13} /> Rapor Yazdır
            </button>
          </div>
        )}
      </div>

      {viewMode === 'card' && <>
      {/* Pipeline Progress Bar */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {PIPELINE_STAGES.filter(s => s !== 'WON').map((stage, idx) => {
          const count = (grouped[stage] ?? []).length;
          const isActive = count > 0;
          return (
            <Fragment key={stage}>
              <div className={cn(
                "flex-1 min-w-[80px] text-center py-2 px-3 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                isActive ? getStatusStyle(stage) : 'text-slate-300 bg-slate-50'
              )}>
                {STATUS_LABEL[stage]}
                <span className="ml-1 opacity-70">({count})</span>
              </div>
              {idx < PIPELINE_STAGES.filter(s => s !== 'WON').length - 1 && (
                <ArrowRight size={12} className="text-slate-300 shrink-0 mx-0.5" />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Cards grouped by stage */}
      {allStages.filter(stage => (grouped[stage] ?? []).length > 0).map(stage => (
        <div key={stage}>
          <div className="flex items-center gap-3 mb-4">
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", getStatusStyle(stage))}>
              {STATUS_LABEL[stage]}
            </span>
            <span className="text-xs text-slate-400 font-bold">{(grouped[stage] ?? []).length} fırsat</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(grouped[stage] ?? []).map(opp => {
              const customer = customers.find(c => c.id === opp.customerId);
              const oppProposals = proposals.filter(p => p.opportunityId === opp.id);
              const latestProposal = oppProposals.length > 0
                ? [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0]
                : null;
              const stageIdx = PIPELINE_STAGES.indexOf(opp.status);
              const nextStage = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1
                ? PIPELINE_STAGES[stageIdx + 1]
                : null;
              return (
                <motion.div
                  layout key={opp.id}
                  className={cn("glass-panel p-6 rounded-[24px] border-t-4 flex flex-col gap-4 hover:shadow-xl transition-all", stageColors[opp.status] || 'border-t-slate-200')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="font-black text-slate-900 text-sm leading-snug truncate">{opp.title}</h5>
                      {opp.trackingCode && (
                        <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{opp.trackingCode}</p>
                      )}
                      {customer && (
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                          <Building size={10} />{customer.name}
                        </p>
                      )}
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border shrink-0", getStatusStyle(opp.status))}>
                      {STATUS_LABEL[opp.status]}
                    </span>
                  </div>

                  {(opp.createdAt || opp.expectedCloseDate) && (
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold -mt-2">
                      {opp.createdAt && <span className="flex items-center gap-1"><Calendar size={10} /> Açılış {fmtShortDate(opp.createdAt)}</span>}
                      {opp.expectedCloseDate && <span className="flex items-center gap-1"><Calendar size={10} /> Kapanış {fmtShortDate(opp.expectedCloseDate)}</span>}
                    </div>
                  )}

                  {opp.value > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Değer</span>
                      <span className="font-black text-slate-800">{opp.value.toLocaleString('tr-TR')} {opp.currency || customer?.currency || ''}</span>
                    </div>
                  )}

                  {opp.probability > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>Olasılık</span><span>{opp.probability}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${opp.probability}%` }} />
                      </div>
                    </div>
                  )}

                  {!['WON', 'LOST', 'WITHDRAWN'].includes(opp.status) && (() => {
                    const daysSince = daysSinceCheckIn(opp);
                    const daysLeft = daysSince == null ? null : PROGRESS_CHECKIN_INTERVAL_DAYS - daysSince;
                    const badge = dleftBadge(daysLeft);
                    return (
                      <div className={cn("flex items-center gap-1 text-[10px] font-bold", badge.c)}>
                        <ClipboardCheck size={11} />
                        {daysLeft != null && daysLeft < 0 ? 'İlerleme teyidi gecikti' : `İlerleme teyidine ${badge.t}`}
                      </div>
                    );
                  })()}

                  {latestProposal && (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold">
                      <FileSignature size={11} />
                      Teklif v{latestProposal.version} ·{' '}
                      <span className={cn("font-black", proposalStatusTone(latestProposal.status))}>
                        {PROPOSAL_STATUS_LABEL[latestProposal.status] || latestProposal.status}
                      </span>
                    </div>
                  )}

                  <OpportunityHistoryPanel
                    opportunity={opp}
                    proposals={oppProposals}
                    onEditProposal={onEditProposal}
                    onGoToCostAnalysis={onGoToCostAnalysis}
                  />

                  <OpportunityRequiredDocsPanel opportunityId={opp.id} />
                  <OpportunityDocumentsPanel opportunityId={opp.id} />

                  {(opp.agentTriage?.igpd || opp.agentTriage?.crm) && (
                    <div className="flex flex-col gap-1">
                      {opp.agentTriage.igpd && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                          🤖 BD: {opp.agentTriage.igpd.expectedValue.toLocaleString('tr-TR')} ₺ · {opp.agentTriage.igpd.recommendation}
                        </span>
                      )}
                      {opp.agentTriage.crm && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 self-start">
                          🤖 CRM: {opp.agentTriage.crm.recommendation}
                        </span>
                      )}
                    </div>
                  )}

                  {opp.techEvalStatus && !['WON', 'LOST', 'WITHDRAWN'].includes(opp.status) && (
                    <div className="flex flex-col gap-1">
                      {opp.techEvalStatus === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 self-start">
                          ⏳ Teknik Değerlendirme: Presales Müdürü onayı bekleniyor
                        </span>
                      )}
                      {opp.techEvalStatus === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 self-start">
                          ✓ Teknik Değerlendirme: Onaylandı
                        </span>
                      )}
                      {opp.techEvalStatus === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-full px-2 py-0.5 self-start" title={opp.techEvalReason || undefined}>
                          ✕ Teknik Değerlendirme Reddedildi{opp.techEvalReason ? `: ${opp.techEvalReason}` : ''}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                    {opp.status !== 'WON' && opp.status !== 'LOST' && (
                      <button
                        onClick={() => onCheckIn(opp)}
                        className="flex items-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <ClipboardCheck size={11} /> İlerleme Teyit Et
                      </button>
                    )}
                    {nextStage && opp.status !== 'WON' && opp.status !== 'LOST' && (
                      <button
                        onClick={() => onProgressStatus(opp, nextStage)}
                        className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <ArrowRight size={11} /> {STATUS_LABEL[nextStage]}
                      </button>
                    )}
                    {opp.status !== 'WON' && opp.status !== 'LOST' && (
                      <button
                        onClick={() => onMarkLost(opp)}
                        className="flex items-center gap-1 bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <XCircle size={11} /> Kaybedildi
                      </button>
                    )}
                    {opp.status === 'LOST' && (
                      <button
                        onClick={() => onProgressStatus(opp, 'NEW')}
                        className="flex items-center gap-1 bg-blue-50 text-blue-500 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <ArrowRight size={11} /> Yeniden Aç
                      </button>
                    )}
                    <button
                      onClick={() => onHandOff(opp)}
                      className="flex items-center gap-1 text-slate-400 hover:text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                    >
                      <GitBranch size={11} /> Aktar
                    </button>
                    <PermissionGate permission="CRM_EDIT">
                      <button
                        onClick={() => onEdit(opp)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
                      >
                        <Edit2 size={11} /> Düzenle
                      </button>
                    </PermissionGate>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
      </>}

      {viewMode === 'table' && dateFilteredOpportunities.length > 0 && (
        <div className="glass-panel rounded-[24px] overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fırsat</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Müşteri</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Değer</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Olasılık</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Açılış</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Beklenen Kapanış</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {dateFilteredOpportunities.map(opp => {
                const customer = customers.find(c => c.id === opp.customerId);
                return (
                  <tr key={opp.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs font-black text-slate-900 max-w-[240px] truncate">{opp.title}</td>
                    <td className="px-5 py-3 text-xs font-bold text-slate-600">{customer?.name || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border", getStatusStyle(opp.status))}>
                        {STATUS_LABEL[opp.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-black text-slate-800 text-right whitespace-nowrap">
                      {opp.value > 0 ? `${opp.value.toLocaleString('tr-TR')} ${opp.currency || customer?.currency || ''}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-slate-600 text-right">{opp.probability > 0 ? `%${opp.probability}` : '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{fmtShortDate(opp.createdAt) || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{fmtShortDate(opp.expectedCloseDate) || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="CRM_EDIT">
                        <button
                          onClick={() => onEdit(opp)}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-primary px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary/5"
                        >
                          <Edit2 size={11} /> Düzenle
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dateFilteredOpportunities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Target size={48} className="mb-4 opacity-20" />
          <p className="font-black text-sm uppercase tracking-widest">
            {dateFilterActive ? 'Seçilen tarih aralığında fırsat bulunamadı' : 'Henüz fırsat kaydı bulunmuyor'}
          </p>
        </div>
      )}
    </div>
  );
}
