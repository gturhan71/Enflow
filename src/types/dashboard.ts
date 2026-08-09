export interface DashboardPayload {
  kpis: { winRate: number; pipelineValue: number; won: { count: number; value: number }; lost: { count: number; value: number }; withdrawnCount: number; activeOpps: number };
  timeSensitive: {
    tenderDeadlines: { id: string; name: string; ikn?: string | null; submissionDeadline: string | null; daysLeft: number | null }[];
    guaranteeExpiries: { id: string; type: string; amount: number; currency: string; expiryDate: string | null; daysLeft: number | null }[];
    guaranteeRequests: { id: string; type: string; amount: number; currency: string; isIndefinite?: boolean; tenderId?: string | null; expiryDate?: string | null }[];
    costApprovalsPending: { id: string; title: string; value: number }[];
    invoicesDue: { id: string; invoiceNo?: string | null; amount: number; currency: string; dueDate: string | null; overdue: boolean }[];
    milestonesDue: { id: string; title: string; projectName?: string | null; plannedEnd: string | null; daysLeft: number | null }[];
    contractDeadlines: { id: string; title: string; deadline: string | null; daysLeft: number | null }[];
    legalDeadlines: { id: string; title: string; priority: string; dueDate: string | null; daysLeft: number | null }[];
  };
  management: {
    bottlenecks: { role: string; label?: string; pendingCount: number; oldestWaitingDays: number }[];
    tenderPipeline: { active: number; submitted: number; won: number; lost: number; withdrawn: number };
    bomHandoffs: { count: number; recent: { id: string; oppTitle: string; itemCount: number; handoffCount: number; lastHandoffAt: string }[] };
    financing: { receivableByCurrency: Record<string, number>; overdueByCurrency: Record<string, number> };
    purchaseRequests: Record<string, number>;
    projects: { active: number; avgMargin: number };
    topRisks: { id: string; title: string; type: string; score: number }[];
    agentActivityToday: { pendingRatification: number; actionsTaken: number; total: number };
    visitPerformance: {
      period: { start: string; end: string };
      planned: number;
      completed: number;
      cancelled: number;
      coveragePct: number;
      targetRate: number;
      conversion: { windowDays: number; lookbackDays: number; maturedVisits: number; convertedVisits: number; conversionRatePct: number };
      topPerformers: { userId: string; name: string; completed: number; converted: number }[];
    };
  };
  personal: { myOpportunities: { id: string; title: string; value: number; status: string; technicalStatus?: string }[]; myTasksPending: number; unreadNotifications: number };
}
