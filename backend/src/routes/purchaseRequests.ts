import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';
import { scoreQuotes } from '../services/virtualAgentService';
import { advanceProcess, isAuthorizedForStep, ProcessNotConfiguredError } from '../services/processEngine';
import { resolveEffectiveApprover } from '../services/approvalChainService';

const router: Router = Router();
router.use(tenantMiddleware);

// Her tekliften 0-1 arası ağırlıklı uygunluk skoru (fiyat %60 oransal + puan
// %25 + teslim süresi %15 — bkz. virtualAgentService.scoreQuotes) ekler.
// Skor daha önce yalnız sanal agent'ın arka-plan danışmanlığındaydı; kullanıcı
// artık aynı hesabı ekranda da görüyor, seçim yine insan kararı.
// B-08 — tedarikçi teslim taahhüdü → proje takvimi senkronu. Milestone.status/progress'e
// dokunulmaz (insan kararı olarak kalır) — yalnız tarih alanları + görünür bir uyarı.
async function syncProcurementMilestoneDate(tenantId: string, projectId: string, expectedDate: Date, reason: string) {
  const milestone = await prisma.projectMilestone.findFirst({ where: { projectId, milestoneType: 'PROCUREMENT' } });
  if (!milestone) return;
  const wasAlreadySet = !!milestone.plannedEnd;
  if (wasAlreadySet && milestone.plannedEnd!.getTime() === expectedDate.getTime()) return;

  await prisma.projectMilestone.update({ where: { id: milestone.id }, data: { plannedEnd: expectedDate } }).catch(() => {});

  if (wasAlreadySet) {
    const project = await prisma.project.findFirst({ where: { id: projectId, tenantId } });
    const targets = new Set<string>();
    if (project?.pmId) targets.add(project.pmId);
    if (project?.managerId) targets.add(project.managerId);
    for (const userId of targets) {
      await prisma.notification.create({
        data: {
          tenantId, userId, type: 'WARNING',
          title: 'Tedarikçi teslim tarihi değişti',
          message: `${project?.name || 'Proje'} — Satınalma aşaması planlanan bitiş tarihi ${reason}: ${expectedDate.toLocaleDateString('tr-TR')}.`,
          relatedModule: 'project-mgmt', relatedItemId: projectId,
        },
      }).catch(() => {});
    }
  }
}

type ScorableQuote = { id: string; totalAmount: number; totalAmountTRY: number | null; deliveryDays: number | null; vendor?: { rating: number | null } | null };
function withQuoteScores<Q extends ScorableQuote, T extends { quotes: Q[] }>(pr: T): T {
  if (!pr.quotes?.length) return pr;
  const scored = scoreQuotes(pr.quotes);
  const byId = new Map(scored.map(s => [s.quote.id, s.score]));
  return { ...pr, quotes: pr.quotes.map(q => ({ ...q, score: byId.get(q.id) ?? null })) };
}

// ── LIST ──────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, sourceType } = req.query;
  const requests = await prisma.purchaseRequest.findMany({
    where: {
      tenantId: req.tenantId,
      ...(status ? { status: String(status) } : {}),
      ...(sourceType ? { sourceType: String(sourceType) } : {}),
    },
    include: {
      items: { include: { brand: true } },
      quotes: { include: { vendor: true, items: true } },
      deliveries: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests.map(withQuoteScores));
}));

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: {
      items: { include: { brand: true } },
      quotes: { include: { vendor: true, items: true }, orderBy: { totalAmountTRY: 'asc' } },
      deliveries: { orderBy: { deliveredAt: 'desc' } },
    },
  });
  if (!pr) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  res.json(withQuoteScores(pr));
}));

