import { prisma } from '../prismaClient';
import { resolveActorName, resolveEntityLabel, buildSummary } from './activityLogSummary';

// Merkezi denetim-izi (ActivityLog) yazıcı.
// NON-THROWING: loglama hiçbir koşulda ana işlemi bozmaz (hata yutulur).
// İnsan işlemleri actorType='HUMAN' (varsayılan); agent işlemleri actorType='AGENT' + agentRunId
// (bkz. agentProvenance.ts — Faz 8.3).
// actorName/entityLabel/summary YAZMA ANINDA çözülüp satıra gömülür (write-time
// snapshot) — kayıt silinse/yeniden adlansa bile Denetim İzi ekranı ve ileride
// dışa aktarılan arşiv dosyası kendi başına anlamlı kalır (activityLogSummary.ts).

export interface LogActivityParams {
  tenantId: string;
  userId?: string;
  action: string;            // CREATE | UPDATE | DELETE | <STATUS> | özel
  entityType: string;        // OPPORTUNITY | CUSTOMER | PROJECT | ...
  entityId: string;
  details?: Record<string, unknown> | null;
  actorType?: 'HUMAN' | 'AGENT';
  agentRunId?: string | null;
}

export async function logActivity(p: LogActivityParams): Promise<void> {
  try {
    const userId = p.userId || 'system';
    const actorType = p.actorType || 'HUMAN';
    const [actorName, entityLabel] = await Promise.all([
      resolveActorName(userId, actorType),
      resolveEntityLabel(p.tenantId, p.entityType, p.entityId),
    ]);
    const summary = buildSummary({ actorName, action: p.action, entityType: p.entityType, entityLabel });
    await prisma.activityLog.create({
      data: {
        tenantId: p.tenantId,
        userId,
        action: p.action,
        entityType: p.entityType,
        entityId: p.entityId,
        details: p.details ? JSON.stringify(p.details) : null,
        actorType,
        agentRunId: p.agentRunId || null,
        actorName,
        entityLabel,
        summary,
      },
    });
  } catch {
    /* denetim-izi yazımı ana akışı asla bozmaz */
  }
}
