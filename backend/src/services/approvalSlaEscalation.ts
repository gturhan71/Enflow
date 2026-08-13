// Enflow — ApprovalStage SLA aşımı eskalasyon sweep'i (poll-bazlı, cron yok)
// ─────────────────────────────────────────────────────────────────────────────
// B-05: slaEscalation.ts (TodoTask) ile birebir aynı desende, ama onay
// zincirine özgü — süresi geçmiş "current" (sıradaki ilk PENDING) stage'ler
// için idempotent (escalatedAt) bir kez GENERAL_MANAGER'a ek onay yetkisi
// (escalatedToRole) tanımlar + bildirim üretir. Orijinal rol sahibinin yetkisi
// kaldırılmaz — gerçek bir devir (approve/reject endpoint'lerinde escalatedToRole
// da kabul edilir), yalnız bildirim değil. GET /api/approval-chains çağrısında tetiklenir.

import { prisma } from '../prismaClient';
import { computeSlaDueDate } from '../utils/businessDays';

const lastSweepByTenant = new Map<string, number>();
const DEFAULT_SLA_BUSINESS_DAYS = 2;
const ESCALATION_ROLE = 'GENERAL_MANAGER';

export async function getApprovalSlaBusinessDays(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  try {
    const ms = JSON.parse(t?.moduleSettings || '{}') as { approvals?: { slaBusinessDays?: number } };
    return typeof ms.approvals?.slaBusinessDays === 'number' ? ms.approvals.slaBusinessDays : DEFAULT_SLA_BUSINESS_DAYS;
  } catch {
    return DEFAULT_SLA_BUSINESS_DAYS;
  }
}

export async function sweepApprovalSlaEscalations(tenantId: string): Promise<void> {
  const now = Date.now();
  const last = lastSweepByTenant.get(tenantId) || 0;
  if (now - last < 60_000) return;
  lastSweepByTenant.set(tenantId, now);

  try {
    const slaDays = await getApprovalSlaBusinessDays(tenantId);
    const chains = await prisma.approvalChain.findMany({
      where: { tenantId, status: 'PENDING' },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    for (const chain of chains) {
      // Süreç Motoru (Faz A) çoklu-onaylayıcı desteği: aynı `order`'ı paylaşan
      // birden çok satır tek mantıksal "current" grup olabilir — her satır
      // kendi SLA/eskalasyon saatini bağımsız işletir (bkz. resolveGroupAfterDecision).
      const pending = chain.stages.filter(s => s.status === 'PENDING');
      if (!pending.length) continue;
      const minOrder = Math.min(...pending.map(s => s.order));
      const currentGroup = pending.filter(s => s.order === minOrder);

      for (const current of currentGroup) {
        if (!current.dueDate) {
          // Taban "şimdi" — stage.createdAt zincirin oluşturulma anıdır (tüm aşamalar
          // birlikte create edilir), "bu aşamanın sıraya girdiği an" değil. "now" kullanmak
          // hem yeni sıraya giren aşamalara taze bir SLA penceresi verir hem de bu özellik
          // ilk devreye girdiğinde haftalarca eski bekleyen zincirlerin anında "aşılmış"
          // sayılıp toplu eskalasyon bildirimi patlatmasını önler.
          await prisma.approvalStage.update({
            where: { id: current.id },
            data: { dueDate: computeSlaDueDate(slaDays) ?? undefined },
          }).catch(() => {});
          continue; // süre yeni belirlendi — bu turda aşım değerlendirilmez
        }

        if (current.escalatedAt || current.dueDate.getTime() >= now) continue;

        await prisma.approvalStage.update({
          where: { id: current.id },
          data: { escalatedAt: new Date(), escalatedToRole: ESCALATION_ROLE },
        }).catch(() => {});

        // role set ise: orijinal rol + eskalasyon rolü. Yalnız-birim aşamasında
        // (role=null, processEngine.ts'in ürettiği unit-scope'lu aşamalar):
        // birim üyeleri + eskalasyon rolündeki herkes hedeflenir.
        const targets = current.role
          ? await prisma.user.findMany({ where: { tenantId, status: 'ACTIVE', role: { in: [current.role, ESCALATION_ROLE] } } })
          : await prisma.user.findMany({ where: { tenantId, status: 'ACTIVE', OR: [{ unitId: current.unitId ?? undefined }, { role: ESCALATION_ROLE }] } });
        for (const u of targets) {
          await prisma.notification.create({
            data: {
              tenantId, userId: u.id, type: 'WARNING',
              title: 'Onay SLA aşıldı — üst yönetime eskale edildi',
              message: `${chain.entityType} onayı${current.role ? ` (${current.role})` : ''} SLA süresini aştı, Genel Müdür'e eskale edildi.`,
              relatedModule: 'todo', relatedItemId: chain.entityId,
            },
          }).catch(() => {});
        }
      }
    }
  } catch {
    // sweep ana akışı bozmaz
  }
}
