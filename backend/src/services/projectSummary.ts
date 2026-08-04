export interface ProjectCostItemForSummary { plannedAmount: number; amountTRY: number }
export interface ProjectMilestoneForSummary { status: string; plannedEnd: Date | null }

export interface ProjectForSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  phase: string;
  customerName: string | null;
  pmName: string | null;
  totalValue: number;
  contractCurrency: string;
  progress: number;
  plannedEndDate: Date | null;
  projectCostItems: ProjectCostItemForSummary[];
  milestones: ProjectMilestoneForSummary[];
}

export interface ProjectSummaryLine {
  id: string; name: string; type: string; status: string; phase: string;
  customerName: string | null; pmName: string | null;
  totalValue: number; contractCurrency: string;
  totalPlanned: number; totalActual: number; plannedMargin: number; actualMargin: number;
  progress: number; delayedMs: number; plannedEndDate: Date | null;
  milestoneCount: number; completedMs: number;
}

/**
 * Bir projenin GM özet satırı — planlanan/gerçekleşen maliyet toplamı,
 * planlanan/gerçekleşen marj %, geciken (vadesi geçmiş + tamamlanmamış)
 * milestone sayısı. Saf; DB'den zaten çekilmiş proje+kalem+milestone
 * verisi üzerinde çalışır. `now` test edilebilirlik için opsiyonel.
 */
export function summarizeProject(p: ProjectForSummary, now: number = Date.now()): ProjectSummaryLine {
  const totalPlanned = p.projectCostItems.reduce((s, c) => s + c.plannedAmount, 0);
  const totalActual = p.projectCostItems.reduce((s, c) => s + c.amountTRY, 0);
  const plannedMargin = p.totalValue > 0 ? ((p.totalValue - totalPlanned) / p.totalValue) * 100 : 0;
  const actualMargin = p.totalValue > 0 ? ((p.totalValue - totalActual) / p.totalValue) * 100 : 0;
  const delayedMs = p.milestones.filter(
    (m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && m.plannedEnd && m.plannedEnd.getTime() < now,
  ).length;

  return {
    id: p.id, name: p.name, type: p.type, status: p.status, phase: p.phase,
    customerName: p.customerName, pmName: p.pmName,
    totalValue: p.totalValue, contractCurrency: p.contractCurrency,
    totalPlanned, totalActual, plannedMargin, actualMargin,
    progress: p.progress, delayedMs,
    plannedEndDate: p.plannedEndDate,
    milestoneCount: p.milestones.length,
    completedMs: p.milestones.filter((m) => m.status === 'COMPLETED').length,
  };
}
