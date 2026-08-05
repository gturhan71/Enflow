// Enflow — Personel devri (terfi/işten ayrılma otomasyonu)
// ─────────────────────────────────────────────────────────────────────────────
// Bir kullanıcı terfi ettiğinde (rol değişince, opsiyonel) veya işten
// ayrıldığında (deaktivasyon/silme öncesi, ZORUNLU) sahip olduğu AKTİF iş
// kayıtlarının başka bir kullanıcıya devredilmesini sağlar.
//
// Kategori seçimi bilinçli: yalnız "aktif sorumluluk" alanları (Faz 1, bkz.
// CATEGORIES) devredilir. Tarihsel/olay alanları (Opportunity.createdById,
// ApprovalStage.approverId, PurchaseRequest.requestedBy/approvedBy*,
// ActivityLog.userId vb.) BİLEREK dokunulmaz — kim ne yaptı kaydı asla
// yeniden yazılmaz. ApprovalStage.approverId'ye özellikle dokunulmuyor: yalnız
// APPROVED/REJECTED/SKIPPED'te set edilir (PENDING'de null), yönlendirme
// `role` alanına göre çalışır ve autoSkipOrphanStages (approvalChainService.ts)
// zaten "role'de aktif kimse yok" durumunu self-healing çözer.

import { prisma } from '../prismaClient';

// `prisma` .$extends() ile genişletilmiş bir client — Prisma.TransactionClient
// (temel client'ın tipi) yapısal olarak uyuşmuyor. Gerçek tx tipini doğrudan
// bu client'ın kendi $transaction imzasından türetiyoruz.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface OwnedCategory {
  key: string;
  label: string;
  count: number;
  sample: { id: string; label: string }[];
}

export interface OwnedItemsResult {
  userId: string;
  userName: string;
  role: string;
  status: string;
  categories: OwnedCategory[];
  totalActive: number;
  inboundDelegationCount: number;   // bu kullanıcıya vekalet vermiş kişi sayısı
  createdOpportunityCount: number;  // hard-delete'i engelleyen tarihsel sayaç
  hardDeleteBlocked: boolean;
}

export interface TransferResult {
  transferred: Record<string, number>;
  clearedInboundDelegations: number;
}

interface CategoryDef {
  key: string;
  label: string;
  count: (tenantId: string, userId: string) => Promise<number>;
  sample: (tenantId: string, userId: string) => Promise<{ id: string; label: string }[]>;
  transfer: (tx: Tx, tenantId: string, fromUserId: string, toUserId: string, toUserName: string) => Promise<number>;
}

const ACTIVE_PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'];
const ACTIVE_LEGAL_STATUSES = ['OPEN', 'IN_REVIEW', 'RESPONDED', 'ESCALATED'];
const ACTIVE_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_PART'];
const ACTIVE_TENDER_STATUSES = ['DRAFT', 'PREPARING', 'SUBMITTED', 'EVALUATING'];

