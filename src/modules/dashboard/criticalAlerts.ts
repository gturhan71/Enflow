import type { DashboardPayload } from '../../types';
import { severityRank } from './helpers';

export interface CriticalAlert {
  id: string;
  category: string;
  title: string;
  daysLeft: number | null;
  targetTab: string;
}

const daysUntil = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);

// Tüm "vade" taşıyan diziler tek, önem-sıralı listede birleştirilir — GM'in
// tek tek kartları taramak yerine en kritik N işi bir bakışta görmesi için.
// Sadece 7 gün ve altı (veya süresi dolmuş) kalemler kritik uyarı sayılır.
export function buildCriticalAlerts(d: DashboardPayload): CriticalAlert[] {
  const items: CriticalAlert[] = [
    ...d.timeSensitive.tenderDeadlines.map(t => ({ id: `tender-${t.id}`, category: 'İhale', title: t.name, daysLeft: t.daysLeft, targetTab: 'sales-support' })),
    ...d.timeSensitive.guaranteeExpiries.map(g => ({ id: `guarantee-${g.id}`, category: 'Teminat', title: g.type === 'BID_BOND' ? 'Geçici Teminat' : 'Kesin Teminat', daysLeft: g.daysLeft, targetTab: 'finance' })),
    ...d.timeSensitive.invoicesDue.map(i => ({ id: `invoice-${i.id}`, category: 'Fatura', title: i.invoiceNo || 'Fatura', daysLeft: daysUntil(i.dueDate), targetTab: 'finance' })),
    ...d.timeSensitive.milestonesDue.map(m => ({ id: `milestone-${m.id}`, category: 'Milestone', title: m.title, daysLeft: m.daysLeft, targetTab: 'project-mgmt' })),
    ...d.timeSensitive.contractDeadlines.map(c => ({ id: `contract-${c.id}`, category: 'Sözleşme', title: c.title, daysLeft: c.daysLeft, targetTab: 'contract-workflow' })),
    ...d.timeSensitive.legalDeadlines.map(l => ({ id: `legal-${l.id}`, category: 'Hukuk', title: l.title, daysLeft: l.daysLeft, targetTab: 'contract-workflow' })),
  ];
  return items
    .filter((i): i is CriticalAlert & { daysLeft: number } => i.daysLeft != null && i.daysLeft <= 7)
    .sort((a, b) => severityRank(a.daysLeft) - severityRank(b.daysLeft) || a.daysLeft - b.daysLeft);
}
