import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { nextProjectCode } from '../services/projectCodeService';

const router: Router = Router();
router.use(tenantMiddleware);

const PROJECT_INCLUDE = {
  milestones: { orderBy: { order: 'asc' as const } },
  projectCostItems: { orderBy: { createdAt: 'desc' as const } },
};

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, type } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      tenantId: req.tenantId,
      ...(status ? { status: String(status) } : {}),
      ...(type   ? { type: String(type) }     : {}),
    },
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(projects);
}));

// ── SUMMARY (GM raporu — /summary/all önce tanımlanmalı) ────────────────────
router.get('/summary/all', asyncHandler(async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { tenantId: req.tenantId, status: { not: 'CANCELLED' } },
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  const summary = projects.map(p => {
    const totalPlanned = p.projectCostItems.reduce((s, c) => s + c.plannedAmount, 0);
    const totalActual  = p.projectCostItems.reduce((s, c) => s + c.amountTRY, 0);
    const plannedMargin = p.totalValue > 0 ? ((p.totalValue - totalPlanned) / p.totalValue) * 100 : 0;
    const actualMargin  = p.totalValue > 0 ? ((p.totalValue - totalActual)  / p.totalValue) * 100 : 0;
    const delayedMs = p.milestones.filter(m =>
      m.status !== 'COMPLETED' && m.status !== 'CANCELLED' &&
      m.plannedEnd && new Date(m.plannedEnd) < new Date()
    ).length;
    return {
      id: p.id, name: p.name, type: p.type, status: p.status, phase: p.phase,
      customerName: p.customerName, pmName: p.pmName,
      totalValue: p.totalValue, contractCurrency: p.contractCurrency,
      totalPlanned, totalActual, plannedMargin, actualMargin,
      progress: p.progress, delayedMs,
      plannedEndDate: p.plannedEndDate,
      milestoneCount: p.milestones.length,
      completedMs: p.milestones.filter(m => m.status === 'COMPLETED').length,
    };
  });

  res.json(summary);
}));

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: PROJECT_INCLUDE,
  });
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
  res.json(project);
}));

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  let {
    name, type = 'HARDWARE', description,
    customerId, customerName, opportunityId, contractId,
    pmId, pmName, ownerId,
    totalValue = 0, contractCurrency = 'TRY', budgetTotal = 0, avgMargin = 0,
    startDate, plannedEndDate, deadline,
    status = 'PLANNING',
    milestoneTemplate,
    procurementNotes,
  } = req.body;

  // Fırsat verisini otomatik çek
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId: req.tenantId },
      include: { customer: true },
    });
    if (opp) {
      if (!name) name = opp.title;
      if (!customerId) customerId = opp.customerId;
      if (!customerName && opp.customer) customerName = opp.customer.name;
      if (!totalValue) totalValue = opp.value;
      if (!budgetTotal) budgetTotal = opp.value;
    }
  }

  const code = await nextProjectCode(req.tenantId, type);

  const project = await prisma.project.create({
    data: {
      tenantId: req.tenantId,
      code,
      name,
      type,
      description: description || null,
      customerId: customerId || null,
      customerName: customerName || null,
      opportunityId: opportunityId || null,
      contractId: contractId || null,
      pmId: pmId || req.userId,
      pmName: pmName || null,
      ownerId: ownerId || req.userId,
      totalValue: Number(totalValue),
      contractCurrency,
      budgetTotal: Number(budgetTotal),
      avgMargin: Number(avgMargin),
      startDate: startDate ? new Date(startDate) : new Date(),
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
      deadline: deadline ? new Date(deadline) : (plannedEndDate ? new Date(plannedEndDate) : new Date()),
      status,
      phase: 'Planlama',
      procurementNotes: procurementNotes || null,
    },
  });

  // Milestone şablonu uygula
  const tmplKey = milestoneTemplate || type;
  const templates = getMilestoneTemplate(tmplKey);
  for (const [idx, tmpl] of templates.entries()) {
    await prisma.projectMilestone.create({
      data: { projectId: project.id, ...tmpl, order: idx },
    });
  }

  const full = await prisma.project.findFirst({ where: { id: project.id }, include: PROJECT_INCLUDE });
  res.status(201).json(full);
}));

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.project.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const allowed = [
    'name','type','description','status','phase',
    'customerId','customerName','opportunityId','contractId',
    'pmId','pmName','ownerId','managerId',
    'totalValue','contractCurrency','budgetTotal','avgMargin','progress',
    'startDate','plannedEndDate','actualEndDate','deadline',
    'procurementNotes',
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      if (['startDate','plannedEndDate','actualEndDate','deadline'].includes(k)) {
        data[k] = req.body[k] ? new Date(req.body[k]) : null;
      } else if (['totalValue','budgetTotal','avgMargin','progress'].includes(k)) {
        data[k] = Number(req.body[k]);
      } else {
        data[k] = req.body[k];
      }
    }
  }

  const updated = await prisma.project.update({ where: { id }, data, include: PROJECT_INCLUDE });

  // Kritik milestone geçişinde GM TodoTask
  if (req.body.status === 'COMPLETED' || (req.body.phase && req.body.phase !== existing.phase)) {
    const criticalMs = await prisma.projectMilestone.findFirst({
      where: { projectId: id, status: 'IN_PROGRESS', requiresApproval: true },
    });
    if (criticalMs) {
      await prisma.todoTask.create({
        data: {
          tenantId: req.tenantId,
          title: `Proje Onayı: ${existing.name} — ${criticalMs.title}`,
          description: `"${criticalMs.title}" aşaması için genel müdür onayı gerekiyor.`,
          unitId: req.tenantId,
          assignedBy: req.userId,
          priority: 'HIGH',
          status: 'PENDING',
          relatedModule: 'PROJECT',
          relatedItemId: id,
        },
      }).catch(() => {});
    }
  }

  res.json(updated);
}));

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.project.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });
  await prisma.project.delete({ where: { id } });
  res.json({ ok: true });
}));

