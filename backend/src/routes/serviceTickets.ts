import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { sweepServiceTicketSla } from '../services/serviceTicketReminders';
import { nextDocumentNumber } from '../services/documentNumberService';
import { documentUpload, enforceStorageLimit } from '../utils/secureUpload';
import { slugify, getUploadDir } from '../utils/fileUpload';

const router: Router = Router();
const ROLES = requireRole(['GENERAL_MANAGER', 'PROJECT_MGR', 'OPERATIONS_MGR']);
router.use(tenantMiddleware, ROLES);

const SERVICE_TICKET_UPLOADS_ROOT = path.join(__dirname, '../../uploads/service-tickets');
const ticketAttachmentUpload = documentUpload(20);

// ServiceTicket (müşteri arıza bildirimi/intake) → WorkOrder (teknisyen sahaya
// giden yürütme kaydı) bağlantısı. Önceden bu köprü hiç yoktu — WorkOrder.
// serviceTicketId alanı API düzeyinde duruyordu ama hiçbir UI eylemi set
// etmiyordu, iki sistem fiilen hiç buluşmuyordu. ServiceTicket.status ile
// WorkOrder.status arasında bilinçli olarak otomatik senkron YOK (manuel,
// bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md) — yalnızca ilk açılış köprülenir.
const CATEGORY_TO_WORK_ORDER_TYPE: Record<string, string> = {
  FAULT: 'REPAIR', SPARE_PART: 'OTHER', MAINTENANCE: 'MAINTENANCE', OTHER: 'OTHER',
};

// Çözüm maliyeti (yedek parça/işçilik) girildiyse, projenin maliyet kalemlerine
// idempotent olarak işle (T5 satınalma→proje deseninin aynısı — purchaseRequests.ts).
async function upsertServiceCostItem(tenantId: string, projectId: string, ticketId: string, ticketTitle: string, amount: number, currency: string, userId?: string) {
  const data = {
    category: 'SERVICE',
    description: `Servis: ${ticketTitle}`,
    actualAmount: amount,
    amountTRY: currency === 'TRY' ? amount : 0,
    currency,
    serviceTicketId: ticketId,
  };
  const existing = await prisma.projectCostItem.findFirst({ where: { projectId, serviceTicketId: ticketId, project: { tenantId } } });
  if (existing) {
    await prisma.projectCostItem.updateMany({ where: { id: existing.id, project: { tenantId } }, data }).catch(() => {});
  } else {
    await prisma.projectCostItem.create({ data: { projectId, createdById: userId, ...data } }).catch(() => {});
  }
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  await sweepServiceTicketSla(req.tenantId); // SLA aşımı eskalasyonu (non-throwing)
  const { status, projectId, priority } = req.query as { status?: string; projectId?: string; priority?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (projectId) where.projectId = projectId;
  if (priority) where.priority = priority;
  const tickets = await prisma.serviceTicket.findMany({
    where,
    include: { project: { select: { id: true, name: true, code: true, customerName: true } }, brand: true, productCategory: true },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  });
  res.json(tickets);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ticket = await prisma.serviceTicket.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: {
      project: { select: { id: true, name: true, code: true, customerName: true } }, brand: true, productCategory: true,
      attachments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!ticket) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });
  res.json(ticket);
}));

