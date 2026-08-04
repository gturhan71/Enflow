import { prisma } from '../prismaClient';
import { getAgentPluginForRole } from './pluginCatalog';
import { agentActorId } from './agentProvenance';
import { resolveApproverRoles } from './governance';

// Faz 0 — diyagramdaki kurumsal onay sırası:
// Presales hazırlar → Finans değerlendirir → İGB onaylar → Üst Yönetim (GMÜ) karar verir → KSU evrak kontrolü
// Presales bir onay aşaması değil (hazırlayan taraf); zincir Finans'tan başlar.
export const APPROVAL_CHAIN_TEMPLATES: Record<string, string[]> = {
  OPPORTUNITY: ['FINANCE_MGR', 'IGPD_MGR', 'GENERAL_MANAGER', 'KSU_MGR'],
  PROPOSAL: ['FINANCE_MGR', 'IGPD_MGR', 'GENERAL_MANAGER', 'KSU_MGR'],
  // Sözleşme imzalama: evrak/sözleşme kontrolü (KSU) → yönetici imza onayı (GM)
  CONTRACT_WORKFLOW_SIGNING: ['KSU_MGR', 'GENERAL_MANAGER'],
};

/**
 * Mevcut PENDING bir zincir varsa onu döner; yoksa şablona göre yeni bir
 * ApprovalChain + ApprovalStage seti oluşturur. Eski statü tabanlı onay
 * akışlarının (Opportunity.technicalStatus, ContractWorkflow.status) yanına
 * paralel/ek bir kayıt katmanı olarak eklenir — onları değiştirmez.
 */