// ── CREATE ────────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, sourceType, sourceBomId, projectId,
    requestedBy, requestedByName, unitId, unitName,
    urgency, neededBy, budgetAmount, currency, budgetAmountTRY, notes,
    items = [],
  } = req.body;

  if (!title) return res.status(400).json({ error: 'Başlık zorunludur.' });

  const pr = await prisma.purchaseRequest.create({
    data: {
      tenantId: req.tenantId,
      title,
      description: description || null,
      sourceType: sourceType || 'MANUAL',
      sourceBomId: sourceBomId || null,
      projectId: projectId || null,
      requestedBy: requestedBy || req.userId,
      requestedByName: requestedByName || null,
      unitId: unitId || null,
      unitName: unitName || null,
      urgency: urgency || 'NORMAL',
      neededBy: neededBy ? new Date(neededBy) : null,
      budgetAmount: budgetAmount || null,
      currency: currency || 'TRY',
      budgetAmountTRY: budgetAmountTRY || budgetAmount || null,
      notes: notes || null,
      items: items.length ? {
        create: items.map((item: {
          name: string; description?: string; quantity: number;
          unit?: string; estimatedUnitPrice?: number; currency?: string;
          refVendor?: string; refSource?: string; brandId?: string;
        }) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit: item.unit || 'adet',
          estimatedUnitPrice: item.estimatedUnitPrice || null,
          currency: item.currency || currency || 'TRY',
          refVendor: item.refVendor || null,
          refSource: item.refSource || null,
          brandId: item.brandId || null,
        })),
      } : undefined,
    },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PURCHASE_REQUEST', entityId: pr.id, details: { title: pr.title, projectId: pr.projectId } });
  res.status(201).json(pr);
}));

// ── UPDATE ────────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, urgency, neededBy,
    budgetAmount, currency, budgetAmountTRY, notes,
    projectId, unitId, unitName,
  } = req.body;
  const pr = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      title, description, urgency,
      neededBy: neededBy ? new Date(neededBy) : undefined,
      budgetAmount: budgetAmount ?? null,
      currency: currency || undefined,
      budgetAmountTRY: budgetAmountTRY ?? null,
      notes: notes ?? null,
      projectId: projectId ?? null,
      unitId: unitId ?? null,
      unitName: unitName ?? null,
    },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });
  res.json(pr);
}));

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.purchaseRequest.delete({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  res.json({ ok: true });
}));

