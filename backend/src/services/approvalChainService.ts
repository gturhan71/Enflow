import { prisma } from '../prismaClient';
import { getAgentPluginForRole } from './pluginCatalog';
import { agentActorId } from './agentProvenance';
import { resolveApproverRoles } from './governance';
import { getApprovalSlaBusinessDays } from './approvalSlaEscalation';
import { computeSlaDueDate } from '../utils/businessDays';

// Faz A (Süreç Motoru) — OPPORTUNITY/PROPOSAL/CONTRACT_WORKFLOW_SIGNING artık
// burada sabit değil: bu üç entityType için chain artık processEngine.ts
// tarafından, tenant'ın Ayarlar → İş Akışı Tasarımcısı'nda kurguladığı
// WorkflowStep zincirinden üretiliyor (advanceProcess). Bu sabit şablon yalnız
// `ensureApprovalChain`'in DIĞER (Tasarımcı'ya henüz taşınmamış) çağıranları
// için bir son-çare fallback olarak kalır — bkz. dmo.ts (zaten kendi rolünü
// açıkça geçiyor, bu şablona hiç düşmüyor). Yeni bir entityType eklerken bu
// tabloya sabit rol yazmak yerine processEngine.ts'e bir processKey tanımlamak
// tercih edilmeli (tenant-yapılandırılabilir).
export const APPROVAL_CHAIN_TEMPLATES: Record<string, string[]> = {};

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

  // B-05 — ilk aşamanın SLA süresi hemen atanır (sweep'i beklemeden); sonraki
  // aşamalar sırası geldiğinde approvalSlaEscalation.ts sweep'i tarafından atanır.
  const slaDays = await getApprovalSlaBusinessDays(tenantId);
  const firstStageDueDate = computeSlaDueDate(slaDays) ?? undefined;

  return prisma.approvalChain.create({
    data: {
      tenantId,
      entityType,
      entityId,
      stages: {
        create: stageRoles.map((role, i) => ({ role, order: i, dueDate: i === 0 ? firstStageDueDate : undefined })),
      },
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
 * Skip-logic: **hiçbir aktif kullanıcıya** karşılık gelmeyen PENDING aşamaları
 * `SKIPPED` işaretler ve geriye PENDING aşama kalmadıysa zinciri COMPLETED
 * yapar. Böylece akıştan çıkarılan bir rol/birim onay zincirini tıkayamaz
 * (deadlock önlenir). Aşama `unitId` taşıyorsa (processEngine.ts'in ürettiği
 * unit-scope'lu aşamalar) kontrol o birime, `role` taşıyorsa o role, ikisi de
 * varsa ikisinin kesişimine daraltılır — legacy (yalnız-role, tenant-geneli)
 * aşamalarla geriye dönük uyumlu. İdempotent.
 *
 * Güncellenmiş zinciri (stages dahil) döner.
 */
export async function autoSkipOrphanStages(tenantId: string, chainId: string) {
  const chain = await prisma.approvalChain.findFirst({
    where: { id: chainId, tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!chain || chain.status !== 'PENDING') return chain;

  const pendingStages = chain.stages.filter(s => s.status === 'PENDING');
  const orphanStages: typeof pendingStages = [];
  for (const stage of pendingStages) {
    if (!stage.role && !stage.unitId) continue; // kapsamsız aşama — savunma amaçlı, orphan sayılmaz
    const where: { tenantId: string; status: string; unitId?: string; role?: string } = { tenantId, status: 'ACTIVE' };
    if (stage.unitId) where.unitId = stage.unitId;
    if (stage.role) where.role = stage.role;
    const activeCount = await prisma.user.count({ where });
    if (activeCount > 0) continue; // koltuk dolu — orphan değil
    // Değişmez kural #2 — bir VEKİL atanmışsa ve aktifse, koltuk boş olsa da
    // "orphan" sayılmaz: aşama PENDING kalır, vekil resolveEffectiveApprover
    // üzerinden normal onay/red rotasıyla işlemi yapar (sessiz SKIP/agent
    // devri yerine açıkça atanmış bir insanın devreye girmesi zorunlu).
    if (stage.delegateUserId) {
      const delegateActive = await prisma.user.count({ where: { id: stage.delegateUserId, tenantId, status: 'ACTIVE' } });
      if (delegateActive > 0) continue;
    }
    orphanStages.push(stage);
  }

  // Faz 8.2 — Sanal agent dalı: boş koltuğu (aktif kullanıcısı olmayan rol)
  // lisanslı bir sanal agent dolduruyorsa ve mod OTONOM ise, aşamayı atlamak
  // yerine agent "onaylar" (boş koltuğu tam doldurur). Danışman modunda veya
  // agent yoksa eski skip davranışı korunur (deadlock önlenir).
  const agentApprovedIds: string[] = [];
  const skippedIds: string[] = [];
  for (const stage of orphanStages) {
    const plugin = stage.role ? getAgentPluginForRole(stage.role) : null;
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
      const rationale = `Boş koltuk (${stage.role || stage.unitId || 'birim'}) — ${plugin.name} otonom modda onayladı.`;
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

/**
 * Bir kullanıcı bir onay aşamasını çözümleyebilir mi? — önce VEKİL kontrolü
 * (`stage.delegateUserId` — WorkflowStep/ApprovalStage üzerinde açıkça atanmış,
 * boş koltuk için tanımlı kişi; her zaman geçerli bir onaylayıcıdır, koltuk o an
 * dolu olsa bile). Sonra `stage.role` set ise kendi rolü (ya da o role aktif
 * vekalet — `User.delegateToUserId`, farklı bir mekanizma: kişinin KENDİ
 * onaylarını başkasına devretmesi) + `stage.unitId` set ise ayrıca o birime
 * üye olması gerekir. `stage.role` null ise (yalnız-birim aşaması) yetki tek
 * başına birim üyeliğinden gelir. `role` bir string olarak da geçilebilir
 * (geriye dönük uyumluluk — DMO gibi yalnız role dayalı çağıranlar için).
 */
export async function resolveEffectiveApprover(
  tenantId: string,
  stage: { role: string | null; unitId?: string | null; delegateUserId?: string | null } | string,
  userId: string,
): Promise<boolean> {
  const norm = typeof stage === 'string' ? { role: stage, unitId: null, delegateUserId: null } : stage;
  if (norm.delegateUserId && norm.delegateUserId === userId) return true;

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) return false;

  const unitOk = !norm.unitId || user.unitId === norm.unitId;
  if (!norm.role) return unitOk; // yalnız-birim aşaması: tek koşul birim üyeliği

  if (user.role === norm.role && unitOk) return true;
  const delegatedRoles = await getDelegatedRoles(tenantId, userId);
  // Vekalet role-bazlı çalışır, birim kısıtlaması vekalette uygulanmaz (bilinen sınır).
  return delegatedRoles.includes(norm.role);
}

/**
 * Bir onay kararından (approve/reject) sonra aynı `order`'ı paylaşan aşama
 * grubunu (çoklu onaylayıcı) çözümler: ANY modunda ilk onay kardeş PENDING
 * aşamaları otomatik SKIPPED yapar; ALL modunda grubun tamamı karar
 * bekler. Grup tamamen çözülünce (PENDING kalmadıysa) bir sonraki grup
 * "current" olur; hiç aşama kalmadıysa zincir COMPLETED olur. Herhangi bir
 * aşama REJECTED ise (hangi moddan olursa olsun) zincir anında REJECTED olur.
 */
export async function resolveGroupAfterDecision(tenantId: string, chainId: string) {
  const chain = await prisma.approvalChain.findFirst({
    where: { id: chainId, tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!chain || chain.status !== 'PENDING') return chain;

  if (chain.stages.some(s => s.status === 'REJECTED')) {
    return prisma.approvalChain.update({
      where: { id: chainId },
      data: { status: 'REJECTED' },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }

  const pending = chain.stages.filter(s => s.status === 'PENDING');
  if (pending.length === 0) {
    return prisma.approvalChain.update({
      where: { id: chainId },
      data: { status: 'COMPLETED' },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }

  const minOrder = Math.min(...pending.map(s => s.order));
  const group = chain.stages.filter(s => s.order === minOrder);
  const mode = group[0]?.mode || 'ANY';
  const approvedInGroup = group.filter(s => s.status === 'APPROVED');

  if (mode === 'ANY' && approvedInGroup.length > 0) {
    const siblingIds = group.filter(s => s.status === 'PENDING').map(s => s.id);
    if (siblingIds.length) {
      await prisma.approvalStage.updateMany({
        where: { id: { in: siblingIds } },
        data: { status: 'SKIPPED', note: 'Diğer onaycı onayladı (ANY modu)', approvedAt: new Date() },
      });
    }
  }

  const refreshed = await prisma.approvalChain.findFirst({
    where: { id: chainId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!refreshed) return null;

  const groupStillPending = refreshed.stages.some(s => s.order === minOrder && s.status === 'PENDING');
  if (!groupStillPending) {
    const anyPending = refreshed.stages.some(s => s.status === 'PENDING');
    if (!anyPending) {
      return prisma.approvalChain.update({
        where: { id: chainId },
        data: { status: 'COMPLETED' },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
    }
  }
  return refreshed;
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