// ── MILESTONES ────────────────────────────────────────────────────────────────

router.get('/:id/milestones', asyncHandler(async (req: Request, res: Response) => {
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId: String(req.params.id) },
    orderBy: { order: 'asc' },
  });
  res.json(milestones);
}));

router.post('/:id/milestones', asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, milestoneType = 'CUSTOM',
    assignedToId, assignedToName,
    plannedStart, plannedEnd, budgetAmount, currency = 'TRY',
    isParallel = false, requiresApproval = false, order, notes,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'Başlık zorunludur.' });

  const lastOrder = await prisma.projectMilestone.count({ where: { projectId: String(req.params.id) } });
  const ms = await prisma.projectMilestone.create({
    data: {
      projectId: String(req.params.id),
      title, milestoneType,
      description: description || null,
      assignedToId: assignedToId || null,
      assignedToName: assignedToName || null,
      plannedStart: plannedStart ? new Date(plannedStart) : null,
      plannedEnd: plannedEnd ? new Date(plannedEnd) : null,
      budgetAmount: budgetAmount ? Number(budgetAmount) : null,
      currency,
      isParallel: Boolean(isParallel),
      requiresApproval: Boolean(requiresApproval),
      order: order ?? lastOrder,
      notes: notes || null,
    },
  });
  res.status(201).json(ms);
}));

router.put('/:id/milestones/:msId', asyncHandler(async (req: Request, res: Response) => {
  const data: Record<string, unknown> = {};
  const dateFields = ['plannedStart','plannedEnd','actualStart','actualEnd'];
  const numFields  = ['progress','budgetAmount','actualCost','order'];
  const boolFields = ['isParallel','requiresApproval'];
  const strFields  = ['title','description','status','milestoneType','assignedToId','assignedToName','currency','notes'];

  for (const k of strFields)  if (req.body[k] !== undefined) data[k] = req.body[k];
  for (const k of numFields)  if (req.body[k] !== undefined) data[k] = req.body[k] !== null ? Number(req.body[k]) : null;
  for (const k of boolFields) if (req.body[k] !== undefined) data[k] = Boolean(req.body[k]);
  for (const k of dateFields) if (req.body[k] !== undefined) data[k] = req.body[k] ? new Date(req.body[k]) : null;
  if (req.body.approvedById) { data.approvedById = req.body.approvedById; data.approvedAt = new Date(); }
  if (data.status === 'COMPLETED' && !data.actualEnd) data.actualEnd = new Date();
  if (data.status === 'IN_PROGRESS' && !data.actualStart) data.actualStart = new Date();

  const ms = await prisma.projectMilestone.update({ where: { id: String(req.params.msId) }, data });

  // Proje ilerlemesini güncelle
  const allMs = await prisma.projectMilestone.findMany({ where: { projectId: String(req.params.id) } });
  const avgProgress = allMs.length ? Math.round(allMs.reduce((s, m) => s + m.progress, 0) / allMs.length) : 0;
  const activeMs = allMs.find(m => m.status === 'IN_PROGRESS');
  const allDone  = allMs.every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED');
  await prisma.project.update({
    where: { id: String(req.params.id) },
    data: {
      progress: avgProgress,
      phase: activeMs?.title ?? (allDone ? 'Tamamlandı' : allMs[0]?.title ?? 'Planlama'),
      ...(allDone ? { status: 'COMPLETED', actualEndDate: new Date() } : {}),
    },
  });

  res.json(ms);
}));