// ── ONAY / RET ────────────────────────────────────────────────────────────
// Süreç Motoru (Faz B) — DRAFT→PENDING_UNIT (ilk "onaya gönder") PURCHASE_APPROVAL
// zincirini kurar; sonraki her onay çağıranın mevcut PENDING aşamayla eşleşen
// role/birime sahip olmasını gerektirir (opportunities.ts'in GM /approve'undaki
// desenle birebir aynı). Yetki kontrolü/zincir ilerletme, `pr.status` kalıcı
// yazılmadan ÖNCE yapılır — başarısızsa (403/409) hiçbir statü değişmez.
router.post('/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const { approverId } = req.body;
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!pr) return res.status(404).json({ error: 'Bulunamadı.' });

  const nextStatus: Record<string, string> = {
    DRAFT: 'PENDING_UNIT',
    PENDING_UNIT: 'PENDING_PROCUREMENT',
    PENDING_PROCUREMENT: 'PENDING_GM',
    PENDING_GM: 'PO_ISSUED',
  };

  const fieldMap: Record<string, string> = {
    PENDING_UNIT: 'approvedByUnit',
    PENDING_PROCUREMENT: 'approvedByProcurement',
    PENDING_GM: 'approvedByGM',
  };

  const next = nextStatus[pr.status];
  if (!next) return res.status(400).json({ error: `${pr.status} durumundan onay verilemez.` });

  const NOT_CONFIGURED_MSG = 'Satınalma onay süreci henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Satınalma Onayı" sürecini kurgulayın.';
  try {
    if (pr.status === 'DRAFT') {
      await advanceProcess(req.tenantId, 'PURCHASE_APPROVAL', 'PURCHASE_REQUEST', pr.id, { actorUserId: req.userId });
    } else {
      const chain = await prisma.approvalChain.findFirst({
        where: { tenantId: req.tenantId, entityType: 'PURCHASE_REQUEST', entityId: pr.id, status: 'PENDING' },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      if (!chain) return res.status(409).json({ error: 'Onay süreci başlatılmamış. Önce talebi onaya gönderin.' });
      const pending = chain.stages.filter(s => s.status === 'PENDING');
      if (!pending.length) return res.status(409).json({ error: 'Onay bekleyen aşama yok.' });
      const minOrder = Math.min(...pending.map(s => s.order));
      let myStage: (typeof pending)[number] | undefined;
      for (const s of pending.filter(s => s.order === minOrder)) {
        if (await resolveEffectiveApprover(req.tenantId, { role: s.role, unitId: s.unitId, delegateUserId: s.delegateUserId }, req.userId)) { myStage = s; break; }
      }
      if (!myStage) return res.status(403).json({ error: 'Sırası gelmiş bir onay aşamanız yok — önceki aşamaların tamamlanması bekleniyor.' });
      await advanceProcess(req.tenantId, 'PURCHASE_APPROVAL', 'PURCHASE_REQUEST', pr.id, {
        stageId: myStage.id, decision: 'APPROVE', actorUserId: req.userId,
      });
    }
  } catch (e) {
    if (e instanceof ProcessNotConfiguredError) return res.status(409).json({ error: NOT_CONFIGURED_MSG });
    throw e;
  }

  const updateData: Record<string, unknown> = { status: next };
  if (fieldMap[pr.status]) updateData[fieldMap[pr.status]] = approverId || req.userId;
  if (next === 'PO_ISSUED') {
    const year = new Date().getFullYear();
    const count = await prisma.purchaseRequest.count({ where: { tenantId: req.tenantId } });
    updateData.poNumber = `PO-${year}-${String(count).padStart(4, '0')}`;
    updateData.poIssuedAt = new Date();
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id) },
    data: updateData,
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });

  // PO kesilince maliyet kalemi oluştur. PURCHASE_TO_COST_ITEM, PURCHASE_APPROVAL'dan
  // bilerek AYRI, bağımsız kurgulanabilir bir süreçtir (PO onayını veren ile
  // maliyet kalemini bütçeye işleyen birim/rol farklı olabilir — örn. Finans
  // ek onay isteyebilir). PO_ISSUED durum geçişinin kendisi zaten PURCHASE_APPROVAL
  // zincirinin GM aşamasıyla gerçek onaya bağlı — bu ikinci, opsiyonel süreç
  // yapılandırılmamışsa PO_ISSUED'u GERİ ALMAYIZ (zaten onaylanmış bir geçiş),
  // yalnız maliyet kalemi bu talep için oluşmaz (sessiz varsayılan AUTO yok).
  if (next === 'PO_ISSUED') {
    const selected = await prisma.purchaseQuote.findFirst({ where: { purchaseRequestId: pr.id, isSelected: true } });
    // B-08 — seçili tedarikçinin teslim taahhüdü proje takvimine (Satınalma milestone'u) senkronize edilir.
    if (pr.projectId && selected?.deliveryDays && updated.poIssuedAt) {
      const expectedDate = new Date(updated.poIssuedAt);
      expectedDate.setDate(expectedDate.getDate() + selected.deliveryDays);
      await syncProcurementMilestoneDate(req.tenantId, pr.projectId, expectedDate, 'PO kesildi');
    }
    try {
      await advanceProcess(req.tenantId, 'PURCHASE_TO_COST_ITEM', 'PURCHASE_REQUEST', pr.id, { actorUserId: req.userId });
    } catch (e) {
      if (!(e instanceof ProcessNotConfiguredError)) throw e;
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `STATUS_${next}`, entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { title: updated.title, status: updated.status } });
  res.json(updated);
}));

router.post('/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const { rejectedBy, rejectionNote } = req.body;
  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      status: 'REJECTED',
      rejectedBy: rejectedBy || req.userId,
      rejectionNote: rejectionNote || null,
    },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_REJECTED', entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { rejectionNote: rejectionNote || null } });
  res.json(updated);
}));