// Arıza açılırken müşteriden alınan log dosyası/ekran görüntüsü/geri bildirim —
// teknisyene sevk edildiğinde WorkOrder detayında (serviceTicketId üzerinden
// canlı join ile, kopyalanmadan) görünür. Bkz. routes/workOrders.ts sourceTicketContext.
router.post(
  '/:id/attachments',
  ticketAttachmentUpload.single('file'),
  enforceStorageLimit(),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });
    const ticket = await prisma.serviceTicket.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!ticket) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

    const { description } = req.body as { description?: string };
    const folder = slugify(ticket.title || ticket.id);
    const uploadDir = getUploadDir(SERVICE_TICKET_UPLOADS_ROOT, folder);
    const ext = path.extname(req.file.originalname);
    const safeName = `${id.slice(-8)}_${Date.now()}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    fs.writeFileSync(path.join(uploadDir, safeName), req.file.buffer);
    const fileUrl = `/uploads/service-tickets/${folder}/${safeName}`;

    const attachment = await prisma.serviceTicketAttachment.create({
      data: {
        tenantId: req.tenantId, serviceTicketId: id, fileUrl, fileName: req.file.originalname,
        description: description || null, uploadedById: req.userId,
      },
    });
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'SERVICE_TICKET_ATTACHMENT', entityId: attachment.id, details: { serviceTicketId: id, fileName: attachment.fileName } });
    res.status(201).json(attachment);
  }),
);

router.delete('/:id/attachments/:attId', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const attId = String(req.params.attId);
  const attachment = await prisma.serviceTicketAttachment.findFirst({ where: { id: attId, serviceTicketId: id, tenantId: req.tenantId } });
  if (!attachment) return res.status(404).json({ error: 'Ek bulunamadı.' });
  await prisma.serviceTicketAttachment.delete({ where: { id: attId } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'SERVICE_TICKET_ATTACHMENT', entityId: attId, details: { serviceTicketId: id } });
  res.json({ message: 'Ek silindi.' });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const { projectId, title, description, category, priority, reportedByContactId, reportedByName, assignedToUserId, unitId, slaHours, brandId, productCategoryId } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: 'Proje ve başlık zorunludur.' });

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId } });
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const dueAt = slaHours ? new Date(Date.now() + Number(slaHours) * 3_600_000) : null;
  const ticket = await prisma.serviceTicket.create({
    data: {
      tenantId, projectId, title,
      description: description || null,
      category: category || 'FAULT',
      priority: priority || 'NORMAL',
      reportedByContactId: reportedByContactId || null,
      reportedByName: reportedByName || null,
      assignedToUserId: assignedToUserId || null,
      unitId: unitId || null,
      slaHours: slaHours ? Number(slaHours) : null,
      dueAt,
      brandId: brandId || null,
      productCategoryId: productCategoryId || null,
    },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } }, brand: true, productCategory: true },
  });

  // B-09 — garanti süresi bitişi kontrolü: projeye bağlı sözleşmenin garanti
  // tarihi geçmişse görünür bir uyarı verilir (kayıt reddedilmez — mevcut
  // uyarı desenleriyle aynı felsefe, ör. proposals.ts marginWarning).
  const contract = await prisma.contract.findFirst({ where: { projectId, tenantId }, select: { guaranteeExpiry: true } });
  const warrantyExpiredWarning = contract?.guaranteeExpiry && ticket.reportedAt.getTime() > contract.guaranteeExpiry.getTime()
    ? { expiredAt: contract.guaranteeExpiry }
    : null;

  await logActivity({ tenantId, userId: req.userId, action: 'CREATE', entityType: 'SERVICE_TICKET', entityId: ticket.id, details: { title: ticket.title, projectId, warrantyExpired: warrantyExpiredWarning ? true : undefined } });
  res.json({ ...ticket, warrantyExpiredWarning });
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const record = await prisma.serviceTicket.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  const { title, description, category, priority, status, reportedByContactId, reportedByName, assignedToUserId, unitId, slaHours, resolutionNotes, costAmount, costCurrency, brandId, productCategoryId } = req.body;
  const isResolving = status && (status === 'RESOLVED' || status === 'CLOSED') && record.status !== 'RESOLVED' && record.status !== 'CLOSED';

  const ticket = await prisma.serviceTicket.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(priority !== undefined && { priority }),
      ...(status !== undefined && { status }),
      ...(reportedByContactId !== undefined && { reportedByContactId }),
      ...(reportedByName !== undefined && { reportedByName }),
      ...(assignedToUserId !== undefined && { assignedToUserId }),
      ...(unitId !== undefined && { unitId }),
      ...(slaHours !== undefined && { slaHours: slaHours ? Number(slaHours) : null }),
      ...(resolutionNotes !== undefined && { resolutionNotes }),
      ...(costAmount !== undefined && { costAmount: costAmount != null ? Number(costAmount) : null }),
      ...(costCurrency !== undefined && { costCurrency }),
      ...(brandId !== undefined && { brandId: brandId || null }),
      ...(productCategoryId !== undefined && { productCategoryId: productCategoryId || null }),
      ...(isResolving && { resolvedAt: new Date() }),
    },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } }, brand: true, productCategory: true },
  });
  if (costAmount != null && Number(costAmount) > 0) {
    await upsertServiceCostItem(tenantId, ticket.projectId, id, ticket.title, Number(costAmount), costCurrency || 'TRY', req.userId);
  }
  await logActivity({ tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'SERVICE_TICKET', entityId: id, details: { title: ticket.title, status: ticket.status } });
  res.json(ticket);
}));

router.post('/:id/resolve', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const record = await prisma.serviceTicket.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  const { resolutionNotes, costAmount, costCurrency } = req.body as { resolutionNotes?: string; costAmount?: number; costCurrency?: string };
  const ticket = await prisma.serviceTicket.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes || record.resolutionNotes,
      ...(costAmount != null && { costAmount: Number(costAmount) }),
      ...(costCurrency !== undefined && { costCurrency }),
    },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } }, brand: true, productCategory: true },
  });
  if (costAmount != null && Number(costAmount) > 0) {
    await upsertServiceCostItem(tenantId, ticket.projectId, id, ticket.title, Number(costAmount), costCurrency || 'TRY', req.userId);
  }
  await logActivity({ tenantId, userId: req.userId, action: 'STATUS_RESOLVED', entityType: 'SERVICE_TICKET', entityId: id, details: { title: ticket.title, costAmount: costAmount ?? null } });
  res.json(ticket);
}));

router.post('/:id/dispatch', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const ticket = await prisma.serviceTicket.findFirst({
    where: { id, tenantId },
    include: { project: { select: { customerId: true, customerName: true } } },
  });
  if (!ticket) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  // İdempotent — bu talepten zaten bir iş emri açıldıysa yenisini açmak yerine
  // var olanı döndür (tekrar tıklanırsa mükerrer iş emri oluşmasın).
  const existing = await prisma.workOrder.findFirst({ where: { tenantId, serviceTicketId: id } });
  if (existing) {
    return res.json({ workOrder: existing, alreadyExisted: true });
  }

  const workOrderNo = await nextDocumentNumber(tenantId, 'ISE').catch(() => null);
  const workOrder = await prisma.workOrder.create({
    data: {
      tenantId,
      workOrderNo,
      status: 'PENDING_SCHEDULE',
      type: CATEGORY_TO_WORK_ORDER_TYPE[ticket.category] || 'OTHER',
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      projectId: ticket.projectId,
      customerId: ticket.project?.customerId || null,
      customerName: ticket.project?.customerName || null,
      serviceTicketId: ticket.id,
      unitId: ticket.unitId,
    },
  });
  await logActivity({ tenantId, userId: req.userId, action: 'DISPATCH_WORK_ORDER', entityType: 'SERVICE_TICKET', entityId: id, details: { workOrderId: workOrder.id, workOrderNo } });
  res.status(201).json({ workOrder, alreadyExisted: false });
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const record = await prisma.serviceTicket.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  await prisma.serviceTicket.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'SERVICE_TICKET', entityId: id, details: { title: record.title } });
  res.json({ message: 'Servis talebi silindi.' });
}));

export default router;
