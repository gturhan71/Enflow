import { apiClient } from '../../services/apiClient';
import { Proposal } from '../../types';
import { WORKFLOW_STATUS_STEPS } from './constants';
import { ContractWorkflow } from './types';

export const BASE = '/contract-workflows';

export async function apiFetch(path: string, init?: RequestInit) {
  return apiClient.fetchWithAuth(path, init);
}

export const STATUS_RANK: Record<string, number> = { APPROVED: 4, ACCEPTED: 3, SENT: 2, PENDING_APPROVAL: 1, DRAFT: 0, REJECTED: -1 };

export function bestProposalPrice(opportunityId: string, proposals: Proposal[]): number | null {
  let best: { rank: number; version: number; price: number } | null = null;
  for (const p of proposals) {
    if (p.opportunityId !== opportunityId) continue;
    // Proposal.totalPrice backend'de kalıcı bir DB kolonu değil — API'den dönen kayıtlarda
    // üst-seviye totalPrice her zaman undefined'dır. Asıl tutar content.totalPrice'ta
    // (KDV hariç Ara Toplam / "Son Teklif Tutarı", bkz. ProposalEditor.tsx onSave).
    let price = p.totalPrice;
    if (price == null && p.content) {
      try {
        const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
        if (typeof c?.totalPrice === 'number') price = c.totalPrice;
      } catch { /* bozuk content — yok say */ }
    }
    if (!price) continue;
    const rank = STATUS_RANK[p.status] ?? 0;
    const version = p.version ?? 0;
    if (!best || rank > best.rank || (rank === best.rank && version > best.version)) {
      best = { rank, version, price };
    }
  }
  return best?.price ?? null;
}

export const stepIndex = (status: string) => WORKFLOW_STATUS_STEPS.findIndex(s => s.key === status);

// ── Evrak tamamlama alarmı ────────────────────────────────────────────────────
// Esas: son sözleşme tarihine (deadline — İmza Son Tarihi) kadar tüm zorunlu
// evraklar tamamlanmış olmalı. İmzalanmış/aktarılmış/iptal-feshedilmiş süreçlerde
// veya eksik evrak yoksa alarm yok. Canlı hesaplanır — kalıcı bildirim/sweep yok.
const TERMINAL_STATUSES = ['SIGNED', 'TRANSFERRED', 'CANCELLED', 'TERMINATED'];

export interface DeadlineAlarm {
  level: 'none' | 'warning' | 'critical';
  daysLeft: number | null; // negatif ise süre geçmiş
  missingRequired: number;
  totalRequired: number;
  label: string;
}

export function computeDeadlineAlarm(wf: Pick<ContractWorkflow, 'status' | 'deadline' | 'documents'>): DeadlineAlarm {
  const required = wf.documents.filter(d => d.isRequired);
  const missing = required.filter(d => !['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
  if (TERMINAL_STATUSES.includes(wf.status) || !wf.deadline || missing.length === 0) {
    return { level: 'none', daysLeft: null, missingRequired: missing.length, totalRequired: required.length, label: '' };
  }
  const daysLeft = Math.ceil((new Date(wf.deadline).getTime() - Date.now()) / 86400000);
  const level: DeadlineAlarm['level'] = daysLeft <= 3 ? 'critical' : 'warning';
  const label = daysLeft < 0
    ? `Son tarih ${Math.abs(daysLeft)} gün geçti — ${missing.length}/${required.length} evrak eksik`
    : daysLeft === 0
      ? `Son tarih bugün — ${missing.length}/${required.length} evrak eksik`
      : `${daysLeft} gün kaldı — ${missing.length}/${required.length} evrak eksik`;
  return { level, daysLeft, missingRequired: missing.length, totalRequired: required.length, label };
}

export const isDocsComplete = (wf: Pick<ContractWorkflow, 'documents'>): boolean =>
  wf.documents.filter(d => d.isRequired).every(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
