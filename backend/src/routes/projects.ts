import { Router, Request, Response } from 'express';
import { documentUpload, enforceStorageLimit } from '../utils/secureUpload';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { createProjectWithMilestones } from '../services/projectFactory';
import { advanceProcess, ProcessNotConfiguredError } from '../services/processEngine';
import { logActivity } from '../services/activityLog';
import { computeProjectOverhead, applyProjectOverhead } from '../services/overheadService';
import { computeProjectProgress } from '../services/projectProgress';
import { summarizeProject } from '../services/projectSummary';
import { slugify, getUploadDir, tryUploadToNextcloud } from '../utils/fileUpload';

const router: Router = Router();
router.use(tenantMiddleware);

// IDOR/tenant-izolasyon guard'ı: URL'deki proje bu tenant'a ait mi?
// Alt-kaynak (milestone/cost/handover) işlemlerinden ÖNCE çağrılır.
async function ownsProject(req: Request): Promise<boolean> {
  const p = await prisma.project.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, select: { id: true } });
  return !!p;
}

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

  const summary = projects.map((p) => summarizeProject(p));

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

// Faz B/C güvenlik düzeltmesi — tenders.ts'teki WON_TRANSITION_ROLES deseniyle
// birebir aynı: bu, bir fırsattan proje AÇMA yetkisini kısıtlayan sabit bir
// yetki katmanıdır (motorun kendisi değil). Eskiden bu dalda HİÇ rol kontrolü
// yoktu — kimliği doğrulanmış herhangi bir kullanıcı herhangi bir WON fırsattan
// proje açabiliyordu.
const OPPORTUNITY_TO_PROJECT_ROLES = ['GENERAL_MANAGER', 'PROJECT_MGR', 'SALES_MGR'];

