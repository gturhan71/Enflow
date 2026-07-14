import { Router, Request, Response } from 'express';
import { analyzeSpec } from '../services/specAnalysis';
import { documentUpload } from '../utils/secureUpload';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { ensureApprovalChain, completeApprovalChain } from '../services/approvalChainService';
import { createProjectWithMilestones } from '../services/projectFactory';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);
router.use(requireRole(['GENERAL_MANAGER', 'KSU_MGR', 'SALES_MGR', 'PROJECT_MGR', 'LEGAL_MGR', 'FINANCE_MGR', 'IGPD_MGR']));

// ── Upload helpers ─────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .replace(/[ğ]/gi, 'g').replace(/[ü]/gi, 'u').replace(/[ş]/gi, 's')
    .replace(/[ı]/gi, 'i').replace(/[ö]/gi, 'o').replace(/[ç]/gi, 'c')
    .replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').slice(0, 60);
}

function contractFolder(wf: { tenderName?: string | null; tenderNo?: string | null; projectName?: string | null; title: string }): string {
  const base = wf.projectName || wf.tenderName || wf.title;
  const parts = [slugify(base), wf.tenderNo ? slugify(wf.tenderNo) : null].filter(Boolean);
  return parts.join('_');
}

const UPLOADS_ROOT = path.join(__dirname, '../../uploads/contracts');

