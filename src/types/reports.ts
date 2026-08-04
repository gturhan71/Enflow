// ── Yönetim Raporlama (Faz 7) ────────────────────────────────────────────────
export interface ReportMetric {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}
export interface ReportChartSeries {
  title: string;
  type: 'bar' | 'pie' | 'line';
  data: { name: string; value: number }[];
}
export interface UnitMetrics {
  unitKey: string;
  label: string;
  role: string;
  period: { start: string; end: string };
  metrics: ReportMetric[];
  charts: ReportChartSeries[];
}
export interface WorkflowBottleneck {
  role: string;
  pendingCount: number;
  oldestWaitingDays: number;
}
export interface OverviewUnit {
  unitKey: string;
  label: string;
  role: string;
  headline: ReportMetric[];
  charts: ReportChartSeries[];
}
export interface ReportOverview {
  period: { start: string; end: string };
  units: OverviewUnit[];
  bottlenecks: WorkflowBottleneck[];
}
export interface UnitDefinition {
  key: string;
  label: string;
  role: string;
}
export interface UnitReport {
  id: string;
  tenantId: string;
  unitKey: string;
  unitLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'RETURNED';
  authorId?: string | null;
  authorName?: string | null;
  metricsSnapshot?: string | null;
  consolidationSnapshot?: string | null;
  escalatedToId?: string | null;
  escalatedToName?: string | null;
  highlights?: string | null;
  issues?: string | null;
  plannedActions?: string | null;
  risks?: string | null;
  summary?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  docNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}
