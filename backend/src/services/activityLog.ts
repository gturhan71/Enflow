import { prisma } from '../prismaClient';

// Merkezi denetim-izi (ActivityLog) yazıcı.
// NON-THROWING: loglama hiçbir koşulda ana işlemi bozmaz (hata yutulur).
// İnsan işlemleri actorType='HUMAN' (varsayılan); agent işlemleri actorType='AGENT' + agentRunId
// (bkz. agentProvenance.ts — Faz 8.3).

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
    await prisma.activityLog.create({
      data: {
        tenantId: p.tenantId,
        userId: p.userId || 'system',
        action: p.action,
        entityType: p.entityType,
        entityId: p.entityId,
        details: p.details ? JSON.stringify(p.details) : null,
        actorType: p.actorType || 'HUMAN',
        agentRunId: p.agentRunId || null,
      },
    });
  } catch {
    /* denetim-izi yazımı ana akışı asla bozmaz */
  }
}