function getUploadDir(folderName: string): string {
  const dir = path.join(UPLOADS_ROOT, folderName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Tür-doğrulamalı, bellek-tabanlı yükleme (paylaşımlı güvenli fabrika).
const upload = documentUpload(50);

// ── Nextcloud WebDAV helper ────────────────────────────────────────────────────

async function uploadToNextcloud(
  fileBuffer: Buffer,
  fileName: string,
  remotePath: string,
  ncUrl: string,
  ncUser: string,
  ncPass: string,
): Promise<string> {
  const fullPath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`;
  const uploadUrl = `${ncUrl}/remote.php/dav/files/${ncUser}${fullPath}`;
  const auth = Buffer.from(`${ncUser}:${ncPass}`).toString('base64');

  // MKCOL (create folder tree) — best-effort, ignore errors
  const mkcolUrl = `${ncUrl}/remote.php/dav/files/${ncUser}${remotePath}`;
  await new Promise<void>(resolve => {
    const lib = mkcolUrl.startsWith('https') ? https : http;
    const req = lib.request(mkcolUrl, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${auth}` },
    });
    req.on('response', () => resolve());
    req.on('error', () => resolve());
    req.end();
  });

  // PUT file
  return new Promise((resolve, reject) => {
    const lib = uploadUrl.startsWith('https') ? https : http;
    const req = lib.request(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
      },
    }, res => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve(uploadUrl);
      } else {
        reject(new Error(`Nextcloud PUT ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

const pid = (req: Request) => String(req.params.id);

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.contractWorkflow.findMany({
    where: { tenantId: req.tenantId },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(workflows);
}));

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, opportunityId, contractId, contractValue, deadline, notes, tenderName, tenderNo, projectName } = req.body;
  const composedTitle = [
    tenderName || title || 'Yeni Sözleşme',
    tenderNo ? `İKN: ${tenderNo}` : null,
  ].filter(Boolean).join(' — ');
  const wf = await prisma.contractWorkflow.create({
    data: {
      title: composedTitle,
      opportunityId: opportunityId || null,
      contractId: contractId || null,
      contractValue: contractValue || 0,
      tenderName: tenderName || null,
      tenderNo: tenderNo || null,
      projectName: projectName || null,
      deadline: deadline ? new Date(deadline) : null,
      notes: notes || null,
      tenantId: req.tenantId,
      updatedAt: new Date(),
    },
    include: { documents: true },
  });
  res.json(wf);
}));

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const wf = await prisma.contractWorkflow.findFirst({
    where: { id: pid(req), tenantId: req.tenantId },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!wf) return res.status(404).json({ error: 'Not found' });
  res.json(wf);
}));

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { contractText, specText, status, signedDate, deadline, contractValue, notes, title, tenderName, tenderNo, projectName } = req.body;
  const wf = await prisma.contractWorkflow.update({
    where: { id: pid(req) },
    data: {
      ...(title !== undefined && { title }),
      ...(contractText !== undefined && { contractText }),
      ...(specText !== undefined && { specText }),
      ...(status !== undefined && { status }),
      ...(signedDate !== undefined && { signedDate: signedDate ? new Date(signedDate) : null }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(contractValue !== undefined && { contractValue }),
      ...(notes !== undefined && { notes }),
      ...(tenderName !== undefined && { tenderName }),
      ...(tenderNo !== undefined && { tenderNo }),
      ...(projectName !== undefined && { projectName }),
      updatedAt: new Date(),
    },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
  });

  // Faz 0 — kalıcı onay zinciri: KSU (evrak kontrolü) → Üst Yönetim (imza onayı)
  if (status === 'PENDING_SIGNATURE_APPROVAL') {
    await ensureApprovalChain(req.tenantId, 'CONTRACT_WORKFLOW_SIGNING', wf.id);
  } else if (status === 'SIGNED') {
    await completeApprovalChain(req.tenantId, 'CONTRACT_WORKFLOW_SIGNING', wf.id, req.userId, 'Sözleşme imzalandı.');
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status ? `STATUS_${status}` : 'UPDATE', entityType: 'CONTRACT_WORKFLOW', entityId: wf.id, details: { title: wf.title, status: wf.status } });
  res.json(wf);
}));

// ── AI ANALYSIS ───────────────────────────────────────────────────────────────
router.post('/:id/analyze', asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req);
  const wf = await prisma.contractWorkflow.findFirst({
    where: { id, tenantId: req.tenantId },
  });
  if (!wf) return res.status(404).json({ error: 'Not found' });

  const inputText = [
    wf.contractText ? `## SÖZLEŞME METNİ\n${wf.contractText}` : '',
    wf.specText ? `## İDARİ ŞARTNAME\n${wf.specText}` : '',
  ].filter(Boolean).join('\n\n');

  if (!inputText.trim()) {
    return res.status(400).json({ error: 'Analiz için sözleşme metni veya idari şartname girilmeli.' });
  }

  // Ortak şartname analiz servisi (tenant-yapılandırmalı YZ + mock fallback) — DRY (tenders ile paylaşımlı)
  const { analysis } = await analyzeSpec(inputText, { tenantId: req.tenantId, fallbackName: wf.tenderName || wf.title, fallbackNo: wf.tenderNo });

  // Extract project name and tender no from analysis, update workflow title
  const summary = (analysis as { contract_summary?: { project_name?: string; tender_no?: string } }).contract_summary;
  const extractedProjectName = summary?.project_name || null;
  const extractedTenderNo = summary?.tender_no || null;

  const autoTitle = [
    extractedProjectName || wf.tenderName || wf.title,
    extractedTenderNo ? `İKN: ${extractedTenderNo}` : (wf.tenderNo ? `İKN: ${wf.tenderNo}` : null),
  ].filter(Boolean).join(' — ');

  // Save analysis, update title/projectName/tenderNo, auto-create document entries
  await prisma.contractWorkflow.update({
    where: { id },
    data: {
      aiAnalysis: JSON.stringify(analysis),
      status: 'ANALYSIS_DONE',
      title: autoTitle,
      ...(extractedProjectName && { projectName: extractedProjectName }),
      ...(extractedTenderNo && { tenderNo: extractedTenderNo }),
      updatedAt: new Date(),
    },
  });

  const docs = (analysis as { documents?: { name: string; docType: string; description: string; deadline_priority: string; notes: string }[] }).documents || [];
  await prisma.contractWorkflowDoc.deleteMany({ where: { workflowId: id, isAiGenerated: true } });

  if (docs.length > 0) {
    await prisma.contractWorkflowDoc.createMany({
      data: docs.map((d, i) => ({
        id: `${id}-ai-${i}-${Date.now()}`,
        workflowId: id,
        name: d.name,
        docType: d.docType || 'OTHER',
        description: d.description || '',
        status: 'PENDING',
        isRequired: true,
        isAiGenerated: true,
        sortOrder: i,
        notes: d.notes || '',
        tenantId: req.tenantId,
        updatedAt: new Date(),
      })),
    });
  }

  const result = await prisma.contractWorkflow.findFirst({
    where: { id },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json({ workflow: result, analysis });
}));

// ── DELETE WORKFLOW ───────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req);
  const wf = await prisma.contractWorkflow.findFirst({ where: { id, tenantId: req.tenantId }, select: { id: true } });
  if (!wf) return res.status(404).json({ error: 'Sözleşme akışı bulunamadı.' });
  await prisma.contractWorkflowDoc.deleteMany({ where: { workflowId: id } });
  await prisma.contractWorkflow.delete({ where: { id } });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELETE', entityType: 'CONTRACT_WORKFLOW', entityId: id });
  res.json({ success: true });
}));