// ── CREATE ────────────────────────────────────────────────────────────────────
// Süreç Motoru (Faz B, T1) — bir fırsattan proje açılıyorsa (opportunityId
// verilmişse) artık backend WON kontrolü + tenant'ın OPPORTUNITY_TO_PROJECT
// için kurguladığı yapılandırma gerekir (eskiden hiç kontrol yoktu — herhangi
// bir durumdaki fırsattan proje açılabiliyordu). opportunityId verilmemişse
// (genel/bağımsız proje oluşturma) davranış değişmez.
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { opportunityId } = req.body as { opportunityId?: string };

  if (opportunityId) {
    if (!OPPORTUNITY_TO_PROJECT_ROLES.includes(req.userRole || '')) {
      return res.status(403).json({ error: 'Fırsattan proje açma yetkiniz yok.' });
    }
    try {
      await advanceProcess(req.tenantId, 'OPPORTUNITY_TO_PROJECT', 'OPPORTUNITY', opportunityId, {
        actorUserId: req.userId,
        input: req.body,
      });
    } catch (e) {
      if (e instanceof ProcessNotConfiguredError) {
        return res.status(409).json({ error: 'Fırsat → Proje süreci henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Fırsat → Proje" sürecini kurgulayın.' });
      }
      if (e instanceof Error) return res.status(409).json({ error: e.message });
      throw e;
    }
    const full = await prisma.project.findFirst({ where: { tenantId: req.tenantId, opportunityId }, include: PROJECT_INCLUDE });
    // OPPORTUNITY_TO_PROJECT bir MANUAL onay adımı içeriyorsa (tenant'ın seçimi),
    // advanceProcess yalnız ApprovalChain'i başlatır — proje henüz OLUŞMAZ, onay
    // sonrası AUTO adım tetiklenince oluşur. Bu durumda 201+proje yerine 202
    // dönülür — çağıran "oluşturuldu" ile "onaya gönderildi"yi karıştırmasın.
    if (!full) {
      return res.status(202).json({ pending: true, message: 'Fırsat → Proje süreci onay bekliyor — proje, onay tamamlanınca oluşturulacak.' });
    }
    await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PROJECT', entityId: full.id, details: { code: full.code, name: full.name, opportunityId } });
    return res.status(201).json(full);
  }

  const full = await createProjectWithMilestones(req.tenantId, req.body, req.userId);
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PROJECT', entityId: full?.id ?? '', details: { code: full?.code, name: full?.name } });
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

  // Kritik milestone geçişinde GM TodoTask. Faz D düzeltmesi — eskiden
  // `unitId: req.tenantId` yazılıyordu (Tenant id, gerçek bir Unit'e karşılık
  // gelmiyor) — görev hiçbir birimin Todo ekranında görünmüyordu (T4 öncesi
  // hatasıyla aynı sınıf). Artık GM rolündeki gerçek kullanıcının birimi çözülür.
  if (req.body.status === 'COMPLETED' || (req.body.phase && req.body.phase !== existing.phase)) {
    const criticalMs = await prisma.projectMilestone.findFirst({
      where: { projectId: id, status: 'IN_PROGRESS', requiresApproval: true },
    });
    const gm = criticalMs ? await prisma.user.findFirst({ where: { tenantId: req.tenantId, role: 'GENERAL_MANAGER', status: 'ACTIVE' } }) : null;
    if (criticalMs && gm?.unitId) {
      await prisma.todoTask.create({
        data: {
          tenantId: req.tenantId,
          title: `Proje Onayı: ${existing.name} — ${criticalMs.title}`,
          description: `"${criticalMs.title}" aşaması için genel müdür onayı gerekiyor.`,
          unitId: gm.unitId,
          assignedBy: req.userId,
          priority: 'HIGH',
          status: 'PENDING',
          relatedModule: 'PROJECT',
          relatedItemId: id,
        },
      }).catch(() => {});
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: req.body.status && req.body.status !== existing.status ? `STATUS_${req.body.status}` : 'UPDATE', entityType: 'PROJECT', entityId: id, details: { name: updated.name, status: updated.status, phase: updated.phase } });
  res.json(updated);
}));

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.project.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });
  await prisma.project.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'PROJECT', entityId: id });
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
  if (!(await ownsProject(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });
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
  if (!(await ownsProject(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });
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

  // Milestone bu projeye (dolayısıyla bu tenant'a) ait mi — değilse dokunma.
  const upd = await prisma.projectMilestone.updateMany({ where: { id: String(req.params.msId), projectId: String(req.params.id) }, data });
  if (upd.count === 0) return res.status(404).json({ error: 'Milestone bulunamadı.' });
  const ms = await prisma.projectMilestone.findFirst({ where: { id: String(req.params.msId), projectId: String(req.params.id) } });

  // Proje ilerlemesini güncelle
  const allMs = await prisma.projectMilestone.findMany({ where: { projectId: String(req.params.id) } });
  const { progress, phase, completed } = computeProjectProgress(allMs);
  await prisma.project.update({
    where: { id: String(req.params.id) },
    data: {
      progress,
      phase,
      ...(completed ? { status: 'COMPLETED', actualEndDate: new Date() } : {}),
    },
  });

  res.json(ms);
}));

