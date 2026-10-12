// Profesyonel Hizmetler (post-sales) — iş emri (WorkOrder). ServiceTicket'tan
// FARKLI: ServiceTicket müşteri arıza/garanti BİLDİRİMİ (intake), WorkOrder
// sahaya giden teknisyenin YÜRÜTME kaydı (dispatch/takvim/kapanış kanıtı).
// Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md (Faz 1).
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { nextDocumentNumber } from '../services/documentNumberService';
import { documentUpload, enforceStorageLimit } from '../utils/secureUpload';
import { slugify, getUploadDir } from '../utils/fileUpload';
import { countBusinessDaysInRange } from '../utils/businessDays';
import { sweepWorkOrderSla } from '../services/workOrderReminders';

const router: Router = Router();
router.use(tenantMiddleware, requireRole(['GENERAL_MANAGER', 'OPERATIONS_MGR', 'PROJECT_MGR', 'PS_TECH']));

// Dispatch (oluşturma/atama/onay) yalnız yönetici rolleri — PS_TECH yalnız
// kendi atandığı işi görür/yürütür (start/complete/signoff-upload).
const MANAGER_ROLES = new Set(['GENERAL_MANAGER', 'OPERATIONS_MGR', 'PROJECT_MGR']);
const isManager = (req: Request) => MANAGER_ROLES.has(req.userRole || '');

const WORK_ORDER_UPLOADS_ROOT = path.join(__dirname, '../../uploads/work-orders');
const signoffUpload = documentUpload(20);

const INCLUDE = {
  customer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, code: true, status: true, progress: true } },
  unit: { select: { id: true, name: true } },
  requiredSpecialty: { select: { id: true, name: true } },
  assignedTechnician: { select: { id: true, name: true } },
} as const;

// PS Müdürü'nün "projenin ihtiyaçlarını görebiliyor muyum" sorusuna UI cevabı —
// WorkOrder.project zaten include'da; burada yalnız detay görünümünde (liste
// değil, N+1 maliyeti olmasın diye) o projenin açık PurchaseRequest sayısı
// eklenir. Ayrı bir CRUD yüzeyi değil, Satınalma'ya salt-okunur bir özet/link.
async function openPurchaseRequestCount(tenantId: string, projectId: string | null): Promise<number | null> {
  if (!projectId) return null;
  return prisma.purchaseRequest.count({ where: { tenantId, projectId, status: { notIn: ['CLOSED', 'REJECTED'] } } });
}

// Teknisyen maliyeti (saat/günlük ücret) yalnız GM + Profesyonel Hizmetler
// Müdürü'ne görünür — kullanıcının kendisi "işe göre personel atama" kararı
// verirken görür, PROJECT_MGR/PS_TECH görmez. Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md.
const COST_VISIBLE_ROLES = new Set(['GENERAL_MANAGER', 'OPERATIONS_MGR']);
const canSeeCost = (req: Request) => COST_VISIBLE_ROLES.has(req.userRole || '');

// Proje bağlı bir iş emrinde, sözleşmenin teslim tarihi/ceza oranı salt-okunur
// öneri olarak sunulur (Faz 4 — "proje geneli SLA sözleşmede bellidir"). Yeni
// bir alan değil — WorkOrder.dueAt'e UI'dan kopyalanabilir, tek kaynak sözleşme kalır.
async function contractDeliverySla(tenantId: string, projectId: string | null): Promise<{ dueAt: string | null; penaltyDailyRatePct: number | null } | null> {
  if (!projectId) return null;
  const wf = await prisma.contractWorkflow.findFirst({
    where: { tenantId, projectId },
    select: { deliveryDueDate: true, penaltyDailyRatePct: true },
  });
  if (!wf || !wf.deliveryDueDate) return null;
  return { dueAt: wf.deliveryDueDate.toISOString(), penaltyDailyRatePct: wf.penaltyDailyRatePct };
}

