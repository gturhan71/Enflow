import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole } from '../middleware';
import { ensureApprovalChain, completeApprovalChain } from '../services/approvalChainService';
import { createProjectWithMilestones } from '../services/projectFactory';

const router: Router = Router();
router.use(tenantMiddleware);
router.use(requireRole(['GENERAL_MANAGER']));

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

// Multer with dynamic destination per request (resolved after wf fetch)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

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

  let analysis: object;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Aşağıdaki sözleşme metni ve/veya idari şartnameyi analiz et.
Yanıtı YALNIZCA geçerli JSON olarak ver, açıklama veya markdown olmadan.

Beklenen format:
{
  "documents": [
    {
      "name": "Belge adı",
      "docType": "TAX|BANK|LEGAL|FIRM_CERT|SPEC|ADMIN|OTHER",
      "description": "Ne için gerekli, nasıl temin edilir",
      "deadline_priority": "HIGH|MEDIUM|LOW",
      "estimated_days": 3,
      "notes": "Varsa özel not"
    }
  ],
  "tasks": [
    {
      "order": 1,
      "title": "Yapılacak iş",
      "description": "Detay",
      "category": "TAX|LEGAL|ADMIN|TECHNICAL|OTHER",
      "priority": "HIGH|MEDIUM|LOW",
      "estimated_days": 2
    }
  ],
  "key_clauses": [
    {
      "clause": "Madde başlığı",
      "impact": "Proje/süreç üzerindeki etkisi",
      "action_required": "Yapılması gereken"
    }
  ],
  "contract_summary": {
    "project_name": "İdari şartname veya sözleşmede geçen resmi proje/iş adı (tam olarak belgedeki gibi)",
    "tender_no": "Varsa ihale kayıt numarası (İKN) — örn: 2024/123456 — bulunamazsa null",
    "type": "Sözleşme türü (HIZMET/MAL ALIMI/YAPIM İŞİ/vb.)",
    "tax_obligations": ["Damga vergisi %0.948", "KDV %20"],
    "key_deadlines": ["Başlangıç: X gün", "Teslim: Y gün"],
    "special_requirements": ["Özel şart 1", "Özel şart 2"],
    "project_impacts": ["Proje yönetimini etkileyecek madde 1"]
  }
}

--- BELGE ---
${inputText}`,
      }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    analysis = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } else {
    analysis = {
      documents: [
        { name: 'Geçici Teminat Mektubu', docType: 'BANK', description: 'Sözleşme bedelinin %6\'sı oranında banka teminat mektubu', deadline_priority: 'HIGH', estimated_days: 3, notes: 'Bankadan alınacak, belirli süre geçerli olmalı' },
        { name: 'Vergi Borcu Yoktur Yazısı', docType: 'TAX', description: 'Vergi dairesinden güncel tarihli belge', deadline_priority: 'HIGH', estimated_days: 2, notes: 'İnteraktif vergi dairesinden online alınabilir' },
        { name: 'SGK Borcu Yoktur Yazısı', docType: 'FIRM_CERT', description: 'SGK\'dan güncel tarihli borcu yoktur belgesi', deadline_priority: 'HIGH', estimated_days: 2, notes: 'e-Devlet üzerinden alınabilir' },
        { name: 'Ticaret Odası Faaliyet Belgesi', docType: 'LEGAL', description: 'Son 6 ay içinde alınmış güncel faaliyet belgesi', deadline_priority: 'MEDIUM', estimated_days: 1, notes: 'Bağlı olunan ticaret odasından temin edilir' },
        { name: 'İmza Sirküleri', docType: 'LEGAL', description: 'Noterden onaylı güncel imza sirküleri', deadline_priority: 'MEDIUM', estimated_days: 1, notes: 'Mevcut sirküler güncel ise kullanılabilir' },
        { name: 'Damga Vergisi Dekontu', docType: 'TAX', description: 'Sözleşme bedeli üzerinden %0.948 damga vergisi ödeme dekontu', deadline_priority: 'HIGH', estimated_days: 1, notes: 'Vergi dairesine ödeme yapılmalı' },
        { name: 'İdari Şartname', docType: 'SPEC', description: 'Müşteri tarafından verilen idari şartname belgesi', deadline_priority: 'MEDIUM', estimated_days: 0, notes: 'Müşteriden temin edildi' },
      ],
      tasks: [
        { order: 1, title: 'Teminat mektubunu bankaya hazırlat', description: 'Sözleşme bedeli belirlendikten sonra %6 oranında geçici teminat mektubu temin et', category: 'LEGAL', priority: 'HIGH', estimated_days: 3 },
        { order: 2, title: 'Vergi ve SGK borcu yoktur belgelerini al', description: 'Güncel tarihli vergi ve SGK borcu yoktur yazılarını temin et', category: 'TAX', priority: 'HIGH', estimated_days: 2 },
        { order: 3, title: 'Damga vergisini öde', description: 'Sözleşme bedelinin %0.948\'i oranında damga vergisini vergi dairesine yatır', category: 'TAX', priority: 'HIGH', estimated_days: 1 },
        { order: 4, title: 'Taslak sözleşmeyi hukuk birimine incelet', description: 'Sözleşme maddelerinin yasal uygunluğu için hukuk birimi incelemesi yaptır', category: 'LEGAL', priority: 'MEDIUM', estimated_days: 2 },
        { order: 5, title: 'Sözleşme imzalama randevusu al', description: 'Müşteri ile uygun tarihte imzalama toplantısı planla', category: 'ADMIN', priority: 'MEDIUM', estimated_days: 1 },
      ],
      key_clauses: [
        { clause: 'Cezai Şart', impact: 'Gecikmeler için günlük ceza uygulanabilir', action_required: 'Proje takvimini dikkatli planla, tampon süre bırak' },
        { clause: 'Ödeme Koşulları', impact: 'Hakediş/milestone bazlı ödeme yapısı belirlenmiş olabilir', action_required: 'Nakit akış planlaması yap' },
        { clause: 'Garanti ve Teminat', impact: 'İş bitiminde kesin teminat mektubu gerekebilir', action_required: 'Teminat mektuplarının sürelerini takip et' },
      ],
      contract_summary: {
        project_name: wf.tenderName || wf.title,
        tender_no: wf.tenderNo || null,
        type: 'HİZMET / MAL ALIMI',
        tax_obligations: ['Damga Vergisi %0.948', 'KDV %20'],
        key_deadlines: ['Sözleşme imzasından itibaren iş başı', 'Teslim süresi şartnamede belirtilmiş'],
        special_requirements: ['Yerli malı belgesi gerekebilir', 'ISO sertifikaları gerekebilir'],
        project_impacts: ['Teknik şartname gereksinimleri proje kapsamını belirler', 'Muayene ve kabul prosedürleri uygulanacak'],
      },
    };
  }

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
  await prisma.contractWorkflowDoc.deleteMany({ where: { workflowId: id } });
  await prisma.contractWorkflow.delete({ where: { id } });
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
  await prisma.contractWorkflowDoc.delete({ where: { id: String(req.params.docId) } });
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

  res.json({ success: true, project, tasksCreated: createdTasks.length, tasks: createdTasks });
}));

export default router;