// ── DOCUMENTS CRUD ────────────────────────────────────────────────────────────
router.post('/:id/documents', asyncHandler(async (req: Request, res: Response) => {
  const { name, docType, description, deadline, notes, isRequired, sortOrder } = req.body;
  const doc = await prisma.contractWorkflowDoc.create({
    data: {
      workflowId: pid(req),
      name,
      docType: docType || 'OTHER',
      description: description || '',
      deadline: deadline ? new Date(deadline) : null,
      notes: notes || '',
      isRequired: isRequired !== false,
      isAiGenerated: false,
      sortOrder: sortOrder || 0,
      tenantId: req.tenantId,
      updatedAt: new Date(),
    },
  });
  res.json(doc);
}));

router.put('/:id/documents/:docId', asyncHandler(async (req: Request, res: Response) => {
  const { status, fileUrl, notes, deadline, name, docType, description } = req.body;
  const doc = await prisma.contractWorkflowDoc.update({
    where: { id: String(req.params.docId) },
    data: {
      ...(status !== undefined && { status }),
      ...(fileUrl !== undefined && { fileUrl }),
      ...(notes !== undefined && { notes }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(name !== undefined && { name }),
      ...(docType !== undefined && { docType }),
      ...(description !== undefined && { description }),
      updatedAt: new Date(),
    },
  });
  res.json(doc);
}));

router.delete('/:id/documents/:docId', asyncHandler(async (req: Request, res: Response) => {
  const delDoc = await prisma.contractWorkflowDoc.deleteMany({ where: { id: String(req.params.docId), tenantId: req.tenantId } });
  if (delDoc.count === 0) return res.status(404).json({ error: 'Evrak bulunamadı.' });
  res.json({ success: true });
}));

// ── FILE UPLOAD ───────────────────────────────────────────────────────────────
router.post(
  '/:id/documents/:docId/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = pid(req);
    const docId = String(req.params.docId);

    if (!req.file) return res.status(400).json({ error: 'Dosya gönderilmedi.' });

    const wf = await prisma.contractWorkflow.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!wf) return res.status(404).json({ error: 'Workflow bulunamadı.' });

    // IDOR koruması: docId gerçekten bu workflow'a + tenant'a ait mi?
    const docOwned = await prisma.contractWorkflowDoc.findFirst({
      where: { id: docId, workflowId: id, tenantId: req.tenantId },
      select: { id: true },
    });
    if (!docOwned) return res.status(404).json({ error: 'Evrak bulunamadı.' });

    const folder = contractFolder(wf);
    const uploadDir = getUploadDir(folder);

    const ext = path.extname(req.file.originalname);
    const safeName = `${docId.slice(-8)}_${slugify(path.basename(req.file.originalname, ext))}${ext}`;
    const localPath = path.join(uploadDir, safeName);

    fs.writeFileSync(localPath, req.file.buffer);

    const localUrl = `/uploads/contracts/${folder}/${safeName}`;
    let fileUrl = localUrl;
    let ncUrl: string | null = null;

    // Nextcloud — opsiyonel, .env'den okur
    const NC_URL = process.env.NEXTCLOUD_URL;
    const NC_USER = process.env.NEXTCLOUD_USER;
    const NC_PASS = process.env.NEXTCLOUD_PASS;

    if (NC_URL && NC_USER && NC_PASS) {
      try {
        const remotePath = `/ENFLOW_DMS/Sozlesmeler/${folder}`;
        ncUrl = await uploadToNextcloud(req.file.buffer, safeName, remotePath, NC_URL, NC_USER, NC_PASS);
        fileUrl = ncUrl;
      } catch (e) {
        console.warn('[Nextcloud] Upload failed, using local:', (e as Error).message);
        fileUrl = localUrl;
      }
    }

    const doc = await prisma.contractWorkflowDoc.update({
      where: { id: docId },
      data: { fileUrl, status: 'UPLOADED', updatedAt: new Date() },
    });

    res.json({
      doc,
      localUrl,
      nextcloudUrl: ncUrl,
      folder,
      fileName: safeName,
    });
  })
);