// Bilgi amaçlı maliyet tahmini (işçilik + malzeme) — WorkOrder.costAmount'a
// OTOMATİK YAZILMAZ (kullanıcı kararı: yalnız bilgi amaçlı gösterilsin). İşçilik
// = (actualEndAt-actualStartAt) × teknisyenin ücreti; ikisi de yoksa null.
async function estimatedCosts(tenantId: string, order: { id: string; assignedTechnicianId: string | null; actualStartAt: Date | null; actualEndAt: Date | null }): Promise<{ estimatedLaborCost: number | null; estimatedMaterialCost: number | null; estimatedTotalCost: number | null; technicianCostRate: number | null; technicianCostRateUnit: string | null }> {
  let estimatedLaborCost: number | null = null;
  let technicianCostRate: number | null = null;
  let technicianCostRateUnit: string | null = null;
  if (order.assignedTechnicianId) {
    const tech = await prisma.user.findFirst({
      where: { id: order.assignedTechnicianId, tenantId },
      select: { costRate: true, costRateUnit: true },
    });
    technicianCostRate = tech?.costRate ?? null;
    technicianCostRateUnit = tech?.costRateUnit ?? null;
    if (tech?.costRate != null && order.actualStartAt && order.actualEndAt) {
      const hours = Math.max(0, (order.actualEndAt.getTime() - order.actualStartAt.getTime()) / 3_600_000);
      estimatedLaborCost = tech.costRateUnit === 'DAILY' ? Math.ceil(hours / 24 || 1) * tech.costRate : hours * tech.costRate;
      estimatedLaborCost = Math.round(estimatedLaborCost * 100) / 100;
    }
  }
  const materials = await prisma.workOrderMaterialRequest.aggregate({
    where: { tenantId, workOrderId: order.id, status: { not: 'REJECTED' } },
    _sum: { actualCost: true, estimatedCost: true },
  }).catch(() => null);
  const estimatedMaterialCost = materials
    ? (materials._sum.actualCost ?? materials._sum.estimatedCost ?? null)
    : null;
  const estimatedTotalCost = estimatedLaborCost != null || estimatedMaterialCost != null
    ? Math.round(((estimatedLaborCost || 0) + (estimatedMaterialCost || 0)) * 100) / 100
    : null;
  return { estimatedLaborCost, estimatedMaterialCost, estimatedTotalCost, technicianCostRate, technicianCostRateUnit };
}

// Profesyonel Hizmetler Müdürü'ne (OPERATIONS_MGR) aktif bildirim — önceden
// (ServiceTicket'ta da) bu yoktu, birim yöneticisi modülü kendi kontrol etmek
// zorundaydı. Role-wide (deliveryDeadlineReminders.ts paterni), oluşturan kişi
// kendisiyse atlanır (zaten biliyor).
async function notifyOperationsManagers(tenantId: string, workOrderId: string, notif: { title: string; message: string }, createdByUserId?: string): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { tenantId, role: 'OPERATIONS_MGR', status: 'ACTIVE', id: createdByUserId ? { not: createdByUserId } : undefined },
    select: { id: true },
  });
  if (!managers.length) return;
  await prisma.notification.createMany({
    data: managers.map((m) => ({
      tenantId, userId: m.id, type: 'INFO',
      title: notif.title, message: notif.message,
      relatedModule: 'professional-services', relatedItemId: workOrderId,
    })),
  }).catch(() => {});
}

function technicianOwnsOrManages(req: Request, workOrder: { assignedTechnicianId: string | null }): boolean {
  if (isManager(req)) return true;
  return !!workOrder.assignedTechnicianId && workOrder.assignedTechnicianId === req.userId;
}

