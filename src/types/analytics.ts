// ── Büyüme Analitiği Faz 1 ──────────────────────────────────────────────────
export interface AgingBuckets { notDue: number; d0_30: number; d31_60: number; d61_90: number; d90plus: number }
export interface AgingReport {
  buckets: AgingBuckets;
  dso: number;
  totalReceivable: number;
  byCurrency: Record<string, { totalReceivable: number; buckets: AgingBuckets }>;
}
export interface FunnelReport {
  stages: { name: string; status: string; count: number; conversionToNext: number | null }[];
  lossByReason: { reason: string; count: number; value: number }[];
  entered: number;
}
export interface TenderGroup { key: string; won: number; lost: number; winRate: number; wonValue: number; total: number }
export interface TenderAnalytics {
  byAuthority: TenderGroup[];
  byMethod: TenderGroup[];
  overall: { winRate: number; wonValue: number; lostValue: number; activePipeline: number; avgBidValue: number; wonCount: number; lostCount: number };
}
export interface BomVarianceLine { name: string; quoted: number; actual: number; variance: number; variancePct: number; isLineLevel?: boolean }
export interface BomVarianceReport { lines: BomVarianceLine[]; marginErosionPct: number; note: string }
export interface ConcentrationReport {
  topCustomers: { name: string; revenue: number; sharePct: number; isPublic: boolean }[];
  hhi: number; top1Pct: number; top3Pct: number;
  totalRevenue: number; customerCount: number; publicPct: number; note: string;
}
export interface ForecastReport {
  rawPipeline: number; weightedPipeline: number; wonValue: number;
  target: number; coverage: number;
  byStage: { status: string; count: number; weighted: number }[];
}
export interface BidScoreLine {
  id: string; name: string; authority: string; estimatedValue: number; currency: string;
  deadline: string | null; daysLeft: number | null;
  score: number; recommendation: 'BID' | 'REVIEW' | 'NO_BID';
  factors: { authorityWinRate: number; deadline: number; readiness: number; valueFit: number };
  authorityWinPct: number | null; readinessPct: number; triageTier: string | null;
}
export interface BidScorecard {
  tenders: BidScoreLine[];
  summary: { total: number; bid: number; review: number; noBid: number; avgScore: number };
  note: string;
}
export interface DocPortfolioLine {
  id: string; name: string; category: string; expiryDate: string | null;
  daysLeft: number | null; status: 'EXPIRED' | 'EXPIRING';
}
export interface DocumentPortfolio {
  summary: { total: number; valid: number; expiringSoon: number; expired: number; noExpiry: number; reuseCount: number };
  categories: { category: string; count: number }[];
  attention: DocPortfolioLine[];
  note: string;
}
export interface ArchiveAttentionLine {
  id: string; boxNo: string; shelfNo: string; category: string; daysSinceUpdate: number;
}
export interface ArchiveAnalytics {
  summary: { total: number; physical: number; digital: number; inArchive: number; borrowed: number };
  categories: { category: string; count: number }[];
  attention: ArchiveAttentionLine[];
  note: string;
}
export interface HealthPillar { key: string; label: string; score: number; detail: string; }
export interface BusinessHealth {
  overall: number;
  status: 'GÜÇLÜ' | 'ORTA' | 'ZAYIF';
  pillars: HealthPillar[];
  weakest: string;
  note: string;
}
export interface ProjectHealthLine {
  id: string; code: string | null; name: string;
  score: number; status: 'CRITICAL' | 'WATCH' | 'HEALTHY';
  actualMarginPct: number; overdueMilestones: number; milestoneCount: number;
  budgetUsedPct: number; progress: number; deadlineRisk: boolean;
  factors: { margin: number; schedule: number; budget: number };
}
export interface ProjectHealthReport {
  projects: ProjectHealthLine[];
  summary: { total: number; critical: number; watch: number; healthy: number; avgScore: number };
  note: string;
}
export interface CustomerHealthLine {
  id: string; name: string;
  score: number; status: 'LOYAL' | 'STABLE' | 'AT_RISK';
  wonRevenue: number; openPipeline: number; winPct: number | null;
  overdueAmount: number; lastActivityDays: number | null; oppCount: number;
  factors: { payment: number; winRate: number; activity: number; loyalty: number };
}
export interface CustomerHealthReport {
  customers: CustomerHealthLine[];
  summary: { total: number; loyal: number; stable: number; atRisk: number; avgScore: number };
  note: string;
}
export interface DmoAnalytics {
  totalOrders: number;
  byStatus: { status: string; count: number }[];
  evaluationCount: number; evaluationValue: number;
  activeRevenue: number; netProfit: number; avgNetMarginPct: number;
  unprofitableCount: number; risturnAccrued: number; commissionTotal: number;
  topInstitutions: { name: string; revenue: number; net: number }[];
  note: string;
}
