import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { analyzeSpec } from '../services/specAnalysis';
import { documentUpload } from '../utils/secureUpload';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { advanceProcess, ProcessNotConfiguredError } from '../services/processEngine';
import { logActivity } from '../services/activityLog';
import { checkStatusTransition, buildAutoTitle } from '../services/contractWorkflowState';
import { similarityRatio } from '../utils/textSimilarity';

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

// ── Firma Belgesi → Şirket Evrakları arşivinden otomatik eşleme ────────────────
// "FIRM_CERT" (Firma Belgesi) türündeki sözleşme evrakları — ticaret sicil gazetesi,
// imza sirküleri, faaliyet/iş bitirme belgesi vb. — her sözleşmede aynıdır ve zaten
// kurumsal "Şirket Evrakları" arşivinde (CorporateDocument) tutulur. Süresi geçmemiş
// (geçerli) ve dosyası yüklü bir arşiv kaydı isim benzerliğiyle eşleşirse, kullanıcı
// tekrar yüklemek zorunda kalmasın diye otomatik bağlanır.
const ARCHIVE_MATCH_THRESHOLD = 0.55;

async function resolveFirmCertFromArchive(tenantId: string, docName: string) {
  if (!docName?.trim()) return null;
  const candidates = await prisma.corporateDocument.findMany({
    where: {
      tenantId,
      fileUrl: { not: null },
      OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
    },
    select: { name: true, fileUrl: true, docNumber: true },
  });
  if (candidates.length === 0) return null;

  const target = docName.toLocaleLowerCase('tr-TR').trim();
  let best: { fileUrl: string; name: string; docNumber: string | null; score: number } | null = null;
  for (const c of candidates) {
    const score = similarityRatio(target, c.name.toLocaleLowerCase('tr-TR').trim());
    if (!best || score > best.score) best = { fileUrl: c.fileUrl as string, name: c.name, docNumber: c.docNumber, score };
  }
  return best && best.score >= ARCHIVE_MATCH_THRESHOLD ? best : null;
}