router.get('/summary/all', asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (!isManager(req)) where.assignedTechnicianId = req.userId;
  const orders = await prisma.workOrder.findMany({ where, select: { status: true, assignedTechnicianId: true, assignedTechnician: { select: { name: true } }, createdAt: true, actualEndAt: true } });

  const openStatuses = new Set(['DRAFT', 'PENDING_SCHEDULE', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PART']);
  const byTechnician = new Map<string, { name: string; open: number; completed: number }>();
  let open = 0;
  let completed = 0;
  let totalResolutionDays = 0;
  let resolvedCount = 0;
  for (const o of orders) {
    if (openStatuses.has(o.status)) open++;
    if (o.status === 'COMPLETED' || o.status === 'CLOSED') {
      completed++;
      if (o.actualEndAt) {
        totalResolutionDays += (o.actualEndAt.getTime() - o.createdAt.getTime()) / 86_400_000;
        resolvedCount++;
      }
    }
    if (o.assignedTechnicianId) {
      const key = o.assignedTechnicianId;
      const entry = byTechnician.get(key) || { name: o.assignedTechnician?.name || '—', open: 0, completed: 0 };
      if (openStatuses.has(o.status)) entry.open++;
      if (o.status === 'COMPLETED' || o.status === 'CLOSED') entry.completed++;
      byTechnician.set(key, entry);
    }
  }
  res.json({
    total: orders.length,
    open,
    completed,
    avgResolutionDays: resolvedCount ? Math.round((totalResolutionDays / resolvedCount) * 10) / 10 : null,
    byTechnician: [...byTechnician.entries()].map(([userId, v]) => ({ userId, ...v })),
  });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  await sweepWorkOrderSla(req.tenantId); // SLA aşımı eskalasyonu (non-throwing)
  const { status, unitId, assignedTechnicianId, type, customerId, projectId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (unitId) where.unitId = unitId;
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (projectId) where.projectId = projectId;
  if (!isManager(req)) {
    where.assignedTechnicianId = req.userId; // PS_TECH yalnız kendi işlerini görür
  } else if (assignedTechnicianId) {
    where.assignedTechnicianId = assignedTechnicianId;
  }
  const orders = await prisma.workOrder.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(orders);
}));

// Sevkiyat için teknisyen listesi — "işe göre personel atama" (uzmanlık +
// maliyet görerek karar) ihtiyacını karşılar. /users/lookup (herkese açık,
// yalnız id/name) KASITLI olarak kullanılmadı — maliyet burada yalnız
// GM/OPERATIONS_MGR'a döner, /users/lookup'a eklense tüm roller görürdü.
router.get('/technicians', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Teknisyen listesini görme yetkiniz yok.' });
  const technicians = await prisma.user.findMany({
    where: { tenantId: req.tenantId, role: 'PS_TECH', status: 'ACTIVE' },
    select: {
      id: true, name: true, unitId: true,
      costRate: true, costRateUnit: true, costCurrency: true,
      workSpecialties: { select: { specialty: { select: { id: true, name: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const showCost = canSeeCost(req);
  res.json(technicians.map((t) => ({
    id: t.id,
    name: t.name,
    unitId: t.unitId,
    specialties: t.workSpecialties.map((s) => s.specialty),
    ...(showCost ? { costRate: t.costRate, costRateUnit: t.costRateUnit, costCurrency: t.costCurrency } : {}),
  })));
}));

// Faz 5 — Ekip Utilizasyonu. Kapasite = dönemdeki iş günü (hafta sonu hariç,
// resmi tatil listesi YOK — bilinçli basitleştirme) × 8 saat; içinde bulunulan
// ay için kapasite bugüne kadar PRORATE edilir (ayın tamamı değil), geçmiş
// aylar için tam ay. Maliyet yalnız GM/OPERATIONS_MGR'a döner (Faz 4 ile aynı kural).
router.get('/utilization', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Bu raporu görme yetkiniz yok.' });
  const monthParam = String(req.query.month || '');
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIdx = match ? Number(match[2]) - 1 : now.getMonth();

  const periodStart = new Date(year, monthIdx, 1);
  const lastDayOfMonth = new Date(year, monthIdx + 1, 0);
  const isCurrentOrFuture = lastDayOfMonth.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() && periodStart.getTime() <= now.getTime();
  const periodEnd = isCurrentOrFuture && lastDayOfMonth > now ? now : lastDayOfMonth;
  const capacityDays = periodEnd >= periodStart ? countBusinessDaysInRange(periodStart, periodEnd) : 0;
  const capacityHours = capacityDays * 8;

  const openStatuses = ['DRAFT', 'PENDING_SCHEDULE', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PART'];
  const technicians = await prisma.user.findMany({
    where: { tenantId: req.tenantId, role: 'PS_TECH', status: 'ACTIVE' },
    select: {
      id: true, name: true, costRate: true, costRateUnit: true,
      workSpecialties: { select: { specialty: { select: { id: true, name: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const showCost = canSeeCost(req);

  const result = [];
  for (const t of technicians) {
    const openCount = await prisma.workOrder.count({ where: { tenantId: req.tenantId, assignedTechnicianId: t.id, status: { in: openStatuses } } });
    const completedInPeriod = await prisma.workOrder.findMany({
      where: {
        tenantId: req.tenantId, assignedTechnicianId: t.id, status: { in: ['COMPLETED', 'CLOSED'] },
        actualEndAt: { gte: periodStart, lte: lastDayOfMonth },
      },
      select: { actualStartAt: true, actualEndAt: true, dueAt: true },
    });
    let totalHours = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    for (const o of completedInPeriod) {
      if (o.actualStartAt && o.actualEndAt) totalHours += (o.actualEndAt.getTime() - o.actualStartAt.getTime()) / 3_600_000;
      if (o.dueAt && o.actualEndAt) { if (o.actualEndAt.getTime() <= o.dueAt.getTime()) onTimeCount++; else lateCount++; }
    }
    totalHours = Math.round(totalHours * 10) / 10;
    const slaTotal = onTimeCount + lateCount;
    result.push({
      id: t.id,
      name: t.name,
      specialties: t.workSpecialties.map((s) => s.specialty),
      openCount,
      completedCount: completedInPeriod.length,
      totalHours,
      capacityHours,
      utilizationPct: capacityHours > 0 ? Math.round((totalHours / capacityHours) * 1000) / 10 : null,
      onTimeCount, lateCount,
      slaPerformancePct: slaTotal > 0 ? Math.round((onTimeCount / slaTotal) * 1000) / 10 : null,
      ...(showCost ? { estimatedLaborCost: t.costRate != null ? Math.round(totalHours * (t.costRateUnit === 'DAILY' ? t.costRate / 8 : t.costRate) * 100) / 100 : null } : {}),
    });
  }

  res.json({ month: `${year}-${String(monthIdx + 1).padStart(2, '0')}`, capacityDays, capacityHours, technicians: result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const order = await prisma.workOrder.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, include: INCLUDE });
  if (!order) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (!technicianOwnsOrManages(req, order)) return res.status(403).json({ error: 'Bu iş emrini görme yetkiniz yok.' });
  const openPrCount = await openPurchaseRequestCount(req.tenantId, order.projectId);
  const materialRequests = await prisma.workOrderMaterialRequest.findMany({
    where: { tenantId: req.tenantId, workOrderId: order.id },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const contractSla = await contractDeliverySla(req.tenantId, order.projectId);
  // Maliyet tahmini yalnız yönetici rollerine hesaplanır — ham teknisyen ücreti
  // (technicianCostRate) yalnız GM/OPERATIONS_MGR'a döner, PROJECT_MGR yalnız toplamı görür.
  const costs = isManager(req) ? await estimatedCosts(req.tenantId, order) : null;
  const { technicianCostRate, technicianCostRateUnit, ...publicCosts } = costs || {};
  res.json({
    ...order,
    openPurchaseRequestCount: openPrCount,
    materialRequests,
    contractDeliverySla: contractSla,
    ...(costs ? publicCosts : {}),
    ...(costs && canSeeCost(req) ? { technicianCostRate, technicianCostRateUnit } : {}),
  });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'İş emri oluşturma yetkiniz yok.' });
  const {
    type, title, description, priority, customerId, customerName, projectId, serviceTicketId,
    unitId, requiredSpecialtyId,
  } = req.body as Record<string, string | undefined>;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Başlık zorunludur.' });

  let resolvedCustomerName = customerName || null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: req.tenantId }, select: { customerId: true, customerName: true } });
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    resolvedCustomerName = resolvedCustomerName || project.customerName || null;
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: req.tenantId }, select: { name: true } });
    if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
    resolvedCustomerName = resolvedCustomerName || customer.name;
  }

  const workOrderNo = await nextDocumentNumber(req.tenantId, 'ISE').catch(() => null);

  const order = await prisma.workOrder.create({
    data: {
      tenantId: req.tenantId,
      workOrderNo,
      type: type || 'INSTALLATION',
      title: title.trim(),
      description: description || null,
      priority: priority || 'NORMAL',
      customerId: customerId || null,
      customerName: resolvedCustomerName,
      projectId: projectId || null,
      serviceTicketId: serviceTicketId || null,
      unitId: unitId || null,
      requiredSpecialtyId: requiredSpecialtyId || null,
    },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'WORK_ORDER', entityId: order.id, details: { title: order.title, type: order.type } });
  await notifyOperationsManagers(req.tenantId, order.id, {
    title: 'Yeni iş emri — sevkiyat bekliyor',
    message: `"${order.title}" iş emri oluşturuldu, teknisyen sevkiyatı bekliyor.`,
  }, req.userId);
  res.status(201).json(order);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'İş emri düzenleme yetkiniz yok.' });
  const id = String(req.params.id);
  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (['COMPLETED', 'CLOSED'].includes(record.status)) {
    return res.status(400).json({ error: 'Tamamlanmış/kapanmış bir iş emri düzenlenemez.' });
  }

  const {
    type, title, description, priority, customerId, customerName, projectId, unitId,
    requiredSpecialtyId, costAmount, costCurrency, status, servicePlanId,
  } = req.body as Record<string, string | number | undefined>;

  // COMPLETED'a bu uçtan geçiş YASAK — kapanış kanıtı zorunluluğu /:id/complete'te uygulanır.
  if (status === 'COMPLETED') return res.status(400).json({ error: 'Kapanış için /complete uç noktasını kullanın (kanıt dosyası zorunlu).' });
  // CLOSED için de aynı kanıt şartı — bu olmasaydı /complete'i hiç çağırmadan
  // doğrudan CLOSED'a geçilip kapanış kanıtı zorunluluğu atlatılabilirdi.
  if (status === 'CLOSED' && !record.customerSignOffFileUrl) {
    return res.status(400).json({ error: 'Kapanış için önce müşteri imza/kapanış kanıtı (dosya) yüklenmelidir.' });
  }

  if (servicePlanId) {
    const owns = await prisma.serviceWorkPlan.findFirst({ where: { id: servicePlanId as string, tenantId: req.tenantId }, select: { id: true } });
    if (!owns) return res.status(404).json({ error: 'Haftalık plan bulunamadı.' });
  }

  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      ...(type !== undefined && { type: type as string }),
      ...(title !== undefined && { title: (title as string).trim() }),
      ...(description !== undefined && { description: description as string }),
      ...(priority !== undefined && { priority: priority as string }),
      ...(customerId !== undefined && { customerId: (customerId as string) || null }),
      ...(customerName !== undefined && { customerName: customerName as string }),
      ...(projectId !== undefined && { projectId: (projectId as string) || null }),
      ...(unitId !== undefined && { unitId: (unitId as string) || null }),
      ...(requiredSpecialtyId !== undefined && { requiredSpecialtyId: (requiredSpecialtyId as string) || null }),
      ...(costAmount !== undefined && { costAmount: costAmount != null ? Number(costAmount) : null }),
      ...(costCurrency !== undefined && { costCurrency: costCurrency as string }),
      ...(status !== undefined && { status: status as string }),
      ...(servicePlanId !== undefined && { servicePlanId: (servicePlanId as string) || null }),
    },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'WORK_ORDER', entityId: id, details: { title: order.title, status: order.status } });
  res.json(order);
}));