// ── TRANSFER TO PROJECT ───────────────────────────────────────────────────────
router.post('/:id/transfer', asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req);
  const wf = await prisma.contractWorkflow.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { documents: true },
  });
  if (!wf) return res.status(404).json({ error: 'Not found' });

  const analysis = wf.aiAnalysis ? JSON.parse(wf.aiAnalysis) : null;
  const tasks: { title: string; description: string; priority: string }[] = analysis?.tasks || [];

  const { unitId, assignedById } = req.body;

  const createdTasks = await Promise.all(
    tasks.map(t =>
      prisma.todoTask.create({
        data: {
          title: `[Sözleşme] ${t.title}`,
          description: `${t.description}\n\nKaynak: ${wf.title}`,
          unitId: unitId || 'default',
          assignedBy: assignedById || 'system',
          priority: t.priority === 'HIGH' ? 'HIGH' : t.priority === 'LOW' ? 'LOW' : 'MEDIUM',
          status: 'PENDING',
          relatedModule: 'CONTRACT',
          relatedItemId: id,
          tenantId: req.tenantId,
          updatedAt: new Date(),
        },
      })
    )
  );

  // Sözleşme → Proje: imzalı sözleşmeden Project kaydı oluştur (idempotent — projectId doluysa atla)
  let project = null;
  if (!wf.projectId) {
    project = await createProjectWithMilestones(
      req.tenantId,
      {
        name: wf.projectName || wf.title,
        opportunityId: wf.opportunityId || undefined,
        contractId: wf.contractId || undefined,
        totalValue: wf.contractValue,
        budgetTotal: wf.contractValue,
        deadline: wf.deadline || undefined,
        type: 'HARDWARE',
      },
      req.userId,
    );
  } else {
    project = await prisma.project.findFirst({ where: { id: wf.projectId, tenantId: req.tenantId } });
  }

  await prisma.contractWorkflow.update({
    where: { id },
    data: { status: 'TRANSFERRED', projectId: project?.id ?? wf.projectId ?? null, updatedAt: new Date() },
  });

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'TRANSFER_TO_PROJECT', entityType: 'CONTRACT_WORKFLOW', entityId: id, details: { projectId: project?.id ?? null, projectCode: project?.code ?? null, tasksCreated: createdTasks.length } });
  res.json({ success: true, project, tasksCreated: createdTasks.length, tasks: createdTasks });
}));

