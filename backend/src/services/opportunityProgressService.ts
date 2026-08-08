// Enflow — Fırsat ilerleme teyidi (probability/status check-in) servis katmanı
// ─────────────────────────────────────────────────────────────────────────────
// Her teyit (manuel POST /:id/progress-checkin ya da PUT /:id içinde probability/
// status fiilen değiştiğinde otomatik) bir OpportunityProgressLog satırı yazar ve
// Opportunity.lastProgressCheckAt'i sıfırlar — böylece opportunityProgressReminders.ts
// döngüyü yeniden başlatır. Değişmeden yapılan teyitte (changed=false) `note` zorunludur.

import { prisma } from '../prismaClient';
import { logActivity } from './activityLog';

export interface OpportunityProgressSettings {
  intervalDays: number;
  graceBusinessDays: number;
}

const DEFAULT_SETTINGS: OpportunityProgressSettings = { intervalDays: 14, graceBusinessDays: 3 };

export async function getOpportunityProgressSettings(tenantId: string): Promise<OpportunityProgressSettings> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(tenant?.moduleSettings || '{}'); } catch { ms = {}; }
  const cfg = (ms.opportunityProgress as Partial<OpportunityProgressSettings> | undefined) || {};
  return {
    intervalDays: cfg.intervalDays && cfg.intervalDays > 0 ? cfg.intervalDays : DEFAULT_SETTINGS.intervalDays,
    graceBusinessDays: cfg.graceBusinessDays && cfg.graceBusinessDays > 0 ? cfg.graceBusinessDays : DEFAULT_SETTINGS.graceBusinessDays,
  };
}

interface CheckInInput {
  probability?: number;
  status?: string;
  note?: string | null;
}

export class ProgressCheckInError extends Error {}

interface FinalizeInput {
  recordedById: string;
  previousProbability: number;
  newProbability: number;
  previousStatus: string;
  newStatus: string;
  changed: boolean;
  note: string | null;
}

// Ortak kapanış: log satırı + lastProgressCheckAt sıfırlama + açık PROGRESS_CHECKIN
// görevini kapatma + denetim izi. probability/status'ü Opportunity'ye YAZMAZ —
// çağıran taraf (manuel check-in ya da normal PUT) bunu kendi update'inde yapar.
async function finalizeCheckIn(tenantId: string, opportunityId: string, f: FinalizeInput): Promise<void> {
  await prisma.opportunityProgressLog.create({
    data: {
      tenantId, opportunityId, recordedById: f.recordedById,
      previousStatus: f.previousStatus, newStatus: f.newStatus,
      previousProbability: f.previousProbability, newProbability: f.newProbability,
      changed: f.changed, note: f.note,
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { lastProgressCheckAt: new Date(), progressRemindersSent: null },
  });

  await prisma.todoTask.updateMany({
    where: { tenantId, relatedModule: 'OPPORTUNITY', relatedItemId: opportunityId, actionKey: 'PROGRESS_CHECKIN', status: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { status: 'COMPLETED', completedAt: new Date() },
  }).catch(() => {});

  await logActivity({
    tenantId, userId: f.recordedById, action: 'PROGRESS_CHECKIN', entityType: 'OPPORTUNITY', entityId: opportunityId,
    details: { changed: f.changed, previousProbability: f.previousProbability, newProbability: f.newProbability, previousStatus: f.previousStatus, newStatus: f.newStatus, note: f.note },
  });
}

// Manuel teyit (POST /:id/progress-checkin) — kullanıcı probability/status'ü
// değiştirebilir ya da aynen bırakıp not düşebilir (değişmediyse not zorunlu).
export async function recordProgressCheckIn(
  tenantId: string,
  opportunityId: string,
  userId: string | undefined,
  input: CheckInInput,
): Promise<void> {
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!opp) throw new ProgressCheckInError('Fırsat bulunamadı.');

  const newProbability = input.probability !== undefined ? input.probability : opp.probability;
  const newStatus = input.status !== undefined ? input.status : opp.status;
  const changed = newProbability !== opp.probability || newStatus !== opp.status;
  const note = input.note?.trim() || null;

  if (!changed && !note) {
    throw new ProgressCheckInError('İlerleme değişmediyse neden değişmediğine dair bir not girmelisiniz.');
  }

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      ...(input.probability !== undefined ? { probability: newProbability } : {}),
      ...(input.status !== undefined ? { status: newStatus } : {}),
    },
  });

  await finalizeCheckIn(tenantId, opportunityId, {
    recordedById: userId || opp.assignedToId,
    previousProbability: opp.probability, newProbability,
    previousStatus: opp.status, newStatus,
    changed, note,
  });
}

// Otomatik iz (PUT /:id) — çağıran taraf probability/status'ün ZATEN farklı
// olduğunu doğrulamış ve Opportunity'ye kendi update'inde yazmış olmalı; burada
// sadece log + döngü sıfırlama yapılır.
export async function logAutoProgressChange(
  tenantId: string,
  opportunityId: string,
  userId: string | undefined,
  before: { probability: number; status: string },
  after: { probability: number; status: string },
): Promise<void> {
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId }, select: { assignedToId: true } });
  await finalizeCheckIn(tenantId, opportunityId, {
    recordedById: userId || opp?.assignedToId || 'system',
    previousProbability: before.probability, newProbability: after.probability,
    previousStatus: before.status, newStatus: after.status,
    changed: true, note: null,
  });
}
