import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { logActivity } from '../services/activityLog';
import { sweepServiceTicketSla } from '../services/serviceTicketReminders';

const router: Router = Router();
const ROLES = requireRole(['GENERAL_MANAGER', 'PROJECT_MGR', 'OPERATIONS_MGR']);
router.use(tenantMiddleware, ROLES);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  await sweepServiceTicketSla(req.tenantId); // SLA aşımı eskalasyonu (non-throwing)
  const { status, projectId, priority } = req.query as { status?: string; projectId?: string; priority?: string };
  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (status) where.status = status;
  if (projectId) where.projectId = projectId;
  if (priority) where.priority = priority;
  const tickets = await prisma.serviceTicket.findMany({
    where,
    include: { project: { select: { id: true, name: true, code: true, customerName: true } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  });
  res.json(tickets);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ticket = await prisma.serviceTicket.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } } },
  });
  if (!ticket) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });
  res.json(ticket);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const { projectId, title, description, category, priority, reportedByContactId, reportedByName, assignedToUserId, unitId, slaHours } = req.body;
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
    },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } } },
  });
  await logActivity({ tenantId, userId: req.userId, action: 'CREATE', entityType: 'SERVICE_TICKET', entityId: ticket.id, details: { title: ticket.title, projectId } });
  res.json(ticket);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const record = await prisma.serviceTicket.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  const { title, description, category, priority, status, reportedByContactId, reportedByName, assignedToUserId, unitId, slaHours, resolutionNotes } = req.body;
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
      ...(isResolving && { resolvedAt: new Date() }),
    },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } } },
  });
  await logActivity({ tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'SERVICE_TICKET', entityId: id, details: { title: ticket.title, status: ticket.status } });
  res.json(ticket);
}));

router.post('/:id/resolve', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const tenantId = req.tenantId;
  const record = await prisma.serviceTicket.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Servis talebi bulunamadı.' });

  const { resolutionNotes } = req.body as { resolutionNotes?: string };
  const ticket = await prisma.serviceTicket.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolutionNotes: resolutionNotes || record.resolutionNotes },
    include: { project: { select: { id: true, name: true, code: true, customerName: true } } },
  });
  await logActivity({ tenantId, userId: req.userId, action: 'STATUS_RESOLVED', entityType: 'SERVICE_TICKET', entityId: id, details: { title: ticket.title } });
  res.json(ticket);
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
