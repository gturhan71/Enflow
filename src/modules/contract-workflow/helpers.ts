import { apiClient } from '../../services/apiClient';
import { Proposal } from '../../types';
import { WORKFLOW_STATUS_STEPS } from './constants';

export const BASE = '/contract-workflows';

export async function apiFetch(path: string, init?: RequestInit) {
  return apiClient.fetchWithAuth(path, init);
}

export const STATUS_RANK: Record<string, number> = { APPROVED: 4, ACCEPTED: 3, SENT: 2, PENDING_APPROVAL: 1, DRAFT: 0, REJECTED: -1 };

export function bestProposalPrice(opportunityId: string, proposals: Proposal[]): number | null {
  let best: { rank: number; version: number; price: number } | null = null;
  for (const p of proposals) {
    if (p.opportunityId !== opportunityId || !p.totalPrice) continue;
    const rank = STATUS_RANK[p.status] ?? 0;
    const version = p.version ?? 0;
    if (!best || rank > best.rank || (rank === best.rank && version > best.version)) {
      best = { rank, version, price: p.totalPrice };
    }
  }
  return best?.price ?? null;
}

export const stepIndex = (status: string) => WORKFLOW_STATUS_STEPS.findIndex(s => s.key === status);