// B-04 — reddedilen talebi revize edip yeniden onaya sunma: yeni kayıt açmaya
// gerek kalmaz, BoM/Proje bağlantısı (sourceBomId/projectId) ve tüm geçmiş
// (ActivityLog aynı entityId altında) korunur. Onay alanları sıfırlanır —
// süreç baştan (PENDING_UNIT) işler.
router.post('/:id/resubmit', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const pr = await prisma.purchaseRequest.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!pr) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  if (pr.status !== 'REJECTED') return res.status(409).json({ error: 'Yalnız reddedilmiş talepler yeniden gönderilebilir.' });

  const { notes } = req.body as { notes?: string };
  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: 'DRAFT',
      rejectedBy: null,
      rejectionNote: null,
      approvedByUnit: null, approvedByProcurement: null, approvedByGM: null,
      resubmitCount: { increment: 1 },
      ...(notes !== undefined && { notes }),
    },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'RESUBMIT', entityType: 'PURCHASE_REQUEST', entityId: id, details: { previousRejectionNote: pr.rejectionNote, resubmitCount: updated.resubmitCount } });
  res.json(updated);
}));

// ── ITEMS ─────────────────────────────────────────────────────────────────
router.post('/:id/items', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, quantity, unit, estimatedUnitPrice, currency } = req.body;
  const item = await prisma.purchaseItem.create({
    data: {
      purchaseRequestId: String(req.params.id),
      name,
      description: description || null,
      quantity: Number(quantity),
      unit: unit || 'adet',
      estimatedUnitPrice: estimatedUnitPrice || null,
      currency: currency || 'TRY',
    },
  });
  res.status(201).json(item);
}));

router.delete('/:id/items/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.purchaseItem.deleteMany({ where: { id: String(req.params.itemId), purchaseRequest: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Kalem bulunamadı.' });
  res.json({ ok: true });
}));

// ── QUOTES ────────────────────────────────────────────────────────────────
// Kalem bazlı satırlar (items: {purchaseItemId, quantity, unitPrice}[]) verilirse
// totalAmount CLIENT'tan gelen değere değil bu satırların toplamına göre backend'de
// otorite olarak hesaplanır — teklif tutarı her zaman girilen miktar×fiyattan türer.
type QuoteLineInput = { purchaseItemId: string; quantity: number; unitPrice: number };
const sumQuoteLines = (items: QuoteLineInput[]) => items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);

