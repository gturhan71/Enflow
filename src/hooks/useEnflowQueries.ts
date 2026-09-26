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