const CATEGORIES: CategoryDef[] = [
  {
    key: 'OPPORTUNITY_ASSIGNED', label: 'Atanmış Fırsatlar',
    count: (tenantId, userId) => prisma.opportunity.count({ where: { tenantId, assignedToId: userId } }),
    sample: async (tenantId, userId) => (await prisma.opportunity.findMany({
      where: { tenantId, assignedToId: userId }, take: 5, select: { id: true, title: true },
    })).map((r) => ({ id: r.id, label: r.title })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.opportunity.updateMany({ where: { tenantId, assignedToId: fromUserId }, data: { assignedToId: toUserId } })).count,
  },
  {
    key: 'PROJECT_PM', label: 'Proje Yöneticiliği (PM)',
    count: (tenantId, userId) => prisma.project.count({ where: { tenantId, pmId: userId, status: { in: ACTIVE_PROJECT_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.project.findMany({
      where: { tenantId, pmId: userId, status: { in: ACTIVE_PROJECT_STATUSES } }, take: 5, select: { id: true, name: true },
    })).map((r) => ({ id: r.id, label: r.name })),
    transfer: async (tx, tenantId, fromUserId, toUserId, toUserName) =>
      (await tx.project.updateMany({ where: { tenantId, pmId: fromUserId, status: { in: ACTIVE_PROJECT_STATUSES } }, data: { pmId: toUserId, pmName: toUserName } })).count,
  },
  {
    key: 'PROJECT_OWNER', label: 'Proje Sahipliği',
    count: (tenantId, userId) => prisma.project.count({ where: { tenantId, ownerId: userId, status: { in: ACTIVE_PROJECT_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.project.findMany({
      where: { tenantId, ownerId: userId, status: { in: ACTIVE_PROJECT_STATUSES } }, take: 5, select: { id: true, name: true },
    })).map((r) => ({ id: r.id, label: r.name })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.project.updateMany({ where: { tenantId, ownerId: fromUserId, status: { in: ACTIVE_PROJECT_STATUSES } }, data: { ownerId: toUserId } })).count,
  },
  {
    key: 'PROJECT_MANAGER', label: 'Proje Yönetimi',
    count: (tenantId, userId) => prisma.project.count({ where: { tenantId, managerId: userId, status: { in: ACTIVE_PROJECT_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.project.findMany({
      where: { tenantId, managerId: userId, status: { in: ACTIVE_PROJECT_STATUSES } }, take: 5, select: { id: true, name: true },
    })).map((r) => ({ id: r.id, label: r.name })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.project.updateMany({ where: { tenantId, managerId: fromUserId, status: { in: ACTIVE_PROJECT_STATUSES } }, data: { managerId: toUserId } })).count,
  },
  {
    key: 'TASK_ASSIGNED', label: 'Bekleyen Görevler',
    count: (tenantId, userId) => prisma.todoTask.count({ where: { tenantId, assignedToUserId: userId, status: 'PENDING' } }),
    sample: async (tenantId, userId) => (await prisma.todoTask.findMany({
      where: { tenantId, assignedToUserId: userId, status: 'PENDING' }, take: 5, select: { id: true, title: true },
    })).map((r) => ({ id: r.id, label: r.title })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.todoTask.updateMany({ where: { tenantId, assignedToUserId: fromUserId, status: 'PENDING' }, data: { assignedToUserId: toUserId } })).count,
  },
  {
    key: 'UNIT_MANAGER', label: 'Yönettiği Birimler',
    count: (tenantId, userId) => prisma.unit.count({ where: { tenantId, managerId: userId } }),
    sample: async (tenantId, userId) => (await prisma.unit.findMany({
      where: { tenantId, managerId: userId }, take: 5, select: { id: true, name: true },
    })).map((r) => ({ id: r.id, label: r.name })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.unit.updateMany({ where: { tenantId, managerId: fromUserId }, data: { managerId: toUserId } })).count,
  },
  {
    key: 'LEGAL_CASE_ASSIGNED', label: 'Atanmış Hukuk Vakaları',
    count: (tenantId, userId) => prisma.legalCase.count({ where: { tenantId, assignedToId: userId, status: { in: ACTIVE_LEGAL_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.legalCase.findMany({
      where: { tenantId, assignedToId: userId, status: { in: ACTIVE_LEGAL_STATUSES } }, take: 5, select: { id: true, title: true },
    })).map((r) => ({ id: r.id, label: r.title })),
    transfer: async (tx, tenantId, fromUserId, toUserId, toUserName) =>
      (await tx.legalCase.updateMany({ where: { tenantId, assignedToId: fromUserId, status: { in: ACTIVE_LEGAL_STATUSES } }, data: { assignedToId: toUserId, assignedToName: toUserName } })).count,
  },
  {
    key: 'SERVICE_TICKET_ASSIGNED', label: 'Atanmış Servis Talepleri',
    count: (tenantId, userId) => prisma.serviceTicket.count({ where: { tenantId, assignedToUserId: userId, status: { in: ACTIVE_TICKET_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.serviceTicket.findMany({
      where: { tenantId, assignedToUserId: userId, status: { in: ACTIVE_TICKET_STATUSES } }, take: 5, select: { id: true, title: true },
    })).map((r) => ({ id: r.id, label: r.title })),
    transfer: async (tx, tenantId, fromUserId, toUserId) =>
      (await tx.serviceTicket.updateMany({ where: { tenantId, assignedToUserId: fromUserId, status: { in: ACTIVE_TICKET_STATUSES } }, data: { assignedToUserId: toUserId } })).count,
  },
  {
    key: 'TENDER_OWNER', label: 'Sahip Olduğu İhaleler',
    count: (tenantId, userId) => prisma.tender.count({ where: { tenantId, ownerId: userId, status: { in: ACTIVE_TENDER_STATUSES } } }),
    sample: async (tenantId, userId) => (await prisma.tender.findMany({
      where: { tenantId, ownerId: userId, status: { in: ACTIVE_TENDER_STATUSES } }, take: 5, select: { id: true, name: true },
    })).map((r) => ({ id: r.id, label: r.name })),
    transfer: async (tx, tenantId, fromUserId, toUserId, toUserName) =>
      (await tx.tender.updateMany({ where: { tenantId, ownerId: fromUserId, status: { in: ACTIVE_TENDER_STATUSES } }, data: { ownerId: toUserId, ownerName: toUserName } })).count,
  },
  {
    key: 'UNIT_REPORT_ESCALATED', label: 'Bekleyen Rapor Eskalasyonu',
    count: (tenantId, userId) => prisma.unitReport.count({ where: { tenantId, escalatedToId: userId, status: 'SUBMITTED' } }),
    sample: async (tenantId, userId) => (await prisma.unitReport.findMany({
      where: { tenantId, escalatedToId: userId, status: 'SUBMITTED' }, take: 5, select: { id: true, unitLabel: true, periodLabel: true },
    })).map((r) => ({ id: r.id, label: r.periodLabel ? `${r.unitLabel} — ${r.periodLabel}` : r.unitLabel })),
    transfer: async (tx, tenantId, fromUserId, toUserId, toUserName) =>
      (await tx.unitReport.updateMany({ where: { tenantId, escalatedToId: fromUserId, status: 'SUBMITTED' }, data: { escalatedToId: toUserId, escalatedToName: toUserName } })).count,
  },
];

export async function getOwnedItems(tenantId: string, userId: string): Promise<OwnedItemsResult> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const categories: OwnedCategory[] = [];
  for (const c of CATEGORIES) {
    const count = await c.count(tenantId, userId);
    const sample = count > 0 ? await c.sample(tenantId, userId) : [];
    categories.push({ key: c.key, label: c.label, count, sample });
  }
  const totalActive = categories.reduce((s, c) => s + c.count, 0);
  const inboundDelegationCount = await prisma.user.count({ where: { tenantId, delegateToUserId: userId } });
  const createdOpportunityCount = await prisma.opportunity.count({ where: { tenantId, createdById: userId } });

  return {
    userId: user.id, userName: user.name, role: user.role, status: user.status,
    categories, totalActive, inboundDelegationCount, createdOpportunityCount,
    hardDeleteBlocked: createdOpportunityCount > 0,
  };
}

async function transferOwnershipTx(tx: Tx, params: {
  tenantId: string; fromUserId: string; toUserId: string; toUserName: string; categoryKeys?: string[];
}): Promise<TransferResult> {
  const { tenantId, fromUserId, toUserId, toUserName } = params;
  // undefined = tüm kategoriler; boş dizi [] = bilerek "hiçbiri" (falsy-length tuzağına
  // düşmemek için `!== undefined` ile ayrıştırılıyor, `?.length` değil).
  const targets = params.categoryKeys !== undefined
    ? CATEGORIES.filter((c) => params.categoryKeys!.includes(c.key))
    : CATEGORIES;

  const transferred: Record<string, number> = {};
  for (const c of targets) {
    transferred[c.key] = await c.transfer(tx, tenantId, fromUserId, toUserId, toUserName);
  }
  const cleared = await tx.user.updateMany({ where: { tenantId, delegateToUserId: fromUserId }, data: { delegateToUserId: null } });
  return { transferred, clearedInboundDelegations: cleared.count };
}

export async function transferOwnership(params: {
  tenantId: string; fromUserId: string; toUserId: string; categoryKeys?: string[];
}): Promise<TransferResult> {
  const { tenantId, fromUserId, toUserId } = params;
  if (fromUserId === toUserId) throw new Error('Kaynak ve hedef kullanıcı aynı olamaz.');
  const toUser = await prisma.user.findFirst({ where: { id: toUserId, tenantId, status: 'ACTIVE' } });
  if (!toUser) throw new Error('Hedef kullanıcı bulunamadı veya aktif değil.');

  return prisma.$transaction((tx) => transferOwnershipTx(tx, { ...params, toUserName: toUser.name }));
}

export async function deactivateUser(tenantId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } });
    // Kendi verdiği vekaleti de geçersiz kıl; ona vekalet verenlerin devri
    // transferOwnership içinde zaten temizlendi ama transfer edilecek aktif
    // kaydı yoksa (totalActive=0) transferOwnership hiç çağrılmamış olabilir.
    await tx.user.update({ where: { id: userId }, data: { delegateToUserId: null } });
    await tx.user.updateMany({ where: { tenantId, delegateToUserId: userId }, data: { delegateToUserId: null } });
  });
}

export async function hardDeleteUser(tenantId: string, userId: string): Promise<{ ok: true } | { ok: false; reason: string; blockingCount: number }> {
  const blockingCount = await prisma.opportunity.count({ where: { tenantId, createdById: userId } });
  if (blockingCount > 0) {
    return { ok: false, blockingCount, reason: `Bu kullanıcı ${blockingCount} fırsatın oluşturucusu olarak kayıtlı (tarihsel alan, değiştirilemez). Kalıcı silme mümkün değil — bunun yerine pasifleştirin.` };
  }
  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}
