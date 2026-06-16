import { prisma } from '../prismaClient';

// Faz 0 — diyagramdaki kurumsal onay sırası:
// Presales hazırlar → Finans değerlendirir → İGPD onaylar → Üst Yönetim (GMÜ) karar verir → KSU evrak kontrolü
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
  roles?: string[]
) {
  const existing = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId, status: 'PENDING' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (existing) return existing;

  const stageRoles = roles || APPROVAL_CHAIN_TEMPLATES[entityType] || ['GENERAL_MANAGER'];

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
 * onay akışı (Finans → İGPD → GM → KSU) ileride Finans swimlane UI'sından
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