router.post('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Sevkiyat yetkiniz yok.' });
  const id = String(req.params.id);
  const { assignedTechnicianId, scheduledDate, slaHours, dueAt } = req.body as
    { assignedTechnicianId?: string; scheduledDate?: string; slaHours?: number; dueAt?: string };
  if (!assignedTechnicianId || !scheduledDate) return res.status(400).json({ error: 'Teknisyen ve tarih zorunludur.' });

  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(record.status)) {
    return res.status(400).json({ error: 'Bu iş emri artık sevk edilemez.' });
  }

  const technician = await prisma.user.findFirst({ where: { id: assignedTechnicianId, tenantId: req.tenantId }, select: { id: true } });
  if (!technician) return res.status(404).json({ error: 'Teknisyen bulunamadı.' });

  // SLA — sevk edilirken girilir (münferit: slaHours girilip şimdiden hesaplanır;
  // proje bağlı: UI sözleşmeden kopyaladığı tarihi doğrudan dueAt olarak gönderir).
  // dueAt açıkça verilmişse o esas alınır, yoksa slaHours'tan hesaplanır.
  let resolvedDueAt: Date | null = record.dueAt;
  let resolvedSlaHours: number | null = record.slaHours;
  if (dueAt !== undefined) {
    resolvedDueAt = dueAt ? new Date(dueAt) : null;
    resolvedSlaHours = dueAt ? resolvedSlaHours : null;
  } else if (slaHours !== undefined) {
    resolvedSlaHours = slaHours != null ? Number(slaHours) : null;
    resolvedDueAt = resolvedSlaHours != null ? new Date(Date.now() + resolvedSlaHours * 3_600_000) : null;
  }

  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      assignedTechnicianId, scheduledDate: new Date(scheduledDate), status: 'SCHEDULED',
      dueAt: resolvedDueAt, slaHours: resolvedSlaHours,
    },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'SCHEDULE', entityType: 'WORK_ORDER', entityId: id, details: { assignedTechnicianId, scheduledDate, dueAt: resolvedDueAt } });
  // Atanan teknisyene sevkiyat bildirimi — önceden bu uç nokta hiç bildirim
  // üretmiyordu, teknisyen kendisine iş atandığını ancak listeye bakarak
  // öğreniyordu. Sevk eden kişi kendisiyse atlanır (zaten biliyor).
  if (assignedTechnicianId !== req.userId) {
    await prisma.notification.create({
      data: {
        tenantId: req.tenantId, userId: assignedTechnicianId, type: 'INFO',
        title: 'Size yeni bir iş emri sevk edildi',
        message: `"${order.title}" iş emri ${new Date(scheduledDate).toLocaleDateString('tr-TR')} tarihi için size atandı.`,
        relatedModule: 'professional-services', relatedItemId: order.id,
      },
    }).catch(() => {});
  }
  res.json(order);
}));