const archiveSourceNote = (match: { name: string; docNumber: string | null }) =>
  `Şirket Evrakları arşivinden otomatik alındı: ${match.name}${match.docNumber ? ' · ' + match.docNumber : ''}.`;

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
  const { contractText, specText, status, signedDate, deadline, contractValue, notes, title, tenderName, tenderNo, projectName, cancelReason } = req.body;

  if (status !== undefined) {
    const current = await prisma.contractWorkflow.findFirst({ where: { id: pid(req), tenantId: req.tenantId } });
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (status !== current.status) {
      const check = checkStatusTransition(current.status, status, req.userRole || '', cancelReason);
      if (!check.ok) return res.status(check.code).json({ error: check.error });
    }
    // Süreç Motoru (Faz A) — durum kalıcı hale gelmeden ÖNCE kontrol edilir ki
    // tenant CONTRACT_SIGNING sürecini Tasarımcı'da henüz kurgulamadıysa
    // ContractWorkflow yarım-güncellenmiş (status değişti ama zincir yok) bir
    // durumda kalmasın — 409 dönerse status hiç yazılmaz.
    if (status === 'PENDING_SIGNATURE_APPROVAL' && status !== current.status) {
      try {
        await advanceProcess(req.tenantId, 'CONTRACT_SIGNING', 'CONTRACT_WORKFLOW_SIGNING', current.id, { actorUserId: req.userId });
      } catch (e) {
        if (e instanceof ProcessNotConfiguredError) {
          return res.status(409).json({ error: 'Sözleşme imza süreci henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Sözleşme İmza" sürecini kurgulayın.' });
        }
        throw e;
      }
    }
  }

  const isTerminalExit = status === 'CANCELLED' || status === 'TERMINATED';
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
      ...(isTerminalExit && { cancelReason, cancelledAt: new Date(), cancelledById: req.userId }),
      updatedAt: new Date(),
    },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
  });

  // NOT: `SIGNED` durumuna geçiş için ayrı bir eylem YOK — imza onayı zincirin
  // aşamaları (ör. KSU→GM) `/approval-chains/:id/stages/:sid/approve` üzerinden
  // (PendingChainApprovals.tsx) bireysel onaylandıkça zaten ilerler; status
  // burada yalnız ContractWorkflow'un kendi durum makinesini (checkStatusTransition,
  // TRANSITION_ROLES — ayrı bir yetki katmanı) yansıtır.

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: status ? `STATUS_${status}` : 'UPDATE', entityType: 'CONTRACT_WORKFLOW', entityId: wf.id, details: { title: wf.title, status: wf.status, ...(isTerminalExit && { cancelReason }) } });
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
  const { analysis, usedAI } = await analyzeSpec(inputText, { tenantId: req.tenantId, fallbackName: wf.tenderName || wf.title, fallbackNo: wf.tenderNo });

  // Extract project name and tender no from analysis, update workflow title
  const summary = (analysis as { contract_summary?: { project_name?: string; tender_no?: string } }).contract_summary;
  const extractedProjectName = summary?.project_name || null;
  const extractedTenderNo = summary?.tender_no || null;

  const autoTitle = buildAutoTitle(
    { projectName: extractedProjectName, tenderNo: extractedTenderNo },
    { tenderName: wf.tenderName, tenderNo: wf.tenderNo, title: wf.title },
  );

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
    const docsData = await Promise.all(docs.map(async (d, i) => {
      const base = {
        id: `${id}-ai-${i}-${Date.now()}`,
        workflowId: id,
        name: d.name,
        docType: d.docType || 'OTHER',
        description: d.description || '',
        isRequired: true,
        isAiGenerated: true,
        sortOrder: i,
        notes: d.notes || '',
        tenantId: req.tenantId,
        updatedAt: new Date(),
      };
      if ((d.docType || '').toUpperCase() === 'FIRM_CERT') {
        const match = await resolveFirmCertFromArchive(req.tenantId, d.name);
        if (match) {
          return { ...base, status: 'UPLOADED', fileUrl: match.fileUrl, notes: [base.notes, archiveSourceNote(match)].filter(Boolean).join(' ') };
        }
      }
      return { ...base, status: 'PENDING' };
    }));
    await prisma.contractWorkflowDoc.createMany({ data: docsData });
  }

  const result = await prisma.contractWorkflow.findFirst({
    where: { id },
    include: { documents: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json({ workflow: result, analysis, usedAI });
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

  let fileUrl: string | undefined;
  let status = 'PENDING';
  let finalNotes = notes || '';
  if ((docType || '').toUpperCase() === 'FIRM_CERT') {
    const match = await resolveFirmCertFromArchive(req.tenantId, name);
    if (match) { fileUrl = match.fileUrl; status = 'UPLOADED'; finalNotes = [finalNotes, archiveSourceNote(match)].filter(Boolean).join(' '); }
  }

  const doc = await prisma.contractWorkflowDoc.create({
    data: {
      workflowId: pid(req),
      name,
      docType: docType || 'OTHER',
      description: description || '',
      deadline: deadline ? new Date(deadline) : null,
      notes: finalNotes,
      status,
      ...(fileUrl && { fileUrl }),
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

// Evrak zaten oluşturulduktan sonra (ör. arşive belge sonradan eklendiyse ya da ilk
// eşleme başarısız olduysa) yeniden dene — yalnız Firma Belgesi türü için anlamlı.
router.post('/:id/documents/:docId/from-archive', asyncHandler(async (req: Request, res: Response) => {
  const id = pid(req);
  const docId = String(req.params.docId);
  const doc = await prisma.contractWorkflowDoc.findFirst({ where: { id: docId, workflowId: id, tenantId: req.tenantId } });
  if (!doc) return res.status(404).json({ error: 'Evrak bulunamadı.' });
  if (doc.docType.toUpperCase() !== 'FIRM_CERT') {
    return res.status(400).json({ error: 'Yalnız Firma Belgesi türündeki evraklar Şirket Evrakları arşivinden alınabilir.' });
  }
  const match = await resolveFirmCertFromArchive(req.tenantId, doc.name);
  if (!match) return res.status(404).json({ error: 'Şirket Evrakları arşivinde geçerli ve eşleşen bir belge bulunamadı.' });
  const updated = await prisma.contractWorkflowDoc.update({
    where: { id: docId },
    data: {
      fileUrl: match.fileUrl,
      status: 'UPLOADED',
      notes: [doc.notes, archiveSourceNote(match)].filter(Boolean).join(' '),
      updatedAt: new Date(),
    },
  });
  res.json(updated);
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
        logger.warn('[Nextcloud] Upload failed, using local:', (e as Error).message);
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
  // Faz A düzeltmesi: eskiden bu uçta hiçbir durum ön-koşulu yoktu (yalnız
  // `!wf.projectId` idempotency koruması vardı) — SIGNED olmayan bir sözleşme
  // de aktarılabiliyordu. TRANSFERRED zaten aktarılmış olanın tekrar
  // çağrılmasına (idempotent, örn. sayfa yenileme) izin verir.
  if (wf.status !== 'SIGNED' && wf.status !== 'TRANSFERRED') {
    return res.status(409).json({ error: 'Yalnız SIGNED durumundaki bir sözleşme Proje\'ye aktarılabilir.' });
  }

  const analysis = wf.aiAnalysis ? JSON.parse(wf.aiAnalysis) : null;
  const tasks: { title: string; description: string; priority: string }[] = analysis?.tasks || [];

  // Faz A düzeltmesi: eskiden `unitId || 'default'` — 'default' hiçbir gerçek
  // birime karşılık gelmediği için oluşan görevler kimseye görünmüyordu (bkz.
  // tasks.ts'in unitId filtreleme mantığı). Artık gerçek bir birim zorunlu.
  const { unitId, assignedById } = req.body as { unitId?: string; assignedById?: string };
  let targetUnitId: string | null = null;
  if (tasks.length) {
    if (!unitId) return res.status(400).json({ error: 'Sözleşme görevlerinin atanacağı bir birim (unitId) seçilmelidir.' });
    const unit = await prisma.unit.findFirst({ where: { id: unitId, tenantId: req.tenantId } });
    if (!unit) return res.status(400).json({ error: 'Geçersiz birim.' });
    targetUnitId = unit.id;
  }

  const createdTasks = await Promise.all(
    tasks.map(t =>
      prisma.todoTask.create({
        data: {
          title: `[Sözleşme] ${t.title}`,
          description: `${t.description}\n\nKaynak: ${wf.title}`,
          unitId: targetUnitId as string,
          assignedBy: assignedById || req.userId || 'system',
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

  // Süreç Motoru — CONTRACT_TO_PROJECT, CONTRACT_SIGNING'den bilerek AYRI,
  // bağımsız kurgulanabilir bir süreçtir (imzayı onaylayan birim/rol ile
  // projeyi devralan birim/rol farklı olabilir). Tenant burada bir
  // CREATE_PROJECT_FROM_ENTITY (AUTO) adımı kurguladıysa çalışır ve Proje
  // kaydını oluşturur; kurgulamadıysa proje OLUŞMAZ (sessiz varsayılan YOK) —
  // yalnız görevler aktarılır.
  let result;
  try {
    result = await advanceProcess(req.tenantId, 'CONTRACT_TO_PROJECT', 'CONTRACT_WORKFLOW_SIGNING', id, { actorUserId: req.userId });
  } catch (e) {
    if (e instanceof ProcessNotConfiguredError) {
      return res.status(409).json({ error: 'Sözleşme → Proje süreci henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Sözleşme → Proje" sürecini kurgulayın.' });
    }
    throw e;
  }

  const updatedWf = await prisma.contractWorkflow.findFirst({ where: { id, tenantId: req.tenantId } });
  const project = updatedWf?.projectId
    ? await prisma.project.findFirst({ where: { id: updatedWf.projectId, tenantId: req.tenantId } })
    : null;

  if (updatedWf && updatedWf.status !== 'TRANSFERRED') {
    await prisma.contractWorkflow.update({ where: { id }, data: { status: 'TRANSFERRED', updatedAt: new Date() } });
  }

  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'TRANSFER_TO_PROJECT', entityType: 'CONTRACT_WORKFLOW', entityId: id,
    details: { projectId: project?.id ?? null, projectCode: project?.code ?? null, tasksCreated: createdTasks.length, actionsInvoked: result.actionsInvoked },
  });
  res.json({ success: true, project, tasksCreated: createdTasks.length, tasks: createdTasks });
}));

// ── Sözleşme → Satınalma devri: BoM + referans alış fiyatlarıyla Satınalma Talebi (PR) ──
// Süreç Motoru — eskiden bu route Satınalma alıcısını doğrudan
// `prisma.user.findFirst({role:'PROCUREMENT_MGR'})` ile hardcoded buluyordu;
// Designer'da hiç görünmeyen, tenant'ın kurgulayamadığı bir "olmayan süreç"ti
// (Faz D). Artık CONTRACT_TO_PROCUREMENT processKey'i üzerinden ilerliyor.
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

  try {
    await advanceProcess(tenantId, 'CONTRACT_TO_PROCUREMENT', 'CONTRACT_WORKFLOW_SIGNING', id, { actorUserId: req.userId });
  } catch (e) {
    if (e instanceof ProcessNotConfiguredError) {
      return res.status(409).json({ error: 'Sözleşme → Satınalma süreci henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Sözleşme → Satınalma" sürecini kurgulayın.' });
    }
    throw e;
  }

  const updatedWf = await prisma.contractWorkflow.findFirst({ where: { id, tenantId } });
  const pr = updatedWf?.procurementRequestId
    ? await prisma.purchaseRequest.findFirst({ where: { id: updatedWf.procurementRequestId, tenantId }, include: { items: true } })
    : null;
  if (!pr) {
    return res.status(202).json({ pending: true, message: 'Sözleşme → Satınalma süreci onay bekliyor — talep, onay tamamlanınca oluşturulacak.' });
  }
  res.json({ success: true, purchaseRequest: pr });
}));

export default router;
