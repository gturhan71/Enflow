import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

// --- QUERY HOOKS ---

export const useOpportunities = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['opportunities', tenantId],
    queryFn: () => apiService.getOpportunities(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useCustomers = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => apiService.getCustomers(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useProjects = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['projects', tenantId],
    queryFn: () => apiService.getProjects(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useContracts = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['contracts', tenantId],
    queryFn: () => apiService.getContracts(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useTasks = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['tasks', tenantId],
    queryFn: () => apiService.getTasks(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useUnits = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['units', tenantId],
    queryFn: () => apiService.getUnits(),
    staleTime: 10 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useUsers = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => apiService.getUsers(),
    staleTime: 10 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useDocuments = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['documents', tenantId],
    queryFn: () => apiService.getDocuments(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useProposals = (tenantId: string, options: { enabled?: boolean; staleTime?: number; retry?: boolean | number } = {}) => {
  return useQuery({
    queryKey: ['proposals', tenantId],
    queryFn: () => apiService.getProposals(),
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: !!tenantId && (options.enabled !== undefined ? options.enabled : true)
  });
};

export const useModuleSettings = (tenantId: string) => {
  return useQuery({
    queryKey: ['module-settings', tenantId],
    queryFn: () => apiService.getModuleSettings(),
    staleTime: 60 * 1000,
    enabled: !!tenantId,
  });
};

export const useProjectHealth = (tenantId: string) => useQuery({
  queryKey: ['projects', 'health', tenantId],
  queryFn: () => apiService.getProjectHealth().catch(() => null),
  staleTime: 60 * 1000,
  enabled: !!tenantId,
});
// Bekleyen Onaylarım — kullanıcının rolüne sırası gelmiş onay zincirleri. Opsiyonel katman: hata → boş liste.
export const usePendingApprovalChains = (tenantId: string, role: string | undefined) => useQuery({
  queryKey: ['approval-chains', 'pending', tenantId, role ?? ''],
  queryFn: () => apiService.getPendingApprovalChainsForRole(role as string).catch(() => []),
  staleTime: 30 * 1000,
  refetchOnMount: 'always',   // başka ekranlardan (süreç butonları) verilen onaylar önbelleği geçersiz kılmaz → her açılışta taze
  enabled: !!tenantId && !!role,
});
// Ziyaret Planı — anahtarlar `['visit-plan', ...]` öneki altında (paylaşım sonrası tek invalidate).
export const useVisitPlans = (tenantId: string) => useQuery({
  queryKey: ['visit-plan', 'plans', tenantId], queryFn: () => apiService.getVisitPlans(), staleTime: 60 * 1000, enabled: !!tenantId,
});
export const useDailyReports = (tenantId: string, userId: string) => useQuery({
  queryKey: ['visit-plan', 'reports', tenantId, userId], queryFn: () => apiService.getDailyReports({ userId }), staleTime: 60 * 1000, enabled: !!tenantId && !!userId,
});
export const useVisitReportSettings = (tenantId: string) => useQuery({
  queryKey: ['visit-plan', 'settings', tenantId],
  queryFn: () => apiService.getReportSettings().catch(() => ({ shareIntervalDays: 7, visitTargetRate: 80 })),
  staleTime: 5 * 60 * 1000, enabled: !!tenantId,
});
// Yönetici skor tablosu: hafta anahtarın parçası → hızlı hafta değiştirmede eski yanıt yenisini EZEMEZ
// (önceki useEffect+then yarışına açıktı).
export const useVisitScoreboard = (tenantId: string, weekStart: string, enabled: boolean) => useQuery({
  queryKey: ['visit-plan', 'scoreboard', tenantId, weekStart],
  queryFn: async () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return apiService.getReportConsolidation('CRM', { start: weekStart, end: end.toISOString().slice(0, 10) });
  },
  staleTime: 60 * 1000, enabled: !!tenantId && enabled,
});
// Finans — anahtarlar ortak `['finance', ...]` önekini taşır: mutasyon sonrası tek çağrıyla
// (invalidateQueries({ queryKey: ['finance'] })) hepsi yenilenir.
export const useInvoices = (tenantId: string) => useQuery({
  queryKey: ['finance', 'invoices', tenantId], queryFn: () => apiService.getInvoices(), staleTime: 60 * 1000, enabled: !!tenantId,
});
export const useGuarantees = (tenantId: string) => useQuery({
  queryKey: ['finance', 'guarantees', tenantId], queryFn: () => apiService.getGuarantees(), staleTime: 60 * 1000, enabled: !!tenantId,
});
export const useCostApprovals = (tenantId: string) => useQuery({
  queryKey: ['finance', 'cost-approvals', tenantId], queryFn: () => apiService.getCostApprovals(), staleTime: 60 * 1000, enabled: !!tenantId,
});
export const useFinanceSummary = (tenantId: string) => useQuery({
  queryKey: ['finance', 'summary', tenantId], queryFn: () => apiService.getFinanceSummary(), staleTime: 60 * 1000, enabled: !!tenantId,
});
// Yaşlandırma raporu isteğe bağlı (yetki/veri yoksa null) — eski davranış: hata → null.
export const useFinanceAging = (tenantId: string) => useQuery({
  queryKey: ['finance', 'aging', tenantId], queryFn: () => apiService.getAging().catch(() => null), staleTime: 60 * 1000, enabled: !!tenantId,
});
export const usePurchaseRequests = (tenantId: string, params?: { status?: string; sourceType?: string }) => {
  return useQuery({
    queryKey: ['purchase-requests', tenantId, params?.status ?? '', params?.sourceType ?? ''],
    queryFn: () => apiService.getPurchaseRequests(params),
    staleTime: 60 * 1000,
    enabled: !!tenantId,
  });
};

export const useVendors = (tenantId: string) => {
  return useQuery({
    queryKey: ['vendors', tenantId],
    queryFn: () => apiService.getVendors(),
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
};
