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
  res.json({ ...order, openPurchaseRequestCount: openPrCount, materialRequests });
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
  const { assignedTechnicianId, scheduledDate } = req.body as { assignedTechnicianId?: string; scheduledDate?: string };
  if (!assignedTechnicianId || !scheduledDate) return res.status(400).json({ error: 'Teknisyen ve tarih zorunludur.' });

  const record = await prisma.workOrder.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!record) return res.status(404).json({ error: 'İş emri bulunamadı.' });
  if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(record.status)) {
    return res.status(400).json({ error: 'Bu iş emri artık sevk edilemez.' });
  }

  const technician = await prisma.user.findFirst({ where: { id: assignedTechnicianId, tenantId: req.tenantId }, select: { id: true } });
  if (!technician) return res.status(404).json({ error: 'Teknisyen bulunamadı.' });

  const order = await prisma.workOrder.update({
    where: { id },
    data: { assignedTechnicianId, scheduledDate: new Date(scheduledDate), status: 'SCHEDULED' },
    include: INCLUDE,
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'SCHEDULE', entityType: 'WORK_ORDER', entityId: id, details: { assignedTechnicianId, scheduledDate } });
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