router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (!technicianOwnsOrManages(req, record)) return res.status(403).json({ error: 'Bu iş emrini başlatma yetkiniz yok.' });
  if (!['SCHEDULED', 'WAITING_PART'].includes(record.status)) {
    return res.status(400).json({ error: 'Yalnızca planlanmış/parça bekleyen bir iş emri başlatılabilir.' });
  }

  const order = await prisma.workOrder.update({
    where: { id },
    data: { status: 'IN_PROGRESS', actualStartAt: record.actualStartAt || new Date() },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_IN_PROGRESS', entityType: 'WORK_ORDER', entityId: id, details: { title: order.title } });
  res.json(order);
}));

router.post(
  '/:id/signoff-upload',
  signoffUpload.single('file'),
  enforceStorageLimit(),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });

    const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
    if (!technicianOwnsOrManages(req, record)) return res.status(403).json({ error: 'Bu iş emrine kapanış kanıtı yükleme yetkiniz yok.' });

    const folder = slugify(record.workOrderNo || record.title || record.id);
    const uploadDir = getUploadDir(WORK_ORDER_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${id.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    fs.writeFileSync(path.join(uploadDir, safeName), req.file.buffer);
    const fileUrl = `/uploads/work-orders/${folder}/${safeName}`;

    const order = await prisma.workOrder.update({ where: { id }, data: { customerSignOffFileUrl: fileUrl }, include: INCLUDE });
    res.json(order);
  }),
);