export async function ensureApprovalChain(
  tenantId: string,
  entityType: string,
  entityId: string,
  roles?: string[],
  amount?: number | null,
) {
  const existing = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId, status: 'PENDING' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (existing) return existing;

  // DoA: explicit roles > tutar-bazlı matris (opt-in) > sabit şablon > GM.
  let stageRoles = roles;
  if (!stageRoles) {
    const matrixRoles = await resolveApproverRoles(tenantId, amount);
    stageRoles = matrixRoles || APPROVAL_CHAIN_TEMPLATES[entityType] || ['GENERAL_MANAGER'];
  }

  return prisma.approvalChain.create({
    data: {
      tenantId,
      entityType,
      entityId,
      stages: { create: stageRoles.map((role, i) => ({ role, order: i })) },
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Mevcut tek-tıkla onay UI'ları (Opportunity GM onayı, ContractWorkflow imza
 * onayı) tüm zinciri tek seferde tamamlanmış olarak işaretler. Aşama bazlı
 * onay akışı (Finans → İGB → GM → KSU) ileride Finans swimlane UI'sından
 * `/approval-chains/:id/stages/:stageId/approve` ile devreye girer.
 */
export async function completeApprovalChain(
  tenantId: string,
  entityType: string,
  entityId: string,
  approverId?: string,
  note?: string
) {
  const chain = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId, status: 'PENDING' },
  });
  if (!chain) return null;

  await prisma.approvalStage.updateMany({
    where: { chainId: chain.id, status: 'PENDING' },
    data: { status: 'APPROVED', approverId, note, approvedAt: new Date() },
  });

  return prisma.approvalChain.update({
    where: { id: chain.id },
    data: { status: 'COMPLETED' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Skip-logic: tenant'ta **hiçbir aktif kullanıcıya** karşılık gelmeyen role
 * sahip PENDING aşamaları `SKIPPED` işaretler ve geriye PENDING aşama
 * kalmadıysa zinciri COMPLETED yapar. Böylece akıştan çıkarılan bir
 * rol/birim onay zincirini tıkayamaz (deadlock önlenir). İdempotent.
 *
 * Güncellenmiş zinciri (stages dahil) döner.
 */
export async function autoSkipOrphanStages(tenantId: string, chainId: string) {
  const chain = await prisma.approvalChain.findFirst({
    where: { id: chainId, tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!chain || chain.status !== 'PENDING') return chain;

  const activeRoleRows = await prisma.user.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { role: true },
    distinct: ['role'],
  });
  const activeRoles = new Set(activeRoleRows.map(r => r.role));

  const orphanStages = chain.stages.filter(
    s => s.status === 'PENDING' && !activeRoles.has(s.role)
  );

  // Faz 8.2 — Sanal agent dalı: boş koltuğu (aktif kullanıcısı olmayan rol)
  // lisanslı bir sanal agent dolduruyorsa ve mod OTONOM ise, aşamayı atlamak
  // yerine agent "onaylar" (boş koltuğu tam doldurur). Danışman modunda veya
  // agent yoksa eski skip davranışı korunur (deadlock önlenir).
  const agentApprovedIds: string[] = [];
  const skippedIds: string[] = [];
  for (const stage of orphanStages) {
    const plugin = getAgentPluginForRole(stage.role);
    let autonomousAgent = false;
    if (plugin) {
      const ent = await prisma.pluginEntitlement.findUnique({
        where: { tenantId_pluginKey: { tenantId, pluginKey: plugin.key } },
      });
      const active =
        !!ent &&
        (ent.status === 'ACTIVE' || ent.status === 'TRIAL') &&
        (!ent.expiresAt || ent.expiresAt.getTime() >= Date.now());
      autonomousAgent = active && ent!.mode === 'AUTONOMOUS';
    }
    if (autonomousAgent && plugin) {
      // Köken etiketi: her agent-onaylı aşama için bir AgentRun (RATIFIED) oluştur,
      // aşamayı bu çalıştırmaya bağla → bir sonraki adım kimin onayladığını görür.
      const actorId = agentActorId(plugin.key);
      const rationale = `Boş koltuk (${stage.role}) — ${plugin.name} otonom modda onayladı.`;
      const run = await prisma.agentRun.create({
        data: {
          tenantId,
          pluginKey: plugin.key,
          unitKey: plugin.unitKey ?? '',
          entityType: 'APPROVAL_STAGE',
          entityId: stage.id,
          mode: 'AUTONOMOUS',
          status: 'RATIFIED',
          rationale,
          outputJson: JSON.stringify({ chainEntityType: chain.entityType, chainEntityId: chain.entityId, role: stage.role }),
          ratifiedById: actorId,
          ratifiedAt: new Date(),
        },
      });
      await prisma.approvalStage.update({
        where: { id: stage.id },
        data: {
          status: 'APPROVED',
          approverId: actorId,
          note: 'Boş koltuk — sanal agent (otonom) onayladı',
          approvedAt: new Date(),
          agentRunId: run.id,
        },
      });
      await prisma.activityLog.create({
        data: {
          action: 'APPROVAL_STAGE_APPROVE',
          entityType: 'APPROVAL_STAGE',
          entityId: stage.id,
          details: JSON.stringify({ pluginKey: plugin.key, role: stage.role, rationale }),
          userId: actorId,
          actorType: 'AGENT',
          agentRunId: run.id,
          tenantId,
        },
      });
      agentApprovedIds.push(stage.id);
    } else {
      skippedIds.push(stage.id);
    }
  }

  if (skippedIds.length > 0) {
    await prisma.approvalStage.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: 'SKIPPED', note: 'Rol tenant\'ta aktif değil — otomatik atlandı', approvedAt: new Date() },
    });
  }

  const resolvedIds = [...agentApprovedIds, ...skippedIds];

  // Çözüm sonrası PENDING kalan var mı?
  const stillPending = chain.stages.some(
    s => s.status === 'PENDING' && !resolvedIds.includes(s.id)
  );
  if (!stillPending) {
    const hasRejected = chain.stages.some(s => s.status === 'REJECTED');
    await prisma.approvalChain.update({
      where: { id: chainId },
      data: { status: hasRejected ? 'REJECTED' : 'COMPLETED' },
    });
  }

  return prisma.approvalChain.findFirst({
    where: { id: chainId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

/**
 * B-08 — vekalet (delegasyon): kullanıcı X izinliyken (delegateToUserId ile)
 * kendi rolündeki onayları vekiline devreder. `delegateUntil` null ise süresiz,
 * doluysa yalnız o tarihe kadar aktif.
 * Bir kullanıcının "vekaleten" onaylayabileceği roller (kendisine vekalet verilmiş roller).
 */
export async function getDelegatedRoles(tenantId: string, userId: string): Promise<string[]> {
  const now = new Date();
  const delegators = await prisma.user.findMany({
    where: {
      tenantId,
      delegateToUserId: userId,
      OR: [{ delegateUntil: null }, { delegateUntil: { gte: now } }],
    },
    select: { role: true },
    distinct: ['role'],
  });
  return delegators.map(d => d.role);
}

/** Bir kullanıcı bir role ait onayı yapabilir mi? (kendi rolü ya da aktif vekalet). */
export async function resolveEffectiveApprover(tenantId: string, role: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return false;
  if (user.role === role) return true;
  const delegatedRoles = await getDelegatedRoles(tenantId, userId);
  return delegatedRoles.includes(role);
}

/** Onay geri çekildiğinde (revert-approval) en güncel zinciri PENDING'e döndürür. */
export async function resetApprovalChain(tenantId: string, entityType: string, entityId: string) {
  const chain = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
  if (!chain) return null;

  await prisma.approvalStage.updateMany({
    where: { chainId: chain.id },
    data: { status: 'PENDING', approverId: null, note: null, approvedAt: null },
  });

  return prisma.approvalChain.update({ where: { id: chain.id }, data: { status: 'PENDING' } });
}