router.post('/:id/quotes', asyncHandler(async (req: Request, res: Response) => {
  const prId = String(req.params.id);
  const owns = await prisma.purchaseRequest.findFirst({ where: { id: prId, tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  const { vendorId, vendorName, totalAmount, currency, totalAmountTRY, deliveryDays, validUntil, notes, items } = req.body as {
    vendorId?: string; vendorName?: string; totalAmount?: number; currency?: string; totalAmountTRY?: number;
    deliveryDays?: number; validUntil?: string; notes?: string; items?: QuoteLineInput[];
  };
  const lines = Array.isArray(items) ? items.filter(i => i.purchaseItemId && i.quantity > 0 && i.unitPrice >= 0) : [];
  const resolvedTotal = lines.length > 0 ? sumQuoteLines(lines) : Number(totalAmount);
  if (!resolvedTotal || resolvedTotal <= 0) return res.status(400).json({ error: 'Teklif tutarı zorunludur (kalem miktar/fiyat girin veya toplam tutar yazın).' });

  const quote = await prisma.purchaseQuote.create({
    data: {
      purchaseRequestId: prId,
      vendorId: vendorId || null,
      vendorName: vendorName || 'Bilinmeyen',
      totalAmount: resolvedTotal,
      currency: currency || 'TRY',
      totalAmountTRY: totalAmountTRY ? Number(totalAmountTRY) : resolvedTotal,
      deliveryDays: deliveryDays ? Number(deliveryDays) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || null,
      items: lines.length > 0 ? {
        create: lines.map(l => ({ purchaseItemId: l.purchaseItemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      } : undefined,
    },
    include: { vendor: true, items: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'QUOTE_ADD', entityType: 'PURCHASE_REQUEST', entityId: prId, details: { vendorName: quote.vendorName, totalAmount: quote.totalAmount, lineCount: lines.length } });
  res.status(201).json(quote);
}));

router.put('/:id/quotes/:qid', asyncHandler(async (req: Request, res: Response) => {
  const qid = String(req.params.qid);
  const owns = await prisma.purchaseQuote.findFirst({
    where: { id: qid, purchaseRequest: { tenantId: req.tenantId } },
    select: { id: true, isSelected: true, purchaseRequest: { select: { projectId: true, poIssuedAt: true } } },
  });
  if (!owns) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  const { vendorName, totalAmount, currency, totalAmountTRY, deliveryDays, validUntil, notes, items } = req.body as {
    vendorName?: string; totalAmount?: number; currency?: string; totalAmountTRY?: number;
    deliveryDays?: number; validUntil?: string; notes?: string; items?: QuoteLineInput[];
  };
  const lines = Array.isArray(items) ? items.filter(i => i.purchaseItemId && i.quantity > 0 && i.unitPrice >= 0) : null;
  const resolvedTotal = lines && lines.length > 0 ? sumQuoteLines(lines) : Number(totalAmount);

  await prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.purchaseQuoteItem.deleteMany({ where: { purchaseQuoteId: qid } });
      if (lines.length > 0) {
        await tx.purchaseQuoteItem.createMany({ data: lines.map(l => ({ purchaseQuoteId: qid, purchaseItemId: l.purchaseItemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) });
      }
    }
    await tx.purchaseQuote.update({
      where: { id: qid },
      data: {
        vendorName, totalAmount: resolvedTotal, currency,
        totalAmountTRY: totalAmountTRY ? Number(totalAmountTRY) : resolvedTotal,
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || null,
      },
    });
  });

  // B-08 — PO zaten kesilmişken seçili teklifin teslim taahhüdü revize edilmişse
  // ("taahhüt değişti") proje takvimi yeniden senkronize edilir.
  if (deliveryDays && owns.isSelected && owns.purchaseRequest.projectId && owns.purchaseRequest.poIssuedAt) {
    const expectedDate = new Date(owns.purchaseRequest.poIssuedAt);
    expectedDate.setDate(expectedDate.getDate() + Number(deliveryDays));
    await syncProcurementMilestoneDate(req.tenantId, owns.purchaseRequest.projectId, expectedDate, 'tedarikçi teklifinde güncellendi');
  }

  res.json(await prisma.purchaseQuote.findFirst({ where: { id: qid, purchaseRequest: { tenantId: req.tenantId } }, include: { vendor: true, items: true } }));
}));

router.delete('/:id/quotes/:qid', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.purchaseQuote.deleteMany({ where: { id: String(req.params.qid), purchaseRequest: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  res.json({ ok: true });
}));

router.post('/:id/quotes/:qid/select', asyncHandler(async (req: Request, res: Response) => {
  const prId = String(req.params.id);
  const qid = String(req.params.qid);
  // Tüm tekliflerin seçimini kaldır
  await prisma.purchaseQuote.updateMany({ where: { purchaseRequestId: prId }, data: { isSelected: false } });
  const selected = await prisma.purchaseQuote.update({
    where: { id: qid },
    data: { isSelected: true },
    include: { vendor: true, items: true },
  });
  // Satınalma talebine seçilen tedarikçiyi kaydet
  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { selectedVendorId: selected.vendorId, selectedVendorName: selected.vendorName },
  });
  res.json(selected);
}));

// ── DELIVERY ──────────────────────────────────────────────────────────────
// B-13 — PR üst statüsü tek bir teslimat kaydının kendi `status`'una göre değil,
// TÜM teslimatların kümülatif teslim-alınan miktarına göre ilerler (çoklu kısmi
// teslimat toplamı sipariş miktarına ulaşınca INVOICED'a geçer; ulaşmazsa
// IN_DELIVERY'de kalır — son kayıt kendi başına 'RECEIVED' dese bile).
router.post('/:id/delivery', asyncHandler(async (req: Request, res: Response) => {
  const prId = String(req.params.id);
  const { deliveredAt, receivedBy, quantityOrdered, quantityReceived, quantityDamaged, status, notes } = req.body;

  const delivery = await prisma.deliveryRecord.create({
    data: {
      purchaseRequestId: prId,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
      receivedBy: receivedBy || null,
      quantityOrdered: quantityOrdered ? Number(quantityOrdered) : null,
      quantityReceived: quantityReceived ? Number(quantityReceived) : null,
      quantityDamaged: quantityDamaged ? Number(quantityDamaged) : null,
      status: status || 'RECEIVED',
      notes: notes || null,
    },
  });

  const pr = await prisma.purchaseRequest.findFirst({ where: { id: prId, tenantId: req.tenantId }, include: { items: true, deliveries: true } });
  if (pr) {
    const totalOrdered = pr.items.reduce((s, i) => s + (i.quantity || 0), 0);
    const cumulativeReceived = pr.deliveries.reduce((s, d) => s + (d.quantityReceived || 0), 0);
    const fullyReceived = totalOrdered > 0 && cumulativeReceived >= totalOrdered;
    await prisma.purchaseRequest.update({
      where: { id: prId },
      // totalOrdered bilinmiyorsa (eski/eksik veri) geriye dönük uyumluluk için kaydın kendi statüsüne güven.
      data: { status: totalOrdered > 0 ? (fullyReceived ? 'INVOICED' : 'IN_DELIVERY') : (status === 'RECEIVED' ? 'INVOICED' : 'IN_DELIVERY') },
    });

    // B-08 — tam teslim alındığında Satınalma milestone'unun gerçek bitiş tarihi
    // doldurulur; planlanandan geç kalınmışsa proje takvimine görünür bir uyarı düşer.
    // Milestone.status/progress'e dokunulmaz (insan kararı olarak kalır).
    if (fullyReceived && pr.projectId) {
      const milestone = await prisma.projectMilestone.findFirst({ where: { projectId: pr.projectId, milestoneType: 'PROCUREMENT' } });
      if (milestone && !milestone.actualEnd) {
        await prisma.projectMilestone.update({ where: { id: milestone.id }, data: { actualEnd: delivery.deliveredAt } }).catch(() => {});
        if (milestone.plannedEnd && delivery.deliveredAt.getTime() > milestone.plannedEnd.getTime()) {
          const project = await prisma.project.findFirst({ where: { id: pr.projectId, tenantId: req.tenantId } });
          const targets = new Set<string>([project?.pmId, project?.managerId].filter((v): v is string => !!v));
          for (const userId of targets) {
            await prisma.notification.create({
              data: {
                tenantId: req.tenantId, userId, type: 'WARNING',
                title: 'Tedarikçi teslimatı gecikti',
                message: `${project?.name || 'Proje'} — Satınalma teslimatı planlanandan (${milestone.plannedEnd.toLocaleDateString('tr-TR')}) geç geldi (${delivery.deliveredAt.toLocaleDateString('tr-TR')}).`,
                relatedModule: 'project-mgmt', relatedItemId: pr.projectId,
              },
            }).catch(() => {});
          }
        }
      }
    }

    // B-13 — hasar/iade alt-akışı: hasarlı teslimat, kümülatif ilerlemeyi bloklamaz
    // (hasarsız kısım yine sayılır) ama Satınalma birimine ayrı bir takip görevi açar.
    if ((status === 'DAMAGED' || (quantityDamaged && Number(quantityDamaged) > 0))) {
      // Faz B düzeltmesi: birim-adı eşleştirmesi (name.contains) yerine role-bazlı
      // arama — tenant birimi yeniden adlandırırsa/özelleştirirse çökmez.
      const procurementUser = await prisma.user.findFirst({ where: { tenantId: req.tenantId, role: 'PROCUREMENT_MGR', status: 'ACTIVE' } });
      const targetUnitId = procurementUser?.unitId || pr.unitId;
      if (targetUnitId) {
        await prisma.todoTask.create({
          data: {
            title: `Hasarlı teslimat — iade/tekrar sipariş: ${pr.title}`,
            description: `Teslimat kaydında hasar bildirildi (${quantityDamaged ? Number(quantityDamaged).toLocaleString('tr-TR') : '?'} adet). Tedarikçiyle iade/tekrar sipariş süreci başlatılmalı.`,
            unitId: targetUnitId,
            assignedToUserId: procurementUser?.id,
            assignedBy: req.userId || 'system',
            tenantId: req.tenantId,
            relatedModule: 'PROCUREMENT', relatedItemId: prId, priority: 'HIGH', status: 'PENDING',
          },
        }).catch(() => {});
      }
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELIVERY_RECORD', entityType: 'PURCHASE_REQUEST', entityId: prId, details: { status: delivery.status, quantityReceived: delivery.quantityReceived, quantityDamaged: delivery.quantityDamaged } });
  res.status(201).json(delivery);
}));

// ── INVOICE ───────────────────────────────────────────────────────────────
// Süreç Motoru (Faz B) — tek-aktörlü yetkilendirme (isAuthorizedForStep):
// tam bir onay zinciri gerekmiyor, yalnız tenant'ın PURCHASE_TO_INVOICE için
// kurguladığı role/birime sahip kullanıcılar fatura işleyebilir.
router.post('/:id/invoice', asyncHandler(async (req: Request, res: Response) => {
  const { invoiceNo, invoiceAmount, invoiceDate, invoicePaidAt } = req.body;
  const pr = await prisma.purchaseRequest.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId } });
  if (!pr) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  if (pr.status !== 'PO_ISSUED' && pr.status !== 'IN_DELIVERY') {
    return res.status(409).json({ error: 'Yalnız PO kesilmiş veya teslimat aşamasındaki bir talebe fatura işlenebilir.' });
  }
  try {
    const authorized = await isAuthorizedForStep(req.tenantId, 'PURCHASE_TO_INVOICE', req.userId);
    if (!authorized) return res.status(403).json({ error: 'Fatura işleme yetkiniz yok.' });
  } catch (e) {
    if (e instanceof ProcessNotConfiguredError) {
      return res.status(409).json({ error: 'Satınalma fatura yetkilendirmesi henüz yapılandırılmamış. Ayarlar → İş Akışı Tasarımcısı\'ndan "Satınalma → Fatura" sürecini kurgulayın.' });
    }
    throw e;
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      invoiceNo: invoiceNo || null,
      invoiceAmount: invoiceAmount ? Number(invoiceAmount) : null,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      invoicePaidAt: invoicePaidAt ? new Date(invoicePaidAt) : null,
      status: invoicePaidAt ? 'CLOSED' : 'INVOICED',
    },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });

  // Satınalma faturası → Finans Invoice (type=PURCHASE). Idempotent: purchaseRequestId ile upsert.
  if (invoiceAmount || invoiceNo) {
    const selectedQuote = updated.quotes.find(q => q.isSelected);
    const amount = invoiceAmount ? Number(invoiceAmount) : 0;
    const paid = !!invoicePaidAt;
    const invData = {
      type: 'PURCHASE',
      invoiceNo: invoiceNo || null,
      amount,
      issueDate: invoiceDate ? new Date(invoiceDate) : null,
      projectId: updated.projectId || null,
      vendorName: selectedQuote?.vendorName || null,
      status: paid ? 'PAID' : 'ISSUED',
      paidAmount: paid ? amount : 0,
      paidAt: paid ? new Date(invoicePaidAt) : null,
      notes: `Satınalma talebinden: ${updated.title}`,
    };
    const existingInv = await prisma.invoice.findFirst({
      where: { purchaseRequestId: updated.id, tenantId: req.tenantId },
    });
    if (existingInv) {
      await prisma.invoice.update({ where: { id: existingInv.id }, data: invData });
    } else {
      await prisma.invoice.create({
        data: { tenantId: req.tenantId, purchaseRequestId: updated.id, ...invData },
      });
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `STATUS_${updated.status}`, entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { invoiceNo: invoiceNo || null, invoiceAmount: invoiceAmount ?? null } });
  res.json(updated);
}));

// ── CLOSE ─────────────────────────────────────────────────────────────────
router.post('/:id/close', asyncHandler(async (req: Request, res: Response) => {
  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { status: 'CLOSED' },
    include: { items: { include: { brand: true } }, quotes: { include: { vendor: true, items: true } }, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_CLOSED', entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id) });
  res.json(updated);
}));

export default router;