router.post('/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (!technicianOwnsOrManages(req, record)) return res.status(403).json({ error: 'Bu iş emrini tamamlama yetkiniz yok.' });
  if (!record.customerSignOffFileUrl) {
    return res.status(400).json({ error: 'Kapanış için önce müşteri imza/kapanış kanıtı (dosya) yüklenmelidir.' });
  }

  const { completionNotes, customerSignOffName, costAmount, costCurrency } = req.body as
    { completionNotes?: string; customerSignOffName?: string; costAmount?: number; costCurrency?: string };

  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      actualEndAt: new Date(),
      completionNotes: completionNotes || record.completionNotes,
      customerSignOffName: customerSignOffName || record.customerSignOffName,
      customerSignOffAt: record.customerSignOffAt || new Date(),
      ...(costAmount != null && { costAmount: Number(costAmount) }),
      ...(costCurrency !== undefined && { costCurrency }),
    },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_COMPLETED', entityType: 'WORK_ORDER', entityId: id, details: { title: order.title } });
  res.json(order);
}));

// ── Malzeme/Hizmet Talepleri (Faz 3) — PurchaseRequest'in 9 statülü tam onay
// zincirinin KASITLI DIŞINDA, hafif/tek-adımlı (yalnız birim yöneticisi
// onayı). İş emrinin yürütülmesi için dış kaynaktan (tedarikçi) alım gerektiğinde
// kullanılır. Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md Kullanıcı Kararı 4.
router.post('/:id/materials', asyncHandler(async (req: Request, res: Response) => {
  const workOrderId = String(req.params.id);
  const record = await prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (!technicianOwnsOrManages(req, record)) return res.status(403).json({ error: 'Bu iş emrine malzeme/hizmet talebi ekleme yetkiniz yok.' });

  const { description, vendorId, vendorName, estimatedCost, currency, notes, requestedByName } = req.body as
    { description?: string; vendorId?: string; vendorName?: string; estimatedCost?: number; currency?: string; notes?: string; requestedByName?: string };
  if (!description || !description.trim()) return res.status(400).json({ error: 'Açıklama zorunludur.' });

  if (vendorId) {
    const owns = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId: req.tenantId }, select: { id: true } });
    if (!owns) return res.status(404).json({ error: 'Tedarikçi bulunamadı.' });
  }

  const material = await prisma.workOrderMaterialRequest.create({
    data: {
      tenantId: req.tenantId,
      workOrderId,
      description: description.trim(),
      vendorId: vendorId || null,
      vendorName: vendorName || null,
      estimatedCost: estimatedCost != null ? Number(estimatedCost) : null,
      currency: currency || 'TRY',
      notes: notes || null,
      requestedById: req.userId,
      requestedByName: requestedByName || null,
    },
    include: { vendor: { select: { id: true, name: true } } },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'WORK_ORDER_MATERIAL_REQUEST', entityId: material.id, details: { workOrderId, description: material.description } });
  await notifyOperationsManagers(req.tenantId, workOrderId, {
    title: 'Malzeme/hizmet talebi onayı bekliyor',
    message: `"${record.title}" iş emri için "${material.description}" talebi onay bekliyor.`,
  }, req.userId);
  res.status(201).json(material);
}));

