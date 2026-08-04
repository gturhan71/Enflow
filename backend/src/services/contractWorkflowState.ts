// Enflow — ContractWorkflow durum makinesi (B-01).
// DRAFT → ANALYSIS_DONE → PREPARATION → READY_TO_SIGN → PENDING_SIGNATURE_APPROVAL
//       → SIGNED → TRANSFERRED
// (CANCELLED/TERMINATED her aşamadan çıkış olabilir; sıradan geçiş yok.)

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ANALYSIS_DONE', 'CANCELLED'],
  ANALYSIS_DONE: ['PREPARATION', 'CANCELLED'],
  PREPARATION: ['READY_TO_SIGN', 'CANCELLED'],
  READY_TO_SIGN: ['PENDING_SIGNATURE_APPROVAL', 'CANCELLED'],
  PENDING_SIGNATURE_APPROVAL: ['SIGNED', 'PREPARATION', 'CANCELLED'],
  SIGNED: ['TRANSFERRED', 'TERMINATED'],
  TRANSFERRED: [],
  CANCELLED: [],
  TERMINATED: [],
};

// Yalnız hassas geçişler için rol kısıtlaması; tanımsız geçişler route-seviyesi 7-rol kapısına tabi.
export const TRANSITION_ROLES: Record<string, string[]> = {
  SIGNED: ['GENERAL_MANAGER', 'KSU_MGR'],
  CANCELLED: ['GENERAL_MANAGER', 'KSU_MGR', 'LEGAL_MGR'],
  TERMINATED: ['GENERAL_MANAGER', 'KSU_MGR', 'LEGAL_MGR'],
};

export type TransitionCheckResult =
  | { ok: true }
  | { ok: false; code: 409 | 403 | 400; error: string };

/**
 * Bir durum geçişinin izinli olup olmadığını kontrol eder — sıra: geçerlilik
 * (STATUS_TRANSITIONS) → rol yetkisi (TRANSITION_ROLES) → iptal/fesih gerekçesi
 * zorunluluğu. `nextStatus === currentStatus` her zaman izinlidir (route bu
 * fonksiyonu yalnız gerçek bir değişiklik olduğunda çağırır, ama saf fonksiyon
 * kendi başına da güvenli olsun diye burada da ele alınır).
 */
export function checkStatusTransition(
  currentStatus: string,
  nextStatus: string,
  role: string,
  cancelReason?: string | null,
): TransitionCheckResult {
  if (nextStatus === currentStatus) return { ok: true };

  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return { ok: false, code: 409, error: `${currentStatus} → ${nextStatus} geçişine izin verilmiyor.` };
  }

  const rolesForTransition = TRANSITION_ROLES[nextStatus];
  if (rolesForTransition && !rolesForTransition.includes(role)) {
    return { ok: false, code: 403, error: 'Bu durum geçişi için yetkiniz yok.' };
  }

  if ((nextStatus === 'CANCELLED' || nextStatus === 'TERMINATED') && !String(cancelReason || '').trim()) {
    return { ok: false, code: 400, error: 'İptal/fesih gerekçesi zorunludur.' };
  }

  return { ok: true };
}