router.delete('/:id/milestones/:msId', asyncHandler(async (req: Request, res: Response) => {
  await prisma.projectMilestone.delete({ where: { id: String(req.params.msId) } });
  res.json({ ok: true });
}));

// ── COST ITEMS ────────────────────────────────────────────────────────────────

router.get('/:id/costs', asyncHandler(async (req: Request, res: Response) => {
  res.json(await prisma.projectCostItem.findMany({
    where: { projectId: String(req.params.id) },
    orderBy: { createdAt: 'desc' },
  }));
}));

router.post('/:id/costs', asyncHandler(async (req: Request, res: Response) => {
  const {
    category = 'OTHER', description,
    plannedAmount = 0, actualAmount = 0, currency = 'TRY', amountTRY,
    milestoneId, purchaseRequestId, date, invoiceNo, notes,
  } = req.body;
  if (!description) return res.status(400).json({ error: 'Açıklama zorunludur.' });

  const cost = await prisma.projectCostItem.create({
    data: {
      projectId: String(req.params.id),
      category, description,
      plannedAmount: Number(plannedAmount),
      actualAmount: Number(actualAmount),
      currency,
      amountTRY: amountTRY ? Number(amountTRY) : Number(actualAmount),
      milestoneId: milestoneId || null,
      purchaseRequestId: purchaseRequestId || null,
      date: date ? new Date(date) : null,
      invoiceNo: invoiceNo || null,
      notes: notes || null,
      createdById: req.userId,
    },
  });
  res.status(201).json(cost);
}));

router.put('/:id/costs/:costId', asyncHandler(async (req: Request, res: Response) => {
  const { category, description, plannedAmount, actualAmount, currency, amountTRY, date, invoiceNo, notes } = req.body;
  res.json(await prisma.projectCostItem.update({
    where: { id: String(req.params.costId) },
    data: {
      ...(category    !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(plannedAmount !== undefined && { plannedAmount: Number(plannedAmount) }),
      ...(actualAmount  !== undefined && { actualAmount:  Number(actualAmount)  }),
      ...(currency    !== undefined && { currency }),
      ...(amountTRY   !== undefined && { amountTRY: Number(amountTRY) }),
      ...(date        !== undefined && { date: date ? new Date(date) : null }),
      ...(invoiceNo   !== undefined && { invoiceNo: invoiceNo ?? null }),
      ...(notes       !== undefined && { notes: notes ?? null }),
    },
  }));
}));

router.delete('/:id/costs/:costId', asyncHandler(async (req: Request, res: Response) => {
  await prisma.projectCostItem.delete({ where: { id: String(req.params.costId) } });
  res.json({ ok: true });
}));

// ── Milestone şablonları ──────────────────────────────────────────────────────
type MilestoneTmpl = { title: string; milestoneType: string; requiresApproval: boolean; isParallel: boolean };

function getMilestoneTemplate(type: string): MilestoneTmpl[] {
  const T: Record<string, MilestoneTmpl[]> = {
    HARDWARE: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Satınalma',             milestoneType: 'PROCUREMENT',  requiresApproval: false, isParallel: false },
      { title: 'Sevkiyat',              milestoneType: 'SHIPMENT',     requiresApproval: false, isParallel: false },
      { title: 'Kurulum',               milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Test & Kabul',          milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    SOFTWARE: [
      { title: 'Planlama & Analiz',     milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Geliştirme',            milestoneType: 'DEVELOPMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Test',                  milestoneType: 'TESTING',      requiresApproval: false, isParallel: true  },
      { title: 'Kabul & Geçiş',         milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    SERVICE: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Hizmet Sözleşmesi',     milestoneType: 'CUSTOM',       requiresApproval: false, isParallel: false },
      { title: 'Hizmet Teslimi',        milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Kabul',                 milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    MIXED: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Satınalma',             milestoneType: 'PROCUREMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Geliştirme',            milestoneType: 'DEVELOPMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Kurulum & Entegrasyon', milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Test & Kabul',          milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
  };
  return T[type] ?? T.HARDWARE;
}

export default router;