router.delete('/:id/milestones/:msId', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.projectMilestone.deleteMany({ where: { id: String(req.params.msId), project: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Milestone bulunamadı.' });
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
  if (!(await ownsProject(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });

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
  const upd = await prisma.projectCostItem.updateMany({
    where: { id: String(req.params.costId), project: { tenantId: req.tenantId } },
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
  });
  if (upd.count === 0) return res.status(404).json({ error: 'Maliyet kalemi bulunamadı.' });
  res.json(await prisma.projectCostItem.findFirst({ where: { id: String(req.params.costId), project: { tenantId: req.tenantId } } }));
}));

router.delete('/:id/costs/:costId', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.projectCostItem.deleteMany({ where: { id: String(req.params.costId), project: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Maliyet kalemi bulunamadı.' });
  res.json({ ok: true });
}));

// ── PROJE DEVİR PAKETİ (Faz 2 — ContractWorkflowDoc pattern'inin klonu) ────────
// Devir toplantısı öncesi zorunlu 11 evraklık checklist. isRequired:true olan
// tüm evraklar UPLOADED/VERIFIED/WAIVED olmadan proje "devir tamamlandı"
// sayılmaz (bu hesap frontend'de yapılır, burada sadece veri sağlanır).

const DEFAULT_HANDOVER_DOCS: { name: string; docType: string }[] = [
  { name: 'Onaylı Fizibilite', docType: 'FEASIBILITY' },
  { name: 'İhale Dokümanları', docType: 'TENDER_DOCS' },
  { name: 'İmzalanan Sözleşme + Ekleri', docType: 'CONTRACT' },
  { name: 'Birim Fiyat Teklif Cetveli', docType: 'PRICE_SCHEDULE' },
  { name: 'Fiyat Teklifi / Maliyet Tablosu', docType: 'COST_TABLE' },
  { name: 'Ürün Kitlist Ağacı', docType: 'BOM_TREE' },
  { name: 'Alınan Teklifler', docType: 'RECEIVED_QUOTES' },
  { name: 'İhale Kararı ve Sözleşmeye Davet', docType: 'TENDER_DECISION' },
  { name: 'Kesin + Avans Teminat Mektupları (Kopya)', docType: 'GUARANTEE_LETTERS' },
  { name: 'Proje Devir Formu (imzasız)', docType: 'HANDOVER_FORM' },
  { name: 'Proje Organizasyonu / Personel Listesi', docType: 'STAFF_LIST' },
];

const HANDOVER_UPLOADS_ROOT = path.join(__dirname, '../../uploads/project-handovers');
const handoverUpload = documentUpload(50);

function handoverFolder(p: { code?: string | null; name: string }): string {
  return slugify(p.code || p.name);
}

// GET /:id/handover-docs → liste; hiç evrak yoksa 11 zorunlu evrakı otomatik seed eder
router.get('/:id/handover-docs', asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: req.tenantId } });
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

  let docs = await prisma.projectHandoverDoc.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  });

  if (docs.length === 0) {
    await prisma.projectHandoverDoc.createMany({
      data: DEFAULT_HANDOVER_DOCS.map((d, i) => ({
        projectId,
        name: d.name,
        docType: d.docType,
        isRequired: true,
        sortOrder: i,
        tenantId: req.tenantId,
      })),
    });
    docs = await prisma.projectHandoverDoc.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
  }

  res.json(docs);
}));

router.post('/:id/handover-docs', asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: req.tenantId } });
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const { name, docType, description, isRequired, sortOrder, notes } = req.body;
  const doc = await prisma.projectHandoverDoc.create({
    data: {
      projectId,
      name,
      docType: docType || 'OTHER',
      description: description || null,
      notes: notes || null,
      isRequired: isRequired !== false,
      sortOrder: sortOrder ?? 99,
      tenantId: req.tenantId,
    },
  });
  res.status(201).json(doc);
}));

router.put('/:id/handover-docs/:docId', asyncHandler(async (req: Request, res: Response) => {
  const docId = String(req.params.docId);
  const { status, fileUrl, notes, name, docType, description } = req.body;
  const upd = await prisma.projectHandoverDoc.updateMany({
    where: { id: docId, tenantId: req.tenantId },
    data: {
      ...(status !== undefined && { status }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(notes !== undefined && { notes }),
      ...(name !== undefined && { name }),
      ...(docType !== undefined && { docType }),
      ...(description !== undefined && { description }),
      updatedAt: new Date(),
    },
  });
  if (upd.count === 0) return res.status(404).json({ error: 'Devir evrakı bulunamadı.' });
  const doc = await prisma.projectHandoverDoc.findFirst({ where: { id: docId, tenantId: req.tenantId } });
  res.json(doc);
}));

router.delete('/:id/handover-docs/:docId', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.projectHandoverDoc.deleteMany({ where: { id: String(req.params.docId), tenantId: req.tenantId } });
  if (del.count === 0) return res.status(404).json({ error: 'Devir evrakı bulunamadı.' });
  res.json({ ok: true });
}));