router.put('/:id/materials/:matId', asyncHandler(async (req: Request, res: Response) => {
  const workOrderId = String(req.params.id);
  const matId = String(req.params.matId);
  const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId: req.tenantId } });
  if (!order) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  const material = await prisma.workOrderMaterialRequest.findFirst({ where: { id: matId, workOrderId, tenantId: req.tenantId } });
  if (!material) return res.status(404).json({ error: 'Talep bulunamadı.' });

  const { description, vendorId, vendorName, estimatedCost, actualCost, currency, notes, status } = req.body as
    { description?: string; vendorId?: string; vendorName?: string; estimatedCost?: number; actualCost?: number; currency?: string; notes?: string; status?: string };

  // Onaylanmadan önce alan düzenlemesi: sahibi teknisyen ya da yönetici.
  // ORDERED/RECEIVED'e ilerletme (satın alma fiilen gerçekleştikten sonra) yalnız yönetici.
  if (status && ['ORDERED', 'RECEIVED'].includes(status)) {
    if (!isManager(req)) return res.status(403).json({ error: 'Bu durum geçişi yalnızca birim yöneticisi tarafından yapılabilir.' });
    if (status === 'RECEIVED' && actualCost == null && material.actualCost == null) {
      return res.status(400).json({ error: 'Teslim alındı işaretlemek için gerçekleşen tutar (actualCost) girilmelidir.' });
    }
  } else if (!technicianOwnsOrManages(req, order)) {
    return res.status(403).json({ error: 'Bu talebi düzenleme yetkiniz yok.' });
  }
  if (vendorId) {
    const owns = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId: req.tenantId }, select: { id: true } });
    if (!owns) return res.status(404).json({ error: 'Tedarikçi bulunamadı.' });
  }

  const updated = await prisma.workOrderMaterialRequest.update({
    where: { id: matId },
    data: {
      ...(description !== undefined && { description: description.trim() }),
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
      ...(vendorName !== undefined && { vendorName }),
      ...(estimatedCost !== undefined && { estimatedCost: estimatedCost != null ? Number(estimatedCost) : null }),
      ...(actualCost !== undefined && { actualCost: actualCost != null ? Number(actualCost) : null }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
    },
    include: { vendor: { select: { id: true, name: true } } },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status ? `STATUS_${status}` : 'UPDATE', entityType: 'WORK_ORDER_MATERIAL_REQUEST', entityId: matId, details: { workOrderId } });
  res.json(updated);
}));

