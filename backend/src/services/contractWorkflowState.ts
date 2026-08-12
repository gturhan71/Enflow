// Enflow — ContractWorkflow durum makinesi (B-01).
// DRAFT → ANALYSIS_DONE → PREPARATION → READY_TO_SIGN → PENDING_SIGNATURE_APPROVAL
//       → SIGNED → TRANSFERRED
// (CANCELLED/TERMINATED her aşamadan çıkış olabilir; sıradan geçiş yok.)

// NOT: PREPARATION durumu hiçbir route/handler tarafından fiilen set edilmiyor —
// evrak yükleme tamamlandığında otomatik geçiş (handleFileUpload/maybeAutoMarkReady,
// ContractWorkflowModule.tsx) doğrudan ANALYSIS_DONE'dan READY_TO_SIGN'a atlıyor, ve
// imza onayı reddedildiğinde (handleRejectSignature) PENDING_SIGNATURE_APPROVAL'dan
// doğrudan READY_TO_SIGN'a dönüyor. Bu iki kenar eskiden tabloda yoktu — gerçek
// akışta hep "ANALYSIS_DONE → READY_TO_SIGN geçişine izin verilmiyor." hatasına
// düşülüyordu (evrakları tamamlanmış, PREPARATION'a hiç uğramamış her sözleşmede).
// PREPARATION kenarları geriye dönük uyumluluk için (ileride kullanılabilir) korunuyor.
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ANALYSIS_DONE', 'CANCELLED'],
  ANALYSIS_DONE: ['PREPARATION', 'READY_TO_SIGN', 'CANCELLED'],
  PREPARATION: ['READY_TO_SIGN', 'CANCELLED'],
  READY_TO_SIGN: ['PENDING_SIGNATURE_APPROVAL', 'CANCELLED'],
  PENDING_SIGNATURE_APPROVAL: ['SIGNED', 'READY_TO_SIGN', 'PREPARATION', 'CANCELLED'],
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

export interface ContractAnalysisExtract { projectName: string | null; tenderNo: string | null }
export interface ContractWorkflowFallback { tenderName: string | null; tenderNo: string | null; title: string }

/**
 * AI analizinden çıkarılan proje adı/İKN + mevcut workflow bilgisinden otomatik
 * başlık üretir. Sıra: isim → extractedProjectName → tenderName → title.
 * İKN eki → extractedTenderNo → wf.tenderNo → (hiç yok).
 */
export function buildAutoTitle(extracted: ContractAnalysisExtract, fallback: ContractWorkflowFallback): string {
  const namePart = extracted.projectName || fallback.tenderName || fallback.title;
  const iknPart = extracted.tenderNo
    ? `İKN: ${extracted.tenderNo}`
    : (fallback.tenderNo ? `İKN: ${fallback.tenderNo}` : null);
  return [namePart, iknPart].filter(Boolean).join(' — ');
}