router.post(
  '/:id/handover-docs/:docId/upload',
  handoverUpload.single('file'),
  enforceStorageLimit(),
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = String(req.params.id);
    const docId = String(req.params.docId);
    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });

    const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: req.tenantId } });
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const folder = handoverFolder(project);
    const uploadDir = getUploadDir(HANDOVER_UPLOADS_ROOT, folder);

    const ext = path.extname(req.file.originalname);
    const safeName = `${docId.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);
    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/project-handovers/${folder}/${safeName}`;
    const remotePath = `/ENFLOW_DMS/ProjeDevir/${folder}`;
    const ncUrl = await tryUploadToNextcloud(req.tenantId, req.file.buffer, safeName, remotePath);
    const fileUrl = ncUrl || localUrl;

    const doc = await prisma.projectHandoverDoc.update({
      where: { id: docId },
      data: { fileUrl, status: 'UPLOADED', updatedAt: new Date() },
    });

    res.json({ doc, localUrl, nextcloudUrl: ncUrl, folder, fileName: safeName });
  })
);


// ── Proje-Birim İştiraki (Katman-2 katsayısı) — Faz 2 ────────────────────────
const partRoles = requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']);
async function ownsProjectP(req: Request): Promise<boolean> {
  const p = await prisma.project.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, select: { id: true } });
  return !!p;
}

router.get('/:id/participations', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!(await ownsProjectP(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });
  const parts = await prisma.projectUnitParticipation.findMany({ where: { projectId: String(req.params.id) }, include: { unit: { select: { name: true } } } });
  res.json(parts);
}));

router.post('/:id/participations', tenantMiddleware, partRoles, asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  if (!(await ownsProjectP(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });
  const b = req.body as { unitId?: string; coefficient?: number; role?: string; notes?: string };
  if (!b.unitId) return res.status(400).json({ error: 'unitId gerekli.' });
  const unit = await prisma.unit.findFirst({ where: { id: b.unitId, tenantId: req.tenantId } });
  if (!unit) return res.status(404).json({ error: 'Birim bulunamadı.' });
  const coefficient = Math.max(0, Math.min(1, Number(b.coefficient) || 0));
  const part = await prisma.projectUnitParticipation.upsert({
    where: { projectId_unitId: { projectId, unitId: b.unitId } },
    update: { coefficient, role: b.role || null, notes: b.notes || null },
    create: { projectId, unitId: b.unitId, coefficient, role: b.role || null, notes: b.notes || null },
    include: { unit: { select: { name: true } } },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'UPSERT', entityType: 'PROJECT_UNIT_PARTICIPATION', entityId: part.id, details: { projectId, unitId: b.unitId, coefficient } });
  res.json(part);
}));

router.delete('/:id/participations/:pid', tenantMiddleware, partRoles, asyncHandler(async (req: Request, res: Response) => {
  if (!(await ownsProjectP(req))) return res.status(404).json({ error: 'Proje bulunamadı.' });
  const del = await prisma.projectUnitParticipation.deleteMany({ where: { id: String(req.params.pid), projectId: String(req.params.id) } });
  if (del.count === 0) return res.status(404).json({ error: 'İştirak bulunamadı.' });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'PROJECT_UNIT_PARTICIPATION', entityId: String(req.params.pid) });
  res.json({ message: 'İştirak silindi.' });
}));

// ── İşletme Maliyeti (Overhead) — Faz 1 ──────────────────────────────────────
router.get('/:id/overhead', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const r = await computeProjectOverhead(req.tenantId, String(req.params.id));
  if (!r) return res.status(404).json({ error: 'Proje bulunamadı.' });
  res.json(r);
}));

// Yönetim insiyatifi: overhead uygula/kaldır (GM/FINANCE_MGR)
router.post('/:id/overhead/apply', tenantMiddleware, requireRole(['GENERAL_MANAGER', 'FINANCE_MGR']), asyncHandler(async (req: Request, res: Response) => {
  const b = req.body as { apply?: boolean; rate?: number };
  const r = await applyProjectOverhead(req.tenantId, String(req.params.id), !!b.apply, b.rate);
  if (!r) return res.status(404).json({ error: 'Proje bulunamadı.' });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: b.apply ? 'OVERHEAD_APPLIED' : 'OVERHEAD_REMOVED', entityType: 'PROJECT', entityId: String(req.params.id), details: { overhead: r.totalOverhead, netMargin: r.netMargin } });
  res.json(r);
}));

export default router;