// ── Sözleşme → Satınalma devri: BoM + referans alış fiyatlarıyla Satınalma Talebi (PR) ──
router.post('/:id/handoff-procurement', asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req);
  const tenantId = req.tenantId;
  const wf = await prisma.contractWorkflow.findFirst({ where: { id, tenantId } });
  if (!wf) return res.status(404).json({ error: 'Not found' });
  if (!['SIGNED', 'TRANSFERRED'].includes(wf.status)) {
    return res.status(409).json({ error: 'Yalnız imzalanmış sözleşme Satınalmaya aktarılabilir.' });
  }
  if (wf.procurementRequestId) {
    return res.status(409).json({ error: 'Bu sözleşme zaten Satınalmaya aktarıldı.', procurementRequestId: wf.procurementRequestId });
  }

  // İş bilgisi + BoM (opportunity üzerinden)
  const opp = wf.opportunityId
    ? await prisma.opportunity.findFirst({ where: { id: wf.opportunityId, tenantId }, include: { bomItems: true, customer: true } })
    : null;
  const bomItems = opp?.bomItems ?? [];
  const currency = bomItems[0]?.currency || 'TRY';

  // Satınalma birimi (PROCUREMENT_MGR)
  const procUser = await prisma.user.findFirst({ where: { tenantId, role: 'PROCUREMENT_MGR' } });

  const descLines = [
    `Sözleşme: ${wf.title}`,
    wf.tenderNo ? `İKN: ${wf.tenderNo}` : '',
    opp?.customer?.name ? `Müşteri: ${opp.customer.name}` : '',
    `Sözleşme bedeli: ${wf.contractValue ?? 0} ${currency}`,
    'Kaynak: imzalı sözleşme — BoM referans alış fiyatları üretici/distribütör ile yapılmıştır.',
  ].filter(Boolean).join('\n');

  const pr = await prisma.purchaseRequest.create({
    data: {
      tenantId,
      title: `[Sözleşme] ${wf.projectName || wf.title}`,
      description: descLines,
      sourceType: 'BOM',
      sourceBomId: wf.opportunityId || null,
      projectId: wf.projectId || null,
      requestedBy: req.userId || 'system',
      requestedByName: null,
      unitId: procUser?.unitId || null,
      unitName: null,
      status: 'DRAFT',
      urgency: 'NORMAL',
      budgetAmount: wf.contractValue || null,
      currency,
      items: bomItems.length ? {
        create: bomItems.map(b => ({
          name: b.partNumber || b.description || 'Kalem',
          description: b.description || null,
          quantity: b.quantity || 0,
          unit: 'adet',
          estimatedUnitPrice: b.purchaseCost ?? null, // referans ALIŞ fiyatı (satış fiyatı sızmaz)
          currency: b.currency || currency,
          refVendor: b.vendor || null,
          refSource: b.source || null,
        })),
      } : undefined,
    },
    include: { items: true },
  });

  await prisma.contractWorkflow.update({ where: { id }, data: { procurementRequestId: pr.id, updatedAt: new Date() } });

  // Satınalma'yı bilgilendir + görev
  if (procUser?.id) {
    await prisma.notification.create({
      data: {
        tenantId, userId: procUser.id, type: 'INFO',
        title: 'Sözleşme → Satınalma',
        message: `"${wf.projectName || wf.title}" sözleşmesi imzalandı. ${bomItems.length} kalemlik BoM ve referans alış fiyatları Satınalma Talebi olarak iletildi.`,
      },
    }).catch(() => {});
  }
  if (procUser?.unitId) {
    await prisma.todoTask.create({
      data: {
        tenantId, title: `Satınalma: ${wf.projectName || wf.title}`,
        description: `İmzalı sözleşmeden ${bomItems.length} kalemlik satınalma talebi oluştu. Referans alış fiyatlarını (üretici/distribütör) inceleyip teklif toplayın.`,
        unitId: procUser.unitId, assignedBy: req.userId || 'system',
        relatedModule: 'PROCUREMENT', relatedItemId: pr.id, priority: 'HIGH', status: 'PENDING', updatedAt: new Date(),
      },
    }).catch(() => {});
  }

  await logActivity({ tenantId, userId: req.userId, action: 'CONTRACT_TO_PROCUREMENT', entityType: 'CONTRACT_WORKFLOW', entityId: id, details: { purchaseRequestId: pr.id, items: pr.items.length } });
  res.json({ success: true, purchaseRequest: pr });
}));

export default router;