router.put('/:id/materials/:matId/approve', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Onay yetkiniz yok.' });
  const matId = String(req.params.matId);
  const material = await prisma.workOrderMaterialRequest.findFirst({ where: { id: matId, workOrderId: String(req.params.id), tenantId: req.tenantId } });
  if (!material) return res.status(404).json({ error: 'Talep bulunamadı.' });
  if (material.status !== 'REQUESTED') return res.status(400).json({ error: 'Yalnızca bekleyen bir talep onaylanabilir.' });

  const updated = await prisma.workOrderMaterialRequest.update({
    where: { id: matId },
    data: { status: 'APPROVED', approvedByUnitManagerId: req.userId },
    include: { vendor: { select: { id: true, name: true } } },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_APPROVED', entityType: 'WORK_ORDER_MATERIAL_REQUEST', entityId: matId });
  res.json(updated);
}));

router.put('/:id/materials/:matId/reject', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Red yetkiniz yok.' });
  const matId = String(req.params.matId);
  const { rejectionNote } = req.body as { rejectionNote?: string };
  const material = await prisma.workOrderMaterialRequest.findFirst({ where: { id: matId, workOrderId: String(req.params.id), tenantId: req.tenantId } });
  if (!material) return res.status(404).json({ error: 'Talep bulunamadı.' });
  if (material.status !== 'REQUESTED') return res.status(400).json({ error: 'Yalnızca bekleyen bir talep reddedilebilir.' });

  const updated = await prisma.workOrderMaterialRequest.update({
    where: { id: matId },
    data: { status: 'REJECTED', rejectionNote: rejectionNote || null },
    include: { vendor: { select: { id: true, name: true } } },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_REJECTED', entityType: 'WORK_ORDER_MATERIAL_REQUEST', entityId: matId, details: { rejectionNote } });
  res.json(updated);
}));

router.delete('/:id/materials/:matId', asyncHandler(async (req: Request, res: Response) => {
  const workOrderId = String(req.params.id);
  const matId = String(req.params.matId);
  const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId: req.tenantId } });
  if (!order) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  const material = await prisma.workOrderMaterialRequest.findFirst({ where: { id: matId, workOrderId, tenantId: req.tenantId } });
  if (!material) return res.status(404).json({ error: 'Talep bulunamadı.' });
  if (!isManager(req) && !(material.requestedById === req.userId && material.status === 'REQUESTED')) {
    return res.status(403).json({ error: 'Bu talebi silme yetkiniz yok.' });
  }

  await prisma.workOrderMaterialRequest.delete({ where: { id: matId } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'WORK_ORDER_MATERIAL_REQUEST', entityId: matId, details: { workOrderId } });
  res.json({ message: 'Talep silindi.' });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (!isManager(req)) return res.status(403).json({ error: 'İş emri silme yetkiniz yok.' });
  const id = String(req.params.id);
  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  await prisma.workOrder.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'WORK_ORDER', entityId: id, details: { title: record.title } });
  res.json({ message: 'İş emri silindi.' });
}));

export default router;
