import { describe, it, expect } from 'vitest';
import { checkStatusTransition } from '../contractWorkflowState';

describe('contractWorkflowState — checkStatusTransition', () => {
  it('allows setting the same status (no-op)', () => {
    expect(checkStatusTransition('DRAFT', 'DRAFT', 'SALES_MGR')).toEqual({ ok: true });
  });

  it('rejects an undefined/invalid transition with 409', () => {
    const r = checkStatusTransition('DRAFT', 'SIGNED', 'GENERAL_MANAGER');
    expect(r).toEqual({ ok: false, code: 409, error: 'DRAFT → SIGNED geçişine izin verilmiyor.' });
  });

  it('allows a valid transition with no role restriction, for any of the 7 gate roles', () => {
    expect(checkStatusTransition('DRAFT', 'ANALYSIS_DONE', 'SALES_MGR')).toEqual({ ok: true });
    expect(checkStatusTransition('ANALYSIS_DONE', 'PREPARATION', 'IGPD_MGR')).toEqual({ ok: true });
  });

  it('rejects SIGNED transition for a role outside [GENERAL_MANAGER, KSU_MGR]', () => {
    const r = checkStatusTransition('PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'SALES_MGR');
    expect(r).toEqual({ ok: false, code: 403, error: 'Bu durum geçişi için yetkiniz yok.' });
  });

  it('allows SIGNED transition for GENERAL_MANAGER and KSU_MGR', () => {
    expect(checkStatusTransition('PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'GENERAL_MANAGER')).toEqual({ ok: true });
    expect(checkStatusTransition('PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'KSU_MGR')).toEqual({ ok: true });
  });

  it('requires a cancelReason for CANCELLED even with an authorized role', () => {
    const r = checkStatusTransition('DRAFT', 'CANCELLED', 'GENERAL_MANAGER', undefined);
    expect(r).toEqual({ ok: false, code: 400, error: 'İptal/fesih gerekçesi zorunludur.' });
  });

  it('rejects a whitespace-only cancelReason the same as a missing one', () => {
    const r = checkStatusTransition('DRAFT', 'CANCELLED', 'GENERAL_MANAGER', '   ');
    expect(r.ok).toBe(false);
  });

  it('checks role BEFORE cancelReason for a restricted terminal transition (order matters)', () => {
    // SALES_MGR yetkisiz + gerekçe de yok — yetki hatası önce gelmeli (403, 400 değil)
    const r = checkStatusTransition('SIGNED', 'TERMINATED', 'SALES_MGR', undefined);
    expect(r).toEqual({ ok: false, code: 403, error: 'Bu durum geçişi için yetkiniz yok.' });
  });

  it('allows CANCELLED with an authorized role and a real reason', () => {
    expect(checkStatusTransition('DRAFT', 'CANCELLED', 'LEGAL_MGR', 'Müşteri vazgeçti')).toEqual({ ok: true });
  });

  it('allows the full happy-path chain end to end', () => {
    expect(checkStatusTransition('DRAFT', 'ANALYSIS_DONE', 'SALES_MGR').ok).toBe(true);
    expect(checkStatusTransition('ANALYSIS_DONE', 'PREPARATION', 'SALES_MGR').ok).toBe(true);
    expect(checkStatusTransition('PREPARATION', 'READY_TO_SIGN', 'SALES_MGR').ok).toBe(true);
    expect(checkStatusTransition('READY_TO_SIGN', 'PENDING_SIGNATURE_APPROVAL', 'SALES_MGR').ok).toBe(true);
    expect(checkStatusTransition('PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'GENERAL_MANAGER').ok).toBe(true);
    expect(checkStatusTransition('SIGNED', 'TRANSFERRED', 'GENERAL_MANAGER').ok).toBe(true);
  });

  it('allows PENDING_SIGNATURE_APPROVAL to bounce back to PREPARATION (revision loop)', () => {
    expect(checkStatusTransition('PENDING_SIGNATURE_APPROVAL', 'PREPARATION', 'SALES_MGR')).toEqual({ ok: true });
  });

  it('has no outgoing transitions from any terminal state', () => {
    for (const terminal of ['TRANSFERRED', 'CANCELLED', 'TERMINATED']) {
      const r = checkStatusTransition(terminal, 'DRAFT', 'GENERAL_MANAGER');
      expect(r.ok).toBe(false);
    }
  });
});
