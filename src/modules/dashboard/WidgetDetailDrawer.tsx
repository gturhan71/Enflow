import React from 'react';
import type { DashboardPayload } from '../../types';
import { fmtCurrency as cfmt } from '../../lib/format';
import { WK, WIDGET_META, WIDGET_TARGET_TAB, HORIZON_LABEL, HORIZON_COLOR } from './widgetCatalog';
import { dleftBadge } from './helpers';
import DrawerShell from './DrawerShell';

interface Props {
  widgetKey: WK;
  title: string;
  d: DashboardPayload;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

// Kartta .slice(0,5) ile kısaltılan listelerin TAM hali — drill-down.
const DETAIL_BODY: Partial<Record<WK, (d: DashboardPayload) => React.ReactNode>> = {
  costApprovals: (d) => (
    <Rows empty="Bekleyen onay yok." items={d.timeSensitive.costApprovalsPending} row={(c) => (
      <Row key={c.id} left={c.title} right={cfmt(c.value)} />
    )} />
  ),
  tenderDeadlines: (d) => (
    <Rows empty="Yaklaşan ihale vadesi yok." items={d.timeSensitive.tenderDeadlines} row={(t) => {
      const b = dleftBadge(t.daysLeft);
      return <Row key={t.id} left={t.name} sub={t.ikn ? `İKN: ${t.ikn}` : undefined} right={b.t} rightClass={b.c} />;
    }} />
  ),
  guaranteeExpiries: (d) => (
    <Rows empty="30 gün içinde dolan teminat yok." items={d.timeSensitive.guaranteeExpiries} row={(g) => {
      const b = dleftBadge(g.daysLeft);
      return <Row key={g.id} left={g.type === 'BID_BOND' ? 'Geçici Teminat' : 'Kesin Teminat'} sub={cfmt(g.amount, g.currency)} right={b.t} rightClass={b.c} />;
    }} />
  ),
  guaranteeRequests: (d) => (
    <Rows empty="Bekleyen teminat talebi yok." items={d.timeSensitive.guaranteeRequests} row={(g) => (
      <Row key={g.id} left={g.type === 'BID_BOND' ? 'Geçici Teminat' : 'Kesin Teminat'} sub={g.isIndefinite ? 'Süresiz' : undefined} right={cfmt(g.amount, g.currency)} />
    )} />
  ),
  bomHandoffs: (d) => (
    <Rows empty="Henüz devir yok." items={d.management.bomHandoffs.recent} row={(h) => (
      <Row key={h.id} left={h.oppTitle} sub={`${h.handoffCount} devir · son ${new Date(h.lastHandoffAt).toLocaleDateString('tr-TR')}`} right={`${h.itemCount} kalem`} />
    )} />
  ),
  invoicesDue: (d) => (
    <Rows empty="Bekleyen fatura yok." items={d.timeSensitive.invoicesDue} row={(i) => (
      <Row key={i.id} left={i.invoiceNo || 'Fatura'} sub={i.overdue ? 'Gecikti' : (i.dueDate ? new Date(i.dueDate).toLocaleDateString('tr-TR') : undefined)} right={cfmt(i.amount, i.currency)} rightClass={i.overdue ? 'text-red-600' : undefined} />
    )} />
  ),
  milestonesDue: (d) => (
    <Rows empty="Yaklaşan milestone yok." items={d.timeSensitive.milestonesDue} row={(m) => {
      const b = dleftBadge(m.daysLeft);
      return <Row key={m.id} left={m.title} sub={m.projectName ?? undefined} right={b.t} rightClass={b.c} />;
    }} />
  ),
  myOpportunities: (d) => (
    <Rows empty="Atanmış aktif fırsat yok." items={d.personal.myOpportunities} row={(o) => (
      <Row key={o.id} left={o.title} sub={o.technicalStatus === 'PENDING_APPROVAL' ? 'Onayda' : o.status} right={cfmt(o.value)} />
    )} />
  ),
  contractDeadlines: (d) => (
    <Rows empty="Yaklaşan sözleşme vadesi yok." items={d.timeSensitive.contractDeadlines} row={(c) => {
      const b = dleftBadge(c.daysLeft);
      return <Row key={c.id} left={c.title} right={b.t} rightClass={b.c} />;
    }} />
  ),
  legalDeadlines: (d) => (
    <Rows empty="Açık hukuk dosyası vadesi yok." items={d.timeSensitive.legalDeadlines} row={(l) => {
      const b = dleftBadge(l.daysLeft);
      return <Row key={l.id} left={l.title} sub={l.priority} right={b.t} rightClass={b.c} />;
    }} />
  ),
  approvalBottlenecks: (d) => (
    <Rows empty="Bekleyen onay zinciri aşaması yok." items={d.management.bottlenecks} row={(b) => (
      <Row key={b.role} left={b.label || b.role} right={`${b.pendingCount} adet · ${b.oldestWaitingDays} gün`} />
    )} />
  ),
  topRisks: (d) => (
    <Rows empty="Açık risk kaydı yok." items={d.management.topRisks} row={(r) => (
      <Row key={r.id} left={r.title} sub={r.type === 'RISK' ? 'Risk' : 'Fırsat'} right={`Skor ${r.score}`} />
    )} />
  ),
};

function Rows<T>({ items, empty, row }: { items: T[]; empty: string; row: (item: T) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-xs text-slate-400 italic text-center py-8">{empty}</p>;
  return <div className="space-y-1.5">{items.map(row)}</div>;
}

function Row({ left, sub, right, rightClass }: { left: string; sub?: string; right: string; rightClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">{left}</p>
        {sub && <p className="text-[10px] text-slate-400 truncate">{sub}</p>}
      </div>
      <span className={`text-xs font-black shrink-0 ${rightClass || 'text-slate-700'}`}>{right}</span>
    </div>
  );
}

const WidgetDetailDrawer: React.FC<Props> = ({ widgetKey, title, d, onClose, onNavigate }) => {
  const meta = WIDGET_META[widgetKey];
  const body = DETAIL_BODY[widgetKey];
  const targetTab = WIDGET_TARGET_TAB[widgetKey];

  return (
    <DrawerShell
      title={title}
      badge={{ label: HORIZON_LABEL[meta.horizon], colorClass: HORIZON_COLOR[meta.horizon] }}
      philosophy={meta.philosophy}
      onClose={onClose}
      onNavigate={targetTab ? () => { onNavigate(targetTab); onClose(); } : undefined}
    >
      {body ? body(d) : <p className="text-xs text-slate-400 italic text-center py-8">Bu kart için ek detay yok — kartın kendisi tüm veriyi gösteriyor.</p>}
    </DrawerShell>
  );
};

export default WidgetDetailDrawer;
